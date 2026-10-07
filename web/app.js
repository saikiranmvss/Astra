"use strict";

/* ---------- engine (Web Worker running Pyodide), one request at a time ---------- */
const worker = new Worker("worker.js");
const pending = new Map();
let seq = 0, queue = Promise.resolve();
worker.onmessage = (ev) => {
  const { id, ok, result, error } = ev.data;
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  ok ? p.resolve(result) : p.reject(new Error(error));
};
function rawCall(kind, params) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, kind, params });
  });
}
function call(kind, params) {
  const run = queue.then(() => rawCall(kind, params));
  queue = run.catch(() => {});
  return run;
}

const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
function setStatus(state, text) {
  statusEl.className = "status " + state;
  statusText.textContent = text;
}
let engineIsReady = false;
const bootStart = performance.now();
const engineReady = call("ping", {})
  .then((r) => {
    engineIsReady = true;
    setStatus("ready", "Engine ready \u00b7 " + ((performance.now() - bootStart) / 1000).toFixed(1) + " s");
    document.getElementById("engine-version").textContent = "Engine build " + r.version + ".";
    return r;
  })
  .catch((e) => { setStatus("error", "Engine failed: " + e.message); throw e; });

/* ---------- small helpers ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
const ico = (name, cls) => `<svg class="ico${cls ? " " + cls : ""}"><use href="#i-${name}"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let toastTimer = null;
function toast(text, kind) {
  const el = document.getElementById("toast");
  el.className = "toast" + (kind ? " " + kind : "");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

/* moon phase icon for a tithi number 1..30 (elongation at the tithi's middle), or for an elongation in degrees */
function moonSVG(tithi, size, elong) {
  size = size || 18;
  const r = size / 2 - 1, c = size / 2;
  const deg = elong != null ? ((elong % 360) + 360) % 360 : (tithi - 0.5) * 12;
  const e = deg * Math.PI / 180;
  const cosE = Math.cos(e), rx = Math.abs(cosE) * r;
  const waxing = deg <= 180;
  const s1 = waxing ? 1 : 0;
  const s2 = waxing ? (cosE < 0 ? 1 : 0) : (cosE < 0 ? 0 : 1);
  const lit = `M${c},${c - r} A${r},${r} 0 0 ${s1} ${c},${c + r} A${rx.toFixed(2)},${r} 0 0 ${s2} ${c},${c - r} Z`;
  return `<svg class="moon-ico" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${r}" fill="#2a2f4a"/>
    <path d="${lit}" fill="#f4f1e6"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(120,120,160,.35)" stroke-width=".6"/></svg>`;
}
const GLYPH = { Sun: "\u2609", Moon: "\u263D", Mars: "\u2642", Mercury: "\u263F", Jupiter: "\u2643", Venus: "\u2640", Saturn: "\u2644",
  Rahu: "\u260A", Ketu: "\u260B", Uranus: "\u2645", Neptune: "\u2646", Pluto: "\u2647", Lagna: "\u2191" };
const PCOLOR = { Sun: "#f59e0b", Moon: "#64748b", Mars: "#ef4444", Mercury: "#10b981", Jupiter: "#eab308", Venus: "#ec4899",
  Saturn: "#6366f1", Rahu: "#475569", Ketu: "#a16207", Uranus: "#0ea5e9", Neptune: "#3b82f6", Pluto: "#7c3aed", Lagna: "#7c6cff" };
const glyph = (k) => `<span class="glyph" style="--pc:${PCOLOR[k] || "#7c6cff"}">${GLYPH[k] || ""}</span>`;
/* name syllable (namakshara) in the script of the current language */
const sylOf = (e) => (!e ? "" : LANG === "te" ? e.telugu : LANG === "en" ? e.latin : e.devanagari);
const sylAll = (e) => `${e.latin} \u00b7 ${e.devanagari} \u00b7 ${e.telugu}`;
const sylAlt = (e) => (e.alternates || []).map((a) => `${a.latin} (${a.devanagari} \u00b7 ${a.telugu}) in ${a.note}`).join("; ");
function namaRows(list, now, day) {
  return `<div class="nama-rows">${list.map((e) => {
    const on = now && e.start <= now && now < e.end;
    return `<div class="nama-row${on ? " on" : ""}" title="${esc(sylAlt(e))}"><span class="ns">${esc(sylOf(e))}</span>
      <span class="nb2"><b>${esc(sylAll(e))}</b><small>${esc(tr("nakshatra", e.nakshatra))} pada ${e.pada} \u00b7 ${esc(tr("rashi", e.rashi))}</small></span>
      <span class="nt">${tmRel(e.start, day)} \u2013 ${tmRel(e.end, day)}${on ? '<em>now</em>' : ""}</span></div>`;
  }).join("")}</div>`;
}
function namaStrip(list, now, day) {
  return `<div class="nama-strip">${list.map((e) => {
    const on = now && e.start <= now && now < e.end;
    return `<div class="nama-chip${on ? " on" : ""}" title="${esc(sylAlt(e))}"><span class="ns">${esc(sylOf(e))}</span>
      <b>${esc(sylAll(e))}</b><small>${esc(tr("nakshatra", e.nakshatra))} \u00b7 pada ${e.pada}</small>
      <span class="nt">${tmRel(e.start, day)} \u2013 ${tmRel(e.end, day)}</span>${on ? '<em>now</em>' : ""}</div>`;
  }).join("")}</div>`;
}
function namaCard(nm) {
  const hrs = (m) => (m == null ? "?" : m >= 60 ? (m / 60).toFixed(1) + " h" : Math.round(m) + " min");
  const chip = (e, on) => `<span class="sy${on ? " on" : ""}" title="${esc(e.latin)}"><b>${esc(sylOf(e))}</b><small>${esc(LANG === "en" ? e.devanagari + " " + e.telugu : e.latin)}</small></span>`;
  const nb = nm.neighbour;
  return `
  <div class="card nama-card">
    <div class="card-head"><h3>Name letter (Namakshara)</h3><span class="hint">from the Moon's nakshatra pada at birth</span></div>
    <div class="nama-main">
      <div class="nama-big"><span class="ns">${esc(sylOf(nm))}</span><div><b>${esc(sylAll(nm))}</b><small>${esc(tr("nakshatra", nm.nakshatra))} pada ${nm.pada} \u00b7 ${esc(tr("rashi", nm.rashi))} rashi</small></div></div>
      <div class="nama-sets">
        <div><h4 class="mini-title">${esc(tr("nakshatra", nm.nakshatra))} padas 1\u20134</h4><div class="sy-row">${nm.nakshatra_syllables.map((e, i) => chip(e, i + 1 === nm.pada)).join("")}</div></div>
        <div><h4 class="mini-title">${esc(tr("rashi", nm.rashi))} rashi letters</h4><div class="sy-row">${nm.rashi_syllables.map((e) => chip(e, e.nakshatra === nm.nakshatra && e.pada === nm.pada)).join("")}</div></div>
      </div>
    </div>
    <p class="nama-note">The Moon was in this pada from <b>${esc(dt(nm.pada_start))}</b> to <b>${esc(dt(nm.pada_end))}</b>; birth is ${hrs(nm.minutes_after_start)} after it began and ${hrs(nm.minutes_before_end)} before it ends.</p>
    ${nb ? `<p class="nama-warn">${ico("info")}Birth is only ${hrs(nb.minutes)} from the ${nb.side} pada (${esc(tr("nakshatra", nb.nakshatra))} ${nb.pada} = <b>${esc(sylAll(nb))}</b>). Check the birth time; a few minutes earlier or later changes the letter.</p>` : ""}
    ${nm.alternates ? `<p class="hint">Regional variant: ${esc(sylAlt(nm))}.</p>` : ""}
    <p class="hint">${esc(nm.rule)}. The Moon position is calculated; the syllable table is traditional.</p>
  </div>`;
}
const pdot = (k, big) => `<span class="pdot-i${big ? " big" : ""}" style="--pc:${PCOLOR[k] || "#7c6cff"}">${GLYPH[k] || esc(String(k).slice(0, 2))}</span>`;

/* ---------- caution flags: shanti, afflicted planets, inauspicious panchanga ---------- */
const FLAG_ICON = { danger: "\u26a0", warn: "!", info: "i" };
const flag = (level, text, title) => `<span class="flag ${level}"${title ? ` title="${esc(title)}"` : ""}><i>${FLAG_ICON[level] || "!"}</i>${esc(text)}</span>`;
const GANDAMOOLA_NAK = new Set(["Ashwini", "Ashlesha", "Magha", "Jyeshtha", "Mula", "Revati"]);
const STRONG_BAD_YOGA = new Set(["Vyatipata", "Vaidhriti"]);
const MINOR_BAD_YOGA = new Set(["Vishkambha", "Atiganda", "Shula", "Ganda", "Vyaghata", "Vajra", "Parigha"]);
const DEBIL_SIGN = { Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1 };
const nakFlag = (name) => (GANDAMOOLA_NAK.has(name) ? flag("warn", "Gandamoola", "A birth in this nakshatra traditionally calls for Gandamoola shanti") : "");
function tithiFlag(index) {
  if (index === 30) return flag("danger", "Amavasya", "New Moon: avoided for auspicious work; a birth now calls for Darsha shanti");
  if (index === 29) return flag("warn", "Krishna Chaturdashi", "Rikta tithi; a birth now traditionally calls for shanti");
  if ([4, 9, 14, 19, 24].includes(index)) return flag("info", "Rikta", "Rikta tithi: avoided for auspicious work");
  return "";
}
const yogaFlag = (name) => (STRONG_BAD_YOGA.has(name) ? flag("warn", name, "Inauspicious yoga; a birth now traditionally calls for shanti")
  : MINOR_BAD_YOGA.has(name) ? flag("info", "inauspicious", "Avoided for auspicious work") : "");
