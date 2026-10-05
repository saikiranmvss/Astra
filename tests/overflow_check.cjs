// Layout audit: visits every page at the given widths and reports elements that spill outside
// their card / section or make the page scroll sideways.
//   node tests/overflow_check.cjs <node_modules dir> <url> <screenshot dir> [widths, e.g. 390,768,1280]
const path = require("path");
const { chromium } = require(path.join(process.argv[2], "playwright-core"));
const url = process.argv[3], shots = process.argv[4];
const widths = (process.argv[5] || "390,768").split(",").map(Number);

const TABS = ["dashboard", "chart", "dashas", "transits", "panchanga", "calendar", "festivals", "search", "muhurta", "vargas", "yogas", "match", "eclipses", "reports", "profiles", "settings", "method"];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept("Audit"));
  await page.goto(url);
  await page.waitForSelector("#status.ready", { timeout: 120000 });
  await page.waitForSelector("#dash-today .now-strip", { timeout: 120000 });
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation-duration:0s!important}" });
  const idle = () => page.waitForFunction(() => [...document.querySelectorAll("form button[type=submit]")].every((b) => !b.disabled), null, { timeout: 120000 });
  // produce results on every page once (desktop), so the audit sees real tables
  await page.evaluate(() => { showTab("chart"); });
  await page.waitForSelector("#chart-visual svg", { timeout: 60000 });
  await idle();
  await page.click("#chart-form .save-profile").catch(() => {});
  for (const t of TABS) {
    await page.evaluate((x) => showTab(x), t);
    await page.waitForTimeout(250);
    await idle();
    const f = await page.$(`#tab-${t} form.form button[type=submit]`);
    const hasOut = await page.evaluate((x) => { const o = document.querySelector(`#tab-${x} [id$="-out"]`); return !o || o.children.length > 0; }, t);
    if (f && !hasOut && t !== "settings" && t !== "match") { await f.click(); await page.waitForTimeout(150); await idle(); }
  }
  await page.evaluate(() => showTab("match"));
  await page.selectOption('#match-form .profile-pick[data-prefix="g_"]', "0").catch(() => {});
  await page.fill("#match-form [name=b_date]", "2000-03-15");
  await page.click("#match-form button[type=submit]");
  await page.waitForTimeout(150); await idle();

  let total = 0;
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    for (const t of TABS) {
      await page.evaluate((x) => showTab(x), t);
      await page.waitForTimeout(300);
      const subs = { chart: ["bhava", "jaimini", "upagraha", "tech"], yogas: ["doshas", "shadbala", "av"], dashas: [] };
      const views = [null, ...((subs[t]) || [])];
      for (const v of views) {
        if (v && t === "chart") await page.click(`#chart-sub button[data-sub="${v}"]`).catch(() => {});
        if (v && t === "yogas") await page.click(`#yoga-tabs button[data-y="${v}"]`).catch(() => {});
        await page.waitForTimeout(150);
        const res = await page.evaluate(() => {
          const out = [];
          const vw = document.documentElement.clientWidth;
          const sec = document.querySelector(".page.on, .page.active, section.page:not([hidden])");
          const root = [...document.querySelectorAll("section.page")].find((s) => s.offsetParent !== null) || document.body;
          const desc = (el) => {
            let s = el.tagName.toLowerCase();
            if (el.id) s += "#" + el.id;
            if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\s+/).slice(0, 3).join(".");
            return s;
          };
          const scrollerOf = (el) => {
            for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
              const cs = getComputedStyle(p);
              if (/(auto|scroll|hidden)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return p;
            }
            return null;
          };
          if (document.documentElement.scrollWidth > vw + 1) out.push(`PAGE scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
          const seen = new Set();
          for (const el of root.querySelectorAll("*")) {
            if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.position === "fixed") continue;
            const box = el.parentElement && el.parentElement.closest(".card, .now-strip, .nb, .dr-sec, .pers-b, .stat, .fc, .cal-cell, .tl, .sl-box, .feat, .quick, .mini-feat");
            if (!box) { if (r.right > vw + 1) out.push(`${desc(el)} beyond viewport by ${Math.round(r.right - vw)}px`); continue; }
            if (scrollerOf(el)) continue;
            const b = box.getBoundingClientRect();
            const over = Math.round(r.right - b.right);
            if (over > 2 && !seen.has(box)) {
              seen.add(box);
              out.push(`${desc(el)} overflows ${desc(box)} by ${over}px  "${(el.innerText || "").replace(/\s+/g, " ").slice(0, 50)}"`);
            }
          }
          return out;
        });
        if (res.length) {
          total += res.length;
          console.log(`\n[${w}px] ${t}${v ? "/" + v : ""}:`);
          res.slice(0, 14).forEach((x) => console.log("   " + x));
          if (res.length > 14) console.log(`   ... ${res.length - 14} more`);
        }
      }
      if (shots) await page.screenshot({ path: path.join(shots, `ov_${w}_${t}.png`), fullPage: true });
      if (t === "chart") await page.click('#chart-sub button[data-sub="overview"]').catch(() => {});
      if (t === "yogas") await page.click('#yoga-tabs button[data-y="yogas"]').catch(() => {});
    }
    // drawer
    await page.evaluate(() => showTab("dashboard"));
    await page.click("#today-btn");
    await page.waitForTimeout(300);
    const d = await page.evaluate(() => {
      const dr = document.getElementById("today-drawer").getBoundingClientRect();
      return [...document.querySelectorAll("#today-drawer *")].filter((e) => !e.closest("svg")).map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.right > dr.right + 1).slice(0, 5).map(([e, r]) => `${e.tagName}.${e.className} +${Math.round(r.right - dr.right)}`);
    });
    if (d.length) console.log(`\n[${w}px] drawer:`, d);
    await page.click("#td-close");
  }
  console.log(`\nissues: ${total}`, errors.length ? errors : "");
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
