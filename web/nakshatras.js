/* ---------- Nakshatras: Moon pada by pada for any date, and the 27-star reference ---------- */
let lastNak = null, nakSel = null, nakFilter = "all", nakFromNow = false;
const GANA_WORD = { Deva: "Divine", Manushya: "Human", Rakshasa: "Fierce" };
const ganaTag = (g) => `<span class="gana ${g.toLowerCase()}" title="${esc(GANA_WORD[g] + " temperament")}">${esc(g)} <small>${esc(GANA_WORD[g])}</small></span>`;
const shantiTag = (s) => (s ? `${flag(s.level, LEVEL_WORD[s.level], s.junction ? "Junction pada, the strongest" : "")} <small class="nk-eff">${esc(s.effect)}</small>` : '<span class="hint">\u2014</span>');

const nakForm = bindForm("nak-form", "nak-out", "nak-hint", async (form) => {
  const f = new FormData(form);
  const pl = readPlace(form);
  const date = f.get("date");
  const tz = offsetFor(pl, date, "12:00:00");
  const r = await call("nakshatras", Object.assign({ date, days: +f.get("days") || 1, lat: pl.lat, lon: pl.lon, tz_minutes: tz }, calc()));
  r._place = pl.name;
  r._tz = tz;
  lastNak = r;
  nakSel = null;
  renderNakshatras(r);
  return `${r.padas.length} padas \u00b7 UTC offset ${fmtOffset(tz)}`;
});
nakForm.querySelectorAll(".day-step").forEach((b) => b.addEventListener("click", () => {
  const inp = nakForm.querySelector("[name=date]");
  inp.value = addDays(inp.value || todayIso(), +b.dataset.step);
  nakFromNow = false;
  nakForm.requestSubmit();
}));
nakForm.querySelector(".today-btn").addEventListener("click", () => { nakForm.querySelector("[name=date]").value = todayIso(); nakFromNow = false; nakForm.requestSubmit(); });
document.getElementById("nak-now").addEventListener("click", () => {
  nakForm.querySelector("[name=date]").value = todayIso();
  const days = nakForm.querySelector("[name=days]");
  if (+days.value < 7) days.value = "7";
  nakFromNow = true;
  nakForm.requestSubmit();
});
nakForm.querySelector("[name=date]").addEventListener("change", () => { nakFromNow = false; });
nakForm.querySelector("[name=days]").addEventListener("change", () => nakForm.requestSubmit());
nakForm.querySelector("[name=view]").addEventListener("change", () => lastNak && renderNakshatras(lastNak));
nakForm.querySelector("[name=date]").value = todayIso();
onShow.nakshatras = () => { if (!lastNak) nakForm.run(); };
rerender.nakshatras = () => lastNak && renderNakshatras(lastNak);

function nakNow(r, p) {
  return `<div class="card nk-now ${p.shanti ? p.shanti.level : ""}">
    <div class="nk-now-main">
      <span class="ns">${esc(sylOf(p.syllable))}</span>
      <div><small>Moon now</small><b>${esc(tr("nakshatra", p.nakshatra))} pada ${p.pada}</b><em>${tmRel(p.start, r.date)} \u2013 ${tmRel(p.end, r.date)} \u00b7 lord ${esc(tr("graha", p.lord))}</em></div>
    </div>
    <div class="nk-now-facts">
      <div><small>Gana (gunam)</small>${ganaTag(p.gana)}</div>
      <div><small>Nature</small><b>${esc(p.gati)}</b></div>
      <div><small>Yoni</small><b>${esc(p.yoni.animal)}</b><span class="hint">${esc(p.yoni.gender)}</span></div>
      <div><small>Navamsa</small><b>${esc(tr("rashi", p.pada_nature.navamsa))}</b><span class="hint">${esc(p.pada_nature.purpose)}</span></div>
      <div><small>Shanti</small>${p.shanti ? shantiTag(p.shanti) : '<b class="ok">Not needed</b>'}</div>
    </div>
  </div>`;
}