const karanaFlag = (name) => (name === "Vishti" ? flag("warn", "Bhadra", "Vishti (Bhadra) karana: avoided for auspicious work") : "");
/* flag of one panchanga element: cat is tithi | nakshatra | yoga | karana */
const elemFlag = (cat, x) => (!x ? "" : cat === "tithi" ? tithiFlag(x.index) : cat === "nakshatra" ? nakFlag(x.name) : cat === "yoga" ? yogaFlag(x.name) : cat === "karana" ? karanaFlag(x.name) : "");
const withFlag = (f) => (f ? " " + f : "");
/* a transiting planet in its sign of debilitation (sign index 1-12) */
const skyFlag = (planet, sign) => (DEBIL_SIGN[planet] === sign ? flag("danger", "debilitated", `${planet} is in its sign of debilitation`) : "");
/* afflictions of a natal planet: [{level, text, title}] */
function planetIssues(k, x) {
  const out = [];
  if (!x || k === "Lagna") return out;
  if (x.dignity === "debilitated") out.push({ level: "danger", text: "debilitated", title: `${k} is in its sign of debilitation` });
  if (x.combust) out.push({ level: "warn", text: "combust", title: `${k} is within its combustion orb of the Sun` });
  if (x.house_whole_sign === 8) out.push({ level: "warn", text: "8th house", title: "Placed in the 8th house (dusthana)" });
  return out;
}
const issueFlags = (list) => list.map((i) => flag(i.level, i.text, i.title)).join(" ");
const rowLevel = (list) => (list.some((i) => i.level === "danger") ? " row-danger" : list.some((i) => i.level === "warn") ? " row-warn" : "");
/* a natal lord's affliction as one small flag (dashas, reports) */
function lordFlag(lord) {
  const g = lastChart && lastChart.chart.grahas[lord];
  const top = planetIssues(lord, g).filter((i) => i.level !== "info")[0];
  return top ? " " + flag(top.level, top.text, top.title + " in the birth chart") : "";
}
const SH_ORDER = { danger: 0, warn: 1, info: 2 };
/* shanti finding of the given keys from a chart's shanti check, as a flag */
function shFlag(sh, keys) {
  const it = sh && sh.items.filter((i) => keys.includes(i.key)).sort((a, b) => SH_ORDER[a.level] - SH_ORDER[b.level])[0];
  return it ? " " + flag(it.level, it.name, it.detail) : "";
}
const LEVEL_WORD = { danger: "Shanti", warn: "Caution", info: "Mild" };
/* the four padas of a Gandamoola nakshatra with their traditional effects */
const padaStrip = (padas) => `<div class="pada-strip">${padas.map((p) => `<span class="pd ${p.level}${p.birth ? " on" : ""}"><b>Pada ${p.pada}${p.birth ? " \u00b7 birth" : ""}</b>${esc(p.effect)}</span>`).join("")}</div>`;
function shantiCard(sh) {
  if (!sh) return "";
  const ret = sh.nakshatra_return;
  const n = sh.items.filter((i) => i.level !== "info").length;
  const icon = sh.level === "ok" ? ico("check") : ico("info");
  const sub = sh.level === "ok"
    ? "None of the janana dosha rules apply to this birth moment."
    : `${n} finding${n === 1 ? "" : "s"}${ret ? ` \u00b7 the Moon returns to ${esc(tr("nakshatra", ret.nakshatra))} on <b>${esc(dt(ret.start))}</b>, the usual day for the shanti` : ""}`;
  return `
  <div class="card shanti-card">
    <div class="card-head"><h3>Shanti check</h3><span class="hint">Janana dosha \u00b7 traditional rules on the calculated birth moment</span></div>
    <div class="sh-verdict ${sh.level}">${icon}<div><b>${esc(sh.title)}</b><small>${sub}</small></div></div>
    ${sh.items.length ? `<div class="sh-list">${sh.items.map((i) => `<div class="sh-item ${i.level}">${flag(i.level, i.level === "danger" ? "Shanti" : i.level === "warn" ? "Caution" : "Note")}
      <div><b>${esc(i.name)}</b> <span>${esc(i.detail)}</span>${i.padas ? padaStrip(i.padas) : ""}${i.level !== "info" && i.remedy ? `<small>Remedy: ${esc(i.remedy)}</small>` : ""}${i.rule ? `<small class="hint">${esc(i.rule)}</small>` : ""}</div></div>`).join("")}</div>` : ""}
    <p class="hint">Checked: Gandamoola pada by pada, nakshatra / tithi / lagna gandanta, Abhukta Mula, Amavasya, Krishna Chaturdashi, Vishti, Vyatipata / Vaidhriti, Varjyam, Sankranti, eclipse. Not checked: ${esc(sh.not_checked)} Traditions differ; confirm with your family priest.</p>
  </div>`;
}
const GANA_OF_NAK = "DMRMDMDDRRMMDRDRDRRMMDRRMMD";
const NAK_ORDER = ["Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
  "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana",
  "Dhanishtha", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"];
const ganaOf = (nak) => ({ D: "Deva", M: "Manushya", R: "Rakshasa" })[GANA_OF_NAK[NAK_ORDER.indexOf(nak)]] || "";
const ganaHint = (nak) => { const g = ganaOf(nak); return g ? ` <span class="gana ${g.toLowerCase()}" title="Gana (gunam) of the nakshatra"><small>${g} gana</small></span>` : ""; };
/* nature of the birth star (janma nakshatra gunam) */
const ganaPill = (g) => `<span class="gana ${g.name.toLowerCase()}" title="${esc(g.text)}">${esc(g.name)} <small>${esc(g.meaning)}</small></span>`;
function natureCard(n) {
  if (!n) return "";
  const cell = (k, v, s) => `<div class="nat-c"><small>${k}</small><b>${v}</b>${s ? `<span>${esc(s)}</span>` : ""}</div>`;
  return `
  <div class="card nature-card">
    <div class="card-head"><h3>Nature of the birth star</h3><span class="hint">Janma nakshatra gunam \u00b7 ${esc(tr("nakshatra", n.nakshatra))}</span></div>
    <div class="nat-top">
      <div class="nat-gana ${n.gana.name.toLowerCase()}"><small>Gana (Gunam)</small><b>${esc(n.gana.name)} gana</b><em>${esc(n.gana.meaning)} temperament</em></div>
      <p class="nat-traits"><b>${esc(n.traits)}</b><span>${esc(n.gana.text)}</span><span>${esc(n.gati.name)} (${esc(n.gati.meaning)}) star: ${esc(n.gati.text)}</span></p>
    </div>
    ${n.pada ? `<div class="nat-pada">
      <div class="nat-pada-head"><b>Pada ${n.pada.pada} of ${esc(tr("nakshatra", n.nakshatra))}</b><span>${esc(tr("rashi", n.pada.navamsa))} navamsa \u00b7 lord ${esc(tr("graha", n.pada.navamsa_lord))} \u00b7 ${esc(n.pada.purpose)} pada (${esc(n.pada.purpose_text)})</span></div>
      <p>${esc(n.pada.traits)}</p>
      <div class="pada-strip">${n.padas.map((p) => `<span class="pd${p.pada === n.pada.pada ? " on" : ""}"><b>Pada ${p.pada} \u00b7 ${esc(tr("rashi", p.navamsa))}</b>${esc(p.purpose)}: ${esc(p.traits)}</span>`).join("")}</div>
    </div>` : ""}
    <div class="nat-grid">
      ${cell("Yoni (animal)", esc(n.yoni.animal), n.yoni.gender)}
      ${cell("Deity", esc(n.deity), "")}
      ${cell("Symbol", esc(n.symbol), "")}
      ${cell("Star lord", esc(tr("graha", n.lord)), "")}
      ${cell("Nadi", esc(n.nadi), "")}
      ${n.varna ? cell("Varna", esc(n.varna), "from Moon sign") : ""}
      ${n.vashya ? cell("Vashya", esc(n.vashya), "from Moon sign") : ""}
    </div>
    <p class="hint">${esc(n.note)} Gana, yoni and nadi are the same values used in marriage matching.</p>
  </div>`;
}
/* windows of a day in which a birth needs shanti (panchanga, today) */
function shantiWindows(list, now, day) {
  if (!list || !list.length) return `<div class="empty-inline">${ico("check")}<div><b>No shanti windows</b><small>A birth at any time this day raises no janana dosha.</small></div></div>`;
  return `<div class="shw-list">${list.map((w) => {
    const on = now && w.start <= now && now < w.end;
    return `<div class="shw-row ${w.level}${on ? " on" : ""}" title="${esc(w.level === "info" ? "" : w.remedy || "")}">${flag(w.level, LEVEL_WORD[w.level])}
      <span class="shw-n"><b>${esc(w.name)}</b>${w.note ? `<small>${esc(w.note)}</small>` : ""}</span>
      <span class="shw-t">${tmRel(w.start, day)} \u2013 ${tmRel(w.end, day)}${on ? "<em>now</em>" : ""}</span></div>`;
  }).join("")}</div>`;
}

/* group a label's caption nodes into one element so the layout keeps them on one line */
function wrapLabels(root) {
  (root || document).querySelectorAll(".form label:not(.inline):not(.chk):not(.file-btn):not(.set-row):not(.toggle-row)").forEach((lb) => {
    if (lb.querySelector(":scope > .lb")) return;
    const caption = [];
    for (const n of [...lb.childNodes]) {
      if (n.nodeType === 1 && /^(INPUT|SELECT|TEXTAREA|DIV)$/.test(n.tagName)) break;
      caption.push(n);
    }
    if (!caption.length || !caption.some((n) => n.textContent.trim())) return;
    const span = document.createElement("span");
    span.className = "lb";
    caption.forEach((n) => span.appendChild(n));
    lb.insertBefore(span, lb.firstChild);
  });
}
/* sunrise-to-sunrise bar with the muhurta windows placed on it */
function dayTimeline(r, bare) {
  const m = r.muhurta;
  if (!m || !r.sunrise || !m.horas || !m.horas.length) return "";
  const ms = (iso) => Date.parse(iso + "Z");
  const a = ms(r.sunrise), b = ms(m.horas[m.horas.length - 1].end), span = b - a;
  const pct = (iso) => Math.max(0, Math.min(100, (ms(iso) - a) / span * 100));
  const minLabel = bare ? 9 : 5;
  const seg = (w, cls, label) => {
    if (!w || !w.start) return "";
    const width = Math.max(0.6, pct(w.end) - pct(w.start));
    return `<div class="tl-seg ${cls}" style="left:${pct(w.start)}%;width:${width}%"
    title="${esc(label)} ${hm(w.start)}\u2013${hm(w.end)}">${width >= minLabel ? `<span>${esc(label)}</span>` : ""}</div>`;
  };
  const bad = [seg(m.rahu_kala, "rahu", t("Rahu kala")), seg(m.yamaganda, "yama", t("Yamaganda")), seg(m.gulika_kala, "gulika", t("Gulika")),
    ...(m.durmuhurta || []).map((w) => seg(w, "dur", t("Durmuhurta"))), ...(m.varjyam || []).map((w) => seg(w, "varj", t("Varjyam")))].join("");
  const good = [seg(m.abhijit, "abhi", t("Abhijit")), ...(m.amrita_kala || []).map((w) => seg(w, "amrit", t("Amrita kala"))),
    seg(m.brahma_muhurta, "brahma", "Brahma")].join("");
  const sunsetPct = pct(r.sunset);
  const ticks = [];
  const first = new Date(a); first.setUTCMinutes(0, 0, 0);
  for (let t0 = first.getTime() + 3600000; t0 < b; t0 += 3600000) {
    const h = new Date(t0).getUTCHours();
    if (h % 3) continue;
    ticks.push(`<span class="tl-tick" style="left:${(t0 - a) / span * 100}%">${String(h).padStart(2, "0")}:00</span>`);
  }
  const nowLocal = Date.now() + r.tz_minutes * 60000;
  const now = nowLocal > a && nowLocal < b ? `<div class="tl-now" style="left:calc(58px + (100% - 58px) * ${((nowLocal - a) / span).toFixed(4)})"><span>now</span></div>` : "";
  const body = `<div class="timeline">
      <div class="tl-sky" style="--ss:${sunsetPct}%"><span class="tl-sun">\u2600 ${hm(r.sunrise)}</span><span class="tl-set" style="left:${sunsetPct}%">\u263e ${hm(r.sunset)}</span></div>
      <div class="tl-lane"><span class="tl-name bad">Avoid</span>${bad}</div>
      <div class="tl-lane"><span class="tl-name good">Good</span>${good}</div>
      <div class="tl-ticks">${ticks.join("")}</div>${now}
    </div>`;
  if (bare) return body;
  return `<div class="card"><div class="card-head"><h3>Day at a glance</h3><span class="hint">Sunrise to the next sunrise. Hover a block for exact times.</span></div>${body}</div>`;
}
function emptyState(text, icon) {
  return `<div class="card empty-state"><div class="es-ico">${ico(icon || "compass")}</div><div>${text}</div></div>`;
}

/* ---------- formatting ---------- */
const RASHIS = EN.rashi;
const WEST = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const ABBR = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve",
  Saturn: "Sa", Rahu: "Ra", Ketu: "Ke", Uranus: "Ur", Neptune: "Ne", Pluto: "Pl", Lagna: "Asc" };
