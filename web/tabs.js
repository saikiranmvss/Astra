"use strict";
/* Range-based tabs: month calendar, festivals, event search, transits,
   matching, muhurta, eclipses. Depends on helpers in app.js / i18n.js. */

function icsCalendar(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jyotisha Engine//EN", "CALSCALE:GREGORIAN"];
  events.forEach((e, i) => {
    const clean = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    lines.push("BEGIN:VEVENT", "UID:je-" + stamp + "-" + i + "@jyotisha", "DTSTAMP:" + stamp);
    if (e.time) {
      const f = (iso) => iso.replace(/[-:]/g, "").slice(0, 15);
      lines.push("DTSTART:" + f(e.time));
      lines.push("DTEND:" + f(e.end || e.time));
    } else {
      const d = e.date.replace(/-/g, "");
      lines.push("DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + addDays(e.date, 1).replace(/-/g, ""));
    }
    lines.push("SUMMARY:" + clean(e.title));
    if (e.desc) lines.push("DESCRIPTION:" + clean(e.desc));
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
const varaShort = (wd) => (LANG === "en" ? WEEKDAYS_EN[wd] : tr("vara", EN.vara[wd]));

/* ---------- month calendar ---------- */
let lastCal = null, calSel = null;
const calForm = bindForm("cal-form", "cal-out", "cal-hint", async (form) => {
  const f = new FormData(form);
  const [y, m] = f.get("month").split("-").map(Number);
  const pl = readPlace(form);
  const first = f.get("month") + "-01";
  const last = addDays(new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString().slice(0, 10), -1);
  const tz = rangeTz(pl, first, last);
  const r = await call("calendar", Object.assign({ year: y, month: m, lat: pl.lat, lon: pl.lon }, tz, calc()));
  lastCal = r;
  const today = todayIso();
  calSel = r.days.find((d) => d.date === today) ? today : null;
  renderCalendar(r);
  return r.days.length + " days";
});
calForm.querySelector("[name=month]").value = todayIso().slice(0, 7);
calForm.querySelector("[name=show]").addEventListener("change", () => lastCal && renderCalendar(lastCal));
calForm.querySelectorAll(".month-step").forEach((b) => b.addEventListener("click", () => {
  const inp = calForm.querySelector("[name=month]");
  let [y, m] = (inp.value || todayIso().slice(0, 7)).split("-").map(Number);
  m += +b.dataset.step;
  if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; }
  inp.value = y + "-" + String(m).padStart(2, "0");
  calForm.requestSubmit();
}));
rerender.calendar = () => lastCal && renderCalendar(lastCal);

function tithiMark(d) {
  const n = d.tithi.index;
  return (n === 11 || n === 26 ? '<span class="ekb" title="Ekadashi">EK</span>' : "") + moonSVG(n, 18);
}
function renderCalendar(r) {
  const show = calForm.querySelector("[name=show]").value;
  const today = todayIso();
  const lead = r.days[0].weekday;
  let cells = "";
  for (let i = 0; i < lead; i++) cells += '<div class="cal-cell empty"></div>';
  const mperiods = r.moudhya || [];
  const inMoudhya = (iso) => mperiods.filter((p) => (!p.start || p.start <= iso) && (!p.end || iso < p.end));
  let monthHasMoudhya = false;
  for (const d of r.days) {
    const md = inMoudhya(d.sunrise || d.date + "T06:00:00");
    if (md.length) monthHasMoudhya = true;
    const mdTags = md.map((p) => `<span class="md-tag ${p.planet === "Jupiter" ? "g" : "s"}" title="${esc(p.name)}">${p.planet === "Jupiter" ? "GM" : "SM"}</span>`).join("");
    let body = "";
    if (show === "tithi") {
      body = `<div class="ct">${esc(trTithi("", d.tithi.name))} <span class="hint">${hm(d.tithi.end)}</span></div>
        <div class="cn">${esc(tr("nakshatra", d.nakshatra.name))} <span class="hint">${hm(d.nakshatra.end)}</span></div>
        ${d.festivals.slice(0, 3).map((f) => `<div class="cf cat-${esc(f.category)}">${esc(trFest(f))}</div>`).join("")}${d.festivals.length > 3 ? `<div class="hint">+${d.festivals.length - 3} more</div>` : ""}`;
    } else if (show === "sun") {
      body = `<div>\u2600 ${hm(d.sunrise)} \u2013 ${hm(d.sunset)}</div>`;
    } else if (show === "rahu") {
      body = `<div class="bad">${t("Rahu kala")}<br>${hm(d.rahu_kala && d.rahu_kala.start)} \u2013 ${hm(d.rahu_kala && d.rahu_kala.end)}</div>`;
    } else {
      body = `<div>\u263e\u2191 ${hm(d.moonrise)}</div><div>\u263e\u2193 ${hm(d.moonset)}</div>`;
    }
    cells += `<div class="cal-cell${d.date === today ? " today" : ""}${d.date === calSel ? " sel" : ""}${d.weekday === 0 ? " sun" : ""}" data-date="${d.date}">
      <div class="cd"><b>${+d.date.slice(8)}</b><span class="paksha ${d.tithi.paksha === "Shukla" ? "sk" : "kr"}">${esc(tr("paksha", d.tithi.paksha)).slice(0, LANG === "en" ? 1 : 2)}</span>${mdTags}${tithiMark(d)}</div>${body}</div>`;
  }
  const months = [...new Set(r.days.map((d) => trMonth((d.month.adhika ? "Adhika " : "") + d.month.name)))].join(" / ");
  const head = [0, 1, 2, 3, 4, 5, 6].map((w) => `<div class="cal-h">${esc(varaShort(w))}</div>`).join("");
  const mlabel = new Date(Date.UTC(r.year, r.month - 1, 1)).toLocaleDateString({ en: "en-GB", te: "te-IN", hi: "hi-IN", sa: "hi-IN" }[LANG], { month: "long", year: "numeric", timeZone: "UTC" });
  document.getElementById("cal-out").innerHTML = `
  <div class="card">
    <div class="card-head"><div class="cal-head"><span class="mt">${esc(mlabel)}</span><span class="ms">${esc(months)} \u00b7 Amanta</span></div>
      <div class="row-actions"><button type="button" class="ghost" id="cal-ics">${ico("panchanga")}Festivals .ics</button><button type="button" class="ghost" id="cal-csv">${ico("download")}CSV</button><button type="button" class="ghost" id="cal-json">JSON</button></div></div>
    <div class="cal">${head}${cells}</div>
    <p class="hint">Tithi and nakshatra shown are those at sunrise, with their end time. Click a day for the full details.${monthHasMoudhya ? ` <span class="md-tag g">GM</span> Guru moudhyami, <span class="md-tag s">SM</span> Shukra moudhyami (planet within its combustion orb of the Sun): ${mperiods.map((p) => `${esc(p.short)} ${p.start ? esc(dateLabel(p.start.slice(0, 10))) : "\u2026"} \u2013 ${p.end ? esc(dateLabel(p.end.slice(0, 10))) : "\u2026"}`).join("; ")}.` : ""}</p>
  </div>
  <div id="cal-day"></div>`;
  document.querySelectorAll(".cal-cell[data-date]").forEach((c) => c.addEventListener("click", () => {
    calSel = c.dataset.date;
    document.querySelectorAll(".cal-cell").forEach((x) => x.classList.toggle("sel", x === c));
    renderCalDay(r.days.find((d) => d.date === calSel));
  }));
  document.getElementById("cal-json").onclick = () => download(`calendar-${r.year}-${r.month}.json`, r);
  document.getElementById("cal-csv").onclick = () => download(`calendar-${r.year}-${r.month}.csv`, toCSV([
    ["date", "weekday", "sunrise", "sunset", "tithi", "tithi_end", "nakshatra", "nakshatra_end", "yoga", "karana", "moon_sign", "month", "rahu_kala", "festivals"],
    ...r.days.map((d) => [d.date, d.vara, tm(d.sunrise), tm(d.sunset), d.tithi.paksha + " " + d.tithi.name, d.tithi.end, d.nakshatra.name, d.nakshatra.end,
      d.yoga.name, d.karana.name, d.moon_sign.name, d.month.name, d.rahu_kala ? hm(d.rahu_kala.start) + "-" + hm(d.rahu_kala.end) : "", d.festivals.map((f) => f.name).join("; ")])]), "text/csv");
  document.getElementById("cal-ics").onclick = () => download(`festivals-${r.year}-${r.month}.ics`,
    icsCalendar(r.days.flatMap((d) => d.festivals.map((f) => ({ date: f.date, title: trFest(f), desc: f.rule })))), "text/calendar");
  if (calSel) renderCalDay(r.days.find((d) => d.date === calSel));
}
function renderCalDay(d) {
  if (!d) return;
  const row = (k, v) => `<tr><td class="hint">${k}</td><td>${v}</td></tr>`;
  const w = (x) => (x ? `${hm(x.start)} \u2013 ${hm(x.end)}` : "\u2014");
  document.getElementById("cal-day").innerHTML = `
  <div class="card">
    <div class="card-head"><h3>${esc(dateLabel(d.date, { weekday: "long" }))} \u00b7 ${esc(tr("vara", d.vara))}</h3>
      <button type="button" class="btn primary sm" id="cal-open">${ico("panchanga")}Full Panchanga for this day</button></div>
    <div class="two-even">
      <table class="tbl">
        ${row(t("Sunrise") + " / " + t("Sunset"), `${tm(d.sunrise)} / ${tm(d.sunset)}`)}
        ${row(t("Moonrise") + " / " + t("Moonset"), `${tmRel(d.moonrise, d.date)} / ${tmRel(d.moonset, d.date)}`)}
        ${row(t("Tithi"), (d.tithis && d.tithis.length ? d.tithis : [d.tithi]).map((x) => `${moonSVG(x.index, 14)} ${esc(trTithi(x.paksha || (x.index <= 15 ? "Shukla" : "Krishna"), x.name))} <span class="hint">until ${tmRel(x.end, d.date)}</span>`).join("<br>"))}
        ${row(t("Nakshatra"), `${esc(tr("nakshatra", d.nakshatra.name))} <span class="hint">until ${tmRel(d.nakshatra.end, d.date)}</span>`)}
        ${row(t("Yoga"), `${esc(tr("yoga", d.yoga.name))} <span class="hint">until ${tmRel(d.yoga.end, d.date)}</span>`)}
        ${row(t("Karana"), `${esc(tr("karana", d.karana.name))} <span class="hint">until ${tmRel(d.karana.end, d.date)}</span>`)}
        ${row("Moon " + t("Rashi"), `${esc(tr("rashi", d.moon_sign.name))} <span class="hint">until ${tmRel(d.moon_sign.end, d.date)}</span>`)}
        ${row("Sun " + t("Rashi"), esc(tr("rashi", d.sun_sign.name)))}
        ${row(t("Month"), esc(trMonth((d.month.adhika ? "Adhika " : "") + d.month.name)) + " (Amanta)")}
      </table>
      <table class="tbl">
        ${row(t("Rahu kala"), w(d.rahu_kala))}
        ${row(t("Yamaganda"), w(d.yamaganda))}
        ${row(t("Gulika"), w(d.gulika))}
        ${row(t("Festivals"), d.festivals.length ? d.festivals.map((f) => `<b>${esc(trFest(f))}</b><br><span class="hint">${esc(f.rule)}${f.resolution ? " \u00b7 " + esc(f.resolution) : ""}</span>`).join("<br>") : "\u2014")}
      </table>
    </div>
  </div>`;
  document.getElementById("cal-open").onclick = () => {
    const pf = document.getElementById("panch-form");
    pf.querySelector("[name=date]").value = d.date;
    for (const n of ["place", "coords", "tz", "tzoverride"]) { const x = pf.querySelector(`[name=${n}]`); x.value = calForm.querySelector(`[name=${n}]`).value; x.dispatchEvent(new Event("change")); }
    showTab("panchanga");
    pf.requestSubmit();
  };
}

/* ---------- festivals ---------- */
const FEST_CATS = { major: "Major festivals", jayanti: "Jayantis", regional: "Telugu / regional", ekadashi: "Ekadashi",
  vrata: "Vratas (Pradosha, Sankashti, Shivaratri, Purnima, Amavasya)", solar: "Sankranti / solar" };
document.getElementById("fest-cats").innerHTML = Object.entries(FEST_CATS).map(([k, v]) =>
  `<label class="chk"><input type="checkbox" name="cat" value="${k}" checked> <span class="dotc cat-${k}"></span>${esc(v)}</label>`).join("");
let lastFest = null;
const festForm = bindForm("fest-form", "fest-out", "fest-hint", async (form) => {
  const f = new FormData(form);
  const year = +f.get("year");
  const pl = readPlace(form);
  const cats = f.getAll("cat");
  if (!cats.length) throw new Error("Pick at least one category.");
  const tz = rangeTz(pl, year + "-01-01", year + "-12-31");
  const r = await call("festivals", Object.assign({ year, categories: cats, lat: pl.lat, lon: pl.lon }, tz, calc()));
  lastFest = r;
  renderFestivals(r);
  return r.count + " dates";
});
festForm.querySelector("[name=year]").value = new Date().getFullYear();
festForm.querySelector("[name=q]").addEventListener("input", () => lastFest && renderFestivals(lastFest));
rerender.festivals = () => lastFest && renderFestivals(lastFest);

function renderFestivals(r) {
  const q = festForm.querySelector("[name=q]").value.trim().toLowerCase();
  const list = r.festivals.filter((f) => !q || f.name.toLowerCase().includes(q) || trFest(f).toLowerCase().includes(q) || f.category.includes(q));
  let html = "", curMonth = "";
  for (const f of list) {
    const mk = f.date.slice(0, 7);
    if (mk !== curMonth) {
      if (curMonth) html += "</table></div>";
      curMonth = mk;
      const lbl = new Date(mk + "-01T00:00:00Z").toLocaleDateString({ en: "en-GB", te: "te-IN", hi: "hi-IN", sa: "hi-IN" }[LANG], { month: "long", year: "numeric", timeZone: "UTC" });
      html += `<h4 class="month-title">${esc(lbl)}</h4><div class="scroll"><table class="tbl"><tr><th>${t("Date")}</th><th>${t("Vara")}</th><th>Festival</th><th>Rule &amp; timing</th></tr>`;
    }
    const extra = [];
    if (f.tithi_start) extra.push(`tithi ${dt(f.tithi_start)} \u2192 ${dt(f.tithi_end)}`);
    if (f.vaishnava_date && f.vaishnava_date !== f.date) extra.push(`<span class="warn">Vaishnava: ${esc(f.vaishnava_date)}</span>`);
    if (f.parana) extra.push(`Parana ${dt(f.parana.start)} \u2013 ${tm(f.parana.end)}`);
    if (f.sankranti_time) extra.push(`sankranti at ${dt(f.sankranti_time)}`);
    html += `<tr><td><b>${esc(dateLabel(f.date))}</b></td><td>${esc(varaShort(f.weekday))}</td>
      <td><span class="dotc cat-${esc(f.category)}"></span><b>${esc(trFest(f))}</b>${LANG !== "en" ? `<br><span class="hint">${esc(f.name)}</span>` : ""}</td>
      <td class="wrap small">${esc(f.rule)}${f.resolution ? ` <span class="hint">(${esc(f.resolution)})</span>` : ""}${extra.length ? "<br>" + extra.join(" \u00b7 ") : ""}</td></tr>`;
  }
  if (curMonth) html += "</table></div>";
  document.getElementById("fest-out").innerHTML = `
  <div class="card">
    <div class="card-head"><span class="hint">${list.length} of ${r.count} dates \u00b7 ${esc(r.profile.months)} months \u00b7 Ekadashi: ${esc(r.profile.ekadashi)}</span>
      <div class="row-actions"><button type="button" class="ghost" id="fest-ics">${ico("panchanga")}Add to calendar (.ics)</button><button type="button" class="ghost" id="fest-csv">${ico("download")}CSV</button><button type="button" class="ghost" id="fest-json">JSON</button><button type="button" class="ghost" data-report="festivals">${ico("print")}Report</button></div></div>
    ${html || '<p class="hint">No festivals match.</p>'}
  </div>`;
  document.getElementById("fest-json").onclick = () => download(`festivals-${r.start.slice(0, 4)}.json`, r);
  document.getElementById("fest-csv").onclick = () => download(`festivals-${r.start.slice(0, 4)}.csv`, toCSV([
    ["date", "weekday", "name", "category", "rule", "resolution", "tithi_start", "tithi_end", "vaishnava_date"],
    ...list.map((f) => [f.date, EN.vara[f.weekday], f.name, f.category, f.rule, f.resolution, f.tithi_start, f.tithi_end, f.vaishnava_date])]), "text/csv");
  document.getElementById("fest-ics").onclick = () => download(`festivals-${r.start.slice(0, 4)}.ics`,
    icsCalendar(list.map((f) => ({ date: f.date, title: trFest(f), desc: f.rule }))), "text/calendar");
}

/* ---------- event search ---------- */
const SEARCH_CATS = {
  tithi: ["Tithis", true], nakshatra: ["Nakshatras (Moon)", true], yoga: ["Yogas", false], karana: ["Karanas", false],
  moon_sign: ["Moon sign changes", false], lunation: ["New / Full Moon, quarters", true], sankranti: ["Sankrantis", true],
  ingress: ["Planet sign ingress", false], nakshatra_ingress: ["Planet nakshatra ingress", false],
  station: ["Retrograde / direct stations", false], combustion: ["Combustion begin/end", false], conjunction: ["Conjunctions", false],
};
document.getElementById("search-cats").innerHTML = Object.entries(SEARCH_CATS).map(([k, [v, on]]) =>
  `<label class="chk"><input type="checkbox" name="cat" value="${k}"${on ? " checked" : ""}> ${esc(v)}</label>`).join("");
document.getElementById("search-planets").innerHTML = PLANETS.map((p) =>
  `<label class="chk"><input type="checkbox" name="planet" value="${p}"${["Uranus", "Neptune", "Pluto"].includes(p) ? "" : " checked"}> ${esc(p)}</label>`).join("");
let lastSearch = null, searchHidden = new Set();
const searchForm = bindForm("search-form", "search-out", "search-hint", async (form) => {
  const f = new FormData(form);
  const pl = readPlace(form);
  const start = f.get("start"), end = f.get("end");
  const cats = f.getAll("cat");
  if (!cats.length) throw new Error("Pick at least one category.");
  const ints = (n) => f.getAll(n).map(Number);
  const filters = {};
  if (ints("f_tithi").length) filters.tithi = ints("f_tithi");
  if (ints("f_nak").length) filters.nakshatra = ints("f_nak");
  if (ints("f_yoga").length) filters.yoga = ints("f_yoga");
  if (ints("f_rashi").length) filters.rashi = ints("f_rashi");
  if (ints("f_rashi_sun").length) filters.rashi_sun = ints("f_rashi_sun");
  if (f.getAll("f_phase").length) filters.phases = ints("f_phase");
  if (f.getAll("f_karana").length) filters.karana_names = f.getAll("f_karana");
  const tz = rangeTz(pl, start, end);
  const r = await call("search", Object.assign({ start, end, categories: cats, planets: f.getAll("planet"), filters,
    lat: pl.lat, lon: pl.lon, limit: 20000 }, tz, calc()));
  r._weekdays = ints("f_wd").map((x) => x - 1);
  r._tz = tz;
  lastSearch = r;
  searchHidden = new Set();
  renderSearch(r);
  return r.count + " events \u00b7 precision " + r.precision;
});
(() => {
  const s = searchForm.querySelector("[name=start]"), e = searchForm.querySelector("[name=end]");
  s.value = todayIso(); e.value = addDays(todayIso(), 30);
  searchForm.querySelector("[name=quick]").addEventListener("change", (ev) => {
    const v = ev.target.value, td = todayIso();
    const map = { m1: [td, addDays(td, 30)], m3: [td, addDays(td, 91)], y1: [td, addDays(td, 365)], py1: [addDays(td, -365), td],
      y10: [td, addDays(td, 3652)], y50: [td, addDays(td, 18262)] };
    if (!map[v]) return;
    [s.value, e.value] = map[v];
    if (v === "y10" || v === "y50") {
      searchForm.querySelectorAll("[name=cat]").forEach((c) => { c.checked = ["ingress", "station", "conjunction"].includes(c.value); });
      searchForm.querySelectorAll("[name=planet]").forEach((c) => { c.checked = ["Jupiter", "Saturn", "Rahu", "Ketu"].includes(c.value); });
    }
  });
})();
rerender.search = () => lastSearch && renderSearch(lastSearch);

const PHASE_TITLES = ["New Moon (Amavasya)", "First quarter", "Full Moon (Purnima)", "Last quarter"];
function eventTitle(e) {
  if (LANG === "en") return e.title;
  const g = (b) => tr("graha", b);
  switch (e.category) {
    case "tithi": return trTithi(e.paksha, e.name);
    case "nakshatra": return tr("graha", "Moon") + " \u2192 " + tr("nakshatra", e.name);
    case "yoga": return tr("yoga", e.name);
    case "karana": return tr("karana", e.name);
    case "moon_sign": return tr("graha", "Moon") + " \u2192 " + tr("rashi", e.name);
    case "sankranti": return tr("rashi", e.name) + " " + WORDS[LANG].Sankranti;
    case "ingress": return g(e.body) + " \u2192 " + tr("rashi", e.name) + (e.direction < 0 && !["Rahu", "Ketu"].includes(e.body) ? " (R)" : "");
    case "nakshatra_ingress": return g(e.body) + " \u2192 " + tr("nakshatra", e.name);
    case "station": return g(e.body) + " \u00b7 " + e.name;
    case "conjunction": return g(e.body) + " \u260c " + g(e.other);
    case "combustion": return g(e.body) + " \u00b7 combustion " + e.name;
    case "lunation": return e.phase === 0 ? tr("tithi", "Amavasya") : e.phase === 2 ? tr("tithi", "Purnima") : e.title;
    default: return e.title;
  }
}
function weekdayOfIso(iso) { return new Date(iso.slice(0, 10) + "T12:00:00Z").getUTCDay(); }
function renderSearch(r) {
  const q = (document.getElementById("search-q") || {}).value || "";
  const wds = r._weekdays || [];
  const counts = {};
  r.events.forEach((e) => { counts[e.category] = (counts[e.category] || 0) + 1; });
  const shown = r.events.filter((e) => !searchHidden.has(e.category)
    && (!wds.length || wds.includes(weekdayOfIso(e.time || e.end)))
    && (!q || (e.title + " " + eventTitle(e) + " " + (e.detail || "") + " " + (e.month || "")).toLowerCase().includes(q.toLowerCase())));
  const MAX = 3000;
  const rows = shown.slice(0, MAX).map((e) => {
    const iv = e.end !== undefined;
    return `<tr><td>${e.time ? dt(e.time) : '<span class="hint">before range</span>'}</td><td>${iv ? dt(e.end) : ""}</td>
      <td><span class="tagpill">${esc(e.category)}</span></td><td><b>${esc(eventTitle(e))}</b>${LANG !== "en" ? ` <span class="hint">${esc(e.title)}</span>` : ""}</td>
      <td class="wrap small hint">${esc([e.month ? "month " + e.month : "", e.lord ? "lord " + e.lord : "", e.detail || ""].filter(Boolean).join(" \u00b7 "))}</td></tr>`;
  }).join("");
  document.getElementById("search-out").innerHTML = `
  <div class="card">
    <div class="card-head"><div class="filter-input">${ico("search")}<input id="search-q" placeholder="Filter results\u2026" value="${esc(q)}"></div>
      <div class="row-actions"><button type="button" class="ghost" id="search-ics">${ico("panchanga")}.ics</button><button type="button" class="ghost" id="search-csv">${ico("download")}CSV</button><button type="button" class="ghost" id="search-json">JSON</button></div></div>
    <div class="chips">${Object.entries(counts).map(([k, n]) => `<button class="chip${searchHidden.has(k) ? "" : " on"}" data-cat="${k}">${esc(k)} <b>${n}</b></button>`).join("")}</div>
    <p class="hint">${shown.length} shown${shown.length > MAX ? " (first " + MAX + " listed; use filters or download)" : ""} \u00b7 ${esc(r.start)} \u2192 ${esc(r.end)} \u00b7 precision ${esc(r.precision)}${r.truncated ? ' \u00b7 <span class="warn">result limit reached</span>' : ""}</p>
    <div class="scroll"><table class="tbl"><tr><th>Start / time</th><th>End</th><th>Category</th><th>Event</th><th>Details</th></tr>${rows}</table></div>
  </div>`;
  const qi = document.getElementById("search-q");
  qi.addEventListener("input", () => { const pos = qi.selectionStart; renderSearch(r); const n = document.getElementById("search-q"); n.focus(); n.setSelectionRange(pos, pos); });
  document.querySelectorAll("#search-out .chip").forEach((c) => c.addEventListener("click", () => {
    const k = c.dataset.cat;
    searchHidden.has(k) ? searchHidden.delete(k) : searchHidden.add(k);
    renderSearch(r);
  }));
  document.getElementById("search-json").onclick = () => download(`events-${r.start}-${r.end}.json`, r);
  document.getElementById("search-csv").onclick = () => download(`events-${r.start}-${r.end}.csv`, toCSV([
    ["category", "start", "end", "title", "name", "month", "detail"],
    ...shown.map((e) => [e.category, e.time, e.end || "", e.title, e.name || "", e.month || "", e.detail || ""])]), "text/csv");
  document.getElementById("search-ics").onclick = () => download(`events-${r.start}-${r.end}.ics`,
    icsCalendar(shown.filter((e) => e.time).map((e) => ({ time: e.time, end: e.end, title: eventTitle(e), desc: e.detail || e.title }))), "text/calendar");
}

/* ---------- transits ---------- */
let lastTransit = null, transitMode = "current";
const transitYearCache = {};
const transitForm = bindForm("transit-form", "transit-out", "transit-hint", async (form) => {
  const b = readBirth(form, "birth_");
  const f = new FormData(form);
  const date = f.get("date");
  let time = f.get("time") || "12:00:00";
  if (time.length === 5) time += ":00";
  const pl = readPlace(form);
  // tz_minutes converts the transit time; tz_changes localises the lifetime Saturn periods
  const span = rangeTz(pl, b.date, addDays(date, 5 * 366));
  const r = await call("transits", Object.assign({
    birth_date: b.date, birth_time: b.time, birth_tz_minutes: b.tz_minutes, birth_lat: b.lat, birth_lon: b.lon,
    date, time, tz_minutes: offsetFor(pl, date, time),
    tz_changes: span.tz_changes.length ? [[0, span.tz_minutes]].concat(span.tz_changes) : [],
    lat: pl.lat, lon: pl.lon,
  }, calc()));
  r._name = b.name;
  r._birth = b;
  r._place = pl;
  lastTransit = r;
  for (const k of Object.keys(transitYearCache)) delete transitYearCache[k];
  form.classList.add("collapsed");
  renderTransits(r);
  if (/^\d{4}$/.test(transitMode)) showTransitYear(+transitMode);
  return "";
});
function setNow(form) {
  const n = new Date();
  form.querySelector("[name=date]").value = ymd(n);
  form.querySelector("[name=time]").value = String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0") + ":00";
}
setNow(transitForm);
transitForm.querySelector(".now-btn").addEventListener("click", () => setNow(transitForm));
transitForm.insertAdjacentHTML("afterbegin", `<div class="collapsed-summary"><span class="cs-ico">${ico("user")}</span><span class="cs-text"></span><button type="button" class="btn ghost sm cs-edit">${ico("edit")}Change</button></div>`);
transitForm.querySelector(".cs-edit").addEventListener("click", () => transitForm.classList.remove("collapsed"));
document.getElementById("transit-edit").addEventListener("click", () => transitForm.classList.toggle("collapsed"));
(function transitModes() {
  const y = new Date().getFullYear();
  const box = document.getElementById("transit-mode");
  box.innerHTML = `<button type="button" data-m="current" class="on">Current</button>${[y, y + 1, y + 2].map((v) => `<button type="button" data-m="${v}">${v}</button>`).join("")}<button type="button" data-m="custom">Custom</button>`;
  transitForm.classList.add("mode-current");
  box.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    transitMode = b.dataset.m;
    $$("button", box).forEach((x) => x.classList.toggle("on", x === b));
    transitForm.classList.toggle("mode-current", transitMode === "current");
    const out = document.getElementById("transit-out"), yr = document.getElementById("transit-year");
    if (transitMode === "custom") {
      out.hidden = false; yr.hidden = true;
      transitForm.classList.remove("collapsed");
      transitForm.querySelector("[name=date]").focus();
    } else if (transitMode === "current") {
      out.hidden = false; yr.hidden = true;
      setNow(transitForm);
      if (transitForm.querySelector("[name=birth_date]").value) transitForm.requestSubmit();
    } else {
      out.hidden = true; yr.hidden = false;
      if (lastTransit) showTransitYear(+transitMode);
      else if (transitForm.querySelector("[name=birth_date]").value) transitForm.requestSubmit();
      else { yr.innerHTML = emptyState("Enter birth details first, then pick a year.", "transits"); transitForm.classList.remove("collapsed"); }
    }
  });
})();
rerender.transits = () => { if (lastTransit) renderTransits(lastTransit); if (/^\d{4}$/.test(transitMode) && transitYearCache[transitMode]) renderTransitYear(+transitMode); };

/* sidereal zodiac wheel: transit planets outside, natal planets inside, natal lagna on the left */
function transitWheel(r) {
  const C = 170, R0 = 160, R1 = 130, R2 = 92;
  const asc = r.natal.lagna_longitude || 0;
  const pt = (lon, rad) => { const a = Math.PI + (lon - asc) * Math.PI / 180; return [C + rad * Math.cos(a), C - rad * Math.sin(a)]; };
  let s = `<svg class="wheel" viewBox="0 0 340 340" role="img" aria-label="Transit wheel">
    <circle cx="${C}" cy="${C}" r="${R0}" class="w-outer"/><circle cx="${C}" cy="${C}" r="${R1}" class="w-ring"/><circle cx="${C}" cy="${C}" r="${R2}" class="w-inner"/>`;
  for (let i = 0; i < 12; i++) {
    const [x0, y0] = pt(i * 30, R1), [x1, y1] = pt(i * 30, R0), [lx, ly] = pt(i * 30 + 15, (R0 + R1) / 2);
    s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="w-div"/>`;
    s += `<text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" class="w-sign">${esc(tr("rashi", RASHIS[i]).slice(0, LANG === "en" ? 3 : 4))}</text>`;
    const [a0, b0] = pt(i * 30, R2), [a1, b1] = pt(i * 30, R1);
    s += `<line x1="${a0.toFixed(1)}" y1="${b0.toFixed(1)}" x2="${a1.toFixed(1)}" y2="${b1.toFixed(1)}" class="w-div faint"/>`;
  }
  const place = (list, rad, step) => {
    const sorted = list.slice().sort((a, b) => a.lon - b.lon);
    let prev = -99, lane = 0;
    return sorted.map((p) => { lane = p.lon - prev < 9 ? (lane + 1) % 3 : 0; prev = p.lon; return Object.assign({}, p, { rad: rad - lane * step }); });
  };
  const tp = place(r.planets.filter((p) => ORDER.includes(p.planet)).map((p) => ({ k: p.planet, lon: p.longitude, retro: p.retrograde && !["Rahu", "Ketu"].includes(p.planet), fav: p.favourable })), 114, 15);
  tp.forEach((p) => {
    const [x, y] = pt(p.lon, p.rad);
    s += `<g class="w-p${p.fav ? " fav" : ""}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9.5" style="fill:${PCOLOR[p.k]}"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${GLYPH[p.k]}</text><title>${esc(tr("graha", p.k))} ${esc(signDeg(p.lon))}${p.retro ? " (R)" : ""}</title></g>`;
  });
  const nat = r.natal.longitudes || {};
  const np = place(Object.entries(nat).filter(([k]) => ORDER.includes(k) && k !== "Lagna").map(([k, lon]) => ({ k, lon })), 76, 13);
  np.forEach((p) => {
    const [x, y] = pt(p.lon, p.rad);
    s += `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="w-natal"><title>Natal ${esc(tr("graha", p.k))} ${esc(signDeg(p.lon))}</title>${esc(abbr(p.k))}</text>`;
  });
  const [ax, ay] = pt(asc, R0 + 2), [bx, by] = pt(asc, R2);
  s += `<line x1="${bx.toFixed(1)}" y1="${by.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" class="w-asc"/>`;
  s += `<text x="${C}" y="${C - 4}" class="w-c">Transit</text><text x="${C}" y="${C + 12}" class="w-c2">${esc(r.transit_time.slice(0, 10))}</text></svg>`;
  return s;
}

function renderTransits(r) {
  const n = r.natal;
  const nl = EN.rashi.indexOf(n.lagna) + 1, nm = EN.rashi.indexOf(n.moon_sign) + 1;
  const cells = {};
  for (let s = 1; s <= 12; s++) cells[s] = [];
  cells[nl].push({ t: abbr("Lagna"), cls: "asc", title: "Natal lagna" });
  cells[nm].push({ t: "\u263eN", cls: "natal", title: "Natal Moon" });
  r.planets.filter((p) => ORDER.includes(p.planet)).forEach((p) =>
    cells[p.rashi.index].push({ t: abbr(p.planet) + (p.retrograde && !["Rahu", "Ketu"].includes(p.planet) ? "\u211E" : ""), cls: (p.favourable ? "fav" : "") + (p.retrograde && !["Rahu", "Ketu"].includes(p.planet) ? " r" : ""), title: tr("graha", p.planet) }));
  const cp = r.current_saturn_phase;
  const verdict = (p) => p.favourable === undefined ? "" : p.favourable ? '<span class="good">favourable</span>'
    : p.vedha_by ? `<span class="warn">obstructed (vedha by ${esc(tr("graha", p.vedha_by))})</span>` : '<span class="bad">unfavourable</span>';
  const b = r._birth || {};
  transitForm.querySelector(".cs-text").innerHTML = `<b>${esc(r._name || "Natal chart")}</b> \u00b7 ${esc(b.date || "")} ${esc(b.time || "")}${b.place ? " \u00b7 " + esc(b.place) : ""}`;
  document.getElementById("transit-out").innerHTML = `
  <div class="transit-top">
    <div class="card">
      <div class="card-head"><h3>Current Transit Positions</h3><span class="hint">${esc(dateLabel(r.transit_time))} ${hm(r.transit_time)}</span></div>
      <div class="pos-list">${r.planets.map((p) => `<div class="pos-row"><span>${pdot(p.planet)}<b>${esc(tr("graha", p.planet))}</b></span><span>${esc(tr("rashi", p.rashi.name || RASHIS[p.rashi.index - 1]))}</span><span class="num">${dms(p.longitude % 30, false)}${p.retrograde && !["Rahu", "Ketu"].includes(p.planet) ? ' <span class="tagpill de">R</span>' : ""}</span><span class="hpill${p.favourable ? " good" : ""}" title="House from natal Moon">${p.house_from_moon}</span></div>`).join("")}</div>
    </div>
    <div class="card wheel-card">${transitWheel(r)}<p class="hint center">Outer ring: transits now \u00b7 inner: natal planets \u00b7 line: natal lagna</p></div>
    <div class="quick-col">
      <button type="button" class="quick" data-scroll="tr-chart">${ico("chart")}<span>Transit Chart</span></button>
      <button type="button" class="quick" data-scroll="tr-table">${ico("bars")}<span>Ashtakavarga &amp; Gochara</span></button>
      <button type="button" class="quick" data-scroll="tr-ingress">${ico("panchanga")}<span>Ingresses &amp; Chandrashtama</span></button>
      <button type="button" class="quick" data-scroll="tr-sade">${ico("transits")}<span>Sade Sati &amp; Shani</span></button>
      <div class="sat-card ${cp ? "on" : ""}"><small>Saturn now</small><b>${cp ? esc(cp.phase) : "No Sade Sati / Ashtama / Kantaka"}</b>${cp ? `<small>${dt(cp.start)} \u2192 ${dt(cp.end)}</small>` : ""}</div>
    </div>
  </div>
  <div class="card">
    <div class="card-head"><h3>Summary</h3><div class="row-actions"><button type="button" class="ghost" id="tr-json">${ico("download")}JSON</button><button type="button" class="ghost" data-report="transits">${ico("print")}Report</button></div></div>
    <div class="summary">
      <div class="stat"><div class="k">Transit moment</div><div class="v">${dt(r.transit_time)}</div><div class="s">transit lagna ${esc(tr("rashi", r.transit_lagna))}</div></div>
      <div class="stat"><div class="k">Natal ${t("Lagna")} \u00b7 Moon</div><div class="v">${esc(tr("rashi", n.lagna))} \u00b7 ${esc(tr("rashi", n.moon_sign))}</div><div class="s">${esc(tr("nakshatra", n.moon_nakshatra))}${r._name ? " \u00b7 " + esc(r._name) : ""}</div></div>
      <div class="stat"><div class="k">Vimshottari at that moment</div><div class="v">${r.current_dasha.map((x) => esc(tr("graha", x))).join(" \u203a ")}</div><div class="s">Maha \u203a Antar \u203a Pratyantar</div></div>
      <div class="stat"><div class="k">Saturn</div><div class="v">${cp ? esc(cp.phase) : "no Sade Sati / Ashtama / Kantaka"}</div><div class="s">${cp ? dt(cp.start) + " \u2192 " + dt(cp.end) : ""}</div></div>
    </div>
  </div>
  <div class="two">
    <div class="card" id="tr-chart"><div class="card-head"><h3>Transits over natal chart</h3><span class="hint">green = favourable</span></div>
      <div class="chart-visual sm">${kundali(cells, nl, `<div class="t">Gochara</div><div class="u">${esc(r.transit_time.slice(0, 16).replace("T", " "))}</div><div class="u">Asc natal lagna \u00b7 \u263eN natal Moon</div>`)}</div>
    </div>
    <div class="card" id="tr-table"><div class="card-head"><h3>Gochara table</h3></div>
      <div class="scroll"><table class="tbl"><tr><th>${t("Planet")}</th><th>Now in</th><th>${t("Nakshatra")}</th><th>From Moon</th><th>From lagna</th><th>BAV</th><th>SAV</th><th>Result</th></tr>
      ${r.planets.map((p) => `<tr><td>${pdot(p.planet)}<b>${esc(tr("graha", p.planet))}</b>${p.retrograde && !["Rahu", "Ketu"].includes(p.planet) ? ' <span class="tagpill de">R</span>' : ""}</td>
        <td>${signDeg(p.longitude)}</td><td>${esc(tr("nakshatra", p.nakshatra.name))} p${p.nakshatra.pada}</td><td>${p.house_from_moon}</td><td>${p.house_from_lagna}</td>
        <td class="${p.bav_bindus >= 5 ? "good" : p.bav_bindus <= 2 ? "bad" : ""}">${p.bav_bindus ?? ""}</td><td class="${p.sav_in_sign >= 30 ? "good" : p.sav_in_sign < 25 ? "bad" : ""}">${p.sav_in_sign}</td><td>${verdict(p)}</td></tr>`).join("")}
      </table></div>
      <p class="hint">${esc(r.rules)}. BAV = the planet's own Ashtakavarga bindus in the sign it is transiting; SAV = total bindus of that sign.</p>
    </div>
  </div>
  <div class="two-even">
    <div class="card" id="tr-sade"><div class="card-head"><h3>Sade Sati cycles (lifetime)</h3></div>
      ${r.saturn.sade_sati.map((c) => `<details class="dasha"${cp && c.start <= r.transit_time && r.transit_time < c.end ? " open" : ""}><summary><span class="lord">${dateLabel(c.start)}</span><span class="dates">\u2192 ${dateLabel(c.end)}</span></summary>
        <div class="inner"><table class="tbl">${c.phases.map((p) => `<tr><td>${esc(p.phase)}</td><td>${esc(tr("rashi", p.sign))}</td><td>${dt(p.start)}</td><td>${dt(p.end)}</td></tr>`).join("")}</table></div></details>`).join("")}
      <h4 class="mini-title">Ashtama (8th) and Kantaka (4th) Shani</h4>
      <div class="scroll"><table class="tbl">${r.saturn.ashtama_kantaka.map((p) => `<tr><td>${esc(p.phase)}</td><td>${esc(tr("rashi", p.sign))}</td><td>${dt(p.start)}</td><td>${dt(p.end)}</td></tr>`).join("")}</table></div>
    </div>
    <div class="card" id="tr-ingress"><div class="card-head"><h3>Upcoming slow-planet ingresses</h3><span class="hint">next 5 years</span></div>
      <div class="scroll"><table class="tbl"><tr><th>${t("Date")}</th><th>${t("Planet")}</th><th>Enters</th><th>From Moon</th><th>From lagna</th></tr>
      ${r.upcoming_ingresses.map((u) => `<tr><td>${dt(u.time)}</td><td>${pdot(u.planet)}<b>${esc(tr("graha", u.planet))}</b>${u.retrograde ? ' <span class="tagpill de">R</span>' : ""}</td><td>${esc(tr("rashi", u.sign))}</td><td>${u.house_from_moon}</td><td>${u.house_from_lagna}</td></tr>`).join("")}
      </table></div>
      <h4 class="mini-title">Chandrashtama (Moon in 8th from natal Moon), next 60 days</h4>
      <table class="tbl">${r.chandrashtama.map((c) => `<tr><td>${dt(c.start)}</td><td>\u2192 ${dt(c.end)}</td></tr>`).join("")}</table>
    </div>
  </div>`;
  document.getElementById("tr-json").onclick = () => download("transits-" + r.transit_time.slice(0, 10) + ".json", r);
  $$("#transit-out .quick[data-scroll]").forEach((q) => q.addEventListener("click", () => document.getElementById(q.dataset.scroll).scrollIntoView({ behavior: "smooth", block: "start" })));
}

/* a calendar year of ingresses and stations, read against the natal Moon and lagna */
async function showTransitYear(y) {
  const box = document.getElementById("transit-year");
  box.hidden = false;
  document.getElementById("transit-out").hidden = true;
  if (!transitYearCache[y]) {
    box.innerHTML = `<div class="card"><div class="card-head"><h3>Transits in ${y}</h3><span class="hint">Calculating\u2026</span></div><div class="skeleton"></div></div>`;
    const pl = lastTransit._place, start = y + "-01-01", end = y + "-12-31";
    try {
      transitYearCache[y] = await call("search", Object.assign({ start, end, categories: ["ingress", "station"],
        planets: ["Sun", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"], lat: pl.lat, lon: pl.lon, limit: 5000 }, rangeTz(pl, start, end), calc()));
    } catch (e) { box.innerHTML = `<div class="error-box">${ico("info")}<span>${esc(e.message)}</span></div>`; return; }
  }
  if (String(y) === transitMode) renderTransitYear(y);
}
let transitYearHidden = new Set(["Sun"]);
function renderTransitYear(y) {
  const r = transitYearCache[y], n = lastTransit.natal;
  const nm = EN.rashi.indexOf(n.moon_sign), nl = EN.rashi.indexOf(n.lagna);
  const evs = r.events.filter((e) => e.time && !transitYearHidden.has(e.body));
  const bodies = [...new Set(r.events.map((e) => e.body))];
  let html = "", cur = "";
  for (const e of evs) {
    const mk = e.time.slice(0, 7);
    if (mk !== cur) {
      if (cur) html += "</div>";
      cur = mk;
      html += `<h4 class="month-title">${esc(new Date(mk + "-01T00:00:00Z").toLocaleDateString(LOCALE(), { month: "long", year: "numeric", timeZone: "UTC" }))}</h4><div class="ev-list">`;
    }
    const si = EN.rashi.indexOf(e.name);
    const houses = e.category === "ingress" && si >= 0 ? `<span class="hpill" title="House from natal Moon">${((si - nm + 12) % 12) + 1} from Moon</span><span class="hpill alt" title="House from natal lagna">${((si - nl + 12) % 12) + 1} from lagna</span>` : "";
    html += `<div class="ev-row"><span class="ev-date">${esc(dateLabel(e.time, { year: undefined }))} <small>${hm(e.time)}</small></span><span>${pdot(e.body)}<b>${esc(eventTitle(e))}</b></span><span class="ev-tags"><span class="tagpill${e.category === "station" ? " de" : ""}">${esc(e.category === "station" ? "station" : "ingress")}</span>${houses}</span></div>`;
  }
  if (cur) html += "</div>";
  document.getElementById("transit-year").innerHTML = `<div class="card">
    <div class="card-head"><h3>Transits in ${y}</h3><span class="hint">${lastTransit._name ? esc(lastTransit._name) + " \u00b7 " : ""}natal Moon ${esc(tr("rashi", n.moon_sign))}, lagna ${esc(tr("rashi", n.lagna))}</span></div>
    <div class="chips">${bodies.map((b) => `<button type="button" class="chip${transitYearHidden.has(b) ? "" : " on"}" data-body="${b}">${esc(tr("graha", b))}</button>`).join("")}</div>
    ${html || '<p class="hint">No events for the selected planets.</p>'}
  </div>`;
  $$("#transit-year .chip").forEach((c) => c.addEventListener("click", () => {
    const k = c.dataset.body;
    transitYearHidden.has(k) ? transitYearHidden.delete(k) : transitYearHidden.add(k);
    renderTransitYear(y);
  }));
}

/* ---------- matching ---------- */
let lastMatch = null;
const matchForm = bindForm("match-form", "match-out", "match-hint", async (form) => {
  const g = readBirth(form, "g_"), b = readBirth(form, "b_");
  const strip = (x) => ({ date: x.date, time: x.time, tz_minutes: x.tz_minutes, lat: x.lat, lon: x.lon });
  const r = await call("match", Object.assign({ groom: strip(g), bride: strip(b) }, calc()));
  r._names = [g.name, b.name];
  lastMatch = r;
  renderMatch(r);
  return "";
});
rerender.match = () => lastMatch && renderMatch(lastMatch);
function renderMatch(r) {
  const a = r.ashtakoota, p = r.porutham, k = r.kuja_dosha;
  const pct = Math.round(a.total / a.max * 100);
  const person = (x, nm, label) => `<div class="stat"><div class="k">${label}${nm ? " \u00b7 " + esc(nm) : ""}</div><div class="v">${esc(tr("nakshatra", x.nakshatra))} p${x.pada}</div><div class="s">${esc(tr("rashi", x.rashi))}</div></div>`;
  document.getElementById("match-out").innerHTML = `
  <div class="card">
    <div class="card-head"><h3>Compatibility</h3><div class="row-actions"><button type="button" class="ghost" id="match-json">${ico("download")}JSON</button><button type="button" class="ghost" data-report="match">${ico("print")}Report</button></div></div>
    <div class="summary">
      ${person(r.groom, r._names[0], t("Groom"))}${person(r.bride, r._names[1], t("Bride"))}
      <div class="stat"><div class="k">Ashtakoota</div><div class="v">${a.total} / ${a.max}</div><div class="s"><div class="bar"><span style="width:${pct}%"></span></div>${esc(a.verdict)}</div></div>
      <div class="stat"><div class="k">Poruthams</div><div class="v">${p.matched} / ${p.of}</div><div class="s">${p.critical && p.critical.length ? '<span class="bad">critical: ' + p.critical.map(esc).join(", ") + "</span>" : "no critical failures"}</div></div>
      <div class="stat"><div class="k">Kuja dosha</div><div class="v">${k.groom.present ? "Groom \u2713" : "Groom \u2717"} \u00b7 ${k.bride.present ? "Bride \u2713" : "Bride \u2717"}</div><div class="s">${k.balanced ? '<span class="good">balanced</span>' : '<span class="warn">not balanced</span>'}</div></div>
    </div>
  </div>
  <div class="two-even">
    <div class="card"><h2>Ashtakoota (North Indian, 36 points)</h2>
      <table><tr><th>Koota</th><th>${t("Score")}</th><th>Max</th><th>Detail</th></tr>
      ${a.kootas.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td class="${x.score >= x.max * 0.5 ? "good" : "bad"}">${x.score}</td><td>${x.max}</td><td class="wrap hint">${esc(x.detail)}</td></tr>`).join("")}
      <tr><td><b>${t("Total")}</b></td><td><b>${a.total}</b></td><td>${a.max}</td><td></td></tr></table>
      ${a.notes && a.notes.length ? `<p class="hint">${a.notes.map(esc).join("<br>")}</p>` : ""}
    </div>
    <div class="card"><h2>Dashakoota / 10 Poruthams (South Indian)</h2>
      <table><tr><th>Porutham</th><th>Result</th><th>Detail</th></tr>
      ${p.poruthams.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${x.ok ? '<span class="good">\u2713</span>' : '<span class="bad">\u2717</span>'}</td><td class="wrap hint">${esc(x.detail)}</td></tr>`).join("")}
      </table><p class="hint">${esc(p.variant)}</p>
    </div>
  </div>
  <div class="card"><h2>Kuja (Mangal) dosha</h2>
    <table>${[["Groom", k.groom], ["Bride", k.bride]].map(([w, x]) => `<tr><td><b>${t(w)}</b></td><td>${x.present ? '<span class="warn">present</span>' : '<span class="good">absent</span>'}</td><td class="wrap">${esc(x.evidence || "")}</td><td class="wrap hint">${(x.cancellation_factors || []).map(esc).join("; ")}</td></tr>`).join("")}</table>
    <p class="hint">${esc(r.status)}. Matching uses traditional tables; read it as one input among many.</p>
  </div>`;
  document.getElementById("match-json").onclick = () => download("matching.json", r);
}

/* ---------- muhurta ---------- */
let lastMuhurta = null;
const muhurtaForm = bindForm("muhurta-form", "muhurta-out", "muhurta-hint", async (form) => {
  const f = new FormData(form);
  const pl = readPlace(form);
  const start = f.get("start"), end = f.get("end");
  const tz = rangeTz(pl, start, end);
  const params = Object.assign({ start, end, activity: f.get("activity"), lat: pl.lat, lon: pl.lon,
    include_night: !!f.get("include_night"), min_minutes: +f.get("min_minutes") || 24, moudhya: f.get("moudhya") || "auto" }, tz, calc());
  if (f.get("birth_nakshatra")) params.birth_nakshatra = +f.get("birth_nakshatra");
  if (f.get("birth_rashi")) params.birth_rashi = +f.get("birth_rashi");
  const r = await call("muhurta", params);
  lastMuhurta = r;
  renderMuhurta(r);
  return r.count + " windows";
});
muhurtaForm.querySelector("[name=start]").value = todayIso();
muhurtaForm.querySelector("[name=end]").value = addDays(todayIso(), 60);
rerender.muhurta = () => lastMuhurta && renderMuhurta(lastMuhurta);
let muhurtaSort = "date";
function renderMuhurta(r) {
  const ru = r.rules || {};
  const list = r.windows.slice().sort((a, b) => muhurtaSort === "score" ? b.score - a.score || a.start.localeCompare(b.start) : a.start.localeCompare(b.start));
  const names = (ids, arr, cat) => (ids || []).map((i) => tr(cat, arr[i - 1])).join(", ");
  document.getElementById("muhurta-out").innerHTML = `
  <div class="card">
    <h2>${esc(r.label)}</h2>
    <table class="rules">
      ${ru.nakshatras ? `<tr><td class="hint">${t("Nakshatra")}</td><td class="wrap">${esc(names(ru.nakshatras, EN.nakshatra, "nakshatra"))}</td></tr>` : ""}
      ${ru.weekdays ? `<tr><td class="hint">${t("Vara")}</td><td class="wrap">${esc(ru.weekdays.map((w) => tr("vara", EN.vara[w])).join(", "))}</td></tr>` : ""}
      ${ru.lagnas ? `<tr><td class="hint">${t("Lagna")}</td><td class="wrap">${esc(names(ru.lagnas, EN.rashi, "rashi"))}</td></tr>` : ""}
      ${ru.avoid_tithis ? `<tr><td class="hint">Avoid tithis</td><td class="wrap">${esc(ru.avoid_tithis.join(", "))}</td></tr>` : ""}
      ${ru.avoid_months ? `<tr><td class="hint">Avoid months</td><td class="wrap">${esc(ru.avoid_months.map((m) => tr("month", m)).join(", "))}</td></tr>` : ""}
      <tr><td class="hint">Always avoided</td><td class="wrap">${esc((r.always_avoided || []).join(", "))}</td></tr>
    </table>
  </div>
  ${muhurtaMoudhyaHTML(r)}
  <div class="card">
    <div class="row-actions"><span class="hint" style="margin-right:auto">${r.count} windows \u00b7 ${esc(r.status)}</span>
      <select id="mu-sort" style="max-width:180px"><option value="date">Sort by date</option><option value="score"${muhurtaSort === "score" ? " selected" : ""}>Sort by score</option></select>
      <button type="button" class="ghost" id="mu-ics">${ico("panchanga")}.ics</button><button type="button" class="ghost" id="mu-csv">${ico("download")}CSV</button><button type="button" class="ghost" data-report="muhurta">${ico("print")}Report</button></div>
    <div class="scroll"><table><tr><th>${t("Date")}</th><th>${t("Vara")}</th><th>Window</th><th>Min</th><th>${t("Tithi")}</th><th>${t("Nakshatra")}</th><th>${t("Yoga")} / ${t("Karana")}</th><th>${t("Lagna")}</th><th>Tara / Chandra</th><th>${t("Score")}</th></tr>
    ${list.map((w) => `<tr><td><b>${esc(dateLabel(w.date))}</b></td><td>${esc(tr("vara", w.vara))}</td><td><b>${hm(w.start)} \u2013 ${tmRel(w.end, w.date)}</b></td><td>${Math.round(w.minutes)}</td>
      <td>${esc(LANG === "en" ? w.tithi : trTithi(w.tithi.split(" ")[0], w.tithi.split(" ").slice(1).join(" ")))}</td><td>${esc(w.nakshatras.map((x) => tr("nakshatra", x)).join(", "))}</td>
      <td>${esc(tr("yoga", w.yoga))} / ${esc(tr("karana", w.karana))}</td><td>${esc(w.lagnas.map((x) => tr("rashi", x)).join(", "))}</td>
      <td>${esc(w.tarabala || "\u2014")} / ${w.chandrabala_house ?? "\u2014"}</td><td title="${esc(w.reasons.join("; "))}"><b>${w.score}</b> <span class="hint small">${esc(w.reasons.join("; "))}</span></td></tr>`).join("") || `<tr><td colspan="10" class="hint">No window satisfies all rules in this range.${r.suggestion ? " " + esc(r.suggestion.text) : " Try a longer range, include night, or lower the minimum window."}</td></tr>`}
    </table></div>
  </div>`;
  document.getElementById("mu-sort").onchange = (ev) => { muhurtaSort = ev.target.value; renderMuhurta(r); };
  document.getElementById("mu-csv").onclick = () => download(`muhurta-${r.activity}.csv`, toCSV([
    ["date", "weekday", "start", "end", "minutes", "tithi", "nakshatras", "yoga", "karana", "lagnas", "tarabala", "chandrabala", "score", "reasons"],
    ...list.map((w) => [w.date, w.vara, w.start, w.end, w.minutes, w.tithi, w.nakshatras.join("/"), w.yoga, w.karana, w.lagnas.join("/"), w.tarabala, w.chandrabala_house, w.score, w.reasons.join("; ")])]), "text/csv");
  document.getElementById("mu-ics").onclick = () => download(`muhurta-${r.activity}.ics`,
    icsCalendar(list.map((w) => ({ time: w.start, end: w.end, title: r.label + " muhurta", desc: w.tithi + ", " + w.nakshatras.join("/") + ", lagna " + w.lagnas.join("/") }))), "text/calendar");
}

/* ---------- eclipses ---------- */
let lastEclipse = null;
const eclipseForm = bindForm("eclipse-form", "eclipse-out", "eclipse-hint", async (form) => {
  const f = new FormData(form);
  const pl = readPlace(form);
  const start = f.get("start"), end = f.get("end");
  const kinds = ["solar", "lunar"].filter((k) => f.get(k));
  if (!kinds.length) throw new Error("Pick solar and/or lunar.");
  const tz = rangeTz(pl, start, end);
  const r = await call("eclipses", Object.assign({ start, end, kinds, lat: pl.lat, lon: pl.lon }, tz, calc()));
  r._visibleOnly = !!f.get("visible_only");
  lastEclipse = r;
  renderEclipses(r);
  return r.count + " eclipses";
});
eclipseForm.querySelector("[name=start]").value = todayIso();
eclipseForm.querySelector("[name=end]").value = addDays(todayIso(), 5 * 365);
rerender.eclipses = () => lastEclipse && renderEclipses(lastEclipse);
function renderEclipses(r) {
  const vis = (e) => e.type === "lunar" ? e.visible_any : e.local && e.local.visible;
  const list = r.eclipses.filter((e) => !r._visibleOnly || vis(e));
  const contacts = (c, alt) => Object.entries(c || {}).filter(([k]) => k !== "max").map(([k, v]) =>
    `<span class="ct-item"><b>${k}</b> ${dt(v)}${alt && alt[k] != null ? ` <span class="${alt[k] > 0 ? "good" : "hint"}">${alt[k].toFixed(0)}\u00b0</span>` : ""}</span>`).join("");
  document.getElementById("eclipse-out").innerHTML = `
  <div class="card">
    <div class="row-actions"><span class="hint" style="margin-right:auto">${list.length} of ${r.count} \u00b7 ${esc(r.method.lunar)} \u00b7 ${esc(r.method.solar)}</span>
      <button type="button" class="ghost" id="ec-ics">${ico("panchanga")}.ics</button><button type="button" class="ghost" id="ec-json">JSON</button><button type="button" class="ghost" data-report="eclipses">${ico("print")}Report</button></div>
    ${list.map((e) => {
      const l = e.local || {};
      const v = vis(e);
      return `<div class="eclipse ${e.type}">
        <div class="eh"><span class="big">${e.type === "solar" ? "\u2600" : "\u263e"}</span>
          <div><b>${esc(e.kind)} ${e.type} eclipse</b> \u00b7 ${dt(e.max)}<div class="hint">Moon in ${esc(tr("nakshatra", e.moon_nakshatra))} (${esc(tr("rashi", e.moon_rashi))}) \u00b7 Sun in ${esc(tr("rashi", e.sun_rashi))}</div></div>
          <span class="tagpill ${v ? "ex" : ""}" style="margin-left:auto">${v ? "visible here" : "not visible here"}</span></div>
        ${e.type === "lunar" ? `<div class="small">Umbral magnitude <b>${e.umbral_magnitude}</b> \u00b7 penumbral ${e.penumbral_magnitude} \u00b7 duration ${e.duration_minutes} min</div>
          <div class="contacts">${contacts(e.contacts, e.moon_altitude)}</div><div class="hint small">Numbers after times are the Moon's altitude here; positive means above the horizon.</div>`
        : `<div class="small">Gamma <b>${e.gamma}</b>${e.global_magnitude != null ? " \u00b7 global magnitude " + e.global_magnitude : ""}</div>
          ${l.visible ? `<div class="small">Here: <b>${esc(l.kind)}</b>, magnitude ${l.magnitude}, obscuration ${(l.obscuration * 100).toFixed(1)}%, ${l.duration_minutes} min</div>
          <div class="contacts">${contacts(l.contacts, l.sun_altitude)}<span class="ct-item"><b>max</b> ${dt(l.contacts && l.contacts.max)}</span></div>` : `<div class="hint small">${esc(l.reason || "")}</div>`}`}
      </div>`;
    }).join("") || '<p class="hint">No eclipses in this range.</p>'}
  </div>`;
  document.getElementById("ec-json").onclick = () => download("eclipses.json", r);
  document.getElementById("ec-ics").onclick = () => download("eclipses.ics", icsCalendar(list.map((e) => {
    const c = e.type === "lunar" ? e.contacts : (e.local && e.local.contacts) || {};
    const s = c.P1 || c.C1 || e.max, en = c.P4 || c.C4 || e.max;
    return { time: s, end: en, title: `${e.kind} ${e.type} eclipse`, desc: vis(e) ? "visible" : "not visible here" };
  })), "text/calendar");
}