function nakRows(r, list, now) {
  let day = "", html = "";
  for (const p of list) {
    const d = (p.start && p.start > r.range.start ? p.start : r.range.start).slice(0, 10);
    if (r.days > 1 && d !== day) html += `<tr class="nk-day"><th colspan="8">${esc(dateLabel(d, { weekday: "long" }))}</th></tr>`;
    day = d;
    const on = now && p.start <= now && now < p.end;
    const lvl = p.shanti ? (p.shanti.level === "danger" ? " row-danger" : p.shanti.level === "warn" ? " row-warn" : "") : "";
    html += `<tr class="nk-row${lvl}${on ? " on" : ""}" data-nak="${p.nakshatra_index}">
      <td class="num">${tmRel(p.start, d)} \u2013 ${tmRel(p.end, d)}${on ? ' <em class="now-tag">now</em>' : ""}</td>
      <td><b>${esc(tr("nakshatra", p.nakshatra))}</b> <span class="hint">pada ${p.pada}</span></td>
      <td><span class="nk-syl" title="${esc(p.syllable.latin + " \u00b7 " + p.syllable.devanagari + " \u00b7 " + p.syllable.telugu)}">${esc(sylOf(p.syllable))}</span></td>
      <td>${ganaTag(p.gana)}</td>
      <td>${esc(p.gati)}</td>
      <td>${esc(p.yoni.animal)} <span class="hint">${esc(p.yoni.gender === "male" ? "M" : "F")}</span></td>
      <td>${esc(tr("rashi", p.pada_nature.navamsa))} <span class="hint">${esc(p.pada_nature.purpose)}</span></td>
      <td>${shantiTag(p.shanti)}</td></tr>`;
  }
  return html;
}

/* consecutive padas of one star merged into a nakshatra stretch */
function nakGroups(padas) {
  const out = [];
  for (const p of padas) {
    const g = out[out.length - 1];
    if (g && g.nakshatra_index === p.nakshatra_index) { g.end = p.end; g.padas.push(p); }
    else out.push({ nakshatra: p.nakshatra, nakshatra_index: p.nakshatra_index, start: p.start, end: p.end, gana: p.gana, gati: p.gati, yoni: p.yoni, lord: p.lord, padas: [p] });
  }
  return out;
}
const dayTime = (iso) => `<span class="nk-d">${esc(new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }))}</span> ${iso.slice(11, 16)}`;
function nakGroupRows(r, list, now) {
  let html = "";
  for (const g of nakGroups(list)) {
    const d = (g.start && g.start > r.range.start ? g.start : r.range.start).slice(0, 10);
    const on = now && g.start <= now && now < g.end;
    const pr = g.padas.length > 1 ? `padas ${g.padas[0].pada}\u2013${g.padas[g.padas.length - 1].pada}` : `pada ${g.padas[0].pada}`;
    const sh = g.padas.filter((p) => p.shanti);
    const lvl = sh.some((p) => p.shanti.level === "danger") ? " row-danger" : sh.some((p) => p.shanti.level === "warn") ? " row-warn" : "";
    html += `<tr class="nk-row${lvl}${on ? " on" : ""}" data-nak="${g.nakshatra_index}">
      <td class="num nk-span">${dayTime(g.start)} <span class="hint">\u2192</span> ${dayTime(g.end)}${on ? ' <em class="now-tag">now</em>' : ""}</td>
      <td><b>${esc(tr("nakshatra", g.nakshatra))}</b> <span class="hint">${pr}</span></td>
      <td>${ganaTag(g.gana)}</td>
      <td>${esc(g.gati)}</td>
      <td>${esc(g.yoni.animal)}</td>
      <td>${esc(tr("graha", g.lord))}</td>
      <td>${sh.length ? sh.map((p) => flag(p.shanti.level, "P" + p.pada, `Pada ${p.pada} (${tmRel(p.start, d)} \u2013 ${tmRel(p.end, d)}): ${p.shanti.effect}`)).join(" ") : '<span class="hint">\u2014</span>'}</td></tr>`;
  }
  return html;
}

function nakDetail(n) {
  const cell = (k, v, s) => `<div class="nat-c"><small>${k}</small><b>${v}</b>${s ? `<span>${esc(s)}</span>` : ""}</div>`;
  return `<div class="nk-detail">
    <div class="nat-top">
      <div class="nat-gana ${n.gana.name.toLowerCase()}"><small>${esc(tr("nakshatra", n.nakshatra))}</small><b>${esc(n.gana.name)} gana</b><em>${esc(n.gana.meaning)} temperament</em></div>
      <p class="nat-traits"><b>${esc(n.traits)}</b><span>${esc(n.gana.text)}</span><span>${esc(n.gati.name)} (${esc(n.gati.meaning)}) star: ${esc(n.gati.text)}</span></p>
    </div>
    <div class="pada-strip">${n.padas.map((p) => `<span class="pd ${p.shanti ? p.shanti.level : ""}"><b>Pada ${p.pada} \u00b7 ${esc(tr("rashi", p.navamsa))}</b>${esc(p.purpose)}: ${esc(p.traits)}${p.shanti ? `<em class="pd-sh">${esc(LEVEL_WORD[p.shanti.level])}: ${esc(p.shanti.effect)}</em>` : ""}</span>`).join("")}</div>
    <div class="nat-grid">
      ${cell("Star lord", esc(tr("graha", n.lord)), "")}
      ${cell("Yoni (animal)", esc(n.yoni.animal), n.yoni.gender)}
      ${cell("Deity", esc(n.deity), "")}
      ${cell("Symbol", esc(n.symbol), "")}
      ${cell("Nadi", esc(n.nadi), "")}
    </div>
  </div>`;
}