const ABBR_L = {
  te: { Sun: "సూ", Moon: "చం", Mars: "కు", Mercury: "బు", Jupiter: "గు", Venus: "శు", Saturn: "శ", Rahu: "రా", Ketu: "కే", Lagna: "ల" },
  hi: { Sun: "सू", Moon: "च", Mars: "मं", Mercury: "बु", Jupiter: "गु", Venus: "शु", Saturn: "श", Rahu: "रा", Ketu: "के", Lagna: "ल" },
};
ABBR_L.sa = ABBR_L.hi;
const abbr = (k) => (ABBR_L[LANG] && ABBR_L[LANG][k]) || ABBR[k] || k;
const ORDER = ["Lagna", "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const OUTER = ["Uranus", "Neptune", "Pluto"];
const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu", "Uranus", "Neptune", "Pluto"];
const SI_CELL = { 12: [1, 1], 1: [1, 2], 2: [1, 3], 3: [1, 4], 4: [2, 4], 5: [3, 4], 6: [4, 4],
  7: [4, 3], 8: [4, 2], 9: [4, 1], 10: [3, 1], 11: [2, 1] };
const SUNRISE = {
  upper_limb_refraction: "Upper limb + refraction (modern panchangas)",
  center_refraction: "Disc centre + refraction",
  center_geometric: "Disc centre, no refraction",
};
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOCALE = () => ({ en: "en-GB", te: "te-IN", hi: "hi-IN", sa: "hi-IN" }[LANG] || "en-GB");

function dms(x, secs = true) {
  const neg = x < 0; x = Math.abs(x);
  let d = Math.floor(x), m = Math.floor((x - d) * 60), s = ((x - d) * 60 - m) * 60;
  if (!secs) { m = Math.round((x - d) * 60); if (m === 60) { d += 1; m = 0; } return (neg ? "-" : "") + d + "\u00b0" + String(m).padStart(2, "0") + "\u2032"; }
  s = Math.round(s * 10) / 10;
  if (s >= 60) { s = 0; m += 1; } if (m >= 60) { m = 0; d += 1; }
  return (neg ? "-" : "") + d + "\u00b0" + String(m).padStart(2, "0") + "\u2032" + s.toFixed(1).padStart(4, "0") + "\u2033";
}
const tm = (iso) => (iso ? iso.slice(11, 19) : "\u2014");
const hm = (iso) => (iso ? iso.slice(11, 16) : "\u2014");
const dateLabel = (iso, opts) => {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return d.toLocaleDateString(LOCALE(), Object.assign({ day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }, opts || {}));
};
const longDate = (iso) => dateLabel(iso, { day: "numeric", month: "long", year: "numeric" });
const dt = (iso) => (iso ? dateLabel(iso) + " " + iso.slice(11, 16) : "\u2014");
/* "time, plus the date when it differs from the reference day" */
const tmRel = (iso, day) => (!iso ? "\u2014" : iso.slice(0, 10) === day ? hm(iso) : hm(iso) + " (" + dateLabel(iso, { year: undefined }) + ")");
function signDeg(lon) { const s = Math.floor(lon / 30) % 12; return tr("rashi", RASHIS[s]) + " " + dms(lon - s * 30); }
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const todayIso = () => ymd(new Date());
/* "2y 3m 4d" between two local ISO stamps */
function span(fromMs, toMs) {
  let d = Math.max(0, Math.round((toMs - fromMs) / 86400000));
  const y = Math.floor(d / 365.25); d -= Math.round(y * 365.25);
  const m = Math.floor(d / 30.44); d -= Math.round(m * 30.44);
  return [y ? y + "y" : "", m ? m + "m" : "", (d > 0 || (!y && !m)) ? Math.max(0, d) + "d" : ""].filter(Boolean).join(" ");
}

function parseCoords(text) {
  const nums = String(text).match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) throw new Error("Enter coordinates as 'latitude, longitude'.");
  const lat = parseFloat(nums[0]), lon = parseFloat(nums[1]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error("Coordinates out of range.");
  return { lat, lon };
}
const _fmtCache = {};
function offsetAt(tz, utcMs) {
  const f = _fmtCache[tz] || (_fmtCache[tz] = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs) / 60000);
}
function tzOffsetMinutes(tz, date, time) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi, s] = (time || "12:00:00").split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0);
  let guess = wall;
  for (let i = 0; i < 3; i++) guess = wall - offsetAt(tz, guess) * 60000;
  return offsetAt(tz, guess);
}
/* offset at the start of a range plus every IANA change inside it (as UTC Julian days) */
function tzRange(tz, start, end) {
  const a = Date.parse(start + "T00:00:00Z") - 45 * 86400000;
  const b = Date.parse(end + "T00:00:00Z") + 45 * 86400000;
  const step = 86400000;
  const base = offsetAt(tz, a);
  const changes = [];
  let prev = base;
  for (let t = a + step; t <= b; t += step) {
    const o = offsetAt(tz, t);
    if (o !== prev) {
      let lo = t - step, hi = t;
      while (hi - lo > 60000) { const mid = Math.floor((lo + hi) / 2); if (offsetAt(tz, mid) === prev) lo = mid; else hi = mid; }
      changes.push([hi / 86400000 + 2440587.5, o]);
      prev = o;
    }
  }
  return { tz_minutes: base, tz_changes: changes };
}
function parseOverride(v) {
  v = String(v || "").trim();
  if (!v) return null;
  let m = v.match(/^([+-])?(\d{1,2}):(\d{2})$/);
  if (m) return (m[1] === "-" ? -1 : 1) * (parseInt(m[2]) * 60 + parseInt(m[3]));
  if (/^[+-]?\d+(\.\d+)?$/.test(v)) { const n = parseFloat(v); return Math.abs(n) <= 14 ? Math.round(n * 60) : Math.round(n); }
  throw new Error("UTC offset must look like +05:30 or 5.5");
}
const fmtOffset = (m) => (m < 0 ? "-" : "+") + String(Math.floor(Math.abs(m) / 60)).padStart(2, "0") + ":" + String(Math.abs(m) % 60).padStart(2, "0");

function download(name, obj, type) {
  const blob = obj instanceof Blob ? obj : new Blob([typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)], { type: type || "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function toCSV(rows) {
  return rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(",")).join("\n");
}

/* ---------- storage & settings ---------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem("astro." + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { localStorage.setItem("astro." + k, JSON.stringify(v)); },
};
const DEFAULT_SETTINGS = {
  ayanamsa: "lahiri", node: "true", dasha_year: "julian", sunrise_profile: "upper_limb_refraction",
  chart_style: "north", elevation: 0, show_retro: true, show_deg: false, show_outer: true,
  theme: "light", start_page: "dashboard", place: null,
};
function settings() { return Object.assign({}, DEFAULT_SETTINGS, store.get("settings", {})); }
function updateSettings(patch) { store.set("settings", Object.assign(settings(), patch)); }
/* calculation choices sent with every engine request */
const calc = () => { const s = settings(); return { ayanamsa: s.ayanamsa, node: s.node, sunrise_profile: s.sunrise_profile }; };

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
function applyTheme() {
  const th = settings().theme;
  const dark = th === "dark" || (th === "system" && darkQuery.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.getElementById("theme-switch").classList.toggle("on", dark);
}
darkQuery.addEventListener("change", applyTheme);
applyTheme();
document.getElementById("theme-btn").addEventListener("click", () => {
  updateSettings({ theme: document.documentElement.dataset.theme === "dark" ? "light" : "dark" });
  applyTheme();
  if (typeof syncSettingsForm === "function") syncSettingsForm();
});

/* ---------- places & profiles ---------- */
const PRESETS = [
  ["Hyderabad", "17.385, 78.4867", "Asia/Kolkata"], ["Visakhapatnam", "17.6868, 83.2185", "Asia/Kolkata"],
  ["Vijayawada", "16.5062, 80.6480", "Asia/Kolkata"], ["Tirupati", "13.6288, 79.4192", "Asia/Kolkata"],
  ["Warangal", "17.9689, 79.5941", "Asia/Kolkata"], ["Chennai", "13.0827, 80.2707", "Asia/Kolkata"],
  ["Bengaluru", "12.9716, 77.5946", "Asia/Kolkata"], ["Mumbai", "19.0760, 72.8777", "Asia/Kolkata"],
  ["New Delhi", "28.6139, 77.2090", "Asia/Kolkata"], ["Kolkata", "22.5726, 88.3639", "Asia/Kolkata"],
  ["Varanasi", "25.3176, 82.9739", "Asia/Kolkata"], ["Ujjain", "23.1765, 75.7885", "Asia/Kolkata"],
  ["Kathmandu", "27.7172, 85.3240", "Asia/Kathmandu"], ["Singapore", "1.3521, 103.8198", "Asia/Singapore"],
  ["Dubai", "25.2048, 55.2708", "Asia/Dubai"], ["London", "51.5074, -0.1278", "Europe/London"],
  ["New York", "40.7128, -74.0060", "America/New_York"], ["Dallas", "32.7767, -96.7970", "America/Chicago"],
  ["San Francisco", "37.7749, -122.4194", "America/Los_Angeles"], ["Toronto", "43.6532, -79.3832", "America/Toronto"],
  ["Sydney", "-33.8688, 151.2093", "Australia/Sydney"], ["Melbourne", "-37.8136, 144.9631", "Australia/Melbourne"],
];
const profiles = () => store.get("profiles", []);
const places = () => store.get("places", []);
let ZONES = [];
try { ZONES = Intl.supportedValuesOf("timeZone"); } catch (e) { ZONES = []; }
for (const z of ["Asia/Kolkata", "UTC"]) if (!ZONES.includes(z)) ZONES.push(z);
const LOCAL_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return "Asia/Kolkata"; } })();
function defaultPlace() {
  return settings().place || store.get("lastPlace", null) || { name: "Hyderabad", coords: "17.385, 78.4867", tz: "Asia/Kolkata" };
}

/* time zone from an OpenStreetMap address: single-zone countries directly, large countries by state or longitude */
const TZ_BY_CC = { in: "Asia/Kolkata", np: "Asia/Kathmandu", lk: "Asia/Colombo", bd: "Asia/Dhaka", pk: "Asia/Karachi", bt: "Asia/Thimphu",
  ae: "Asia/Dubai", sa: "Asia/Riyadh", qa: "Asia/Qatar", kw: "Asia/Kuwait", om: "Asia/Muscat", bh: "Asia/Bahrain", sg: "Asia/Singapore",
  my: "Asia/Kuala_Lumpur", th: "Asia/Bangkok", jp: "Asia/Tokyo", kr: "Asia/Seoul", cn: "Asia/Shanghai", hk: "Asia/Hong_Kong", tw: "Asia/Taipei",
  ph: "Asia/Manila", vn: "Asia/Ho_Chi_Minh", gb: "Europe/London", ie: "Europe/Dublin", fr: "Europe/Paris", de: "Europe/Berlin", it: "Europe/Rome",
  es: "Europe/Madrid", nl: "Europe/Amsterdam", be: "Europe/Brussels", ch: "Europe/Zurich", at: "Europe/Vienna", se: "Europe/Stockholm",
  no: "Europe/Oslo", dk: "Europe/Copenhagen", fi: "Europe/Helsinki", pl: "Europe/Warsaw", pt: "Europe/Lisbon", gr: "Europe/Athens",
  nz: "Pacific/Auckland", za: "Africa/Johannesburg", ke: "Africa/Nairobi", ng: "Africa/Lagos", eg: "Africa/Cairo", mu: "Indian/Mauritius",
  fj: "Pacific/Fiji", tt: "America/Port_of_Spain", gy: "America/Guyana", il: "Asia/Jerusalem", tr: "Europe/Istanbul", ua: "Europe/Kyiv" };
const AU_STATE = { "New South Wales": "Australia/Sydney", "Australian Capital Territory": "Australia/Sydney", Victoria: "Australia/Melbourne",
  Tasmania: "Australia/Hobart", Queensland: "Australia/Brisbane", "South Australia": "Australia/Adelaide",
  "Northern Territory": "Australia/Darwin", "Western Australia": "Australia/Perth" };
