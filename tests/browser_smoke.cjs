// Browser smoke test: loads the app in Edge, exercises every page and saves screenshots.
//   node tests/browser_smoke.cjs <node_modules dir> <url> <screenshot dir>
const path = require("path");
const { chromium } = require(path.join(process.argv[2], "playwright-core"));
const url = process.argv[3];
const shots = process.argv[4];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !/nominatim|fonts\.g/.test(m.text())) errors.push(m.text()); });
  };
  watch(page);
  page.on("dialog", (d) => d.accept("Test profile"));
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForSelector("#status.ready", { timeout: 120000 });
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}*,*::before,*::after{transition:none!important;animation-duration:0s!important}" });
  console.log("engine ready ms", Date.now() - t0, await page.textContent("#status-text"));
  const shot = (name, full) => page.screenshot({ path: path.join(shots, name + ".png"), fullPage: !!full });
  const idle = (form) => page.waitForFunction((f) => { const b = document.querySelector(`#${f} button[type=submit]`); return b && !b.disabled; }, form, { timeout: 120000 });
  const go = (tab) => page.evaluate((t) => showTab(t), tab);
  async function submit(tab, form, outSel, setup) {
    await go(tab);
    await page.waitForTimeout(150);
    await idle(form);
    if (setup) await setup();
    const t = Date.now();
    await page.click(`#${form} button[type=submit]`);
    await page.waitForTimeout(100);
    await idle(form);
    const out = "#" + form.replace("-form", "-out");
    await page.waitForSelector(`${outSel}, ${out} .error-box`, { timeout: 120000 });
    const hint = await page.$eval(`#${form} .hint[id]`, (e) => e.textContent).catch(() => "");
    const err = await page.$(`${out} .error-box`);
    console.log(`[${tab}] ${Date.now() - t} ms \u00b7 ${hint}${err ? " \u00b7 ERROR " + (await err.textContent()) : ""}`);
  }

  // dashboard
  await page.waitForSelector("#today-rows .tr-row", { timeout: 60000 });
  await page.waitForSelector("#dash-fest .fc", { timeout: 60000 });
  console.log("today:", (await page.$$eval("#today-rows .tr-row", (r) => r.map((x) => x.innerText.replace(/\s+/g, " ")))).join(" | "));
  await page.waitForTimeout(400);
  await shot("dashboard");
  await shot("dashboard_full", true);

  // birth chart (auto-calculates on first visit)
  await go("chart");
  await page.waitForSelector("#chart-visual svg.kundali, #chart-out .error-box", { timeout: 60000 });
  await idle("chart-form");
  (await page.$$eval("#chart-out .stat", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ")))).forEach((s) => console.log("   ", s));
  await shot("chart");
  for (const sub of ["bhava", "jaimini", "upagraha", "tech"]) await page.click(`#chart-sub button[data-sub="${sub}"]`);
  await page.click('#chart-sub button[data-sub="overview"]');
  await page.click("#chart-form .save-profile");
  await page.click('#tab-chart .style-toggle button[data-style="south"]');
  await shot("chart_south");
  await page.click('#tab-chart .style-toggle button[data-style="north"]');
  await page.selectOption("#chart-varga", "D9");
  await page.selectOption("#chart-varga", "D1");

  // dashas
  await go("dashas");
  await page.waitForSelector("#dashas-out .cur-row");
  console.log("dasha now:", (await page.$$eval("#dashas-out .cur-row b", (r) => r.map((x) => x.textContent))).join(" > "));
  await shot("dashas");
  for (const sys of ["chara", "yogini", "ashtottari"]) {
    await page.click(`#dasha-sys button[data-sys="${sys}"]`);
    await page.waitForSelector("#dashas-out .cur-row");
    console.log(`   ${sys}:`, (await page.$$eval("#dashas-out .cur-row b", (r) => r.map((x) => x.textContent))).join(" > "));
  }
  await shot("dashas_ashtottari");
  await page.click('#dasha-sys button[data-sys="vimshottari"]');
  for (const v of ["detail", "antar", "timeline"]) await page.click(`#dashas-out .tool[data-view="${v}"]`);

  // vargas & yogas
  await go("vargas");
  await page.waitForSelector("#vargas-out .varga-grid");
  await shot("vargas");
  await page.click('#varga-tabs button[data-v="other"]');
  await go("yogas");
  for (const y of ["yogas", "doshas", "shadbala", "av"]) { await page.click(`#yoga-tabs button[data-y="${y}"]`); if (y === "shadbala") await shot("yogas_shadbala"); }
  await page.click('#yoga-tabs button[data-y="yogas"]');
  await shot("yogas");

  // panchanga
  await submit("panchanga", "panch-form", "#panch-out .pl-row", () => page.fill("#panch-form [name=date]", "2027-01-08"));
  await page.waitForSelector("#panch-upcoming .fl-row, #panch-upcoming .fest-today, #panch-upcoming p", { timeout: 60000 });
  await shot("panchanga");
  await shot("panchanga_full", true);

  await submit("calendar", "cal-form", "#cal-out .cal-cell[data-date]", () => page.fill("#cal-form [name=month]", "2027-10"));
  await page.click('#cal-out .cal-cell[data-date="2027-10-29"]');
  await shot("calendar", true);

  await submit("festivals", "fest-form", "#fest-out table", () => page.fill("#fest-form [name=year]", "2027"));
  (await page.$$eval("#fest-out tr", (rows) => rows.map((r) => r.innerText.replace(/\s+/g, " ")).filter((s) => /Deepavali|Ugadi|Vinayaka/.test(s)))).forEach((s) => console.log("   ", s.slice(0, 110)));
  await shot("festivals");

  await submit("search", "search-form", "#search-out table", async () => {
    await page.fill("#search-form [name=start]", "2027-01-01");
    await page.fill("#search-form [name=end]", "2027-03-31");
  });
  await shot("search");

  // transits (auto-fills from the saved profile)
  await go("transits");
  await page.waitForSelector("#transit-out .wheel, #transit-out .error-box", { timeout: 90000 });
  await idle("transit-form");
  await shot("transits");
  await page.click('#transit-mode button:nth-child(2)');
  await page.waitForSelector("#transit-year .ev-row", { timeout: 90000 });
  console.log("transit year events:", await page.$$eval("#transit-year .ev-row", (r) => r.length));
  await shot("transits_year");
  await page.click('#transit-mode button[data-m="current"]');

  await submit("match", "match-form", "#match-out .stat", async () => {
    await page.selectOption('#match-form .profile-pick[data-prefix="g_"]', "0");
    await page.fill("#match-form [name=b_date]", "2000-03-15");
    await page.fill("#match-form [name=b_time]", "07:30:00");
  });
  await shot("match");

  await submit("muhurta", "muhurta-form", "#muhurta-out table", async () => {
    await page.selectOption("#muhurta-form [name=activity]", "griha_pravesha");
    await page.fill("#muhurta-form [name=start]", "2027-01-01");
    await page.fill("#muhurta-form [name=end]", "2027-03-31");
  });
  await shot("muhurta");

  await submit("eclipses", "eclipse-form", "#eclipse-out .eclipse", async () => {
    await page.fill("#eclipse-form [name=start]", "2026-01-01");
    await page.fill("#eclipse-form [name=end]", "2030-12-31");
  });
  await shot("eclipses");

  // reports: the birth-chart report opens in a new window
  await go("reports");
  await shot("reports");
  const [pop] = await Promise.all([ctx.waitForEvent("page"), page.click('#report-list [data-report="chart"]')]);
  watch(pop);
  await pop.waitForSelector(".rep-body section", { timeout: 60000 });
  await pop.screenshot({ path: path.join(shots, "report_chart.png"), fullPage: true });
  await pop.close();

  // saved charts, settings, search, notifications
  await go("profiles");
  await shot("profiles");
  await go("settings");
  await shot("settings");
  for (const s of ["look", "loc", "data"]) await page.click(`#set-tabs button[data-s="${s}"]`);
  await page.click('#set-tabs button[data-s="look"]');
  await page.selectOption('#settings-form [name=theme]', "dark");
  await page.click('#settings-form button[type=submit]');
  await go("dashboard");
  await shot("dashboard_dark");
  await go("chart");
  await shot("chart_dark");
  await go("settings");
  await page.selectOption('#settings-form [name=theme]', "light");
  await page.click('#settings-form button[type=submit]');
  await go("dashboard");
  await page.click("#gsearch");
  await page.fill("#gsearch", "hyd");
  await shot("search_popup");
  await page.keyboard.press("Escape");
  await page.click("#bell-btn");
  await shot("notifications");
  await page.click("#bell-btn");

  // language switch re-renders existing results
  await page.click("#avatar-btn");
  await page.selectOption("#lang-select", "te");
  await go("calendar");
  await shot("calendar_te");
  await page.evaluate(() => setLang("hi"));
  await go("panchanga");
  await shot("panchanga_hi");
  await page.evaluate(() => setLang("en"));

  // phone layout
  await page.setViewportSize({ width: 390, height: 844 });
  await go("dashboard");
  await shot("mobile_dashboard");
  await go("chart");
  await shot("mobile_chart");
  await page.click("#mob-menu");
  await shot("mobile_menu");

  console.log("errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
