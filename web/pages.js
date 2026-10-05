"use strict";
/* Shell and chart-driven pages: sidebar, global search, notifications, dashboard,
   dashas, vargas, yogas & strength, reports, settings. Depends on app.js / tabs.js. */

/* ---------- sidebar & popovers ---------- */
const appEl = document.getElementById("app");
if (store.get("sideMini", false)) appEl.classList.add("side-mini");
document.getElementById("side-toggle").addEventListener("click", () => {
  if (window.innerWidth <= 900) { appEl.classList.remove("side-open"); return; }
  appEl.classList.toggle("side-mini");
  store.set("sideMini", appEl.classList.contains("side-mini"));
});
document.getElementById("mob-menu").addEventListener("click", () => appEl.classList.add("side-open"));
document.getElementById("scrim").addEventListener("click", () => appEl.classList.remove("side-open"));
function togglePop(id) {
  const p = document.getElementById(id);
  const open = p.hidden;
  closePops();
  p.hidden = !open;
  return !p.hidden;
}
document.getElementById("avatar-btn").addEventListener("click", (e) => { e.stopPropagation(); togglePop("avatar-pop"); });
document.getElementById("bell-btn").addEventListener("click", (e) => { e.stopPropagation(); if (togglePop("bell-pop")) renderBell(true); });
document.addEventListener("click", (e) => { if (!e.target.closest(".pop, #avatar-btn, #bell-btn, .gsearch")) closePops(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePops();
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); gsInput.focus(); }
});
document.getElementById("explore-btn").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("features").scrollIntoView({ behavior: "smooth", block: "center" });
});

/* ---------- global search ---------- */
const PAGES = [
  ["dashboard", "Dashboard", "home today overview", "dashboard"], ["chart", "Birth Chart", "kundali rasi horoscope jataka lagna planets name letter namakshara baby name syllable", "chart"],
  ["dashas", "Dashas", "vimshottari yogini ashtottari chara periods mahadasha antardasha", "dashas"],
  ["vargas", "Vargas", "divisional navamsha d9 dashamsha d10 d60", "vargas"], ["yogas", "Yogas & Strength", "doshas shadbala ashtakavarga raja yoga kuja", "yogas"],
  ["transits", "Transits", "gochara sade sati saturn ingress chandrashtama", "transits"], ["match", "Matching", "compatibility ashtakoota porutham marriage compare", "match"],
  ["panchanga", "Daily Panchanga", "tithi nakshatra yoga karana rahu kala sunrise name letters today moudhyami", "panchanga"], ["calendar", "Monthly Calendar", "month calendar panchanga", "panchanga"],
  ["festivals", "Festivals (Yearly)", "festival ekadashi vrata sankranti jayanti", "festival"], ["muhurta", "Muhurta", "auspicious time marriage griha pravesha vehicle", "muhurta"],
  ["eclipses", "Eclipses", "grahana solar lunar", "eclipse"], ["search", "Event Search", "find events ingress retrograde station conjunction", "search"],
  ["reports", "Reports", "pdf print report", "reports"], ["profiles", "Saved Charts", "profiles people places", "saved"],
  ["settings", "Settings", "ayanamsa theme language default place", "settings"], ["method", "Method", "how accuracy validation", "method"],
];
const gsInput = document.getElementById("gsearch"), gsPop = document.getElementById("gs-pop");
let gsItems = [], gsActive = 0;
function gsRender() {
  const q = gsInput.value.trim().toLowerCase();
  const groups = [["Pages", []], ["Saved charts", []], ["Places", []]];
  PAGES.forEach(([tab, title, kw, icon]) => { if (!q || (title + " " + kw).toLowerCase().includes(q)) groups[0][1].push({ icon, label: title, sub: "Open page", run: () => showTab(tab) }); });
  profiles().forEach((p) => { if (!q || p.name.toLowerCase().includes(q)) groups[1][1].push({ icon: "user", label: p.name, sub: p.date + " \u00b7 " + (p.place || p.coords), run: () => openProfileChart(p) }); });
  if (q.length >= 2) localPlaceMatches(q).forEach((pl) => groups[2][1].push({ icon: "pin", label: pl.label, sub: "Panchanga for this place", run: () => openPanchangaAt(pl) }));
  gsItems = [];
  let html = "";
  for (const [name, list] of groups) {
    const top = list.slice(0, name === "Pages" ? (q ? 6 : 5) : 5);
    if (!top.length) continue;
    html += `<div class="gs-group">${name}</div>` + top.map((it) => { gsItems.push(it); const i = gsItems.length - 1;
      return `<button type="button" class="gs-i${i === gsActive ? " on" : ""}" data-i="${i}">${ico(it.icon)}<span><b>${esc(it.label)}</b><small>${esc(it.sub)}</small></span></button>`; }).join("");
  }
  gsPop.innerHTML = html || '<div class="gs-empty">Nothing found</div>';
  gsPop.hidden = false;
}
function gsRun(i) { const it = gsItems[i]; if (!it) return; gsInput.value = ""; gsPop.hidden = true; gsInput.blur(); it.run(); }
gsInput.addEventListener("focus", () => { gsActive = 0; gsRender(); });
gsInput.addEventListener("input", () => { gsActive = 0; gsRender(); });
gsInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); gsActive = (gsActive + (e.key === "ArrowDown" ? 1 : -1) + gsItems.length) % Math.max(1, gsItems.length); gsRender(); }
  else if (e.key === "Enter") { e.preventDefault(); gsRun(gsActive); }
  else if (e.key === "Escape") { gsPop.hidden = true; gsInput.blur(); }
});
gsPop.addEventListener("mousedown", (e) => e.preventDefault());
gsPop.addEventListener("click", (e) => { const b = e.target.closest(".gs-i"); if (b) gsRun(+b.dataset.i); });
function openPanchangaAt(pl) {
  setPlace(panchForm, "", { name: pl.label, coords: pl.coords, tz: pl.tz });
  showTab("panchanga");
  panchForm.requestSubmit();
}