function guessTz(addr, lon) {
  const cc = (addr.country_code || "").toLowerCase();
  if (TZ_BY_CC[cc]) return TZ_BY_CC[cc];
  if (cc === "au") return AU_STATE[addr.state] || null;
  if (cc === "us") {
    if (addr.state === "Hawaii") return "Pacific/Honolulu";
    if (addr.state === "Alaska") return "America/Anchorage";
    if (addr.state === "Arizona") return "America/Phoenix";
    return lon > -87.5 ? "America/New_York" : lon > -101.5 ? "America/Chicago" : lon > -114.5 ? "America/Denver" : "America/Los_Angeles";
  }
  if (cc === "ca") return lon > -64 ? "America/Halifax" : lon > -90 ? "America/Toronto" : lon > -102 ? "America/Winnipeg" : lon > -120 ? "America/Edmonton" : "America/Vancouver";
  return null;
}
const geoCache = {};
async function geoSearch(q) {
  if (geoCache[q]) return geoCache[q];
  const res = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=en&q=" + encodeURIComponent(q));
  if (!res.ok) throw new Error("Place search unavailable");
  const js = await res.json();
  return (geoCache[q] = js.map((x) => {
    const lat = +x.lat, lon = +x.lon, parts = x.display_name.split(",").map((s) => s.trim());
    return { label: [parts[0], parts.length > 2 ? parts[parts.length - 3] : "", parts[parts.length - 1]].filter((v, i, a) => v && a.indexOf(v) === i).join(", "),
      sub: x.display_name, coords: lat.toFixed(5) + ", " + lon.toFixed(5), tz: guessTz(x.address || {}, lon), icon: "pin" };
  }));
}
async function geoReverse(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lon}`);
  if (!res.ok) return { name: "", tz: null };
  const x = await res.json();
  const a = x.address || {};
  return { name: [a.city || a.town || a.village || a.county || "", a.state || "", a.country || ""].filter(Boolean).join(", "),
    tz: guessTz(a, +lon) };
}
const zoneCache = {};
/* resolves to the IANA zone at the coordinates, or null when offline or not inferable */
function zoneAt(lat, lon) {
  const k = (+lat).toFixed(2) + "," + (+lon).toFixed(2);
  if (!(k in zoneCache)) zoneCache[k] = geoReverse(lat, lon).then((g) => (g.tz && ZONES.includes(g.tz) ? g.tz : null), () => null);
  return zoneCache[k];
}
/* hours between a UTC offset and local mean solar time at a longitude, wrapped to 0..12 */
const solarGap = (offMin, lon) => Math.abs(((((offMin / 60 - lon / 15) % 24) + 36) % 24) - 12);
function localPlaceMatches(q) {
  const s = q.toLowerCase();
  const out = [];
  places().forEach((p) => { if (!s || p.name.toLowerCase().includes(s)) out.push({ label: p.name, sub: "Saved place \u00b7 " + p.tz, coords: p.coords, tz: p.tz, icon: "star" }); });
  PRESETS.forEach((p) => { if (!s || p[0].toLowerCase().includes(s)) out.push({ label: p[0], sub: p[2], coords: p[1], tz: p[2], icon: "pin" }); });
  return out.slice(0, s ? 6 : 8);
}

function renderPlaceSlot(el, prefix) {
  prefix = prefix || el.dataset.prefix || "";
  const def = defaultPlace();
  const coords = el.dataset.coords || def.coords;
  const tz = el.dataset.tz || (el.dataset.coords ? "Asia/Kolkata" : def.tz);
  const name = el.dataset.place || (el.dataset.coords ? "" : def.name || "");
  const compact = el.dataset.variant === "compact";
  const label = el.dataset.label || "Place";
  el.classList.add("place-box");
  el.classList.toggle("compact", compact);
  el.innerHTML = `
    <label class="place-field"><span class="lb">${label === "Place" ? '<span data-i18n="Place">Place</span>' : esc(label)}</span>
      <div class="ac">${ico("search", "ac-ico")}<input name="${prefix}place" class="place-q" autocomplete="off" spellcheck="false" placeholder="Search city or town\u2026" value="${esc(name)}">
        <button type="button" class="adorn locate" title="Use my location">${ico("locate")}<span data-i18n="Use my location">Use my location</span></button>
        ${compact ? `<button type="button" class="adorn place-toggle" title="Coordinates and time zone">${ico("sliders")}</button>` : ""}
        <div class="ac-list" hidden></div></div></label>
    ${compact ? `<div class="place-meta"></div>` : ""}
    <div class="place-warn" role="alert" hidden></div>
    <div class="place-more"${compact ? " hidden" : ""}>
      <label><span class="lb"><span data-i18n="Coordinates">Coordinates</span></span><input name="${prefix}coords" required value="${esc(coords)}" placeholder="17.385, 78.4867" title="latitude, longitude (paste from Google Maps)"></label>
      <label><span class="lb"><span data-i18n="Time zone">Time Zone</span></span><select name="${prefix}tz">${ZONES.map((z) => `<option${z === tz ? " selected" : ""}>${esc(z)}</option>`).join("")}</select></label>
      <label><span class="lb">UTC offset</span><input name="${prefix}tzoverride" placeholder="auto (e.g. +05:30)"></label>
      <div class="place-btns"><button type="button" class="link save-place">${ico("star")} Save this place</button></div>
    </div>`;
  const q = (n) => el.querySelector(`[name="${prefix}${n}"]`);
  const inp = el.querySelector(".place-q"), list = el.querySelector(".ac-list"), meta = el.querySelector(".place-meta");
  const warn = el.querySelector(".place-warn");
  let zoneSeq = 0, coordsEdited = false;
  const setZone = (z) => { q("tz").value = z; q("tzoverride").value = ""; updateMeta(); };
  /* flag a zone whose clock is hours away from the Sun at the coordinates (e.g. an Indian place left on UTC) */
  function checkZone() {
    const seq = ++zoneSeq;
    let lat, lon, off;
    try {
      ({ lat, lon } = parseCoords(q("coords").value));
      off = parseOverride(q("tzoverride").value) ?? offsetAt(q("tz").value, Date.now());
    } catch (e) { warn.hidden = true; return; }
    const gap = Math.round(solarGap(off, lon) * 60);
    if (gap <= 180) { warn.hidden = true; return; }
    const zone = q("tzoverride").value || q("tz").value === "UTC" ? "UTC" + fmtOffset(off) : `${q("tz").value} (UTC${fmtOffset(off)})`;
    warn.innerHTML = `${ico("info")}<div><b>Time zone may not match this place.</b> ${esc(zone)} is ${Math.floor(gap / 60)} h ${gap % 60} min away from local time at these coordinates (about UTC${fmtOffset(Math.round(lon * 4))}). Times are read as clock time in the selected zone.<div class="pw-fix"></div></div>`;
    warn.hidden = false;
    zoneAt(lat, lon).then((z) => {
      if (seq !== zoneSeq || !z || (z === q("tz").value && !q("tzoverride").value)) return;
      const fix = warn.querySelector(".pw-fix");
      fix.innerHTML = `<button type="button" class="btn ghost sm">Use ${esc(z)}</button>`;
      fix.firstChild.addEventListener("click", () => setZone(z));
    });
  }
  /* coordinates typed or pasted by hand: follow them with the zone of that place */
  async function zoneFromCoords() {
    const typed = q("coords").value;
    let c;
    try { c = parseCoords(typed); } catch (e) { return; }
    const z = await zoneAt(c.lat, c.lon);
    if (!z || z === q("tz").value || q("coords").value !== typed) return;
    setZone(z);
    toast("Time zone set to " + z + " for these coordinates");
  }
  function updateMeta() {
    if (meta) meta.textContent = q("coords").value + " \u00b7 " + q("tz").value + (q("tzoverride").value ? " \u00b7 UTC" + q("tzoverride").value : "");
    checkZone();
  }
  updateMeta();
  let timer = null, items = [], active = -1;
  function show(arr, loading) {
    items = arr; active = -1;
    list.innerHTML = arr.map((it, i) => `<button type="button" class="ac-i" data-i="${i}">${ico(it.icon || "pin")}<span><b>${esc(it.label)}</b><small>${esc(it.sub || "")}</small></span></button>`).join("")
      + (loading ? '<div class="ac-note">Searching OpenStreetMap\u2026</div>' : "") + (!arr.length && !loading ? '<div class="ac-note">No match. Type at least 3 letters, or paste coordinates.</div>' : "");
    list.hidden = false;
  }
  function pick(it) {
    inp.value = it.label;
    q("coords").value = it.coords;
    if (it.tz && ZONES.includes(it.tz)) q("tz").value = it.tz;
    else toast("Time zone could not be inferred for this place. Please check it.", "warn");
    q("tzoverride").value = "";
    list.hidden = true;
    updateMeta();
  }
  inp.addEventListener("input", () => {
    const v = inp.value.trim();
    clearTimeout(timer);
    const loc = localPlaceMatches(v);
    const remote = v.length >= 3 && !/^-?\d/.test(v);
    show(loc, remote);
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)) { q("coords").value = v; updateMeta(); timer = setTimeout(zoneFromCoords, 600); }
    if (remote) timer = setTimeout(async () => {
      try { const g = await geoSearch(v); if (inp.value.trim() === v) show(loc.concat(g)); } catch (e) { if (inp.value.trim() === v) show(loc); }
    }, 420);
  });
  inp.addEventListener("focus", () => { if (!inp.value.trim()) show(localPlaceMatches("")); });
  inp.addEventListener("blur", () => setTimeout(() => { list.hidden = true; }, 160));
  inp.addEventListener("keydown", (ev) => {
    if (list.hidden || !items.length) return;
    const btns = $$(".ac-i", list);
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      active = (active + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      btns.forEach((b, i) => b.classList.toggle("on", i === active));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      pick(items[Math.max(0, active)]);
    } else if (ev.key === "Escape") list.hidden = true;
  });
  list.addEventListener("mousedown", (ev) => ev.preventDefault());
  list.addEventListener("click", (ev) => { const b = ev.target.closest(".ac-i"); if (b) pick(items[+b.dataset.i]); });
  ["coords", "tz", "tzoverride"].forEach((n) => q(n).addEventListener("change", updateMeta));
  q("coords").addEventListener("input", () => { coordsEdited = true; });
  q("coords").addEventListener("change", () => { if (coordsEdited) { coordsEdited = false; zoneFromCoords(); } });
  const tog = el.querySelector(".place-toggle");
  if (tog) tog.addEventListener("click", () => { const more = el.querySelector(".place-more"); more.hidden = !more.hidden; tog.classList.toggle("on", !more.hidden); });
  el.querySelector(".locate").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("Geolocation is not available in this browser.", "warn");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude.toFixed(5), lon = pos.coords.longitude.toFixed(5);
      q("coords").value = lat + ", " + lon;
      if (ZONES.includes(LOCAL_TZ)) q("tz").value = LOCAL_TZ;
      inp.value = "My location";
      updateMeta();
      try { const g = await geoReverse(lat, lon); if (g.name) inp.value = g.name; } catch (e) { /* name is optional */ }
    }, (err) => toast("Location unavailable: " + err.message, "warn"));
  });
  el.querySelector(".save-place").addEventListener("click", () => {
    const nm = prompt("Name for this place?", inp.value || "");
    if (!nm) return;
    const lst = places().filter((p) => p.name !== nm);
    lst.push({ name: nm, coords: q("coords").value, tz: q("tz").value });
    store.set("places", lst);
    refreshPlacePickers();
    toast("Place saved");
  });
}
function refreshPlacePickers() { renderProfilesTab(); }
/* read place + time zone from a form; returns lat, lon, tz name, override minutes, display name */
function readPlace(form, prefix) {
  prefix = prefix || "";
  const f = new FormData(form);
  const { lat, lon } = parseCoords(f.get(prefix + "coords"));
  const tz = f.get(prefix + "tz");
  const override = parseOverride(f.get(prefix + "tzoverride"));
  const name = (f.get(prefix + "place") || "").trim();
  store.set("lastPlace", { name, coords: f.get(prefix + "coords"), tz });
  return { lat, lon, tz, override, name };
}
const offsetFor = (pl, date, time) => pl.override ?? tzOffsetMinutes(pl.tz, date, time);
const rangeTz = (pl, start, end) => (pl.override != null ? { tz_minutes: pl.override, tz_changes: [] } : tzRange(pl.tz, start, end));
function setPlace(form, prefix, p) {
  const set = (n, v) => { const x = form.querySelector(`[name="${prefix}${n}"]`); if (x) { x.value = v ?? ""; x.dispatchEvent(new Event("change")); } };
  set("place", p.name || p.place || ""); set("coords", p.coords); set("tz", p.tz); set("tzoverride", p.tzoverride || "");
}

function profileOptions() {
  return `<option value="">Choose a saved chart\u2026</option>` + profiles().map((p, i) => `<option value="${i}">${esc(p.name)} (${esc(p.date)})</option>`).join("");
}
function renderBirthSlot(el) {
  const px = el.dataset.prefix;
  el.innerHTML = `<div class="grid">
    <label>Saved profile <select class="profile-pick" data-prefix="${px}">${profileOptions()}</select></label>
    <label><span data-i18n="Name">Name</span> <input name="${px}name" placeholder="Optional"></label>
    <label>Date of birth <input name="${px}date" type="date" required></label>
    <label>Time of birth <input name="${px}time" type="time" step="1" required></label>
  </div><div class="place-inner" data-label="Place of birth"></div>`;
  renderPlaceSlot(el.querySelector(".place-inner"), px);
}
function fillProfile(form, prefix, p) {
  const set = (n, v) => { const x = form.querySelector(`[name="${prefix}${n}"]`); if (x) x.value = v ?? ""; };
  set("name", p.name); set("date", p.date); set("time", p.time);
  setPlace(form, prefix, { name: p.place || "", coords: p.coords, tz: p.tz, tzoverride: p.tzoverride });
}
function readBirth(form, prefix) {
  const f = new FormData(form);
  const date = f.get(prefix + "date");
  let time = f.get(prefix + "time") || "12:00:00";
  if (time.length === 5) time += ":00";
  if (!date) throw new Error("Enter the date of birth.");
  const pl = readPlace(form, prefix);
  return { name: f.get(prefix + "name") || "", date, time, lat: pl.lat, lon: pl.lon, tz_minutes: offsetFor(pl, date, time), place: pl.name,
    raw: { name: f.get(prefix + "name") || "", date, time, place: pl.name, coords: f.get(prefix + "coords"), tz: pl.tz, tzoverride: f.get(prefix + "tzoverride") || "" } };
}
function saveProfile(raw) {
  const name = prompt("Profile name?", raw.name || "");
  if (!name) return;
  const list = profiles().filter((p) => p.name !== name);
  list.push(Object.assign({}, raw, { name }));
  store.set("profiles", list);
  refreshProfilePickers();
  toast("Saved \u201c" + name + "\u201d");
}
function refreshProfilePickers() {
  $$(".profile-pick").forEach((s) => { s.innerHTML = profileOptions(); });
  renderProfilesTab();
  if (typeof refreshChartSources === "function") refreshChartSources();
  if (typeof renderDashSaved === "function") renderDashSaved();
  if (typeof refreshTodayPickers === "function") refreshTodayPickers();
}
document.addEventListener("change", (ev) => {
  const s = ev.target;
  if (!s.classList || !s.classList.contains("profile-pick") || s.value === "") return;
  const p = profiles()[+s.value];
  if (!p) return;
  fillProfile(s.closest("form"), s.dataset.prefix || "", p);
});

function renderProfilesTab() {
  const pl = profiles(), pc = places();
  document.getElementById("profiles-list").innerHTML = pl.length ? `<div class="profile-grid">
    ${pl.map((p, i) => `<div class="profile-card">
      <div class="pc-av">${esc((p.name || "?").slice(0, 1).toUpperCase())}</div>
      <div class="pc-body"><b>${esc(p.name)}</b><small>${esc(dateLabel(p.date))} \u00b7 ${esc(p.time)}</small><small>${esc(p.place || p.coords)} \u00b7 ${esc(p.tzoverride || p.tz)}</small></div>
      <div class="pc-act"><button type="button" class="btn primary sm" data-open="${i}">Open chart</button>
        <button type="button" class="icon-btn sm" data-transit="${i}" title="Transits">${ico("transits")}</button>
        <button type="button" class="icon-btn sm danger" data-del="${i}" title="Delete">${ico("trash")}</button></div></div>`).join("")}
  </div>` : `<div class="empty-inline">${ico("saved")}<div><b>No saved charts yet</b><small>Generate a birth chart and press \u201cSave profile\u201d.</small></div></div>`;
  document.getElementById("places-list").innerHTML = pc.length ? `<div class="scroll"><table class="tbl">
    <tr><th>Name</th><th>Coordinates</th><th>Time zone</th><th></th></tr>
    ${pc.map((p, i) => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.coords)}</td><td>${esc(p.tz)}</td><td class="r"><button type="button" class="icon-btn sm danger" data-delplace="${i}" title="Delete">${ico("trash")}</button></td></tr>`).join("")}
  </table></div>` : `<div class="empty-inline">${ico("pin")}<div><b>No saved places</b><small>Use \u201cSave this place\u201d under any place field.</small></div></div>`;
}
document.getElementById("tab-profiles").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.del != null) {
    const list = profiles();
    if (!confirm("Delete " + list[+b.dataset.del].name + "?")) return;
    list.splice(+b.dataset.del, 1); store.set("profiles", list); refreshProfilePickers();
  } else if (b.dataset.delplace != null) {
    const list = places(); list.splice(+b.dataset.delplace, 1); store.set("places", list); refreshPlacePickers();
  } else if (b.dataset.open != null) {
    openProfileChart(profiles()[+b.dataset.open]);
  } else if (b.dataset.transit != null) {
    const form = document.getElementById("transit-form");
    fillProfile(form, "birth_", profiles()[+b.dataset.transit]);
    showTab("transits");
    form.requestSubmit();
  }
});
function openProfileChart(p) {
  const form = document.getElementById("chart-form");
  fillProfile(form, "", p);
  showTab("chart");
  form.requestSubmit();
}
document.getElementById("export-profiles").addEventListener("click", () =>
  download("astra-profiles.json", { profiles: profiles(), places: places() }));