function nakReference(r) {
  const chips = [["all", "All 27"], ["Deva", "Deva"], ["Manushya", "Manushya"], ["Rakshasa", "Rakshasa"], ["gm", "Gandamoola"]];
  const show = (n) => nakFilter === "all" || n.gana.name === nakFilter || (nakFilter === "gm" && n.padas.some((p) => p.shanti));
  const sel = r.reference.find((n) => n.index === nakSel) || r.reference[0];
  return `<div class="card">
    <div class="card-head"><h3>All 27 nakshatras</h3><span class="hint">click a star for its nature and padas</span></div>
    <div class="chips nk-chips">${chips.map(([k, l]) => `<button type="button" class="chip${nakFilter === k ? " on" : ""}" data-f="${k}">${esc(l)}</button>`).join("")}</div>
    <div class="nk-grid">${r.reference.filter(show).map((n) => `<button type="button" class="nk-tile ${n.gana.name.toLowerCase()}${n.index === sel.index ? " sel" : ""}" data-nak="${n.index}">
      <span class="nk-i">${n.index}</span><b>${esc(tr("nakshatra", n.nakshatra))}</b><small>${esc(n.gana.name)} \u00b7 ${esc(tr("graha", n.lord))} \u00b7 ${esc(n.yoni.animal)}</small>${n.padas.some((p) => p.shanti) ? '<i class="nk-gm" title="Gandamoola nakshatra">GM</i>' : ""}</button>`).join("")}</div>
    ${nakDetail(sel)}
    <p class="hint">Gana, yoni and nadi are the Ashtakoota tables used in matching; pada traits come from each pada's navamsa sign; Gandamoola pada effects are traditional and vary by region.</p>
  </div>`;
}

function renderNakshatras(r) {
  const now = nowLocalIso(r._tz);
  const cur = r.padas.find((p) => p.start <= now && now < p.end);
  if (!nakSel) nakSel = (cur || r.padas.find((p) => p.end > r.range.start) || r.padas[0]).nakshatra_index;
  const out = document.getElementById("nak-out");
  const view = nakForm.querySelector("[name=view]").value;
  const fromNow = nakFromNow && now >= r.range.start && now < r.range.end;
  const list = fromNow ? r.padas.filter((p) => p.end > now) : r.padas;
  const span = r.days > 1 ? `${esc(dateLabel(r.date))} \u2013 ${esc(dateLabel(addDays(r.date, r.days - 1)))}` : esc(longDate(r.date));
  const title = (view === "naks" ? "Nakshatras" : "Nakshatra padas") + (fromNow ? ` from now \u00b7 next ${r.days} days` : ` \u00b7 ${span}`);
  const table = view === "naks"
    ? `<tr><th>Time</th><th>${t("Nakshatra")}</th><th>Gana</th><th>Nature</th><th>Yoni</th><th>Lord</th><th>Shanti padas</th></tr>${nakGroupRows(r, list, now)}`
    : `<tr><th>Time</th><th>${t("Nakshatra")} \u00b7 pada</th><th>Letter</th><th>Gana</th><th>Nature</th><th>Yoni</th><th>Navamsa</th><th>Shanti (for a birth)</th></tr>${nakRows(r, list, now)}`;
  out.innerHTML = `${cur ? nakNow(r, cur) : ""}
  <div class="card">
    <div class="card-head"><h3>${title}</h3><span class="hint">${esc(r._place || "")} \u00b7 local time</span></div>
    <div class="scroll"><table class="tbl nk-tbl">${table}</table></div>
    <p class="hint">Exact Moon ${view === "naks" ? "nakshatra" : "pada"} times. A child born in a pada takes its letter, gana and shanti level; red and orange rows are Gandamoola${view === "naks" ? " (P1\u2013P4 flags show which padas)" : " padas"}. Click a row to read about that star.</p>
  </div>
  ${nakReference(r)}`;
  out.querySelectorAll("tr[data-nak]").forEach((el) => el.addEventListener("click", () => {
    nakSel = +el.dataset.nak;
    out.querySelector(".nk-grid").closest(".card").outerHTML = nakReference(r);
    bindRef();
    out.querySelector(".nk-detail").scrollIntoView({ block: "nearest", behavior: "smooth" });
  }));
  bindRef();
  function bindRef() {
    const card = out.querySelector(".nk-grid").closest(".card");
    card.querySelectorAll(".nk-tile").forEach((b) => b.addEventListener("click", () => { nakSel = +b.dataset.nak; card.outerHTML = nakReference(r); bindRef(); }));
    card.querySelectorAll(".nk-chips .chip").forEach((b) => b.addEventListener("click", () => { nakFilter = b.dataset.f; card.outerHTML = nakReference(r); bindRef(); }));
  }
}