/* ---------- dashboard ---------- */
const dashData = { panch: null, upcoming: null, eclipses: null, place: null };
async function loadDashboard() {
  const p = defaultPlace();
  dashData.place = p;
  const date = todayIso();
  document.getElementById("today-date").textContent = longDate(date);
  document.getElementById("today-place").textContent = p.name || p.coords;
  let lat, lon;
  try { ({ lat, lon } = parseCoords(p.coords)); } catch (e) { return; }
  const base = { lat, lon };
  try {
    const r = await call("panchanga", Object.assign({ date, tz_minutes: tzOffsetMinutes(p.tz, date, "12:00:00") }, base, calc()));
    dashData.panch = r;
    renderToday(r);
    renderDashTimings(r);
  } catch (e) {
    document.getElementById("today-rows").innerHTML = `<div class="today-wait">${esc(e.message)}</div>`;
  }
  try { await loadToday(true); } catch (e) { console.error(e); }
  try {
    const u = await call("upcoming", Object.assign({ start: date, days: 45 }, base, tzRange(p.tz, date, addDays(date, 45)), calc()));
    dashData.upcoming = u;
    renderDashFest(u);
  } catch (e) { document.querySelector("#dash-fest .skeleton").outerHTML = '<p class="hint">Could not list festivals.</p>'; }
  updateBell();
  try {
    const end = addDays(date, 730);
    dashData.eclipses = await call("eclipses", Object.assign({ start: date, end, kinds: ["solar", "lunar"] }, base, tzRange(p.tz, date, end), calc()));
  } catch (e) { dashData.eclipses = null; }
  updateBell();
}
function renderToday(r) {
  const ref = nowLocalIso(r.tz_minutes);
  const ti = currentOf(r.tithi, ref), nk = currentOf(r.nakshatra, ref), yo = currentOf(r.yoga, ref), ka = currentOf(r.karana, ref);
  const row = (cls, icon, k, v, till) => `<div class="tr-row"><span class="tr-ico ${cls}">${icon}</span><span class="tr-kv"><small>${k}</small><b>${v}</b></span><span class="tr-till">till ${tmRel(till, r.date)}</span></div>`;
  document.getElementById("today-rows").innerHTML =
    row("c-ti", moonSVG(ti.index || 1, 20), t("Tithi"), esc(trTithi(ti.paksha, ti.name)), ti.end) +
    row("c-nak", ico("star"), t("Nakshatra"), esc(tr("nakshatra", nk.name)), nk.end) +
    row("c-yoga", ico("yogas"), t("Yoga"), esc(tr("yoga", yo.name)), yo.end) +
    row("c-kar", ico("dashboard"), t("Karana"), esc(tr("karana", ka.name)), ka.end);
}
function renderDashTimings(r) {
  const m = r.muhurta || {};
  const w = (x) => (x && x.start ? `${hm(x.start)} \u2013 ${hm(x.end)}` : "\u2014");
  const item = (cls, k, v) => `<div class="tm-row"><span class="tm-dot ${cls}"></span><span>${k}</span><b>${v}</b></div>`;
  document.getElementById("dash-timings").innerHTML = `<div class="card-head"><h3>Today\u2019s timings</h3><a class="link" href="#panchanga" data-tab-link="panchanga">Full Panchanga</a></div>
    <div class="sun-strip"><span>${ico("sunrise")}${hm(r.sunrise)}</span><span>${ico("sunset")}${hm(r.sunset)}</span><span>${ico("moonrise")}${tmRel(r.moonrise, r.date)}</span></div>
    ${dayTimeline(r, true)}
    <div class="tm-list">
      ${item("bad", t("Rahu kala"), w(m.rahu_kala))}${item("bad", t("Yamaganda"), w(m.yamaganda))}${item("bad", t("Gulika"), w(m.gulika_kala))}
      ${item("good", t("Abhijit"), w(m.abhijit))}${item("good", t("Amrita kala"), (m.amrita_kala || []).map(w).join(", ") || "\u2014")}${item("good", "Brahma muhurta", w(m.brahma_muhurta))}
    </div>`;
}
function renderDashFest(u) {
  const list = u.festivals.filter((f) => f.category !== "vrata" || /Shivaratri|Pradosha/.test(f.name)).slice(0, 7);
  document.getElementById("dash-fest").innerHTML = `<div class="card-head"><h3>Upcoming festivals</h3><a class="link" href="#festivals" data-tab-link="festivals">Year view</a></div>
    ${list.length ? `<div class="fest-cards">${list.map((f) => `<div class="fc"><span class="fc-date"><b>${+f.date.slice(8)}</b><small>${esc(dateLabel(f.date, { day: undefined, year: undefined, month: "short" }))}</small></span>
      <span class="fc-body"><b>${esc(trFest(f))}</b><small><span class="dotc cat-${esc(f.category)}"></span>${esc(varaShort(f.weekday))} \u00b7 ${esc(f.category)}</small></span></div>`).join("")}</div>` : '<p class="hint">No festivals in the next 45 days.</p>'}`;
}
function renderDashSaved() {
  const el = document.querySelector("#dash-saved .dash-saved-list");
  const pl = profiles();
  el.innerHTML = pl.length ? pl.slice(-5).reverse().map((p) => `<button type="button" class="saved-row" data-name="${esc(p.name)}"><span class="pc-av sm">${esc(p.name.slice(0, 1).toUpperCase())}</span><span><b>${esc(p.name)}</b><small>${esc(dateLabel(p.date))} \u00b7 ${esc(p.place || p.coords)}</small></span>${ico("right", "chev")}</button>`).join("")
    : `<div class="empty-inline">${ico("saved")}<div><b>No saved charts yet</b><small>Your charts appear here for one-click access.</small></div></div><a class="btn primary block" href="#chart" data-tab-link="chart">${ico("plus")}Create New Chart</a>`;
}
document.getElementById("dash-saved").addEventListener("click", (e) => {
  const b = e.target.closest(".saved-row");
  if (!b) return;
  const p = profiles().find((x) => x.name === b.dataset.name);
  if (p) openProfileChart(p);
});
rerender.dashboard = () => { if (dashData.panch) { renderToday(dashData.panch); renderDashTimings(dashData.panch); } if (dashData.upcoming) renderDashFest(dashData.upcoming); renderTodayAll(); };