document.getElementById("import-profiles").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (Array.isArray(data.profiles)) store.set("profiles", data.profiles);
    if (Array.isArray(data.places)) store.set("places", data.places);
    refreshProfilePickers(); refreshPlacePickers();
    toast("Imported");
  } catch (e) { toast("Not a valid profiles file.", "warn"); }
});

/* ---------- static option lists ---------- */
function fillOptionLists() {
  const fill = (cls, list, cat) => $$(cls).forEach((sel) => {
    const keep = [...sel.options].filter((o) => o.value === "").map((o) => o.outerHTML).join("");
    const chosen = new Set([...sel.selectedOptions].map((o) => o.value));
    sel.innerHTML = keep + list.map((n, i) => `<option value="${i + 1}"${chosen.has(String(i + 1)) ? " selected" : ""}>${i + 1}. ${esc(tr(cat, n))}${LANG !== "en" ? " \u00b7 " + esc(n) : ""}</option>`).join("");
  });
  fill(".opt-nak", EN.nakshatra, "nakshatra");
  fill(".opt-rashi", EN.rashi, "rashi");
  fill(".opt-yoga", EN.yoga, "yoga");
  fill(".opt-vara", EN.vara, "vara");
  const tithis = [];
  for (let i = 0; i < 30; i++) {
    const pk = i < 15 ? "Shukla" : "Krishna";
    const nm = i === 14 ? "Purnima" : i === 29 ? "Amavasya" : EN.tithi[i % 15];
    tithis.push([pk, nm]);
  }
  $$(".opt-tithi").forEach((sel) => {
    const chosen = new Set([...sel.selectedOptions].map((o) => o.value));
    sel.innerHTML = tithis.map(([pk, nm], i) => `<option value="${i + 1}"${chosen.has(String(i + 1)) ? " selected" : ""}>${i + 1}. ${esc(trTithi(pk, nm))}</option>`).join("");
  });
}

/* ---------- navigation, language ---------- */
const rerender = {};
const onShow = {};
let currentTab = null;
function showTab(name) {
  if (!document.getElementById("tab-" + name)) name = "dashboard";
  currentTab = name;
  closePops();
  $$(".nav-i").forEach((x) => x.classList.toggle("active", x.dataset.tab === name || (x.dataset.also || "").split(" ").includes(name)));
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
  document.getElementById("main").classList.toggle("on-dash", name === "dashboard");
  document.getElementById("app").classList.remove("side-open");
  if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  document.getElementById("content").scrollTop = 0;
  window.scrollTo(0, 0);
  if (onShow[name]) { try { onShow[name](); } catch (e) { console.error(e); } }
}
document.addEventListener("click", (ev) => {
  const a = ev.target.closest("[data-tab-link], .nav-i, [data-go]");
  if (!a) return;
  const name = a.dataset.tabLink || a.dataset.tab || a.dataset.go;
  if (!name || !document.getElementById("tab-" + name)) return;
  ev.preventDefault();
  closePops();
  showTab(name);
});
window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== currentTab && document.getElementById("tab-" + h)) showTab(h); });
function closePops(except) { $$(".pop").forEach((p) => { if (p !== except) p.hidden = true; }); }

