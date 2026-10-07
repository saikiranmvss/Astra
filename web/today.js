"use strict";
/* Today at a glance (dashboard section and a quick drawer on every page), quick
   date chips on the forms, Moudhyami display and the muhurta person picker.
   Every value shown comes from the engine's `today` call. Depends on app.js / tabs.js. */

/* ---------- natal Moon for personal checks (from a chart calculation) ---------- */
const natalCache = {};
async function natalOf(p) {
  const key = [p.name, p.date, p.time, p.coords, settings().ayanamsa].join("|");
  if (natalCache[key]) return natalCache[key];
  const { lat, lon } = parseCoords(p.coords);
  let time = p.time || "12:00:00";
  if (time.length === 5) time += ":00";
  const ov = parseOverride(p.tzoverride);
  const tz_minutes = ov != null ? ov : tzOffsetMinutes(p.tz || LOCAL_TZ, p.date, time);
  const r = await call("chart", Object.assign({ date: p.date, time, tz_minutes, lat, lon, dasha_levels: 1 }, calc()));
  const moon = r.chart.grahas.Moon;
  natalCache[key] = { name: p.name, moon_sign: moon.rashi.index, nakshatra: moon.nakshatra.index,
    nakshatra_name: moon.nakshatra.name, rashi_name: moon.rashi.name, lagna: r.chart.lagna.rashi.index };
  return natalCache[key];
}

/* ---------- loading ---------- */
let todayData = null, todayLoading = null;
function refreshTodayPickers() {
  const pl = profiles();
  const opts = (none) => `<option value="">${esc(none)}</option>` + pl.map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join("");
  const tp = document.getElementById("today-profile");
  const cur = store.get("todayProfile", "");
  tp.innerHTML = opts("Everyone (general)");
  const idx = pl.findIndex((p) => p.name === cur);
  tp.value = idx >= 0 ? String(idx) : "";
  $$(".mu-profile").forEach((s) => { const v = s.value; s.innerHTML = opts("Nobody (skip personal checks)"); s.value = v; });
}
function loadToday(force) {
  if (todayLoading && !force) return todayLoading;
  const job = (async () => {
    const p = defaultPlace();
    const { lat, lon } = parseCoords(p.coords);
    const date = todayIso();
    const params = Object.assign({ date, lat, lon, muhurta_days: 30 }, tzRange(p.tz, date, addDays(date, 400)), calc(),
      { tz_minutes: tzOffsetMinutes(p.tz, date, "12:00:00") });
    const prof = profiles().find((x) => x.name === store.get("todayProfile", ""));
    if (prof) { try { params.natal = await natalOf(prof); } catch (e) { console.error(e); } }
    const r = await call("today", params);
    r._place = p.name || p.coords;
    r._natal = params.natal || null;
    todayData = r;
    renderTodayAll();
    if (typeof updateBell === "function") updateBell();
    return r;
  })();
  todayLoading = job;
  job.catch((e) => {
    document.getElementById("dash-today").innerHTML = `<div class="card error-box">${esc(e.message)}</div>`;
  }).finally(() => { if (todayLoading === job) todayLoading = null; });
  return job;
}
document.getElementById("today-refresh").addEventListener("click", () => {
  document.getElementById("dash-today").classList.add("busy-soft");
  loadToday(true).finally(() => document.getElementById("dash-today").classList.remove("busy-soft"));
});
document.getElementById("today-profile").addEventListener("change", (e) => {
  const p = profiles()[+e.target.value];
  store.set("todayProfile", p ? p.name : "");
  document.getElementById("dash-today").classList.add("busy-soft");
  loadToday(true).finally(() => document.getElementById("dash-today").classList.remove("busy-soft"));
});

/* ---------- shared helpers ---------- */
const tdNow = (r) => nowLocalIso(r.panchanga.tz_minutes);
const hmRange = (w) => (w && w.start ? `${hm(w.start)} \u2013 ${hm(w.end)}` : "\u2014");
const inWin = (w, now) => w && w.start && w.start <= now && now < w.end;
const WIN_COLOR = { rahu: "#ef4444", yama: "#f97316", gulika: "#64748b", dur: "#b45309", varj: "#a855f7",
  abhijit: "#16a34a", amrita: "#14b8a6", brahma: "#0ea5e9", pradosha: "#6366f1" };