/* ---------- notifications ---------- */
function bellItems() {
  const out = [];
  const r = dashData.panch, today = todayIso();
  if (r && r.muhurta && r.muhurta.rahu_kala) {
    const nowIso = nowLocalIso(r.tz_minutes), rk = r.muhurta.rahu_kala;
    const state = nowIso < rk.start ? "today" : nowIso < rk.end ? "now" : "was";
    out.push({ icon: "info", cls: "bad", title: `${t("Rahu kala")} ${state === "now" ? "is on now" : state === "was" ? "has passed today" : "today"}`, sub: `${hm(rk.start)} \u2013 ${hm(rk.end)} \u00b7 ${dashData.place.name || ""}`, go: "panchanga" });
    if (r.muhurta.abhijit) out.push({ icon: "sun", cls: "good", title: `${t("Abhijit")} muhurta`, sub: `${hm(r.muhurta.abhijit.start)} \u2013 ${hm(r.muhurta.abhijit.end)}`, go: "panchanga" });
  }
  if (typeof todayData !== "undefined" && todayData) {
    const md = todayData.moudhya.status;
    ["Jupiter", "Venus"].forEach((b) => {
      const s = md[b];
      if (s.combust && s.current) out.push({ icon: "eclipse", cls: "bad", title: `${s.name} is on`, sub: `Ceremonies postponed until ${s.current.end ? dateLabel(s.current.end) : "\u2026"}`, go: "muhurta" });
      else if (s.next && s.next.start <= addDays(today, 30)) out.push({ icon: "eclipse", cls: "ecl", title: `${s.name} starts ${dateLabel(s.next.start)}`, sub: `Until ${dateLabel(s.next.end)} \u00b7 ${Math.round(s.next.days)} days`, go: "muhurta" });
    });
    const gen = todayData.muhurta.by_activity.find((x) => x.activity === "general");
    if (gen && gen.next) out.push({ icon: "muhurta", cls: "good", title: "Next auspicious muhurta", sub: `${dateLabel(gen.next.date)} ${hm(gen.next.start)} \u2013 ${hm(gen.next.end)}`, go: "dashboard" });
  }
  if (dashData.upcoming) {
    const soon = dashData.upcoming.festivals.filter((f) => f.date >= today && f.date <= addDays(today, 7) && f.category !== "vrata").slice(0, 4);
    soon.forEach((f) => {
      const days = Math.round((Date.parse(f.date) - Date.parse(today)) / 86400000);
      out.push({ icon: "festival", cls: "fest", title: trFest(f), sub: days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days \u00b7 ${dateLabel(f.date)}`, go: "festivals" });
    });
  }
  if (dashData.eclipses && dashData.eclipses.eclipses.length) {
    const vis = (e) => e.type === "lunar" ? e.visible_any : e.local && e.local.visible;
    const e = dashData.eclipses.eclipses.find(vis) || dashData.eclipses.eclipses[0];
    out.push({ icon: "eclipse", cls: "ecl", title: `Next ${vis(e) ? "visible " : ""}eclipse: ${e.kind} ${e.type}`, sub: dt(e.max) + (vis(e) ? " \u00b7 visible here" : " \u00b7 not visible here"), go: "eclipses" });
  }
  return out;
}
function updateBell() {
  const items = bellItems();
  const sig = todayIso() + ":" + items.map((i) => i.title).join("|");
  const badge = document.getElementById("bell-badge");
  badge.hidden = !items.length || store.get("bellSeen", "") === sig;
  badge.textContent = items.length;
  return sig;
}
function renderBell(markSeen) {
  const items = bellItems();
  document.getElementById("bell-pop").innerHTML = `<div class="pop-title">Notifications</div>` + (items.length ? items.map((i) => `<a class="bell-i" href="#${i.go}" data-tab-link="${i.go}"><span class="bi-ico ${i.cls}">${ico(i.icon)}</span><span><b>${esc(i.title)}</b><small>${esc(i.sub)}</small></span></a>`).join("")
    : '<div class="gs-empty">Calculating today\u2019s sky\u2026</div>');
  if (markSeen) { store.set("bellSeen", updateBell()); document.getElementById("bell-badge").hidden = true; }
}

/* ---------- chart source (dashas / vargas / yogas) ---------- */
let chartPromise = null;
function ensureChart() {
  if (lastChart) return Promise.resolve(lastChart);
  if (!chartPromise) chartPromise = chartForm.run().finally(() => { chartPromise = null; });
  return chartPromise;
}
function chartSourceHTML() {
  const r = lastChart;
  return `<div class="src"><span class="pc-av sm">${esc(((r && r.input.name) || "C").slice(0, 1).toUpperCase())}</span><span class="src-t">${r ? `<b>${esc(r.input.name || "Current chart")}</b><small>${esc(dateLabel(r.input.date))} ${esc(r.input.time.slice(0, 5))}</small>` : "<b>Loading chart\u2026</b><small>&nbsp;</small>"}</span>
    <select class="src-pick sel-sm" aria-label="Switch chart">${profileOptions().replace("Choose a saved chart\u2026", "Switch chart\u2026")}</select>
    <button type="button" class="icon-btn sm" data-go="chart" title="Edit birth details">${ico("edit")}</button></div>`;
}
function refreshChartSources() { $$(".chart-source").forEach((el) => { el.innerHTML = chartSourceHTML(); }); }
document.addEventListener("change", (ev) => {
  if (!ev.target.classList.contains("src-pick") || ev.target.value === "") return;
  const p = profiles()[+ev.target.value];
  if (!p) return;
  fillProfile(chartForm, "", p);
  ["dashas-out", "vargas-out", "yogas-out"].forEach((id) => document.getElementById(id).classList.add("out-busy"));
  chartForm.run().finally(() => ["dashas-out", "vargas-out", "yogas-out"].forEach((id) => document.getElementById(id).classList.remove("out-busy")));
});
function chartChanged() {
  refreshChartSources();
  renderDashas(); renderVargas(); renderYogas();
}
function needChart(outId) {
  if (lastChart) return false;
  document.getElementById(outId).innerHTML = `<div class="card"><div class="skeleton tall"></div></div>`;
  ensureChart();
  return true;
}

/* ---------- dashas ---------- */
let dashaSys = "vimshottari", dashaView = "timeline", dashaSel = null;
const VIM = [["Ketu", 7], ["Venus", 20], ["Sun", 6], ["Moon", 10], ["Mars", 7], ["Rahu", 18], ["Jupiter", 16], ["Saturn", 19], ["Mercury", 17]];
const isoMs = (iso) => Date.parse(iso + "Z");
const msIso = (ms) => new Date(ms).toISOString().slice(0, 19);
function vimSub(lord, s0, e0) {
  const i = VIM.findIndex((x) => x[0] === lord);
  const out = [];
  let s = s0;
  for (let j = 0; j < 9; j++) { const [l, y] = VIM[(i + j) % 9]; const e = s + (e0 - s0) * y / 120; out.push({ lord: l, start: msIso(s), end: msIso(e) }); s = e; }
  return out;
}
const SIGN_SHORT = (s) => esc(tr("rashi", s)).slice(0, LANG === "en" ? 3 : 4);
const signBadge = (s) => `<span class="pdot-i sign">${SIGN_SHORT(s)}</span>`;
/* a common shape for every system: mahas [{key, label, icon, start, end, years, current, sub:[...]}], levels [...] */
function dashaModel(r, sys) {
  const nowMs = Date.now() + r.input.tz_minutes * 60000;
  const nowIso = msIso(nowMs);
  const cur = (n) => n.start <= nowIso && nowIso < n.end;
  if (sys === "chara") {
    const cd = r.chara_dasha;
    const mahas = cd.dashas.map((d) => ({ key: d.sign, label: tr("rashi", d.sign), icon: signBadge(d.sign), start: d.start, end: d.end, years: d.years, current: d.current,
      sub: d.sub.map((s) => ({ key: s.sign, label: tr("rashi", s.sign), icon: signBadge(s.sign), start: s.start, end: s.end, current: s.current })) }));
    return { title: "Chara dasha (Jaimini)", info: `${cd.profile} \u00b7 ${cd.direction} order (9th sign ${tr("rashi", cd.ninth_sign)})`, mahas, levelNames: ["Maha", "Antar"], nowIso, nowMs };
  }
  if (sys === "yogini" || sys === "ashtottari") {
    const d = sys === "yogini" ? r.yogini_dasha : r.ashtottari_dasha;
    const lab = (x) => sys === "yogini" ? `${x.name} (${tr("graha", x.lord)})` : tr("graha", x.lord);
    const mahas = d.mahadashas.map((m) => ({ key: m.lord, label: lab(m), icon: pdot(m.lord), start: m.start, end: m.end, years: m.years, current: m.current,
      sub: m.sub.map((s) => ({ key: s.lord, label: lab(s), icon: pdot(s.lord), start: s.start, end: s.end, current: s.current })) }));
    return { title: d.system + " dasha", info: `${d.cycle_years}-year cycle \u00b7 starts with ${d.starting} from ${tr("nakshatra", d.birth_nakshatra)} \u00b7 balance ${d.balance_years.toFixed(3)} y \u00b7 ${d.rule}`, mahas, levelNames: ["Maha", "Antar"], nowIso, nowMs };
  }
  const v = r.dasha;
  const mk = (n) => ({ key: n.lord, label: tr("graha", n.lord), icon: pdot(n.lord), start: n.start, end: n.end, years: n.years, current: n.current, sub: n.sub ? n.sub.map(mk) : null });
  const mahas = v.mahadashas.map(mk);
  return { title: "Vimshottari dasha", info: `Starts from ${tr("nakshatra", v.birth_nakshatra)} (lord ${tr("graha", v.starting_lord)}) \u00b7 balance ${v.balance_years.toFixed(4)} y \u00b7 year = ${v.year_length_days} days`,
    mahas, levelNames: ["Maha", "Antar", "Pratyantar", "Sukshma", "Prana"], nowIso, nowMs, cur };
}
function currentChain(model, sys) {
  const chain = [];
  let list = model.mahas;
  while (list) {
    const n = list.find((x) => x.start <= model.nowIso && model.nowIso < x.end) || list.find((x) => x.current);
    if (!n) break;
    chain.push(n);
    list = n.sub;
  }
  /* Vimshottari: extend to Sukshma and Prana with the same proportions */
  if (sys === "vimshottari" && chain.length === 3) {
    for (let lvl = 3; lvl < 5; lvl++) {
      const p = chain[chain.length - 1];
      const subs = vimSub(p.key, isoMs(p.start), isoMs(p.end));
      const n = subs.find((x) => x.start <= model.nowIso && model.nowIso < x.end);
      if (!n) break;
      chain.push({ key: n.lord, label: tr("graha", n.lord), icon: pdot(n.lord), start: n.start, end: n.end });
    }
  }
  return chain;
}
const fmtRange = (n, withTime) => withTime ? `${dt(n.start)} \u2013 ${dt(n.end)}` : `${dateLabel(n.start)} \u2013 ${dateLabel(n.end)}`;
function renderDashas() {
  const out = document.getElementById("dashas-out");
  if (needChart("dashas-out")) return;
  const r = lastChart, model = dashaModel(r, dashaSys);
  const chain = currentChain(model, dashaSys);
  if (!dashaSel || !model.mahas.find((m) => m.start === dashaSel)) dashaSel = (chain[0] || model.mahas[0]).start;
  const selMaha = model.mahas.find((m) => m.start === dashaSel);
  const lvlName = (i) => model.levelNames[i] || "Level " + (i + 1);
  out.innerHTML = `
  <div class="dasha-grid">
    <div class="card">
      <div class="card-head"><h3>Current Dasha</h3><span class="hint">${esc(dateLabel(model.nowIso))}</span></div>
      <div class="cur-list">${chain.map((n, i) => `<div class="cur-row${i === 0 ? " main" : ""}">${n.icon.replace("pdot-i", "pdot-i big")}<div><b>${esc(n.label)} ${lvlName(i)} Dasha</b><small>${fmtRange(n, i >= 2)}</small>
        ${i < 2 ? `<small class="rem">Remaining: ${span(model.nowMs, isoMs(n.end))}${i === 1 ? ` \u00b7 ${Math.max(0, Math.round((isoMs(n.end) - model.nowMs) / 86400000))} days left` : ""}</small>` : ""}</div>
        <div class="cur-bar"><span style="width:${Math.min(100, Math.max(0, (model.nowMs - isoMs(n.start)) / (isoMs(n.end) - isoMs(n.start)) * 100)).toFixed(1)}%"></span></div></div>`).join("") || '<p class="hint">Outside the computed range.</p>'}</div>
      <p class="hint">${esc(model.info)}</p>
    </div>
    <div class="card">
      <div class="card-head"><h3>${esc(model.title.replace(" dasha", ""))} Sequence</h3><span class="hint">click a period for its sub-periods</span></div>
      <div class="seq">${model.mahas.map((m) => `<button type="button" class="seq-row${m.current ? " cur" : ""}${m.start === dashaSel ? " sel" : ""}" data-start="${esc(m.start)}">${m.icon}<b>${esc(m.label)}</b><span>${esc(dateLabel(m.start))} \u2013 ${esc(dateLabel(m.end))}</span><small>${(+m.years).toFixed(m.years % 1 ? 1 : 0)} y</small></button>`).join("")}</div>
    </div>
  </div>
  <div class="tool-row">
    <button type="button" class="tool${dashaView === "timeline" ? " on" : ""}" data-view="timeline">${ico("timeline")}Dasha Timeline</button>
    <button type="button" class="tool${dashaView === "detail" ? " on" : ""}" data-view="detail">${ico("list")}Detailed Table</button>
    <button type="button" class="tool${dashaView === "antar" ? " on" : ""}" data-view="antar">${ico("table")}Antar Dasha Table</button>
    <button type="button" class="tool" data-view="export">${ico("download")}Export</button>
    <button type="button" class="tool" data-report="dasha">${ico("print")}Report</button>
  </div>
  <div class="card" id="dasha-view">${dashaViewHTML(model, selMaha)}</div>`;
  $$(".seq-row", out).forEach((b) => b.addEventListener("click", () => { dashaSel = b.dataset.start; if (dashaView === "timeline" || dashaView === "detail") dashaView = "antar"; renderDashas(); }));
  $$(".tool[data-view]", out).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.view === "export") return exportDashas(model);
    dashaView = b.dataset.view; renderDashas();
  }));
}
function dashaViewHTML(model, sel) {
  if (dashaView === "antar" && sel) {
    return `<div class="card-head"><h3>${esc(sel.label)} \u2013 sub-periods</h3><span class="hint">${fmtRange(sel)}</span></div>
      <div class="scroll"><table class="tbl"><tr><th>${model.levelNames[1]}</th><th>Start</th><th>End</th><th>Duration</th>${sel.sub && sel.sub[0] && sel.sub[0].sub ? `<th>${model.levelNames[2]}</th>` : ""}</tr>
      ${(sel.sub || []).map((s) => `<tr class="${s.current ? "cur" : ""}"><td>${s.icon}<b>${esc(s.label)}</b></td><td>${dt(s.start)}</td><td>${dt(s.end)}</td><td>${span(isoMs(s.start), isoMs(s.end))}</td>
        ${s.sub ? `<td class="small">${s.sub.map((x) => `<span class="mini-p${x.current ? " cur" : ""}" title="${esc(fmtRange(x, true))}">${esc(x.label.slice(0, 3))}</span>`).join("")}</td>` : ""}</tr>`).join("")}</table></div>`;
  }
  if (dashaView === "detail") {
    if (dashaSys === "vimshottari") return `<div class="card-head"><h3>Detailed table</h3><span class="hint">Maha \u203a Antar \u203a Pratyantar; current periods are open</span></div>${dashaTree(lastChart.dasha.mahadashas, 0)}`;
    return `<div class="card-head"><h3>Detailed table</h3></div>${model.mahas.map((m) => `<details class="dasha"${m.current ? " open" : ""}><summary><span class="lord${m.current ? " cur" : ""}">${m.icon}${esc(m.label)}</span><span class="dates">${dt(m.start)} \u2192 ${dt(m.end)}</span><span class="hint">${m.years} y</span></summary>
      <div class="inner">${m.sub.map((s) => `<div class="dasha leaf"><span class="lord${s.current ? " cur" : ""}">${esc(s.label)}</span><span class="dates">${dt(s.start)} \u2192 ${dt(s.end)}</span></div>`).join("")}</div></details>`).join("")}`;
  }
  /* timeline */
  const a = isoMs(model.mahas[0].start), b = isoMs(model.mahas[model.mahas.length - 1].end), w = b - a;
  const birth = isoMs(lastChart.input.date + "T" + lastChart.input.time);
  const pct = (ms) => ((ms - a) / w * 100).toFixed(3);
  const col = (m) => PCOLOR[m.key] || `hsl(${(EN.rashi.indexOf(m.key) * 30 + 240) % 360} 70% 62%)`;
  const sub = model.mahas.find((m) => m.start === dashaSel) || model.mahas[0];
  const sa = isoMs(sub.start), sw = isoMs(sub.end) - sa;
  return `<div class="card-head"><h3>Dasha timeline</h3><span class="hint">${esc(dateLabel(model.mahas[0].start))} \u2192 ${esc(dateLabel(model.mahas[model.mahas.length - 1].end))}</span></div>
    <div class="dt-bar">${model.mahas.map((m) => `<div class="dt-seg${m.start === dashaSel ? " sel" : ""}" style="left:${pct(isoMs(m.start))}%;width:${(isoMs(m.end) - isoMs(m.start)) / w * 100}%;--c:${col(m)}" title="${esc(m.label)} ${esc(fmtRange(m))}" data-start="${esc(m.start)}"><span>${esc(m.label.split(" ")[0].slice(0, 3))}</span></div>`).join("")}
      ${birth > a ? `<div class="dt-mark birth" style="left:${pct(birth)}%"><span>birth</span></div>` : ""}${model.nowMs > a && model.nowMs < b ? `<div class="dt-mark now" style="left:${pct(model.nowMs)}%"><span>now</span></div>` : ""}</div>
    <div class="dt-years">${model.mahas.filter((m, i) => i % 2 === 0).map((m) => `<span style="left:${pct(isoMs(m.start))}%">${m.start.slice(0, 4)}</span>`).join("")}</div>
    <h4 class="mini-title">${esc(sub.label)} \u2013 sub-periods</h4>
    <div class="dt-bar sub">${(sub.sub || []).map((s) => `<div class="dt-seg" style="left:${((isoMs(s.start) - sa) / sw * 100).toFixed(3)}%;width:${(isoMs(s.end) - isoMs(s.start)) / sw * 100}%;--c:${col(s)}" title="${esc(s.label)} ${esc(fmtRange(s))}"><span>${esc(s.label.split(" ")[0].slice(0, 3))}</span></div>`).join("")}
      ${model.nowMs > sa && model.nowMs < sa + sw ? `<div class="dt-mark now" style="left:${((model.nowMs - sa) / sw * 100).toFixed(3)}%"><span>now</span></div>` : ""}</div>
    <p class="hint">Click a period in the sequence or on the bar to see its sub-periods.</p>`;
}
document.getElementById("dashas-out").addEventListener("click", (e) => {
  const seg = e.target.closest(".dt-seg[data-start]");
  if (seg) { dashaSel = seg.dataset.start; renderDashas(); }
});
function exportDashas(model) {
  const rows = [["system", "level", "period", "start", "end", "years"]];
  model.mahas.forEach((m) => {
    rows.push([dashaSys, model.levelNames[0], m.label, m.start, m.end, m.years]);
    (m.sub || []).forEach((s) => rows.push([dashaSys, model.levelNames[1], s.label, s.start, s.end, ""]));
  });
  download(`${dashaSys}-dasha-${lastChart.input.date}.csv`, toCSV(rows), "text/csv");
}
$$("#dasha-sys button").forEach((b) => b.addEventListener("click", () => {
  dashaSys = b.dataset.sys; dashaSel = null;
  $$("#dasha-sys button").forEach((x) => x.classList.toggle("on", x === b));
  renderDashas();
}));
rerender.dashas = () => lastChart && renderDashas();

/* ---------- vargas ---------- */
let vargaSel = "D9";
function renderVargas() {
  if (needChart("vargas-out")) return;
  const r = lastChart;
  const keys = Object.keys(r.vargas);
  const sel = document.getElementById("varga-select");
  sel.innerHTML = keys.map((k) => `<option value="${k}"${k === vargaSel ? " selected" : ""}>${k} \u00b7 ${esc(r.vargas[k].name)}</option>`).join("");
  $$("#varga-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.v === vargaSel || (b.dataset.v === "other" && !["D9", "D10", "D12"].includes(vargaSel))));
  const L = r.chart.lagna;
  const minsTo = (deg) => deg / Math.abs(L.speed_deg_per_min || 0.25);
  document.getElementById("vargas-out").innerHTML = `
  <div class="varga-grid">
    <div class="card">
      <div class="card-head"><h3>${esc(vargaSel)} ${esc(r.vargas[vargaSel].name)}</h3><span class="hint">Lagna ${esc(tr("rashi", r.vargas[vargaSel].positions.Lagna.sign))}</span></div>
      <div class="chart-visual">${chartFor(r, vargaSel)}</div>
      <h4 class="mini-title">${esc(r.vargas[vargaSel].name)} Details</h4>
      ${chartDetailsTable(r, vargaSel)}
    </div>
    <div class="card other-vargas">
      <div class="card-head"><h3>Other Vargas</h3></div>
      ${keys.map((k) => `<button type="button" class="ov-row${k === vargaSel ? " on" : ""}" data-v="${k}"><b>${k}</b><span>${esc(r.vargas[k].name)}</span><small>${esc(tr("rashi", r.vargas[k].positions.Lagna.sign))}</small></button>`).join("")}
    </div>
  </div>
  <div class="card">
    <div class="card-head"><h3>All divisional charts</h3><span class="hint">Parashari rules</span></div>
    <div class="scroll"><table class="tbl varga-table">
      <tr><th></th>${keys.map((k) => `<th>${k}</th>`).join("")}</tr>
      ${ORDER.map((p) => `<tr><td><b>${abbr(p)}</b></td>${keys.map((k) => `<td>${esc(tr("rashi", r.vargas[k].positions[p].sign)).slice(0, LANG === "en" ? 4 : 6)}</td>`).join("")}</tr>`).join("")}
      <tr><td class="hint">Lagna margin</td>${keys.map((k) => {
        const m = minsTo(r.vargas[k].positions.Lagna.boundary_margin_deg);
        return `<td class="${m < 2 ? "warn" : "hint"}">${m >= 60 ? (m / 60).toFixed(1) + " h" : m.toFixed(1) + " m"}</td>`;
      }).join("")}</tr>
    </table></div>
    <p class="hint">Lagna margin = minutes of birth time before the lagna changes sign in that varga. A small margin means that varga depends on an exact birth time.</p>
  </div>`;
  $$("#vargas-out .ov-row").forEach((b) => b.addEventListener("click", () => { vargaSel = b.dataset.v; renderVargas(); }));
}
$$("#varga-tabs button").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.v === "other") { if (["D9", "D10", "D12"].includes(vargaSel)) vargaSel = "D7"; }
  else vargaSel = b.dataset.v;
  renderVargas();
}));
document.getElementById("varga-select").addEventListener("change", (e) => { vargaSel = e.target.value; renderVargas(); });
rerender.vargas = () => lastChart && renderVargas();

/* ---------- yogas & strength ---------- */
let yogaTab = "yogas";
function renderYogas() {
  if (needChart("yogas-out")) return;
  const r = lastChart, out = document.getElementById("yogas-out");
  const card = (y) => `<div class="yoga-card${y.type === "dosha" ? " dosha" : ""}"><div class="yc-head"><span class="yc-ico">${ico(y.type === "dosha" ? "info" : "yogas")}</span><b>${esc(y.name)}</b><span class="tagpill${y.type === "dosha" ? " de" : " own"}">${esc(y.type)}</span></div>
    <p>${esc(y.evidence)}</p>${y.note ? `<small>${esc(y.note)}</small>` : ""}${y.cancellation_factors && y.cancellation_factors.length ? `<div class="yc-cancel"><b>Cancellation factors</b><ul>${y.cancellation_factors.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}</div>`;
  let html = "";
  if (yogaTab === "yogas" || yogaTab === "doshas") {
    const list = r.yogas.filter((y) => (y.type === "dosha") === (yogaTab === "doshas"));
    html = `<div class="card"><div class="card-head"><h3>${yogaTab === "yogas" ? "Yogas present" : "Doshas present"}</h3><span class="hint">Traditional definitions checked on calculated positions. Only existence is reported, no predictions.</span></div>
      ${list.length ? `<div class="yoga-grid">${list.map(card).join("")}</div>` : `<div class="empty-inline">${ico("check")}<div><b>None found</b><small>${yogaTab === "doshas" ? "None of the checked doshas are present in this chart." : "None of the checked yogas are present."}</small></div></div>`}</div>`;
  } else if (yogaTab === "shadbala") {
    const sb = r.shadbala, comps = ["sthana", "dig", "kala", "cheshta", "naisargika", "drik"];
    const maxR = Math.max(...sb.ranking.map((p) => sb.planets[p].ratio), 1.6);
    html = `<div class="card"><div class="card-head"><h3>Shadbala strength</h3><span class="hint">ratio of total to required rupas; the line marks 1.0</span></div>
      <div class="sb-bars">${sb.ranking.map((p, i) => { const x = sb.planets[p]; return `<div class="sb-row"><span>${pdot(p)}<b>${esc(tr("graha", p))}</b></span><div class="sb-track"><span class="sb-fill${x.ratio >= 1 ? " ok" : ""}" style="width:${(x.ratio / maxR * 100).toFixed(1)}%"></span><span class="sb-req" style="left:${(1 / maxR * 100).toFixed(1)}%"></span></div><span class="num">${x.total_rupas.toFixed(2)} / ${x.required_rupas}</span><span class="rank">#${i + 1}</span></div>`; }).join("")}</div></div>
    <div class="card"><div class="card-head"><h3>Six-fold components (virupas)</h3></div>
      <div class="scroll"><table class="tbl">
        <tr><th>${t("Planet")}</th>${comps.map((k) => `<th>${k}</th>`).join("")}<th>Total (rupas)</th><th>Required</th><th>Ratio</th><th>Rank</th></tr>
        ${sb.ranking.map((p, i) => { const x = sb.planets[p]; return `<tr><td>${pdot(p)}<b>${esc(tr("graha", p))}</b></td>${comps.map((k) => `<td>${x[k].toFixed(1)}</td>`).join("")}
          <td><b>${x.total_rupas.toFixed(2)}</b></td><td>${x.required_rupas}</td><td class="${x.ratio >= 1 ? "good" : "bad"}">${x.ratio.toFixed(2)}</td><td>${i + 1}</td></tr>`; }).join("")}
      </table></div>
      <details class="adv"><summary>${ico("list")} Component details</summary>
        <div class="scroll"><table class="tbl"><tr><th>${t("Planet")}</th><th>Sthana parts</th><th>Kala parts</th><th>Drik from</th></tr>
        ${Object.entries(sb.planets).map(([p, x]) => `<tr><td><b>${esc(tr("graha", p))}</b></td>
          <td class="small">${Object.entries(x.sthana_parts).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}</td>
          <td class="small">${Object.entries(x.kala_parts).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(", ")}</td>
          <td class="small">${Object.entries(x.drik_detail || {}).map(([k, v]) => `${esc(tr("graha", k))} ${(+v).toFixed(1)}`).join(", ")}</td></tr>`).join("")}
        </table></div>
        <p class="hint">${esc(typeof sb.profile === "string" ? sb.profile : JSON.stringify(sb.profile || sb.PROFILE || ""))}</p>
      </details></div>`;
  } else {
    const av = r.ashtakavarga, maxS = Math.max(...av.sav, 40);
    const lagIdx = r.chart.lagna.rashi.index - 1;
    html = `<div class="card"><div class="card-head"><h3>Sarvashtakavarga by sign</h3><span class="hint">total ${av.sav_total} \u00b7 30+ strong, under 25 weak</span></div>
      <div class="sav-bars">${av.sav.map((v, i) => `<div class="sav-col${i === lagIdx ? " lag" : ""}"><span class="sav-v">${v}</span><div class="sav-track"><span class="sav-fill ${v >= 30 ? "hi" : v < 25 ? "lo" : ""}" style="height:${(v / maxS * 100).toFixed(1)}%"></span></div><small>${SIGN_SHORT(RASHIS[i])}</small></div>`).join("")}</div></div>
    <div class="card av"><div class="card-head"><h3>Bhinnashtakavarga (raw bindus)</h3></div>
      <div class="scroll"><table class="tbl">
        <tr><th></th>${RASHIS.map((s) => `<th>${SIGN_SHORT(s)}</th>`).join("")}<th>${t("Total")}</th></tr>
        ${Object.keys(av.bav).map((p) => `<tr><td>${pdot(p)}<b>${esc(tr("graha", p))}</b></td>${av.bav[p].map((v) => `<td class="${v >= 5 ? "hi" : v <= 2 ? "lo" : ""}">${v}</td>`).join("")}<td>${av.totals[p]}</td></tr>`).join("")}
        <tr><td><b>SAV</b></td>${av.sav.map((v) => `<td class="${v >= 30 ? "hi" : v < 25 ? "lo" : ""}"><b>${v}</b></td>`).join("")}<td><b>${av.sav_total}</b></td></tr>
      </table></div></div>`;
  }
  out.innerHTML = html;
}
$$("#yoga-tabs button").forEach((b) => b.addEventListener("click", () => {
  yogaTab = b.dataset.y;
  $$("#yoga-tabs button").forEach((x) => x.classList.toggle("on", x === b));
  renderYogas();
}));
rerender.yogas = () => lastChart && renderYogas();

/* ---------- chart style toggles ---------- */
function syncStyleToggles() {
  const st = settings().chart_style;
  $$(".style-toggle button").forEach((b) => b.classList.toggle("on", b.dataset.style === st));
}
$$(".style-toggle button").forEach((b) => b.addEventListener("click", () => {
  updateSettings({ chart_style: b.dataset.style });
  syncStyleToggles();
  redrawCharts();
}));
function redrawCharts() {
  if (lastChart) { renderChartVisual(lastChart); renderVargas(); }
  if (lastTransit) renderTransits(lastTransit);
  syncSettingsForm();
}

/* ---------- reports ---------- */
const REPORTS = [
  ["chart", "Birth Chart Report", "Complete chart: Rasi & Navamsha, planets, Panchanga at birth, yogas, strength", "chart", "c1"],
  ["dasha", "Dasha Report", "Vimshottari maha and antar periods, plus Yogini, Ashtottari and Chara", "dashas", "c2"],
  ["transits", "Transit Report", "Current transits, gochara, Sade Sati and upcoming ingresses", "transits", "c3"],
  ["panchanga", "Panchanga Report", "Daily Panchanga with every muhurta window", "panchanga", "c4"],
  ["match", "Compatibility Report", "Ashtakoota, poruthams and Kuja dosha", "match", "c6"],
  ["muhurta", "Muhurta Report", "Auspicious windows for an activity", "muhurta", "c5"],
  ["festivals", "Festival Calendar", "Every festival and vrata of the year with rules", "festival", "c4"],
  ["eclipses", "Eclipse Report", "Eclipses with local contact times and visibility", "eclipse", "c3"],
];
function reportStatus(kind) {
  const nm = (x) => (x ? "Ready" : "Will calculate");
  switch (kind) {
    case "chart": case "dasha": return lastChart ? "Ready \u00b7 " + (lastChart.input.name || lastChart.input.date) : "Uses the Birth Chart form";
    case "transits": return lastTransit ? "Ready \u00b7 " + (lastTransit._name || "natal chart") : "Uses the current chart";
    case "panchanga": return lastPanch ? "Ready \u00b7 " + lastPanch.date : "Today at your default place";
    case "match": return lastMatch ? "Ready" : "Calculate a match first";
    case "muhurta": return lastMuhurta ? "Ready \u00b7 " + lastMuhurta.label : nm(false);
    case "festivals": return lastFest ? "Ready \u00b7 " + lastFest.start.slice(0, 4) : nm(false);
    default: return lastEclipse ? "Ready" : nm(false);
  }
}
function renderReports() {
  document.getElementById("report-list").innerHTML = REPORTS.map(([k, title, sub, icon, c]) => `<div class="rep-row"><span class="fi ${c}">${ico(icon)}</span>
    <span class="rr-body"><b>${title}</b><small>${sub}</small></span><span class="rr-status">${esc(reportStatus(k))}</span>
    <button type="button" class="btn primary sm" data-report="${k}">${ico("print")}Generate</button></div>`).join("");
}
onShow.reports = renderReports;
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-report]");
  if (b) { e.preventDefault(); generateReport(b.dataset.report); }
});
function cloneOut(id) {
  const n = document.getElementById(id).cloneNode(true);
  n.querySelectorAll(".row-actions, button, .filter-input, select, .chips, .tl-now").forEach((x) => x.remove());
  n.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
  n.querySelectorAll("[hidden]").forEach((x) => x.removeAttribute("hidden"));
  return n.innerHTML;
}
function chartReport(r) {
  const bp = r.birth_panchanga, s = settings();
  const chain = currentChain(dashaModel(r, "vimshottari"), "vimshottari");
  const kv = (rows) => `<table class="tbl">${rows.map(([k, v]) => `<tr><td class="hint">${k}</td><td><b>${v}</b></td></tr>`).join("")}</table>`;
  return `<section class="rep-grid2"><div>
      <h2>Birth details</h2>${kv([["Name", esc(r.input.name || "\u2014")], ["Date", esc(longDate(r.input.date))], ["Time", esc(r.input.time) + " (UTC" + fmtOffset(r.input.tz_minutes) + ")"],
        ["Place", esc(r.input.place || "\u2014")], ["Coordinates", r.input.lat.toFixed(4) + ", " + r.input.lon.toFixed(4)], ["Ayanamsa", esc(r.profile.ayanamsa)], ["Rahu / Ketu", String(r.profile.node) === "mean" ? "Mean node" : "True (osculating) node"]])}
      <h2>Panchanga at birth</h2>${kv([[t("Tithi"), esc(trTithi(bp.tithi.paksha, bp.tithi.name))], [t("Nakshatra"), esc(tr("nakshatra", r.chart.grahas.Moon.nakshatra.name)) + " pada " + r.chart.grahas.Moon.nakshatra.pada],
        [t("Yoga"), esc(tr("yoga", bp.yoga.name))], [t("Karana"), esc(tr("karana", bp.karana.name))], [t("Vara"), esc(tr("vara", bp.vara.name))], [t("Month"), esc(tr("month", bp.lunar_month.name))]].concat(r.namakshara ? [["Name letter", esc(sylAll(r.namakshara))]] : []))}
    </div><div class="rep-charts"><div><h3>Rasi (D1)</h3>${chartFor(r, "D1", s.chart_style)}</div><div><h3>Navamsha (D9)</h3>${chartFor(r, "D9", s.chart_style)}</div></div></section>
    <section><h2>Planetary positions</h2>${chartDetailsTable(r, "D1")}</section>
    <section><h2>Current Vimshottari periods</h2>${kv(chain.map((n, i) => [["Maha", "Antar", "Pratyantar", "Sukshma", "Prana"][i], esc(n.label) + " \u00b7 " + fmtRange(n, i >= 2)]))}</section>
    <section><h2>Yogas &amp; doshas</h2>${r.yogas.length ? `<table class="tbl"><tr><th>Name</th><th>Type</th><th>Evidence</th></tr>${r.yogas.map((y) => `<tr><td><b>${esc(y.name)}</b></td><td>${esc(y.type)}</td><td>${esc(y.evidence)}</td></tr>`).join("")}</table>` : "<p>None of the checked yogas are present.</p>"}</section>
    <section><h2>Shadbala</h2><table class="tbl"><tr><th>Planet</th><th>Total (rupas)</th><th>Required</th><th>Ratio</th></tr>${r.shadbala.ranking.map((p) => { const x = r.shadbala.planets[p]; return `<tr><td>${esc(tr("graha", p))}</td><td>${x.total_rupas.toFixed(2)}</td><td>${x.required_rupas}</td><td>${x.ratio.toFixed(2)}</td></tr>`; }).join("")}</table></section>`;
}
function dashaReport(r) {
  const sysTable = (sys) => {
    const m = dashaModel(r, sys);
    return `<section><h2>${esc(m.title)}</h2><p class="hint">${esc(m.info)}</p><table class="tbl"><tr><th>Period</th><th>Start</th><th>End</th><th>Years</th></tr>
      ${m.mahas.map((x) => `<tr class="${x.current ? "cur" : ""}"><td><b>${esc(x.label)}</b></td><td>${dt(x.start)}</td><td>${dt(x.end)}</td><td>${(+x.years).toFixed(2)}</td></tr>`).join("")}</table></section>`;
  };
  const v = dashaModel(r, "vimshottari");
  return sysTable("vimshottari") + `<section><h2>Vimshottari antardashas</h2>${v.mahas.map((m) => `<h3>${esc(m.label)} (${dateLabel(m.start)} \u2013 ${dateLabel(m.end)})</h3><table class="tbl compact">${m.sub.map((s) => `<tr class="${s.current ? "cur" : ""}"><td>${esc(s.label)}</td><td>${dt(s.start)}</td><td>${dt(s.end)}</td></tr>`).join("")}</table>`).join("")}</section>`
    + sysTable("yogini") + sysTable("ashtottari") + sysTable("chara");
}
function writeReport(w, title, sub, body) {
  const sprite = document.querySelector("body > svg").outerHTML;
  w.document.open();
  w.document.write(`<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <link rel="stylesheet" href="${new URL("styles.css", location.href)}"></head><body class="report">${sprite}
    <header class="rep-head"><div class="rep-brand"><svg class="logo" viewBox="0 0 32 32"><use href="#i-logo"/></svg><b>ASTRA</b></div>
      <div class="rep-title"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="rep-meta">Generated ${esc(new Date().toLocaleString())}<br>${esc(location.host)}</div></header>
    <main class="rep-body">${body}</main>
    <footer class="rep-foot">Calculated in the browser from NASA JPL DE440 \u00b7 IAU 2006/2000A \u00b7 ${esc(settings().ayanamsa === "lahiri" ? "Lahiri (IAE true)" : "Lahiri (mean)")} ayanamsa. No AI, no copied panchangam.</footer>
    <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 600); });<\/script></body></html>`);
  w.document.close();
}
async function ensureTransit() {
  if (lastTransit) return;
  const f = transitForm;
  if (!f.querySelector("[name=birth_date]").value) {
    await ensureChart();
    if (lastChart && lastChart._raw) fillProfile(f, "birth_", lastChart._raw);
  }
  if (!(await f.run())) throw new Error("Transit calculation failed.");
}
async function generateReport(kind) {
  const w = window.open("", "_blank");
  if (!w) { toast("Allow pop-ups for this site to open the report.", "warn"); return; }
  w.document.write('<p style="font:16px system-ui,sans-serif;padding:48px;color:#555">Preparing your report\u2026</p>');
  const runOr = async (last, form) => { if (!last && !(await form.run())) throw new Error("Calculation failed."); };
  try {
    let title = "", sub = "", body = "";
    if (kind === "chart" || kind === "dasha") {
      await ensureChart();
      if (!lastChart) throw new Error("Could not calculate the chart.");
      title = kind === "chart" ? "Birth Chart Report" : "Dasha Report";
      sub = (lastChart.input.name ? lastChart.input.name + " \u00b7 " : "") + longDate(lastChart.input.date) + " " + lastChart.input.time + (lastChart.input.place ? " \u00b7 " + lastChart.input.place : "");
      body = kind === "chart" ? chartReport(lastChart) : dashaReport(lastChart);
    } else if (kind === "transits") {
      await ensureTransit();
      title = "Transit Report"; sub = (lastTransit._name || "Natal chart") + " \u00b7 " + dt(lastTransit.transit_time); body = cloneOut("transit-out");
    } else if (kind === "panchanga") {
      await runOr(lastPanch, panchForm);
      title = "Panchanga Report"; sub = longDate(lastPanch.date) + (lastPanch._place ? " \u00b7 " + lastPanch._place : ""); body = cloneOut("panch-out");
    } else if (kind === "match") {
      if (!lastMatch) { w.close(); toast("Calculate a match first, then generate the report."); showTab("match"); return; }
      title = "Compatibility Report"; sub = lastMatch._names.filter(Boolean).join(" & ") || "Groom & bride"; body = cloneOut("match-out");
    } else if (kind === "muhurta") {
      await runOr(lastMuhurta, muhurtaForm);
      title = "Muhurta Report"; sub = lastMuhurta.label; body = cloneOut("muhurta-out");
    } else if (kind === "festivals") {
      await runOr(lastFest, festForm);
      title = "Festival Calendar"; sub = lastFest.start.slice(0, 4); body = cloneOut("fest-out");
    } else {
      await runOr(lastEclipse, eclipseForm);
      title = "Eclipse Report"; sub = lastEclipse.start + " \u2192 " + lastEclipse.end; body = cloneOut("eclipse-out");
    }
    writeReport(w, title, sub, body);
    if (currentTab === "reports") renderReports();
  } catch (e) {
    w.document.body.innerHTML = `<p style="font:16px system-ui,sans-serif;padding:48px;color:#b91c1c">Report failed: ${esc(e.message)}</p>`;
  }
}

/* ---------- settings ---------- */
const setForm = document.getElementById("settings-form");
document.getElementById("set-lang").innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
function syncSettingsForm() {
  const s = settings();
  for (const el of setForm.elements) {
    if (!el.name || el.name.startsWith("set_") || el.name === "house") continue;
    if (el.type === "checkbox") el.checked = !!s[el.name];
    else if (el.name === "lang") el.value = LANG;
    else if (s[el.name] != null) el.value = s[el.name];
  }
  const p = s.place || defaultPlace();
  setPlace(setForm, "set_", p);
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("astro.")) bytes += k.length + (localStorage.getItem(k) || "").length; }
  document.getElementById("set-storage").textContent = `${profiles().length} charts, ${places().length} places \u00b7 ${(bytes / 1024).toFixed(1)} KB in this browser`;
}
$$("#set-tabs button").forEach((b) => b.addEventListener("click", () => {
  $$("#set-tabs button").forEach((x) => x.classList.toggle("on", x === b));
  $$(".set-pane", setForm).forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.s; });
}));
setForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const before = settings();
  const f = new FormData(setForm);
  let place = before.place;
  try { const pl = readPlace(setForm, "set_"); place = { name: pl.name, coords: f.get("set_coords"), tz: pl.tz }; } catch (e) { toast(e.message, "warn"); return; }
  const next = {
    ayanamsa: f.get("ayanamsa"), node: f.get("node"), dasha_year: f.get("dasha_year"), sunrise_profile: f.get("sunrise_profile"),
    chart_style: f.get("chart_style"), elevation: +f.get("elevation") || 0, show_retro: !!f.get("show_retro"), show_deg: !!f.get("show_deg"),
    show_outer: !!f.get("show_outer"), theme: f.get("theme"), start_page: f.get("start_page"), place,
  };
  updateSettings(next);
  applyTheme();
  applyFormDefaults();
  syncStyleToggles();
  if (f.get("lang") !== LANG) setLang(f.get("lang"));
  const calcChanged = ["ayanamsa", "node", "dasha_year", "sunrise_profile", "elevation"].some((k) => before[k] !== next[k]);
  const placeChanged = JSON.stringify(before.place) !== JSON.stringify(place);
  if (calcChanged && lastChart) chartForm.run();
  else redrawCharts();
  if (calcChanged && lastPanch) panchForm.run();
  if (calcChanged || placeChanged) loadDashboard();
  toast("Settings saved");
});
document.getElementById("set-export").addEventListener("click", () =>
  download("astra-backup.json", { profiles: profiles(), places: places(), settings: settings(), lang: LANG }));
document.getElementById("set-import").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (Array.isArray(data.profiles)) store.set("profiles", data.profiles);
    if (Array.isArray(data.places)) store.set("places", data.places);
    if (data.settings && typeof data.settings === "object") store.set("settings", data.settings);
    if (data.lang && LANGS[data.lang]) setLang(data.lang);
    applyTheme(); applyFormDefaults(); syncStyleToggles(); syncSettingsForm(); refreshProfilePickers();
    toast("Backup restored");
  } catch (e) { toast("Not a valid backup file.", "warn"); }
});
document.getElementById("set-clear").addEventListener("click", () => {
  if (!confirm("Delete all saved charts, places and settings from this browser?")) return;
  Object.keys(localStorage).filter((k) => k.startsWith("astro.")).forEach((k) => localStorage.removeItem(k));
  location.reload();
});
onShow.settings = syncSettingsForm;

/* ---------- page hooks: calculate on first visit ---------- */
onShow.chart = () => { if (!lastChart) ensureChart(); };
onShow.dashas = () => { if (lastChart) renderDashas(); else needChart("dashas-out"); refreshChartSources(); };
onShow.vargas = () => { if (lastChart) renderVargas(); else needChart("vargas-out"); refreshChartSources(); };
onShow.yogas = () => { if (lastChart) renderYogas(); else needChart("yogas-out"); refreshChartSources(); };
onShow.panchanga = () => { if (!lastPanch) panchForm.run(); };
onShow.calendar = () => { if (!lastCal) calForm.run(); };
onShow.festivals = () => { if (!lastFest) festForm.run(); };
onShow.muhurta = () => { if (!lastMuhurta) muhurtaForm.run(); };
onShow.eclipses = () => { if (!lastEclipse) eclipseForm.run(); };
onShow.search = () => { if (!lastSearch) searchForm.run(); };
onShow.transits = async () => {
  if (lastTransit) return;
  const f = transitForm;
  if (!f.querySelector("[name=birth_date]").value) {
    if (profiles().length && !lastChart) fillProfile(f, "birth_", profiles()[0]);
    else { await ensureChart(); if (lastChart && lastChart._raw) fillProfile(f, "birth_", lastChart._raw); }
  }
  if (f.querySelector("[name=birth_date]").value && !lastTransit) f.run();
};
onShow.dashboard = () => renderDashSaved();

/* ---------- start ---------- */
syncStyleToggles();
refreshChartSources();
renderDashSaved();
renderReports();
syncSettingsForm();
loadDashboard();
showTab(location.hash.slice(1) || settings().start_page || "dashboard");