const langSel = document.getElementById("lang-select");
const langOptions = () => Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === LANG ? " selected" : ""}>${v}</option>`).join("");
langSel.innerHTML = langOptions();
function setLang(l) {
  LANG = l;
  localStorage.setItem("astro.lang", LANG);
  langSel.innerHTML = langOptions();
  applyI18n();
  fillOptionLists();
  Object.values(rerender).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}
langSel.addEventListener("change", () => setLang(langSel.value));

/* generic submit wrapper: disables the button, shows timing and errors; form.run() can be awaited */
function bindForm(id, outId, hintId, handler) {
  const form = document.getElementById(id);
  form.run = async () => {
    const out = document.getElementById(outId), hint = document.getElementById(hintId);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.classList.add("busy");
    hint.textContent = engineIsReady ? "Calculating\u2026" : "Waiting for the engine\u2026";
    out.classList.add("out-busy");
    const t0 = performance.now();
    try {
      const note = await handler(form, out);
      hint.textContent = "Done in " + ((performance.now() - t0) / 1000).toFixed(2) + " s" + (note ? " \u00b7 " + note : "");
      return true;
    } catch (e) {
      console.error(e);
      out.innerHTML = `<div class="error-box">${ico("info")}<span>${esc(e.message)}</span></div>`;
      hint.textContent = "";
      return false;
    } finally {
      btn.disabled = false;
      btn.classList.remove("busy");
      out.classList.remove("out-busy");
    }
  };
  form.addEventListener("submit", (ev) => { ev.preventDefault(); form.run(); });
  return form;
}

/* ---------- kundali drawing (North and South Indian) ---------- */
/* North Indian houses on a 400x400 square: polygon, label centre, sign-number position */
const NI = {
  1: ["200,0 300,100 200,200 100,100", [200, 96], [200, 182]],
  2: ["0,0 200,0 100,100", [100, 38], [100, 86]],
  3: ["0,0 100,100 0,200", [36, 100], [86, 100]],
  4: ["0,200 100,100 200,200 100,300", [96, 200], [182, 200]],
  5: ["0,200 100,300 0,400", [36, 300], [86, 300]],
  6: ["0,400 100,300 200,400", [100, 362], [100, 318]],
  7: ["200,400 100,300 200,200 300,300", [200, 304], [200, 222]],
  8: ["200,400 300,300 400,400", [300, 362], [300, 318]],
  9: ["400,400 300,300 400,200", [364, 300], [314, 300]],
  10: ["400,200 300,300 200,200 300,100", [304, 200], [218, 200]],
  11: ["400,200 300,100 400,0", [364, 100], [314, 100]],
  12: ["400,0 300,100 200,0", [300, 38], [300, 86]],
};
/* cells: {sign 1..12: [{t, cls, title}]}; lagnaSign 1..12 */
function northSVG(cells, lagnaSign) {
  let houses = "", texts = "";
  for (let h = 1; h <= 12; h++) {
    const [poly, [cx, cy], [nx, ny]] = NI[h];
    const sign = ((lagnaSign + h - 2) % 12) + 1;
    houses += `<polygon class="ni-h${h === 1 ? " h1" : ""}" points="${poly}"><title>House ${h} \u00b7 ${esc(tr("rashi", RASHIS[sign - 1]))}</title></polygon>`;
    texts += `<text class="ni-num" x="${nx}" y="${ny + 4}">${sign}</text>`;
    const items = cells[sign] || [];
    if (!items.length) continue;
    const per = [3, 5, 9, 11].includes(h) ? 2 : 3;
    const rows = [];
    for (let i = 0; i < items.length; i += per) rows.push(items.slice(i, i + per));
    const lh = rows.length > 3 ? 14 : 17;
    const y0 = cy - (rows.length - 1) * lh / 2 + 5;
    rows.forEach((row, ri) => {
      texts += `<text class="ni-row" x="${cx}" y="${y0 + ri * lh}">${row.map((it) => `<tspan class="ni-p ${it.cls || ""}">${esc(it.t)}${it.title ? `<title>${esc(it.title)}</title>` : ""}</tspan>`).join('<tspan class="ni-gap"> </tspan>')}</text>`;
    });
  }
  return `<svg class="kundali ni" viewBox="-2 -2 404 404" role="img" aria-label="North Indian chart">
    <rect class="ni-frame" x="0" y="0" width="400" height="400" rx="6"/>${houses}
    <path class="ni-line" d="M0 0 400 400M400 0 0 400M200 0 400 200 200 400 0 200Z"/>${texts}</svg>`;
}
function siGrid(cells, centre) {
  let html = '<div class="si-chart">';
  for (let s = 1; s <= 12; s++) {
    const [row, col] = SI_CELL[s];
    html += `<div class="si-cell" style="grid-row:${row};grid-column:${col}">${cells[s].join("")}<span class="sn" title="${esc(tr("rashi", RASHIS[s - 1]))}">${esc(tr("rashi", RASHIS[s - 1]))}</span></div>`;
  }
  return html + `<div class="si-center">${centre}</div></div>`;
}
function kundali(cells, lagnaSign, centre, style) {
  style = style || settings().chart_style;
  if (style === "north") return northSVG(cells, lagnaSign);
  const html = {};
  for (let s = 1; s <= 12; s++) html[s] = (cells[s] || []).map((it) => `<span class="p ${it.cls || ""}"${it.title ? ` title="${esc(it.title)}"` : ""}>${esc(it.t)}</span>`);
  return siGrid(html, centre || "");
}
/* positions for a varga (D1 uses exact longitudes): [{k, sign 1..12, deg, retro}] */
function chartPoints(r, varga) {
  const s = settings();
  const g = r.chart.grahas;
  if (varga === "D1") {
    const keys = ORDER.concat(s.show_outer ? OUTER : []);
    return keys.map((k) => {
      const x = k === "Lagna" ? r.chart.lagna : g[k];
      return { k, sign: x.rashi.index, deg: x.rashi.degrees_in_sign, retro: k !== "Lagna" && x.retrograde && !["Rahu", "Ketu"].includes(k), nak: x.nakshatra, lon: x.longitude,
        deb: x.dignity === "debilitated", combust: !!x.combust, issues: planetIssues(k, x) };
    });
  }
  const v = r.vargas[varga].positions;
  return ORDER.map((k) => {
    const deb = DEBIL_SIGN[k] === v[k].sign_index;
    return { k, sign: v[k].sign_index, deg: v[k].degree, retro: k !== "Lagna" && g[k] && g[k].retrograde && !["Rahu", "Ketu"].includes(k), lord: v[k].lord,
      deb, issues: deb ? [{ level: "danger", text: "debilitated", title: `${k} is in its sign of debilitation in ${varga}` }] : [] };
  });
}
function chartCells(points) {
  const s = settings();
  const cells = {};
  for (let i = 1; i <= 12; i++) cells[i] = [];
  for (const p of points) {
    const t = abbr(p.k) + (p.retro && s.show_retro ? "\u211E" : "") + (p.deb ? "\u2193" : "") + (s.show_deg && p.deg != null ? " " + Math.floor(p.deg) + "\u00b0" : "");
    cells[p.sign].push({ t, cls: (p.k === "Lagna" ? "asc" : "") + (p.retro && s.show_retro ? " r" : "") + (p.deb ? " deb" : "") + (p.combust ? " cmb" : ""),
      title: tr("graha", p.k) + (p.deg != null ? " " + dms(p.deg, false) : "") + (p.deb ? " \u00b7 debilitated" : "") + (p.combust ? " \u00b7 combust" : "") });
  }
  return cells;
}
function chartFor(r, varga, style) {
  const pts = chartPoints(r, varga);
  const lag = pts.find((p) => p.k === "Lagna").sign;
  const name = r.vargas[varga].name;
  return kundali(chartCells(pts), lag, `<div class="t">${varga} ${esc(name)}</div><div class="u">${esc(r.input.name || "")}</div><div class="u">${esc(r.input.date)} ${esc(r.input.time)}</div>`, style);
}
function chartDetailsTable(r, varga) {
  const pts = chartPoints(r, varga);
  return `<div class="scroll"><table class="tbl details">
    <tr><th>${t("Planet")}</th><th>${t("Rashi")}</th><th>Degree</th>${varga === "D1" ? `<th>${t("Nakshatra")}</th>` : "<th>Lord</th>"}</tr>
    ${pts.map((p) => `<tr class="${rowLevel(p.issues || []).trim()}"><td>${pdot(p.k)}<b>${esc(p.k === "Lagna" ? "Ascendant" : tr("graha", p.k))}</b>${p.retro ? ' <span class="tagpill de">R</span>' : ""} ${issueFlags((p.issues || []).filter((i) => i.level !== "info"))}</td>
      <td>${esc(tr("rashi", RASHIS[p.sign - 1]))}${LANG === "en" ? ` <span class="hint">${WEST[p.sign - 1]}</span>` : ""}</td><td class="num">${dms(p.deg, false)}</td>
      <td>${varga === "D1" ? esc(tr("nakshatra", p.nak.name)) + " " + p.nak.pada : esc(tr("graha", p.lord || ""))}</td></tr>`).join("")}
  </table></div>`;
}
const chartLegend = () => `<p class="chart-legend"><span class="r">\u211E retrograde</span><span class="deb">\u2193 debilitated</span><span class="cmb">orange: combust</span></p>`;
function chartPlaceholder(text) {
  const empty = {};
  return `<div class="chart-empty">${northSVG(empty, 1)}<div class="ce-msg">${ico("chart")}<span>${text}</span></div></div>`;
}

/* ---------- birth chart ---------- */
let lastChart = null;
let currentVarga = "D1";
let chartSub = "overview";

const chartForm = bindForm("chart-form", "chart-out", "chart-hint", async (form) => {
  const b = readBirth(form, "");
  const f = new FormData(form);
  const params = { date: b.date, time: b.time, tz_minutes: b.tz_minutes, lat: b.lat, lon: b.lon,
    elevation: parseFloat(f.get("elevation") || 0), ayanamsa: f.get("ayanamsa"), node: f.get("node"),
    dasha_year: f.get("dasha_year"), sunrise_profile: f.get("sunrise_profile"), dasha_levels: 3 };
  const r = await call("chart", params);
  r.input.name = b.name;
  r.input.place = b.place;
  r._raw = b.raw;
  lastChart = r;
  renderChart(r);
  if (typeof chartChanged === "function") chartChanged();
  return "UTC offset " + fmtOffset(b.tz_minutes);
});
chartForm.querySelector(".save-profile").addEventListener("click", () => {
  try { saveProfile(readBirth(chartForm, "").raw); } catch (e) { toast(e.message, "warn"); }
});
$$("#chart-sub button[data-sub]").forEach((b) => b.addEventListener("click", () => {
  chartSub = b.dataset.sub;
  $$("#chart-sub button[data-sub]").forEach((x) => x.classList.toggle("on", x === b));
  $$("#chart-out [data-sec]").forEach((s) => { s.hidden = s.dataset.sec !== chartSub; });
}));
document.getElementById("chart-varga").addEventListener("change", (ev) => {
  currentVarga = ev.target.value;
  if (lastChart) renderChartVisual(lastChart);
});
rerender.chart = () => lastChart && renderChart(lastChart);

function dignityPill(d) {
  if (!d) return "";
  const cls = d === "exalted" ? "ex" : d === "debilitated" ? "de" : (d === "own" || d === "moolatrikona") ? "own" : "";
  return `<span class="tagpill ${cls}">${esc(d)}</span>`;
}
function dashaTree(nodes, depth) {
  return nodes.map((n) => {
    const label = `<span class="lord${n.current ? " cur" : ""}">${pdot(n.lord)}${esc(tr("graha", n.lord))}${depth === 0 ? lordFlag(n.lord) : ""}</span><span class="dates">${dt(n.start)} \u2192 ${dt(n.end)}</span>${depth === 0 && n.balance_at_birth ? `<span class="hint">balance at birth ${n.balance_at_birth.toFixed(4)} y</span>` : ""}`;
    if (n.sub) return `<details class="dasha"${n.current ? " open" : ""}><summary>${label}</summary><div class="inner">${dashaTree(n.sub, depth + 1)}</div></details>`;
    return `<div class="dasha leaf"><span class="lord${n.current ? " cur" : ""}">${esc(tr("graha", n.lord))}</span><span class="dates">${dt(n.start)} \u2192 ${dt(n.end)}</span></div>`;
  }).join("");
}
const nakName = (n) => tr("nakshatra", n.name);
const rashiName = (r) => tr("rashi", r.name);

function renderChartVisual(r) {
  const sel = document.getElementById("chart-varga");
  sel.innerHTML = Object.keys(r.vargas).map((k) => `<option value="${k}"${k === currentVarga ? " selected" : ""}>${k} \u00b7 ${esc(r.vargas[k].name)}</option>`).join("");
  document.getElementById("chart-title").textContent = currentVarga === "D1" ? "Rasi Chart" : currentVarga + " " + r.vargas[currentVarga].name;
  document.getElementById("chart-visual").innerHTML = chartFor(r, currentVarga);
  document.getElementById("chart-details").innerHTML = `<h4 class="mini-title">Chart Details</h4>` + chartDetailsTable(r, currentVarga) + chartLegend();
}

function renderChart(r) {
  const c = r.chart, g = c.grahas, bp = r.birth_panchanga, L = c.lagna;
  const moon = g.Moon;
  const s = settings();
  const cur = r.dasha.current.map((x) => tr("graha", x.lord)).join(" \u203a ");
  const lagnaSpeed = Math.abs(L.speed_deg_per_min || 0.25);
  const minsTo = (deg) => (deg / lagnaSpeed);
  const lagMargin = Math.min(L.rashi.degrees_in_sign, 30 - L.rashi.degrees_in_sign);
  const moonNakMargin = Math.min(moon.nakshatra.degrees_into, 13.3333333 - moon.nakshatra.degrees_into);
  const warnLagna = minsTo(lagMargin) < 10;
  const cd = r.chara_dasha;
  const nm = r.namakshara;
  const sh = r.shanti;
  const nat = r.nature;
  const st = r.sun_times || {};
  const sec = (name, html) => `<div data-sec="${name}"${name === chartSub ? "" : " hidden"}>${html}</div>`;
  renderChartVisual(r);

  const summary = `
  <div class="card">
    <div class="card-head"><h3>${esc(r.input.name || "Birth chart")}<span class="hint"> \u00b7 ${esc(longDate(r.input.date))} ${esc(r.input.time)}${r.input.place ? " \u00b7 " + esc(r.input.place) : ""}</span></h3>
      <div class="row-actions"><button type="button" class="ghost" id="dl-json">${ico("download")}JSON</button><button type="button" class="ghost" data-report="chart">${ico("print")}Report</button></div></div>
    <div class="summary">
      <div class="stat"><div class="k">${t("Lagna")}</div><div class="v">${esc(rashiName(L.rashi))} ${dms(L.rashi.degrees_in_sign, false)}</div><div class="s">${esc(nakName(L.nakshatra))} p${L.nakshatra.pada}${warnLagna ? ' \u00b7 <span class="warn">near sign edge</span>' : ""}${shFlag(sh, ["lagna_gandanta"])}</div></div>
      <div class="stat"><div class="k">Janma ${t("Nakshatra")}</div><div class="v">${esc(nakName(moon.nakshatra))}</div><div class="s">pada ${moon.nakshatra.pada} \u00b7 lord ${esc(tr("graha", moon.nakshatra.lord))}${shFlag(sh, ["abhukta_mula", "nakshatra_gandanta", "gandamoola", "pada_edge"])}</div></div>
      <div class="stat"><div class="k">Janma ${t("Rashi")}</div><div class="v">${esc(rashiName(moon.rashi))}</div><div class="s">Moon ${dms(moon.rashi.degrees_in_sign, false)}</div></div>
      ${nat ? `<div class="stat"><div class="k">Gana (Gunam)</div><div class="v">${ganaPill(nat.gana)}</div><div class="s">${esc(nat.gati.name)} (${esc(nat.gati.meaning.toLowerCase())}) \u00b7 ${esc(nat.yoni.animal)} yoni</div></div>` : ""}
      ${sh ? `<div class="stat sh-stat ${sh.level}"><div class="k">Shanti</div><div class="v">${esc(sh.level === "ok" ? "Not needed" : sh.level === "danger" ? "Advised" : "Commonly advised")}</div><div class="s">${esc(sh.items.filter((i) => i.level !== "info").map((i) => i.name).join(", ") || "no janana dosha")}</div></div>` : ""}
      ${nm ? `<div class="stat"><div class="k">Name letter</div><div class="v">${esc(sylOf(nm))} <span class="sv-all">${esc(sylAll(nm))}</span></div><div class="s">${esc(tr("nakshatra", nm.nakshatra))} pada ${nm.pada}${nm.near_boundary ? ' \u00b7 <span class="warn">near pada edge</span>' : ""}</div></div>` : ""}
      <div class="stat"><div class="k">D10 / D9 lagna</div><div class="v">${esc(tr("rashi", r.vargas.D10.positions.Lagna.sign))} / ${esc(tr("rashi", r.vargas.D9.positions.Lagna.sign))}</div><div class="s">Dashamsha / Navamsha</div></div>
      <div class="stat"><div class="k">Vimshottari now</div><div class="v">${esc(cur || "\u2014")}</div><div class="s">Maha \u203a Antar \u203a Pratyantar</div></div>
      <div class="stat"><div class="k">Chara dasha now</div><div class="v">${esc((cd.current || []).map((x) => tr("rashi", x)).join(" \u203a ") || "\u2014")}</div><div class="s">${esc(cd.direction)} order</div></div>
      <div class="stat"><div class="k">Birth ${t("Tithi")}</div><div class="v">${esc(trTithi(bp.tithi.paksha, bp.tithi.name))}</div><div class="s">${esc(tr("vara", bp.vara.name))} \u00b7 ${esc(tr("month", bp.lunar_month.name))}${bp.lunar_month.adhika ? " (Adhika)" : ""}${shFlag(sh, ["amavasya", "chaturdashi", "tithi_gandanta"])}</div></div>
      <div class="stat"><div class="k">${t("Yoga")} \u00b7 ${t("Karana")}</div><div class="v">${esc(tr("yoga", bp.yoga.name))}</div><div class="s">${esc(tr("karana", bp.karana.name))}${shFlag(sh, ["vishti", "yoga"])}</div></div>
      <div class="stat"><div class="k">${t("Sunrise")} \u00b7 ${t("Sunset")}</div><div class="v">${tm(st.sunrise)} \u00b7 ${tm(st.sunset)}</div><div class="s">Hindu day: ${esc(tr("vara", st.hindu_weekday))}</div></div>
      <div class="stat"><div class="k">Ayanamsa (true)</div><div class="v">${dms(c.ayanamsa.true)}</div><div class="s">${esc(r.profile.ayanamsa.split("(")[0])}</div></div>
    </div>
  </div>`;

  const keys = ORDER.slice(1).concat(s.show_outer ? OUTER : []);
  const overview = `${shantiCard(sh)}
  <div class="card">
    <div class="card-head"><h3>Grahas</h3><span class="hint">Sidereal, ${esc(r.profile.node)} node</span></div>
    <div class="scroll"><table class="tbl">
      <tr><th>${t("Planet")}</th><th>Longitude</th><th>${t("Nakshatra")}</th><th>Pada</th><th>Lord</th><th>${t("House")}</th><th>Speed \u00b0/d</th><th>State</th></tr>
      <tr><td>${pdot("Lagna")}<b>${esc(tr("graha", "Lagna"))}</b></td><td>${signDeg(L.longitude)}</td><td>${esc(nakName(L.nakshatra))}</td><td>${L.nakshatra.pada}</td><td>${esc(tr("graha", L.nakshatra.lord))}</td><td>1</td><td>${(L.speed_deg_per_min * 1440).toFixed(1)}</td><td></td></tr>
      ${keys.map((k) => {
        const x = g[k];
        const iss = planetIssues(k, x);
        const state = [x.retrograde && !["Rahu", "Ketu"].includes(k) ? '<span class="tagpill de">R</span>' : "",
          x.dignity !== "debilitated" ? dignityPill(x.dignity) : "", issueFlags(iss)].join(" ");
        return `<tr class="${rowLevel(iss).trim()}"><td>${pdot(k)}<b>${esc(tr("graha", k))}</b></td><td>${signDeg(x.longitude)}</td><td>${esc(nakName(x.nakshatra))}</td><td>${x.nakshatra.pada}</td><td>${esc(tr("graha", x.nakshatra.lord))}</td><td>${x.house_whole_sign}${x.house_sripati !== x.house_whole_sign ? ` <span class="hint">(bhava ${x.house_sripati})</span>` : ""}</td><td>${x.speed_deg_per_day.toFixed(4)}</td><td>${state}</td></tr>`;
      }).join("")}
    </table></div>
  </div>${nm ? namaCard(nm) : ""}${natureCard(nat)}`;

  const into = moon.nakshatra.degrees_into;
  const trace = `
  <div class="card">
    <div class="card-head"><h3>Calculation trace</h3></div>
    <div class="trace">Birth instant    ${esc(r.input.date)} ${esc(r.input.time)} (UTC${fmtOffset(r.input.tz_minutes)})  =  ${esc(c.instant.utc)} UTC