function dayWindows(pan) {
  const m = pan.muhurta || {};
  const out = [];
  const add = (key, label, w, kind, note) => { if (w && w.start) out.push({ key, label, start: w.start, end: w.end, kind, note: note || "" }); };
  add("brahma", "Brahma muhurta", m.brahma_muhurta, "good", "2nd-last night muhurta");
  add("abhijit", t("Abhijit"), m.abhijit, pan.vara.index === 3 ? "neutral" : "good", pan.vara.index === 3 ? "not used on Wednesday" : "8th day muhurta");
  (m.amrita_kala || []).forEach((w) => add("amrita", t("Amrita kala"), w, "good", w.nakshatra ? tr("nakshatra", w.nakshatra) : ""));
  add("rahu", t("Rahu kala"), m.rahu_kala, "bad", "1/8 of the day by weekday");
  add("yama", t("Yamaganda"), m.yamaganda, "bad", "");
  add("gulika", t("Gulika"), m.gulika_kala, "bad", "");
  (m.durmuhurta || []).forEach((w) => add("dur", t("Durmuhurta"), w, "bad", ""));
  (m.varjyam || []).forEach((w) => add("varj", t("Varjyam"), w, "bad", w.nakshatra ? tr("nakshatra", w.nakshatra) : ""));
  add("pradosha", "Pradosha", m.pradosha, "neutral", "3 night muhurtas after sunset");
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
function nowState(pan, now) {
  const wins = dayWindows(pan);
  const bad = wins.filter((w) => w.kind === "bad" && inWin(w, now));
  const good = wins.filter((w) => w.kind === "good" && inWin(w, now));
  const next = wins.find((w) => w.start > now && w.kind !== "neutral");
  return { bad, good, next };
}
const REASON_LABEL = { nakshatra: "nakshatra not suitable", tithi: "tithi to avoid", weekday: "weekday not suitable", yoga: "inauspicious yoga",
  "vishti karana": "Vishti (Bhadra) karana", month: "lunar month avoided / adhika", lagna: "lagna not suitable", "rahu kala": "Rahu kala",
  yamaganda: "Yamaganda", gulika: "Gulika kala", durmuhurta: "Durmuhurta", varjyam: "Varjyam", tarabala: "Tarabala weak",
  chandrabala: "Chandrabala weak", "guru moudhyami": "Guru moudhyami", "shukra moudhyami": "Shukra moudhyami" };
const reasonText = (k) => REASON_LABEL[k] || k;
const dShort = (iso) => (iso ? dateLabel(iso.slice(0, 10)) : "\u2026");

function moudhyaRows(status) {
  return ["Jupiter", "Venus"].map((b) => {
    const s = status && status[b];
    if (!s) return "";
    const cur = s.current, nx = s.next;
    const sub = s.combust
      ? `In moudhyami ${cur && cur.start ? "since " + dShort(cur.start) + " " : ""}until ${cur && cur.end ? dShort(cur.end) + " " + hm(cur.end) : "\u2026"}`
      : nx ? `Next: ${dShort(nx.start)} \u2013 ${dShort(nx.end)}${nx.days ? ` (${Math.round(nx.days)} days)` : ""}` : "No period in the coming year";
    const sep = s.separation_deg != null ? ` \u00b7 ${s.separation_deg.toFixed(1)}\u00b0 from the Sun (orb ${s.orb_deg}\u00b0)` : "";
    return `<div class="md-row"><span class="md-ico">${pdot(b, true)}</span><span class="md-body"><b>${esc(s.short)} moudhyami</b><small>${esc(sub)}${sep}</small></span>
      <span class="pill ${s.combust ? "bad" : "good"}">${s.combust ? "Combust" : "Clear"}</span></div>`;
  }).join("");
}

/* ---------- chakras ---------- */
const polar = (c, deg, r) => [c + r * Math.sin(deg * Math.PI / 180), c - r * Math.cos(deg * Math.PI / 180)];
function arcPath(c, d0, d1, r) {
  const [x0, y0] = polar(c, d0, r), [x1, y1] = polar(c, d1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/* 24-hour day chakra: sunrise at the left, the day across the top, the night across the bottom */
function dayChakra(pan, now) {
  const m = pan.muhurta;
  if (!m || !pan.sunrise || !pan.next_sunrise) return "";
  const C = 190, ms = (iso) => Date.parse(iso + "Z");
  const a = ms(pan.sunrise), b = ms(pan.next_sunrise), span = b - a;
  const ang = (iso) => -90 + (ms(iso) - a) / span * 360;
  const arc = (s, e, r, w, color, title, op) => {
    const d0 = Math.max(-90, ang(s)), d1 = Math.min(270, ang(e));
    if (d1 - d0 <= 0.05) return "";
    return `<path d="${arcPath(C, d0, d1, r)}" stroke="${color}" stroke-width="${w}" fill="none"${op ? ` opacity="${op}"` : ""}><title>${esc(title)}</title></path>`;
  };
  const text = (s, e, r, label, cls) => {
    const d = (Math.max(-90, ang(s)) + Math.min(270, ang(e))) / 2;
    const [x, y] = polar(C, d, r);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}">${esc(label)}</text>`;
  };
  let svg = "";
  svg += arc(pan.sunrise, pan.sunset, 168, 12, "url(#dc-day)", `Day ${hm(pan.sunrise)} \u2013 ${hm(pan.sunset)}`);
  svg += arc(pan.sunset, pan.next_sunrise, 168, 12, "#26306b", `Night ${hm(pan.sunset)} \u2013 ${hm(pan.next_sunrise)}`);
  const QC = { good: "#22c55e", neutral: "#60a5fa", bad: "#f87171" };
  (m.choghadiya || []).forEach((c) => {
    svg += arc(c.start, c.end, 146, 24, QC[c.quality] || "#94a3b8", `${tr("chog", c.name)} (${c.quality}) ${hm(c.start)} \u2013 ${hm(c.end)}`, 0.9);
    svg += text(c.start, c.end, 146, tr("chog", c.name).slice(0, 4), "dc-t");
  });
  (m.horas || []).forEach((h) => {
    svg += arc(h.start, h.end, 119, 24, PCOLOR[h.lord] || "#888", `Hora of ${tr("graha", h.lord)} ${hm(h.start)} \u2013 ${hm(h.end)}`, 0.85);
    svg += text(h.start, h.end, 119, GLYPH[h.lord] || "", "dc-g");
  });
  dayWindows(pan).forEach((w) => {
    if (w.kind === "neutral") return;
    const r = w.kind === "bad" ? 95 : 80;
    svg += arc(w.start, w.end, r, 10, WIN_COLOR[w.key] || "#888", `${w.label} ${hm(w.start)} \u2013 ${hm(w.end)}`);
  });
  for (let h = Math.ceil(a / 3600000); h * 3600000 < b; h++) {
    const t0 = h * 3600000;
    const hr = new Date(t0).getUTCHours();
    const d = -90 + (t0 - a) / span * 360;
    const [x0, y0] = polar(C, d, 176), [x1, y1] = polar(C, d, hr % 3 ? 179 : 183);
    svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="dc-tick"/>`;
    if (hr % 3 === 0) { const [tx, ty] = polar(C, d, 193); svg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="dc-h">${String(hr).padStart(2, "0")}</text>`; }
  }
  let centre = `<text x="${C}" y="${C - 8}" class="dc-c1">${esc(dateLabel(pan.date, { year: undefined }))}</text>`;
  if (now >= pan.sunrise && now < pan.next_sunrise) {
    const d = ang(now);
    const [x, y] = polar(C, d, 172);
    svg += `<line x1="${C}" y1="${C}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="dc-hand"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" class="dc-dot"/>`;
    const hora = (m.horas || []).find((h) => inWin(h, now)), chog = (m.choghadiya || []).find((c) => inWin(c, now));
    centre = `<text x="${C}" y="${C - 16}" class="dc-c0">${now.slice(11, 16)}</text>
      <text x="${C}" y="${C + 8}" class="dc-c2">${hora ? esc(GLYPH[hora.lord] + " " + tr("graha", hora.lord)) + " hora" : ""}</text>
      <text x="${C}" y="${C + 26}" class="dc-c2">${chog ? esc(tr("chog", chog.name)) : ""}</text>`;
  }
  return `<svg viewBox="-14 -14 408 408" class="dchakra" role="img" aria-label="Day chakra">
    <defs><linearGradient id="dc-day" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs>
    <circle cx="${C}" cy="${C}" r="180" class="dc-bg"/>${svg}
    <circle cx="${C}" cy="${C}" r="66" class="dc-core"/>${centre}
  </svg>`;
}
/* graha chakra: sidereal zodiac with the lagna at the left, 27 nakshatras and the planets now */
const RSHORT = ["Mesha", "Vrsbh", "Mithn", "Karka", "Simha", "Kanya", "Tula", "Vrsch", "Dhanu", "Makar", "Kumbh", "Meena"];
function skyChakra(r) {
  const sky = r.sky, asc = sky.lagna.longitude, C = 190;
  const ang = (lon) => -90 - (lon - asc);
  let svg = "";
  for (let s = 0; s < 12; s++) {
    const [x0, y0] = polar(C, ang(s * 30), 140), [x1, y1] = polar(C, ang(s * 30), 178);
    svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="sk-line"/>`;
    const [tx, ty] = polar(C, ang(s * 30 + 15), 160);
    svg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="sk-sign${s === sky.lagna.rashi.index - 1 ? " asc" : ""}">${esc(LANG === "en" ? RSHORT[s] : tr("rashi", RASHIS[s]).slice(0, 4))}</text>`;
  }
  const moon = sky.planets.find((p) => p.planet === "Moon");
  const nakSpan = 360 / 27, mn = Math.floor(moon.longitude / nakSpan);
  const d0 = ang((mn + 1) * nakSpan), d1 = ang(mn * nakSpan);
  svg += `<path d="${arcPath(C, d0, d1, 129)}" stroke="var(--primary)" stroke-opacity=".22" stroke-width="20" fill="none"><title>Moon in ${esc(moon.nakshatra.name)}</title></path>`;
  for (let k = 0; k < 27; k++) {
    const [x0, y0] = polar(C, ang(k * nakSpan), 119), [x1, y1] = polar(C, ang(k * nakSpan), 140);
    svg += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="sk-nl"/>`;
    const [tx, ty] = polar(C, ang(k * nakSpan + nakSpan / 2), 129.5);
    svg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="sk-n${k === mn ? " on" : ""}">${k + 1}</text>`;
  }
  const [lx, ly] = polar(C, -90, 178);
  svg += `<line x1="${C - 52}" y1="${C}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" class="sk-asc"/><text x="${C - 58}" y="${C - 8}" class="sk-asct">Asc ${esc(dms(asc % 30, false))}</text>`;
  const pts = sky.planets.filter((p) => ORDER.includes(p.planet) || settings().show_outer).slice().sort((x, y) => x.longitude - y.longitude);
  let prev = -99, lane = 0;
  pts.forEach((p) => {
    lane = p.longitude - prev < 9 ? (lane + 1) % 3 : 0;
    prev = p.longitude;
    const rr = 98 - lane * 22;
    const [x, y] = polar(C, ang(p.longitude), rr);
    const [ex, ey] = polar(C, ang(p.longitude), 118);
    const retro = p.retrograde && !["Rahu", "Ketu"].includes(p.planet);
    svg += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="sk-tick"/>
      <g class="sk-p"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="${PCOLOR[p.planet]}"/><text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="sk-pg">${GLYPH[p.planet]}</text>
      ${retro ? `<text x="${(x + 11).toFixed(1)}" y="${(y - 9).toFixed(1)}" class="sk-r">R</text>` : ""}<title>${esc(tr("graha", p.planet))} ${esc(tr("rashi", p.rashi.name))} ${esc(dms(p.longitude % 30, false))}${retro ? " retrograde" : ""}</title></g>`;
  });
  return `<svg viewBox="-4 -4 388 388" class="schakra" role="img" aria-label="Graha chakra">
    <circle cx="${C}" cy="${C}" r="178" class="sk-bg"/><circle cx="${C}" cy="${C}" r="140" class="sk-ring"/><circle cx="${C}" cy="${C}" r="119" class="sk-ring"/>${svg}
    <text x="${C}" y="${C + 4}" class="sk-c">${esc(r.sky.time.slice(11, 16))}</text></svg>`;
}
function skyKundali(r) {
  const s = settings();
  const cells = {};
  for (let i = 1; i <= 12; i++) cells[i] = [];
  const ls = r.sky.lagna.rashi.index;
  cells[ls].push({ t: abbr("Lagna"), cls: "asc", title: "Lagna now" });
  r.sky.planets.filter((p) => ORDER.includes(p.planet) || (s.show_outer && OUTER.includes(p.planet))).forEach((p) => {
    const retro = p.retrograde && !["Rahu", "Ketu"].includes(p.planet) && s.show_retro;
    cells[p.rashi.index].push({ t: abbr(p.planet) + (retro ? "\u211E" : "") + (s.show_deg ? " " + Math.floor(p.longitude % 30) + "\u00b0" : ""),
      cls: retro ? "r" : "", title: tr("graha", p.planet) + " " + dms(p.longitude % 30, false) });
  });
  return kundali(cells, ls, `<div class="t">Sky now</div><div class="u">${esc(r.sky.time.slice(0, 16).replace("T", " "))}</div>`);
}

/* ---------- dashboard: Today at a glance ---------- */
function nowBoxes(r, now) {
  const pan = r.panchanga, m = pan.muhurta || {};
  const hora = (m.horas || []).find((h) => inWin(h, now)), chog = (m.choghadiya || []).find((c) => inWin(c, now));
  const st = nowState(pan, now);
  const box = (cls, icon, k, v, s) => `<div class="nb ${cls}"><span class="nb-ico">${icon}</span><span class="nb-b"><small>${k}</small><b>${v}</b><em>${s}</em></span></div>`;
  const verdict = st.bad.length ? box("bad", ico("info"), "Right now", "Avoid", esc(st.bad.map((w) => `${w.label} till ${hm(w.end)}`).join(", ")))
    : st.good.length ? box("good", ico("check"), "Right now", "Auspicious", esc(st.good.map((w) => `${w.label} till ${hm(w.end)}`).join(", ")))
    : box("", ico("muhurta"), "Right now", "Neutral", st.next ? esc(`${st.next.label} at ${hm(st.next.start)}`) : "no more windows today");
  const md = r.moudhya.status, anyComb = md.Jupiter.combust || md.Venus.combust;
  const lag = r.sky.lagna;
  return `<div class="now-strip">
    ${hora ? box("", pdot(hora.lord, true), "Hora now", esc(tr("graha", hora.lord)), `till ${hm(hora.end)}`) : ""}
    ${chog ? box(chog.quality === "good" ? "good" : chog.quality === "bad" ? "bad" : "", ico("timeline"), "Choghadiya", esc(tr("chog", chog.name)), `${esc(chog.quality)} \u00b7 till ${hm(chog.end)}`) : ""}
    ${verdict}
    ${box("", ico("chart"), "Lagna now", esc(tr("rashi", lag.rashi.name)), esc(dms(lag.longitude % 30, false)))}
    ${box(anyComb ? "bad" : "good", ico("eclipse"), "Moudhyami", anyComb ? [md.Jupiter.combust ? "Guru" : "", md.Venus.combust ? "Shukra" : ""].filter(Boolean).join(" & ") + " combust" : "None now",
      anyComb ? "ceremonies postponed" : esc(`next: ${[md.Jupiter.next, md.Venus.next].filter(Boolean).sort((x, y) => x.start.localeCompare(y.start)).map((x) => x.short + " " + dShort(x.start))[0] || "\u2014"}`))}
    ${box("", ico("sunrise"), "Sun \u00b7 Moon", `${hm(pan.sunrise)} \u2013 ${hm(pan.sunset)}`, pan.moonrise ? `\u263e rise ${tmRel(pan.moonrise, pan.date)}${pan.moonset ? " \u00b7 set " + tmRel(pan.moonset, pan.date) : ""}` : `\u263e no moonrise today${pan.moonset ? " \u00b7 set " + hm(pan.moonset) : ""}`)}
  </div>`;
}
function timingsTable(r, now) {
  const rows = dayWindows(r.panchanga).map((w) => {
    const st = now < w.start ? "upcoming" : now < w.end ? "now" : "over";
    return `<tr class="${st === "over" ? "dim" : ""}"><td><span class="wdot" style="--wc:${WIN_COLOR[w.key] || "#94a3b8"}"></span><b>${esc(w.label)}</b>${w.note ? ` <span class="hint small">${esc(w.note)}</span>` : ""}</td>
      <td class="num"><b>${hm(w.start)} \u2013 ${tmRel(w.end, r.panchanga.date)}</b></td><td><span class="pill ${w.kind}">${w.kind === "bad" ? "avoid" : w.kind === "good" ? "good" : "info"}</span></td>
      <td><span class="st ${st}">${st}</span></td></tr>`;
  }).join("");
  return `<div class="tscroll"><table class="tt"><tr><th>Window</th><th>Time</th><th>Type</th><th>Status</th></tr>${rows}</table></div>`;
}
function planetsTable(r) {
  const s = settings();
  return `<div class="tscroll"><table class="tt"><tr><th>${t("Planet") || "Planet"}</th><th>${t("Rashi")}</th><th>Degree</th><th>${t("Nakshatra")}</th><th>Motion</th></tr>
    ${r.sky.planets.filter((p) => ORDER.includes(p.planet) || (s.show_outer && OUTER.includes(p.planet))).map((p) => {
      const retro = p.retrograde && !["Rahu", "Ketu"].includes(p.planet);
      return `<tr><td>${pdot(p.planet)}<b>${esc(tr("graha", p.planet))}</b></td><td>${esc(tr("rashi", p.rashi.name))}${withFlag(skyFlag(p.planet, p.rashi.index))}</td><td class="num">${esc(dms(p.longitude % 30, false))}</td>
        <td>${esc(tr("nakshatra", p.nakshatra.name))} <span class="hint">p${p.nakshatra.pada}</span></td>
        <td>${retro ? '<span class="tagpill de">R</span>' : '<span class="hint">direct</span>'}${p.combust ? ' <span class="tagpill warn" title="within combustion orb of the Sun">combust</span>' : ""}</td></tr>`;
    }).join("")}</table></div>`;
}
function muhurtaToday(r) {
  const mu = r.muhurta;
  const open = mu.open_today;
  const gen = mu.by_activity.find((x) => x.activity === "general");
  const reasons = Object.keys(mu.general_rejected_minutes || {}).slice(0, 3).map(reasonText);
  const openHTML = open.length ? `<div class="open-list">${open.map((o) => `<button type="button" class="open-i" data-act="${o.activity}"><b>${esc(o.label)}</b><span>${o.windows.map((w) => `${hm(w.start)} \u2013 ${hm(w.end)}`).join(", ")}</span></button>`).join("")}</div>`
    : `<div class="empty-inline">${ico("info")}<div><b>No muhurta passes every rule today</b><small>Mostly blocked by: ${esc(reasons.join(", ") || "\u2014")}.${gen && gen.next ? ` Next good window: ${esc(dateLabel(gen.next.date))} ${hm(gen.next.start)} \u2013 ${hm(gen.next.end)}.` : ""}</small></div></div>`;
  const rows = mu.by_activity.map((a) => {
    const n = a.next, b = a.best;
    return `<tr><td><b>${esc(a.label)}</b>${a.moudhya_checked ? ' <span class="tagpill" title="Guru / Shukra moudhyami checked for this activity">moudhya</span>' : ""}</td>
      <td>${n ? `<b>${esc(dateLabel(n.date))}</b> <span class="hint">${esc(tr("vara", n.vara))}</span><br>${hm(n.start)} \u2013 ${tmRel(n.end, n.date)}` : `<span class="hint">none in ${mu.days} days${a.moudhya_blocked_days ? ` (${a.moudhya_blocked_days} days in moudhyami)` : a.top_reason ? ` (mostly ${esc(reasonText(a.top_reason))})` : ""}</span>`}</td>
      <td>${b ? `${esc(dateLabel(b.date))} ${hm(b.start)} <span class="score">${b.score}</span>` : "\u2014"}</td><td class="num">${a.count}</td>
      <td><button type="button" class="btn ghost sm" data-act="${a.activity}">Find</button></td></tr>`;
  }).join("");
  return `<h4 class="mini-title">Open today</h4>${openHTML}
    <h4 class="mini-title">Next good muhurta for every event <span class="hint">(next ${mu.days} days, all rules incl. Moudhyami)</span></h4>
    <div class="scroll"><table class="tt"><tr><th>Event</th><th>Next window</th><th>Best scored</th><th>Windows</th><th></th></tr>${rows}</table></div>`;
}
function moudhyaCard(r) {
  const md = r.moudhya;
  const now = r.now;
  const end = addDays(r.date, 365);
  const a = Date.parse(r.date + "T00:00:00Z"), b = Date.parse(end + "T00:00:00Z");
  const pct = (iso) => Math.max(0, Math.min(100, (Date.parse(iso + "Z") - a) / (b - a) * 100));
  const lanes = ["Jupiter", "Venus"].map((pl) => `<div class="md-lane"><span>${esc(pl === "Jupiter" ? "Guru" : "Shukra")}</span><div class="md-track">${md.periods.filter((p) => p.planet === pl && (!p.end || p.end >= r.date) && (!p.start || p.start <= end)).map((p) => {
    const l = p.start ? pct(p.start) : 0, rr = p.end ? pct(p.end) : 100;
    return `<i class="${pl === "Jupiter" ? "g" : "s"}" style="left:${l}%;width:${Math.max(0.8, rr - l)}%" title="${esc(p.name)} ${esc(dShort(p.start))} \u2013 ${esc(dShort(p.end))}"></i>`;
  }).join("")}</div></div>`).join("");
  const months = [];
  for (let i = 0; i < 12; i += 2) { const d = new Date(Date.UTC(+r.date.slice(0, 4), +r.date.slice(5, 7) - 1 + i, 1)); months.push(`<span style="left:${pct(d.toISOString().slice(0, 19))}%">${d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</span>`); }
  const list = md.periods.filter((p) => !p.end || p.end >= now.slice(0, 10)).map((p) => `<tr><td>${pdot(p.planet)}<b>${esc(p.name)}</b></td><td>${esc(dShort(p.start))} ${p.start ? hm(p.start) : ""}</td><td>${esc(dShort(p.end))} ${p.end ? hm(p.end) : ""}</td><td class="num">${p.days ? Math.round(p.days) : "\u2014"}</td><td class="hint">${esc(p.type)} \u00b7 orb ${p.orb_deg}\u00b0</td></tr>`).join("");
  return `${moudhyaRows(md.status)}
    <div class="md-chart">${lanes}<div class="md-months">${months.join("")}</div></div>
    <div class="tscroll"><table class="tt"><tr><th>Period</th><th>From</th><th>To</th><th>Days</th><th>Type</th></tr>${list || '<tr><td colspan="5" class="hint">No moudhyami in the coming year.</td></tr>'}</table></div>
    <p class="hint">${esc(md.rule)}. Start and end are root-solved for each planet; marriage, upanayana, griha pravesha and similar ceremonies are not suggested inside these periods.</p>`;
}
function personalCard(r) {
  const p = r.personal;
  if (!p) return `<div class="empty-inline">${ico("user")}<div><b>Personal Tarabala &amp; Chandrabala</b><small>${profiles().length ? "Pick a saved chart in \u201cFor\u201d above to see today\u2019s strength for that person." : "Save a birth chart to see today\u2019s Tarabala, Chandrabala and gochara for that person."}</small></div></div>`;
  const n = r._natal || {};
  return `<div class="pers-top">
      <div class="pers-b ${p.tarabala.good ? "good" : "bad"}"><small>Tarabala</small><b>${esc(p.tarabala.name)}</b><em>${p.tarabala.number} of 9 \u00b7 ${p.tarabala.good ? "favourable" : "unfavourable"}</em></div>
      <div class="pers-b ${p.chandrabala.good ? "good" : "bad"}"><small>Chandrabala</small><b>${p.chandrabala.house}${["th", "st", "nd", "rd"][p.chandrabala.house % 10 > 3 || [11, 12, 13].includes(p.chandrabala.house) ? 0 : p.chandrabala.house % 10]} from Moon</b><em>${p.chandrabala.good ? "favourable" : "unfavourable"}</em></div>
      <div class="pers-b ${p.chandrashtama ? "bad" : "good"}"><small>Chandrashtama</small><b>${p.chandrashtama ? "Yes, today" : "No"}</b><em>${esc(n.nakshatra_name ? tr("nakshatra", n.nakshatra_name) + " \u00b7 " + tr("rashi", n.rashi_name) : "")}</em></div>
    </div>
    <h4 class="mini-title">Gochara from natal Moon</h4>
    <div class="goch">${p.gochara.map((g) => `<span class="gc ${g.favourable ? "good" : g.vedha_by ? "warn" : "bad"}" title="${g.vedha_by ? "vedha by " + esc(g.vedha_by) : ""}">${pdot(g.planet)}<b>${g.house_from_moon}</b></span>`).join("")}</div>
    <p class="hint">Green: favourable house; amber: good house obstructed (vedha); red: unfavourable. Counted from ${esc(p.name || n.name || "the chart")}\u2019s natal Moon.</p>`;
}
function renderTodayDash(r) {
  const now = tdNow(r);
  document.getElementById("today-sub").textContent = `${longDate(r.date)} \u00b7 ${r._place} \u00b7 calculated in ${r.compute_seconds.toFixed(2)} s`;
  document.getElementById("dash-today").innerHTML = `
    ${nowBoxes(r, now)}
    <div class="today-grid3">
      <div class="card"><div class="card-head"><h3>Day chakra</h3><span class="hint">sunrise to sunrise</span></div>
        <div class="chakra-wrap">${dayChakra(r.panchanga, now)}</div>
        <div class="legend"><span><i style="--c:#22c55e"></i>good choghadiya</span><span><i style="--c:#f87171"></i>bad choghadiya</span><span><i style="--c:#ef4444"></i>Rahu</span><span><i style="--c:#f97316"></i>Yama</span><span><i style="--c:#64748b"></i>Gulika</span><span><i style="--c:#16a34a"></i>Abhijit</span><span><i style="--c:#14b8a6"></i>Amrita</span><span><i style="--c:#a855f7"></i>Varjyam</span></div>
      </div>
      <div class="card"><div class="card-head"><h3>Sky now</h3><span class="hint">${esc(tr("rashi", r.sky.lagna.rashi.name))} lagna</span></div>
        <div class="chart-visual sm" id="today-kundali">${skyKundali(r)}</div></div>
      <div class="card"><div class="card-head"><h3>Graha chakra</h3><span class="hint">27 nakshatras \u00b7 Moon in ${esc(tr("nakshatra", r.sky.planets.find((p) => p.planet === "Moon").nakshatra.name))}</span></div>
        <div class="chakra-wrap">${skyChakra(r)}</div></div>
    </div>
    <div class="today-grid2">
      <div class="card"><div class="card-head"><h3>All timings today</h3><a class="link" href="#panchanga" data-tab-link="panchanga">Full Panchanga</a></div>${timingsTable(r, now)}</div>
      <div class="card"><div class="card-head"><h3>Planets now</h3><a class="link" href="#transits" data-tab-link="transits">Transits</a></div>${planetsTable(r)}</div>
    </div>
    ${(r.panchanga.namakshara || []).length ? `<div class="card" id="today-nama"><div class="card-head"><h3>Name letters today</h3><span class="hint">first syllable of the name for a baby born in each window (Moon's nakshatra pada)</span></div>${namaStrip(r.panchanga.namakshara, now, r.date)}</div>` : ""}
    ${r.panchanga.shanti_windows ? `<div class="card" id="today-shanti"><div class="card-head"><h3>Shanti windows today</h3><span class="hint">a baby born in these times traditionally needs a shanti</span></div>${shantiWindows(r.panchanga.shanti_windows, now, r.date)}</div>` : ""}
    <div class="card" id="today-muhurta"><div class="card-head"><h3>Muhurtas</h3><a class="link" href="#muhurta" data-tab-link="muhurta">Muhurta finder</a></div>${muhurtaToday(r)}</div>
    <div class="today-grid2">
      <div class="card"><div class="card-head"><h3>Moudhyami</h3><span class="hint">Guru &amp; Shukra combustion, next 12 months</span></div>${moudhyaCard(r)}</div>
      <div class="card"><div class="card-head"><h3>For you today</h3><span class="hint">Tarabala \u00b7 Chandrabala \u00b7 Gochara</span></div>${personalCard(r)}</div>
    </div>`;
}

/* ---------- quick drawer (every page) ---------- */
const drawer = document.getElementById("today-drawer"), drawerScrim = document.getElementById("drawer-scrim");
function openDrawer() {
  drawer.hidden = false; drawerScrim.hidden = false;
  requestAnimationFrame(() => drawer.classList.add("open"));
  renderDrawer();
  if (!todayData) loadToday();
}
function closeDrawer() { drawer.classList.remove("open"); drawerScrim.hidden = true; setTimeout(() => { if (!drawer.classList.contains("open")) drawer.hidden = true; }, 220); }
document.getElementById("today-btn").addEventListener("click", (e) => { e.stopPropagation(); closePops(); drawer.classList.contains("open") ? closeDrawer() : openDrawer(); });
document.getElementById("td-close").addEventListener("click", closeDrawer);
drawerScrim.addEventListener("click", closeDrawer);
drawer.addEventListener("click", (e) => { if (e.target.closest("[data-tab-link], [data-act]")) closeDrawer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(); });
function renderDrawer() {
  const p = defaultPlace();
  document.getElementById("td-date").textContent = longDate(todayIso());
  document.getElementById("td-place").textContent = p.name || p.coords;
  const body = document.getElementById("td-body");
  const r = todayData;
  if (!r) { body.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><p class="hint">Calculating today\u2019s sky\u2026</p>'; return; }
  const pan = r.panchanga, now = tdNow(r);
  const cur = (list) => currentOf(list, now);
  const ti = cur(pan.tithi), nk = cur(pan.nakshatra), yo = cur(pan.yoga), ka = cur(pan.karana);
  const row = (k, v, till) => `<div class="dr-row"><span>${k}</span><b>${v}</b><em>${till ? "till " + tmRel(till, pan.date) : ""}</em></div>`;
  const fest = typeof dashData !== "undefined" && dashData.upcoming ? dashData.upcoming.festivals.filter((f) => f.date <= addDays(r.date, 7)).slice(0, 5) : [];
  const open = r.muhurta.open_today;
  body.innerHTML = `${nowBoxes(r, now)}
    <div class="dr-sec"><h4>Panchanga</h4>
      ${row(t("Tithi"), esc(trTithi(ti.paksha, ti.name)) + withFlag(tithiFlag(ti.index)), ti.end)}${row(t("Nakshatra"), esc(tr("nakshatra", nk.name)) + withFlag(nakFlag(nk.name)), nk.end)}
      ${row(t("Yoga"), esc(tr("yoga", yo.name)) + withFlag(yogaFlag(yo.name)), yo.end)}${row(t("Karana"), esc(tr("karana", ka.name)) + withFlag(karanaFlag(ka.name)), ka.end)}
      ${row(t("Vara"), esc(tr("vara", pan.vara.name)), "")}${row(t("Month"), esc(tr("month", pan.lunar_month.name)) + (pan.lunar_month.adhika ? " (Adhika)" : "") + " \u00b7 " + esc(tr("paksha", pan.lunar_month.paksha)), "")}
    </div>
    <div class="dr-sec"><h4>Timings</h4>${dayWindows(pan).map((w) => `<div class="dr-row ${now >= w.end ? "dim" : ""}"><span><i class="wdot" style="--wc:${WIN_COLOR[w.key] || "#94a3b8"}"></i>${esc(w.label)}</span><b>${hm(w.start)} \u2013 ${tmRel(w.end, pan.date)}</b><em>${inWin(w, now) ? "now" : ""}</em></div>`).join("")}</div>
    <div class="dr-sec"><h4>Muhurtas open today</h4>${open.length ? open.slice(0, 8).map((o) => `<div class="dr-row"><span>${esc(o.label)}</span><b>${o.windows.map((w) => hm(w.start) + "\u2013" + hm(w.end)).join(", ")}</b><em><button type="button" class="link-btn" data-act="${o.activity}">find</button></em></div>`).join("")
      : `<p class="hint">None today (${esc(Object.keys(r.muhurta.general_rejected_minutes || {}).slice(0, 2).map(reasonText).join(", "))}).</p>`}</div>
    <div class="dr-sec"><h4>Moudhyami</h4>${moudhyaRows(r.moudhya.status)}</div>
    ${(pan.namakshara || []).length ? `<div class="dr-sec"><h4>Name letters today</h4>${namaRows(pan.namakshara, now, pan.date)}</div>` : ""}
    ${pan.shanti_windows ? `<div class="dr-sec"><h4>Shanti windows today</h4>${shantiWindows(pan.shanti_windows, now, pan.date)}</div>` : ""}
    ${r.personal ? `<div class="dr-sec"><h4>For ${esc(r.personal.name || r._natal.name || "you")}</h4>${row("Tarabala", esc(r.personal.tarabala.name) + (r.personal.tarabala.good ? " \u2713" : " \u2717"), "")}${row("Chandrabala", r.personal.chandrabala.house + (r.personal.chandrabala.good ? " \u2713" : " \u2717"), "")}</div>` : ""}
    ${fest.length ? `<div class="dr-sec"><h4>Festivals this week</h4>${fest.map((f) => `<div class="dr-row"><span>${esc(dateLabel(f.date))}</span><b>${esc(trFest(f))}</b><em></em></div>`).join("")}</div>` : ""}
    <div class="dr-actions"><a class="btn primary" href="#panchanga" data-tab-link="panchanga">${ico("panchanga")}Panchanga</a><a class="btn ghost" href="#muhurta" data-tab-link="muhurta">${ico("muhurta")}Muhurta</a></div>`;
}
function renderTodayAll() {
  if (!todayData) return;
  if (todayData.date !== todayIso()) { loadToday(true); return; }
  renderTodayDash(todayData);
  if (drawer.classList.contains("open")) renderDrawer();
}
rerender.today = renderTodayAll;
setInterval(() => { if (todayData && (currentTab === "dashboard" || drawer.classList.contains("open"))) renderTodayAll(); }, 60000);

/* open the muhurta finder for an activity over the next two months */
function openMuhurtaFor(act) {
  const f = muhurtaForm;
  f.querySelector("[name=activity]").value = act;
  f.querySelector("[name=start]").value = todayIso();
  f.querySelector("[name=end]").value = addDays(todayIso(), 60);
  const had = !!lastMuhurta;
  showTab("muhurta");
  if (had) f.run();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (b && !b.closest("#muhurta-form")) { e.preventDefault(); openMuhurtaFor(b.dataset.act); }
});

/* ---------- quick date chips ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest(".qchips button");
  if (!b) return;
  const form = b.closest("form");
  const today = todayIso();
  if (b.dataset.fyear != null) {
    form.querySelector("[name=year]").value = +today.slice(0, 4) + +b.dataset.fyear;
  } else {
    let start, end;
    if (b.dataset.year != null) { const y = +today.slice(0, 4) + +b.dataset.year; start = `${y}-01-01`; end = `${y}-12-31`; }
    else if (b.dataset.month != null) { start = today.slice(0, 8) + "01"; end = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).toISOString().slice(0, 10); }
    else if (b.dataset.past) { start = addDays(today, +b.dataset.days); end = today; }
    else { start = addDays(today, +(b.dataset.offset || 0)); end = addDays(start, +b.dataset.days); }
    form.querySelector("[name=start]").value = start;
    form.querySelector("[name=end]").value = end;
    const q = form.querySelector("[name=quick]");
    if (q) q.value = "";
  }
  form.querySelectorAll(".qchips button").forEach((x) => x.classList.toggle("on", x === b));
  form.requestSubmit();
});
document.getElementById("panch-tomorrow").addEventListener("click", () => {
  panchForm.querySelector("[name=date]").value = addDays(todayIso(), 1);
  panchForm.requestSubmit();
});
document.getElementById("cal-this").addEventListener("click", () => {
  calForm.querySelector("[name=month]").value = todayIso().slice(0, 7);
  calForm.requestSubmit();
});
/* Prashna: a chart for this moment at the default place */
document.getElementById("prashna-btn").addEventListener("click", () => {
  const p = defaultPlace();
  const local = new Date(Date.now() + offsetAt(p.tz || LOCAL_TZ, Date.now()) * 60000).toISOString();
  const form = document.getElementById("chart-form");
  setPlace(form, "", { name: p.name || "", coords: p.coords, tz: p.tz });
  form.querySelector("[name=name]").value = "Prashna " + local.slice(0, 16).replace("T", " ");
  form.querySelector("[name=date]").value = local.slice(0, 10);
  form.querySelector("[name=time]").value = local.slice(11, 19);
  form.requestSubmit();
});

/* ---------- muhurta: person picker and Moudhyami view ---------- */
document.addEventListener("change", async (e) => {
  const s = e.target;
  if (!s.classList || !s.classList.contains("mu-profile")) return;
  const form = s.closest("form");
  const nak = form.querySelector("[name=birth_nakshatra]"), ras = form.querySelector("[name=birth_rashi]");
  if (s.value === "") { nak.value = ""; ras.value = ""; return; }
  const p = profiles()[+s.value];
  if (!p) return;
  try {
    const n = await natalOf(p);
    nak.value = String(n.nakshatra);
    ras.value = String(n.moon_sign);
    toast(`${p.name}: ${tr("nakshatra", n.nakshatra_name)}, Moon in ${tr("rashi", n.rashi_name)}`);
  } catch (err) { toast(err.message, "bad"); }
});
function muhurtaMoudhyaHTML(r) {
  const md = r.moudhya;
  if (!md) return "";
  const a = Date.parse(r.start + "T00:00:00Z"), b = Date.parse(addDays(r.end, 1) + "T00:00:00Z");
  const pct = (iso) => Math.max(0, Math.min(100, (Date.parse(iso + "Z") - a) / (b - a) * 100));
  const inRange = md.periods.filter((p) => (!p.end || p.end >= r.start) && (!p.start || p.start <= r.end + "T23:59:59"));
  const bars = ["Jupiter", "Venus"].map((pl) => `<div class="md-lane"><span>${pl === "Jupiter" ? "Guru" : "Shukra"}</span><div class="md-track">${inRange.filter((p) => p.planet === pl).map((p) => {
    const l = p.start ? pct(p.start) : 0, rr = p.end ? pct(p.end) : 100;
    return `<i class="${pl === "Jupiter" ? "g" : "s"}" style="left:${l}%;width:${Math.max(0.8, rr - l)}%" title="${esc(p.name)}"></i>`;
  }).join("")}</div></div>`).join("");
  const status = md.checked
    ? (md.blocked_days.length ? `<span class="pill bad">${md.blocked_days.length} day${md.blocked_days.length > 1 ? "s" : ""} skipped</span> These dates fall inside moudhyami, so no muhurta is suggested on them.`
      : `<span class="pill good">Clear</span> No Guru or Shukra moudhyami inside this range.`)
    : md.traditional_for_activity ? `<span class="pill warn">Ignored</span> You chose to ignore moudhyami for this search.`
    : `<span class="pill">Not required</span> This activity is not traditionally postponed for moudhyami; periods are shown for information.`;
  const rej = Object.entries(r.rejected_minutes || {}).slice(0, 7);
  const maxv = rej.length ? rej[0][1] : 1;
  return `<div class="card">
    <div class="card-head"><h3>Moudhyami &amp; why time was rejected</h3>${r.suggestion ? `<button type="button" class="btn primary sm" id="mu-after">${ico("right")}Search from ${esc(dShort(r.suggestion.clear_from))}</button>` : ""}</div>
    <p class="md-status">${status}</p>
    ${inRange.length ? `<div class="md-chart">${bars}<div class="md-months"><span style="left:0">${esc(dShort(r.start))}</span><span style="left:auto;right:0">${esc(dShort(r.end))}</span></div></div>
      <div class="md-list">${inRange.map((p) => `<span>${pdot(p.planet)}<b>${esc(p.name)}</b> ${esc(dShort(p.start))} ${p.start ? hm(p.start) : ""} \u2013 ${esc(dShort(p.end))} ${p.end ? hm(p.end) : ""} <span class="hint">(${p.days ? Math.round(p.days) + " days, " : ""}${esc(p.type)})</span></span>`).join("")}</div>` : ""}
    ${rej.length ? `<h4 class="mini-title">Daytime rejected, by rule <span class="hint">(a slot can fail several rules)</span></h4>
      <div class="rej">${rej.map(([k, v]) => `<div class="rej-row"><span>${esc(reasonText(k))}</span><div class="rej-bar"><i style="width:${(v / maxv * 100).toFixed(1)}%"></i></div><b>${(v / 60).toFixed(1)} h</b></div>`).join("")}</div>` : ""}
    <p class="hint">${esc(md.rule)}; the periods are root-solved from the planets\u2019 positions, not copied from a calendar.</p>
  </div>`;
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#mu-after") || !lastMuhurta || !lastMuhurta.suggestion) return;
  const from = lastMuhurta.suggestion.clear_from.slice(0, 10);
  muhurtaForm.querySelector("[name=start]").value = from;
  muhurtaForm.querySelector("[name=end]").value = addDays(from, 60);
  muhurtaForm.requestSubmit();
});
refreshTodayPickers();