TT \u2212 UTC          ${((c.instant.jd_tt - c.instant.jd_utc) * 86400).toFixed(3)} s     JD(TT) ${c.instant.jd_tt.toFixed(6)}
Moon tropical    \u03bb = ${dms(moon.tropical_longitude)}   (DE440 apparent, true ecliptic of date)
Ayanamsa         A = ${dms(c.ayanamsa.true)}   (mean ${dms(c.ayanamsa.mean)}, nutation ${c.nutation_longitude_arcsec.toFixed(2)}\u2033)
Moon sidereal    \u03bb\u2212A = ${dms(moon.longitude)}
Nakshatra        N = floor(${dms(moon.longitude)} / 13\u00b020\u2032) + 1 = ${moon.nakshatra.index}  \u2192 ${esc(moon.nakshatra.name)}
Inside           ${dms(into)}  \u2192 pada floor(${dms(into)} / 3\u00b020\u2032) + 1 = ${moon.nakshatra.pada}${moonNakMargin < 0.5 ? "   \u26a0 within " + dms(moonNakMargin, false) + " of a nakshatra edge" : ""}
${nm ? `Namakshara       pada ${(nm.nakshatra_index - 1) * 4 + nm.pada} of 108 (${esc(nm.nakshatra)} ${nm.pada})  \u2192 ${esc(sylAll(nm))}   (Moon in this pada ${esc(nm.pada_start ? nm.pada_start.replace("T", " ") : "?")} \u2192 ${esc(nm.pada_end ? nm.pada_end.replace("T", " ") : "?")})\n` : ""}Dasha balance    ${esc(r.dasha.starting_lord)}: Y \u00d7 (1 \u2212 x/800\u2032) = ${r.dasha.balance_years.toFixed(4)} years  (x = ${r.dasha.elapsed_arcmin.toFixed(3)}\u2032)
GAST             ${c.gast_hours.toFixed(6)} h     RAMC ${dms(c.ramc)}     \u03b5 ${dms(c.obliquity_true)}
Lagna            tropical ${dms(L.tropical_longitude)} \u2212 A = ${signDeg(L.longitude)}   (moves ${(L.speed_deg_per_min * 60).toFixed(2)}\u2032 per minute of time)</div>
  </div>`;

  const jm = r.jaimini;
  const jmCard = `
  <div class="two">
    <div class="card">
      <div class="card-head"><h3>Chara karakas (8)</h3></div>
      <table class="tbl">${jm.chara_karakas_8.map((k) => `<tr><td>${esc(k.karaka)}</td><td>${pdot(k.planet)}<b>${esc(tr("graha", k.planet))}</b></td><td class="hint">${dms(k.degrees, false)}</td></tr>`).join("")}</table>
    </div>
    <div class="card">
      <div class="card-head"><h3>Arudha padas</h3></div>
      <div class="scroll"><table class="tbl"><tr><th>Pada</th><th>From</th><th>Lord in</th><th>Arudha</th><th></th></tr>
      ${jm.arudha_padas.map((a) => `<tr><td><b>${esc(a.label)}</b></td><td>${esc(tr("rashi", a.source_sign))}</td><td>${esc(tr("graha", a.lord))} \u00b7 ${esc(tr("rashi", a.lord_sign))}</td><td><b>${esc(tr("rashi", a.sign))}</b></td><td class="hint">${esc(a.exception || "")}</td></tr>`).join("")}
      </table></div>
    </div>
  </div>`;

  const up = r.upagrahas;
  const upCard = `
  <div class="card">
    <div class="card-head"><h3>Upagrahas</h3><span class="hint">Birth during the ${esc(up.birth_in)}. Sun-based points per BPHS; Kalavelas from the eighth parts of the ${esc(up.birth_in)}.</span></div>
    <div class="scroll"><table class="tbl"><tr><th>Point</th><th>Longitude</th><th>${t("Nakshatra")}</th><th>${t("House")}</th><th>Rule</th></tr>
    ${Object.entries(up.points).map(([k, x]) => `<tr><td><b>${esc(k)}</b></td><td>${signDeg(x.longitude)}</td><td>${esc(nakName(x.nakshatra))} p${x.nakshatra.pada}</td><td>${x.house_whole_sign}</td><td class="hint">${esc(x.rule)}${x.time ? " \u00b7 " + dt(x.time) : ""}</td></tr>`).join("")}
    </table></div>
  </div>`;

  const bh = c.bhavas;
  const bhCard = `
  <div class="card">
    <div class="card-head"><h3>Bhavas</h3><span class="hint">Whole-sign houses with Sripati bhava madhyas and sandhis</span></div>
    <div class="scroll"><table class="tbl">
      <tr><th>${t("House")}</th><th>Whole-sign rashi</th><th>Lord</th><th>Sripati madhya</th><th>Sandhi (end)</th></tr>
      ${bh.whole_sign.map((h, i) => `<tr><td>${h.house}</td><td>${esc(tr("rashi", h.rashi))}</td><td>${esc(tr("graha", h.lord))}</td><td>${signDeg(bh.sripati[i].madhya)}</td><td class="hint">${signDeg(bh.sripati[i].sandhi_end)}</td></tr>`).join("")}
    </table></div>
  </div>`;

  const repro = `
  <div class="card">
    <div class="card-head"><h3>Reproducibility &amp; status</h3></div>
    <table class="tbl kv">${Object.entries(Object.assign({}, r.reproducibility, r.profile)).map(([k, v]) => `<tr><td class="hint">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
    ${Object.entries(r.status || {}).map(([k, v]) => `<tr><td class="hint">status: ${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}
    <tr><td class="hint">engine</td><td>${esc(r.engine)} \u00b7 computed in ${r.compute_seconds} s</td></tr></table>
  </div>`;

  document.getElementById("chart-sub").hidden = false;
  document.getElementById("chart-out").innerHTML = summary +
    sec("overview", overview) + sec("bhava", bhCard) + sec("jaimini", jmCard) + sec("upagraha", upCard) + sec("tech", trace + repro);
  document.getElementById("dl-json").onclick = () => download("chart-" + r.input.date + ".json", r);
}

/* ---------- daily panchanga ---------- */
let lastPanch = null, lastPanchUpcoming = null;
const panchForm = bindForm("panch-form", "panch-out", "panch-hint", async (form) => {
  const f = new FormData(form);
  const pl = readPlace(form);
  const date = f.get("date");
  const tz = offsetFor(pl, date, "12:00:00");
  const r = await call("panchanga", Object.assign({ date, lat: pl.lat, lon: pl.lon, tz_minutes: tz }, calc()));
  r._place = pl.name;
  lastPanch = r;
  lastPanchUpcoming = null;
  renderPanchanga(r);
  call("upcoming", Object.assign({ start: date, days: 45, lat: pl.lat, lon: pl.lon }, rangeTz(pl, date, addDays(date, 45)), calc()))
    .then((u) => { if (lastPanch === r) { lastPanchUpcoming = u; renderPanchUpcoming(r, u); } })
    .catch(() => { const el = document.getElementById("panch-upcoming"); if (el) el.innerHTML = '<p class="hint">Could not list festivals.</p>'; });
  return "UTC offset " + fmtOffset(tz);
});
panchForm.querySelectorAll(".day-step").forEach((b) => b.addEventListener("click", () => {
  const inp = panchForm.querySelector("[name=date]");
  inp.value = addDays(inp.value || todayIso(), +b.dataset.step);
  panchForm.requestSubmit();
}));
panchForm.querySelector(".today-btn").addEventListener("click", () => { panchForm.querySelector("[name=date]").value = todayIso(); panchForm.requestSubmit(); });
rerender.panchanga = () => { if (lastPanch) { renderPanchanga(lastPanch); if (lastPanchUpcoming) renderPanchUpcoming(lastPanch, lastPanchUpcoming); } };

function intervalRows(list, cat, extra) {
  return list.map((x) => `<tr><td><b>${esc(cat === "tithi" ? trTithi(x.paksha, x.name) : tr(cat, x.name))}</b>${extra ? " " + extra(x) : ""}${withFlag(elemFlag(cat, x))}</td><td>${dt(x.start)}</td><td>${dt(x.end)}</td></tr>`).join("");
}
const range = (w) => (w ? `${tm(w.start)} \u2013 ${tm(w.end)}` : "\u2014");
const lonOf = (x) => (typeof x === "number" ? x : x && (x.longitude ?? x.lon));
/* the element current at `nowIso` (local) inside a sunrise-to-sunrise list, else the first */
function currentOf(list, nowIso) {
  return list.find((x) => x.start <= nowIso && nowIso < x.end) || list[0];
}
const nowLocalIso = (tzMin) => new Date(Date.now() + tzMin * 60000).toISOString().slice(0, 19);

function renderPanchanga(r) {
  const m = r.muhurta;
  const isToday = r.date === todayIso();
  const ref = isToday ? nowLocalIso(r.tz_minutes) : r.sunrise || r.date + "T06:00:00";
  const ti = currentOf(r.tithi, ref), nk = currentOf(r.nakshatra, ref), yo = currentOf(r.yoga, ref), ka = currentOf(r.karana, ref);
  const sunL = lonOf(r.sun_sidereal_at_sunrise), moonL = lonOf(r.moon_sidereal_at_sunrise);
  const elong = sunL != null && moonL != null ? ((moonL - sunL) % 360 + 360) % 360 : (ti.index - 0.5) * 12;
  const illum = (1 - Math.cos(elong * Math.PI / 180)) / 2 * 100;
  const qcls = { good: "good", bad: "bad", neutral: "" };
  const row = (icon, cls, k, v, till) => `<div class="pl-row"><span class="pl-ico ${cls}">${icon}</span><span class="pl-k">${k}</span><span class="pl-v">${v}</span><span class="pl-t">${till ? "till " + tmRel(till, r.date) : ""}</span></div>`;
  const html = `
  <div class="panch-grid">
    <div class="card">
      <div class="card-head"><h3>${isToday ? "Today\u2019s" : esc(longDate(r.date))} Panchanga</h3><span class="hint">${esc(r._place || "")}${r._place ? " \u00b7 " : ""}${isToday ? "now" : "at sunrise"}</span></div>
      <div class="pl">
        ${row(moonSVG(ti.index || 1, 22), "", t("Tithi"), esc(trTithi(ti.paksha, ti.name)) + withFlag(tithiFlag(ti.index)), ti.end)}
        ${row(ico("star"), "c-nak", t("Nakshatra"), esc(tr("nakshatra", nk.name)) + ` <span class="hint">${esc(tr("graha", nk.lord))}</span>` + ganaHint(nk.name) + withFlag(nakFlag(nk.name)), nk.end)}
        ${row(ico("yogas"), "c-yoga", t("Yoga"), esc(tr("yoga", yo.name)) + withFlag(yogaFlag(yo.name)), yo.end)}
        ${row(ico("dashboard"), "c-kar", t("Karana"), esc(tr("karana", ka.name)) + withFlag(karanaFlag(ka.name)), ka.end)}
        ${row(ico("panchanga"), "c-vara", t("Vara"), esc(tr("vara", r.vara.name)) + ` <span class="hint">lord ${esc(tr("graha", r.vara.lord))}</span>`, "")}
      </div>
      <div class="sun-grid">
        <div class="sg"><span class="sg-ico sun">${ico("sunrise")}</span><span><small>${t("Sunrise")}</small><b>${hm(r.sunrise)}</b></span></div>
        <div class="sg"><span class="sg-ico set">${ico("sunset")}</span><span><small>${t("Sunset")}</small><b>${hm(r.sunset)}</b></span></div>
        <div class="sg"><span class="sg-ico mrise">${ico("moonrise")}</span><span><small>${t("Moonrise")}</small><b>${tmRel(r.moonrise, r.date)}</b></span></div>
        <div class="sg"><span class="sg-ico mset">${ico("moon")}</span><span><small>${t("Moonset")}</small><b>${tmRel(r.moonset, r.date)}</b></span></div>
      </div>
      <div class="card-foot"><button type="button" class="btn ghost block" id="panch-more">${ico("list")}More details</button></div>
    </div>
    <div class="panch-side">
      <div class="card moon-card">
        <div class="card-head"><h3>Moon Phase</h3><span class="hint">at sunrise</span></div>
        <div class="moon-body">${moonSVG(ti.index || 1, 76, elong)}<div><b>${esc(tr("paksha", r.lunar_month.paksha))} ${t("Paksha")}</b><div>${esc(trTithi(r.tithi[0].paksha, r.tithi[0].name))}</div><small>Illumination ${illum.toFixed(1)}% \u00b7 elongation ${elong.toFixed(1)}\u00b0</small></div></div>
      </div>
      ${r.moudhya ? `<div class="card"><div class="card-head"><h3>Moudhyami</h3><span class="hint">Guru &amp; Shukra combustion</span></div>${moudhyaRows(r.moudhya)}</div>` : ""}
      ${r.namakshara && r.namakshara.length ? `<div class="card"><div class="card-head"><h3>Name letters</h3><span class="hint">for babies born this day</span></div>${namaRows(r.namakshara, nowLocalIso(r.tz_minutes), r.date)}<p class="hint">Moon's nakshatra pada from sunrise to the next sunrise; each pada gives the first syllable of the name.</p></div>` : ""}
      ${r.shanti_windows ? `<div class="card"><div class="card-head"><h3>Shanti windows</h3><span class="hint">a birth in these times calls for shanti</span></div>${shantiWindows(r.shanti_windows, isToday ? nowLocalIso(r.tz_minutes) : "", r.date)}<p class="hint">Traditional janana dosha rules from sunrise to the next sunrise. Hover a row for the remedy.</p></div>` : ""}
      <div class="card">
        <div class="card-head"><h3>Lunar Month &amp; Festivals</h3></div>
        <div class="month-pill"><span><b>${esc(tr("month", r.lunar_month.name))}${r.lunar_month.adhika ? " (Adhika)" : ""}</b> \u00b7 ${esc(tr("paksha", r.lunar_month.paksha))}</span><small>${esc(tr("ritu", r.lunar_month.ritu))} \u00b7 ${esc(tr("samvatsara", r.year.samvatsara))} \u00b7 Shaka ${r.year.shaka}</small></div>
        <h4 class="mini-title">Upcoming Festivals</h4>
        <div id="panch-upcoming"><div class="skeleton"></div></div>
        <button type="button" class="btn primary block" id="panch-cal">${ico("panchanga")}View Full Calendar</button>
      </div>
    </div>
  </div>
  <div id="panch-details">
  ${dayTimeline(r)}
  <div class="card">
    <div class="card-head"><h3>Day summary</h3><div class="row-actions"><button type="button" class="ghost" id="dl-panch">${ico("download")}JSON</button><button type="button" class="ghost" data-report="panchanga">${ico("print")}Report</button></div></div>
    <div class="summary">
      <div class="stat"><div class="k">${t("Month")}</div><div class="v">${esc(tr("month", r.lunar_month.name))}${r.lunar_month.adhika ? " (Adhika)" : ""}</div><div class="s">${esc(tr("paksha", r.lunar_month.paksha))} \u00b7 ${esc(tr("ritu", r.lunar_month.ritu))} \u00b7 Amanta</div></div>
      <div class="stat"><div class="k">${t("Samvatsara")}</div><div class="v">${esc(tr("samvatsara", r.year.samvatsara))}</div><div class="s">Shaka ${r.year.shaka} \u00b7 ${esc(r.ayana)}</div></div>
      <div class="stat"><div class="k">Sun \u00b7 Moon ${t("Rashi")}</div><div class="v">${esc(tr("rashi", r.surya_rashi))} \u00b7 ${esc(tr("rashi", r.chandra_rashi))}</div><div class="s">at sunrise</div></div>
      <div class="stat"><div class="k">${t("Sunrise")} \u00b7 ${t("Sunset")}</div><div class="v">${tm(r.sunrise)} \u00b7 ${tm(r.sunset)}</div><div class="s">${esc(SUNRISE[r.sunrise_profile] || r.sunrise_profile)}</div></div>
      <div class="stat"><div class="k">${t("Moonrise")} \u00b7 ${t("Moonset")}</div><div class="v">${tm(r.moonrise)} \u00b7 ${tm(r.moonset)}</div><div class="s">topocentric Moon</div></div>
    </div>
  </div>
  <div class="two">
    <div class="card">
      <div class="card-head"><h3>Panchanga elements</h3><span class="hint">sunrise to next sunrise</span></div>
      <div class="scroll"><table class="tbl">
        <tr><th>${t("Tithi")}</th><th>Start</th><th>End</th></tr>${intervalRows(r.tithi, "tithi")}
        <tr><th>${t("Nakshatra")}</th><th></th><th></th></tr>${intervalRows(r.nakshatra, "nakshatra", (x) => `<span class="hint">${esc(tr("graha", x.lord))}</span>`)}
        <tr><th>${t("Yoga")}</th><th></th><th></th></tr>${intervalRows(r.yoga, "yoga")}
        <tr><th>${t("Karana")}</th><th></th><th></th></tr>${intervalRows(r.karana, "karana")}
      </table></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Muhurta windows</h3></div>
      ${m ? `<table class="tbl">
        <tr><td class="bad">${t("Rahu kala")}</td><td><b>${range(m.rahu_kala)}</b></td></tr>
        <tr><td class="bad">${t("Yamaganda")}</td><td>${range(m.yamaganda)}</td></tr>
        <tr><td class="bad">${t("Gulika")} kala</td><td>${range(m.gulika_kala)}</td></tr>
        <tr><td class="bad">${t("Durmuhurta")}</td><td>${(m.durmuhurta || []).map(range).join("<br>") || "\u2014"}</td></tr>
        <tr><td class="bad">${t("Varjyam")}</td><td>${(m.varjyam || []).map((w) => dt(w.start) + " \u2013 " + tm(w.end) + ` <span class="hint">${esc(tr("nakshatra", w.nakshatra))}</span>`).join("<br>") || "\u2014"}</td></tr>
        <tr><td class="good">${t("Amrita kala")}</td><td>${(m.amrita_kala || []).map((w) => dt(w.start) + " \u2013 " + tm(w.end) + ` <span class="hint">${esc(tr("nakshatra", w.nakshatra))}</span>`).join("<br>") || "\u2014"}</td></tr>
        <tr><td class="good">${t("Abhijit")}</td><td>${range(m.abhijit)}</td></tr>
        <tr><td class="good">Brahma muhurta (next dawn)</td><td>${range(m.brahma_muhurta)}</td></tr>
        <tr><td>Madhyahna</td><td>${tm(m.madhyahna)}</td></tr>
        <tr><td>Pradosha</td><td>${range(m.pradosha)}</td></tr>
        <tr><td>Nishitha</td><td>${tm(m.nishitha)}</td></tr>
        <tr><td>Day / night length</td><td>${m.day_length_hours.toFixed(2)} h / ${m.night_length_hours.toFixed(2)} h</td></tr>
      </table>` : '<p class="hint">Sun does not rise or set on this date at this latitude.</p>'}
    </div>
  </div>
  ${m ? `<div class="two-even">
    <div class="card">
      <div class="card-head"><h3>Choghadiya</h3></div>
      <div class="scroll"><table class="tbl"><tr><th></th><th>Name</th><th>From</th><th>To</th></tr>
      ${(m.choghadiya || []).map((c) => `<tr><td>${c.day ? "\u2600" : "\u263e"}</td><td class="${qcls[c.quality] || ""}"><b>${esc(tr("chog", c.name))}</b> <span class="hint">${esc(c.quality)}</span></td><td>${tm(c.start)}</td><td>${tm(c.end)}</td></tr>`).join("")}
      </table></div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Horas</h3></div>
      <div class="scroll"><table class="tbl"><tr><th>#</th><th>Lord</th><th>From</th><th>To</th></tr>
      ${m.horas.map((h, i) => `<tr><td>${i + 1}${h.day ? "" : " \u263e"}</td><td>${pdot(h.lord)}${esc(tr("graha", h.lord))}</td><td>${tm(h.start)}</td><td>${tm(h.end)}</td></tr>`).join("")}
      </table></div>
    </div>
  </div>` : ""}
  <div class="card">
    <div class="card-head"><h3>Sankranti &amp; month boundaries</h3></div>
    <table class="tbl">
      <tr><td>Previous sankranti</td><td>${esc(tr("rashi", r.sankranti.previous.rashi))}</td><td>${dt(r.sankranti.previous.time)}</td></tr>
      <tr><td>Next sankranti</td><td>${esc(tr("rashi", r.sankranti.next.rashi))}</td><td>${dt(r.sankranti.next.time)}</td></tr>
      <tr><td>Lunar month began (New Moon)</td><td>${esc(tr("month", r.lunar_month.name))}</td><td>${dt(r.lunar_month.start)}</td></tr>
      <tr><td>Lunar month ends (New Moon)</td><td></td><td>${dt(r.lunar_month.end)}</td></tr>
      <tr><td>Year began (Chaitra New Moon)</td><td>${esc(tr("samvatsara", r.year.samvatsara))}</td><td>${dt(r.year.year_start_new_moon)}</td></tr>
    </table>
    <p class="hint">Times are local (UTC${fmtOffset(r.tz_minutes)}). Computed in ${r.compute_seconds} s.</p>
  </div>
  </div>`;
  document.getElementById("panch-out").innerHTML = html;
  document.getElementById("dl-panch").onclick = () => download("panchanga-" + r.date + ".json", r);
  document.getElementById("panch-more").onclick = () => document.getElementById("panch-details").scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("panch-cal").onclick = () => {
    const cf = document.getElementById("cal-form");
    cf.querySelector("[name=month]").value = r.date.slice(0, 7);
    for (const n of ["place", "coords", "tz", "tzoverride"]) { const src = panchForm.querySelector(`[name=${n}]`), dst = cf.querySelector(`[name=${n}]`); if (src && dst) { dst.value = src.value; dst.dispatchEvent(new Event("change")); } }
    showTab("calendar");
    cf.requestSubmit();
  };
}
function renderPanchUpcoming(r, u) {
  const el = document.getElementById("panch-upcoming");
  if (!el) return;
  const today = u.festivals.filter((f) => f.date === r.date);
  const next = u.festivals.filter((f) => f.date > r.date && ["major", "ekadashi", "regional", "jayanti", "solar"].includes(f.category)).slice(0, 6);
  el.innerHTML = (today.length ? `<div class="fest-today">${ico("festival")}<span>${today.map((f) => esc(trFest(f))).join(", ")}</span></div>` : "")
    + (next.length ? `<div class="fest-list">${next.map((f) => `<div class="fl-row"><span><span class="dotc cat-${esc(f.category)}"></span>${esc(trFest(f))}</span><span class="hint">${esc(dateLabel(f.date, { year: undefined }))}</span></div>`).join("")}</div>` : '<p class="hint">No major festivals in the next 45 days.</p>');
}

/* ---------- init shared widgets ---------- */
$$(".sunrise-select").forEach((sel) => {
  sel.innerHTML = Object.entries(SUNRISE).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
});
$$(".place-slot").forEach((el) => renderPlaceSlot(el, el.dataset.prefix || ""));
$$(".birth-slot").forEach((el) => renderBirthSlot(el));
wrapLabels();
$$(".profile-pick").forEach((s) => { s.innerHTML = profileOptions(); });
document.querySelector("#panch-form [name=date]").value = todayIso();
/* calculation defaults on the birth-chart form come from Settings */
function applyFormDefaults() {
  const s = settings();
  for (const k of ["ayanamsa", "node", "dasha_year", "sunrise_profile", "elevation"]) $$(".set-" + k).forEach((el) => { el.value = s[k]; });
}
applyFormDefaults();
document.getElementById("chart-visual").innerHTML = chartPlaceholder("Enter birth details and press Generate Chart");
for (const [id, text, icon] of [
  ["panch-out", "Pick a day and a place to see its full Panchanga.", "panchanga"],
  ["cal-out", "Choose a month and a place to build the calendar.", "panchanga"],
  ["fest-out", "Choose a year and a place to resolve every festival.", "festival"],
  ["search-out", "Pick a date range and categories, then search.", "search"],
  ["transit-out", "Pick a saved chart or enter birth details to see transits.", "transits"],
  ["match-out", "Enter both birth details to compute compatibility.", "match"],
  ["muhurta-out", "Choose an activity and a date range to find good windows.", "muhurta"],
  ["eclipse-out", "Choose a date range to list eclipses and their local circumstances.", "eclipse"],
]) document.getElementById(id).innerHTML = emptyState(text, icon);
fillOptionLists();
renderProfilesTab();
applyI18n();
