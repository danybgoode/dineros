/* Dineros — render de páginas a partir de /data/*.json (sin dependencias). */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf0 = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cache = {};
  const get = n => (cache[n] ||= fetch("/data/" + n + ".json").then(r => { if (!r.ok) throw new Error(n); return r.json(); }));

  /* mmdp = miles de millones de pesos */
  const mm = v => v == null ? "–" : Math.abs(v) >= 1000 ? "$" + nf2.format(v / 1000) + " billones" : "$" + nf1.format(v) + " mil millones";
  const mmShort = v => v == null ? "–" : Math.abs(v) >= 1000 ? nf2.format(v / 1000) + " bdp" : nf1.format(v) + " mmdp";
  const pesos = v => "$" + nf0.format(v);
  const pct = (v, sign) => v == null ? "–" : (sign && v > 0 ? "+" : "") + nf1.format(v) + "%";
  const COLORS = ["var(--jade)", "#3C8C7A", "#7BB8A6", "var(--rosa)", "#E27BAE", "#B8A25B", "#8A6FB5", "#5B86B8", "#9AA7A2", "#C9D2CE"];

  function nav() {
    const here = document.body.dataset.page;
    document.querySelectorAll("nav.tabs a").forEach(a => { if (a.dataset.p === here) a.setAttribute("aria-current", "page"); });
  }

  /* ---------- componentes ---------- */
  function cien(el, items, title) {
    const tot = items.reduce((a, b) => a + Math.max(0, b.pct), 0);
    el.innerHTML = `<div class="cien">${title ? `<h3>${esc(title)}</h3>` : ""}
      <div class="bar" role="img" aria-label="${esc(title || "")}">${items.map((it, i) => `<span style="width:${(Math.max(0, it.pct) / tot * 100).toFixed(2)}%;background:${COLORS[i % COLORS.length]}" title="${esc(it.k)}: ${nf1.format(it.pct)}%"></span>`).join("")}</div>
      <ol>${items.map((it, i) => `<li><i style="background:${COLORS[i % COLORS.length]}"></i><b>${Math.round(it.pct)}</b><span>${esc(it.k)} <span class="muted">· ${mmShort(it.v)}</span></span></li>`).join("")}</ol></div>`;
  }

  function lineChart(el, years, a, b, labA, labB) {
    const W = 760, H = 300, L = 40, R = 16, T = 16, B = 34;
    const max = Math.ceil(Math.max(...a, ...b) / 2000) * 2000;
    const x = i => L + i * (W - L - R) / (years.length - 1), y = v => T + (1 - v / max) * (H - T - B);
    const path = arr => arr.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const gap = "M" + a.map((v, i) => x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" L") + " L" + b.map((v, i) => [i, v]).reverse().map(([i, v]) => x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" L") + " Z";
    const ticks = []; for (let t = 0; t <= max; t += 2000) ticks.push(t);
    const last = years.length - 1;
    el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(labA)} y ${esc(labB)} por año">
      ${ticks.map(t => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t / 1000}</text>`).join("")}
      <path class="gap" d="${gap}"/>
      <path class="s1" d="${path(a)}"/><path class="s2" d="${path(b)}"/>
      ${years.map((yr, i) => (i % 2 === 0 || i === last) ? `<text class="ax" x="${x(i)}" y="${H - 12}" text-anchor="middle">${yr}</text>` : "").join("")}
      <circle class="dot1" cx="${x(last)}" cy="${y(a[last])}" r="4"/><circle class="dot2" cx="${x(last)}" cy="${y(b[last])}" r="4"/>
      <text class="ax" x="${L + 4}" y="${T + 14}">billones de pesos</text>
    </svg>
    <div class="legend"><span><i style="background:var(--jade)"></i>${esc(labA)}</span><span><i style="background:var(--rosa)"></i>${esc(labB)}</span><span><i style="background:var(--rosa);opacity:.25"></i>Déficit (lo que se pidió prestado)</span></div></div>`;
  }

  function diverging(el, rows, opt = {}) {
    const lim = opt.limit || Math.max(...rows.map(r => Math.abs(r.v)), 1);
    el.innerHTML = `<div class="div">${rows.map(r => {
      const w = Math.min(50, Math.abs(r.v) / lim * 50);
      return `<div class="drow" title="${esc(r.title || r.k)}"><span class="lab">${esc(r.k)}</span><span class="track"><span class="axis"></span><span class="fill ${r.v >= 0 ? "pos" : "neg"}" style="width:${w.toFixed(2)}%"></span></span><span class="val">${opt.fmt ? opt.fmt(r) : pct(r.v, true)}</span></div>`;
    }).join("")}</div>`;
  }

  function sortableTable(el, cols, rows, initial) {
    let key = initial || cols[0].k, dir = -1;
    const draw = () => {
      const rs = rows.slice().sort((a, b) => { const x = a[key], y = b[key]; return (typeof x === "string" ? x.localeCompare(y) : (x ?? -1e18) - (y ?? -1e18)) * dir; });
      el.innerHTML = `<div class="tablewrap"><table><thead><tr>${cols.map(c => `<th class="${c.n ? "n" : ""}"><button data-k="${c.k}">${esc(c.label)}</button></th>`).join("")}</tr></thead><tbody>${rs.map(r => `<tr>${cols.map(c => `<td class="${c.n ? "n" : ""}">${c.f ? c.f(r[c.k], r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      el.querySelectorAll("th button").forEach(b => b.onclick = () => { if (key === b.dataset.k) dir *= -1; else { key = b.dataset.k; dir = -1; } draw(); });
    };
    draw();
  }

  const titulo = s => String(s || "").replace(/\s+/g, " ").trim();

  /* ---------- páginas ---------- */
  const PAGES = {
    async inicio() {
      const [ing, fu, av] = await Promise.all([get("ingresos"), get("fuentes"), get("avance_2026")]);
      const pob = fu.poblacion_total, s = ing.serie_anual;
      const I = s["Ingresos presupuestarios"]["2025"], G = s["Gasto neto pagado"]["2025"], D = -s["Balance presupuestario"]["2025"];
      $("#n-in").textContent = mm(I); $("#n-out").textContent = mm(G); $("#n-debt").textContent = mm(D);
      $("#p-in").textContent = pesos(I * 1e9 / pob) + " por persona";
      $("#p-out").textContent = pesos(G * 1e9 / pob) + " por persona";
      $("#p-debt").textContent = pesos(D * 1e9 / pob) + " por persona";
      cien($("#cien-in"), ing.composicion.ingresos, "De cada 100 pesos que entraron en 2025…");
      cien($("#cien-out"), ing.composicion.gasto, "…y de cada 100 que salieron");
      const yrs = Object.keys(s["Ingresos presupuestarios"]);
      lineChart($("#tendencia"), yrs, yrs.map(y => s["Ingresos presupuestarios"][y]), yrs.map(y => s["Gasto neto pagado"][y]), "Ingresos", "Gasto");
      const c = ing.comparacion.find(x => x.clave === "presupuestarios");
      $("#pulso").innerHTML = `<b>${ing.ultimo_mes}: el gobierno lleva ${nf1.format(c.avance_2026_pct)}% de lo que esperaba recaudar en todo 2026.</b>
        <span class="muted">A la misma altura de 2025 llevaba ${nf1.format(c.avance_2025_mismo_periodo_pct)}%. Si el ritmo no se recupera en el último trimestre, ${c.avance_2026_pct < c.avance_2025_mismo_periodo_pct ? "faltará dinero respecto a lo prometido en la Ley de Ingresos" : "se cumplirá la meta"}. El gasto pagado va en ${nf1.format(av.total.avance_pct)}% de lo calendarizado.</span>`;
      const intereses = s["Costo financiero de la deuda"]["2025"], edu = ing.composicion.gasto;
      $("#dato-deuda").innerHTML = `<b>${mm(intereses)} se fueron solo en intereses de la deuda en 2025.</b><span class="muted">Es ${pesos(intereses * 1e9 / pob)} por persona, más del doble que en 2018 (${mm(s["Costo financiero de la deuda"]["2018"])}).</span>`;
    },

    async ingresos() {
      const [ing, sat, fu] = await Promise.all([get("ingresos"), get("sat"), get("fuentes")]);
      $("#ult").textContent = ing.ultimo_mes;
      const comp = ing.comparacion;
      diverging($("#esperado-2025"), comp.map(c => ({ k: c.nombre, v: c.dif_2025_pct, title: `${c.nombre}: se esperaban ${mm(c.esperado_2025)}, se recaudaron ${mm(c.recaudado_2025)}` })), { limit: 16 });
      $("#tabla-2025").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Concepto</th><th class="n">Se esperaba</th><th class="n">Se recaudó</th><th class="n">Diferencia</th></tr></thead><tbody>${comp.map(c => `<tr><td>${esc(c.nombre)}</td><td class="n">${mmShort(c.esperado_2025)}</td><td class="n">${mmShort(c.recaudado_2025)}</td><td class="n"><span class="pill ${c.dif_2025_pct >= 0 ? "ok" : "bad"}">${pct(c.dif_2025_pct, true)}</span></td></tr>`).join("")}</tbody></table></div>`;
      const m = ing.mes_num;
      $("#pace").innerHTML = `<div class="pace">${comp.map(c => {
        const behind = c.avance_2026_pct < c.avance_2025_mismo_periodo_pct - 1;
        return `<div class="prow"><span>${esc(c.nombre)}</span><span class="track" title="Avance 2026: ${nf1.format(c.avance_2026_pct)}% · 2025 a la misma fecha: ${nf1.format(c.avance_2025_mismo_periodo_pct)}%"><span class="fill ${behind ? "behind" : ""}" style="width:${Math.min(100, c.avance_2026_pct)}%"></span><span class="tick" style="left:${Math.min(100, c.avance_2025_mismo_periodo_pct)}%"></span></span><span class="val">${nf1.format(c.avance_2026_pct)}% <span class="muted">vs ${nf0.format(c.avance_2025_mismo_periodo_pct)}%</span></span></div>`;
      }).join("")}</div>
      <div class="legend"><span><i style="background:var(--jade)"></i>Avance 2026 a ${esc(ing.ultimo_mes.toLowerCase())}</span><span><i style="background:var(--up)"></i>Va más lento que en 2025</span><span><i style="background:var(--ink);width:3px"></i>Avance de 2025 a la misma fecha</span><span>Lo esperado a ${m} de 12 meses sería ~${nf0.format(m / 12 * 100)}%</span></div>`;
      const s = ing.serie_anual, yrs = Object.keys(s.ISR);
      $("#isr-iva").innerHTML = `<div class="bars">${yrs.map(y => `<div class="brow"><span class="lab">${y}</span><span class="track"><span class="fill" style="width:${(s.ISR[y] / 3000 * 100).toFixed(1)}%"></span></span><span class="val">${mmShort(s.ISR[y])}</span></div>`).join("")}</div>`;
      const pob = fu.poblacion_total, c = sat.cancelados;
      $("#canc-total").textContent = mm(c.monto_total);
      $("#canc-n").textContent = nf0.format(c.registros);
      $("#canc-top").textContent = nf1.format(c.top1pct_share) + "%";
      $("#canc-top100").textContent = mm(c.top100_monto);
      const emp = c.por_tipo.find(t => t.k.startsWith("Empresas")), pf = c.por_tipo.find(t => t.k.startsWith("Personas"));
      $("#canc-tipo").innerHTML = `Las empresas son el ${nf0.format(emp.n / c.registros * 100)}% de los casos pero concentran <b>${mm(emp.monto)}</b> (${nf0.format(emp.monto / c.monto_total * 100)}% del monto). Las personas físicas suman ${nf0.format(pf.n)} casos y ${mm(pf.monto)}.`;
      $("#canc-anio").innerHTML = `<div class="bars">${c.por_anio.filter(a => +a.k >= 2014).map(a => `<div class="brow"><span class="lab">${a.k} <span class="muted">· ${nf0.format(a.n)} casos</span></span><span class="track"><span class="fill" style="width:${(a.millones / 230000 * 100).toFixed(2)}%;background:var(--rosa)"></span></span><span class="val">${a.millones >= 1000 ? mmShort(a.millones / 1000) : nf1.format(a.millones) + " mdp"}</span></div>`).join("")}</div>`;
      $("#firmes").innerHTML = `<b>${nf0.format(sat.firmes.registros)}</b> contribuyentes tienen deudas fiscales firmes (definitivas) sin pagar: ${nf0.format(sat.firmes.personas_fisicas)} personas físicas y ${nf0.format(sat.firmes.empresas)} empresas. Además, el SAT tiene <b>${nf0.format(sat.efos.Definitivo)}</b> empresas confirmadas como emisoras de facturas falsas (lista 69-B).`;
    },

    async gasto() {
      const [g, av] = await Promise.all([get("gasto_2025"), get("avance_2026")]);
      const big = g.ramos.filter(r => r.aprobado >= 5 || r.ejercido >= 5);
      const rows = big.map(r => ({ k: titulo(r.nombre), v: r.dif_pct, raw: r }));
      let modo = "pct";
      const draw = () => {
        const rs = rows.slice().sort((a, b) => modo === "pct" ? b.v - a.v : b.raw.dif - a.raw.dif);
        diverging($("#ramos"), rs.map(r => ({ k: r.k, v: modo === "pct" ? Math.max(-100, Math.min(200, r.v)) : r.raw.dif, title: `${r.k}: aprobado ${mm(r.raw.aprobado)}, ejercido ${mm(r.raw.ejercido)}`, raw: r.raw })),
          { limit: modo === "pct" ? 100 : Math.max(...rs.map(r => Math.abs(r.raw.dif))), fmt: r => modo === "pct" ? pct(r.raw.dif_pct, true) : (r.raw.dif > 0 ? "+" : "") + nf1.format(r.raw.dif) });
      };
      document.querySelectorAll("#modo button").forEach(b => b.onclick = () => { modo = b.dataset.m; document.querySelectorAll("#modo button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
      draw();
      const progTable = (el, list) => el.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Programa</th><th>Dependencia</th><th class="n">Aprobado</th><th class="n">Ejercido</th><th class="n">Diferencia</th></tr></thead><tbody>${list.map(p => `<tr><td>${esc(titulo(p.nombre))} <span class="tag">${esc(p.clave)}</span></td><td class="muted">${esc(titulo(p.ramo))}</td><td class="n">${nf1.format(p.aprobado)}</td><td class="n">${nf1.format(p.ejercido)}</td><td class="n"><span class="pill ${p.dif < 0 ? "down" : "up"}">${p.dif > 0 ? "+" : ""}${nf1.format(p.dif)}</span></td></tr>`).join("")}</tbody></table></div>`;
      progTable($("#sub"), g.programas_subejercicio.slice(0, 12));
      progTable($("#sobre"), g.programas_sobreejercicio.slice(0, 12));
      progTable($("#bolsas"), g.bolsas_reasignadas.slice(0, 6));
      $("#cap").innerHTML = `<div class="bars">${g.capitulos.map(c => `<div class="brow" title="Aprobado ${mm(c.aprobado)} · ejercido ${mm(c.ejercido)}"><span class="lab">${esc(c.nombre)}</span><span class="track"><span class="fill" style="width:${(c.ejercido / g.capitulos[0].ejercido * 100).toFixed(1)}%"></span><span class="mark" style="left:${Math.min(100, c.aprobado / g.capitulos[0].ejercido * 100).toFixed(1)}%"></span></span><span class="val">${pct(c.dif_pct, true)}</span></div>`).join("")}</div>`;
      const ar = av.ramos.filter(r => r.programado_al_periodo >= 5 && r.avance_pct != null).sort((a, b) => a.avance_pct - b.avance_pct);
      diverging($("#avance"), ar.slice(0, 14).map(r => ({ k: titulo(r.nombre), v: r.avance_pct - 100, raw: r, title: `Programado a septiembre: ${mm(r.programado_al_periodo)} · pagado: ${mm(r.pagado)}` })), { limit: 60, fmt: r => nf0.format(r.raw.avance_pct) + "%" });
      $("#avance-total").textContent = nf1.format(av.total.avance_pct) + "%";
    },

    async estados() {
      const e = await get("estados");
      const rows = e.estados.map(s => ({ ...s, fed: s.participaciones + s.aportaciones }));
      const max = Math.max(...rows.map(r => r.federalizado_pc));
      const nat = rows.reduce((a, r) => a + r.fed, 0) * 1e9 / rows.reduce((a, r) => a + r.poblacion, 0);
      $("#nac").textContent = pesos(nat);
      $("#pc").innerHTML = `<div class="bars">${rows.map(r => `<div class="brow" title="Participaciones ${mm(r.participaciones)} · aportaciones ${mm(r.aportaciones)}"><span class="lab">${esc(r.estado)}</span><span class="track"><span class="fill" style="width:${(r.federalizado_pc / max * 100).toFixed(1)}%;background:${r.federalizado_pc >= nat ? "var(--jade)" : "var(--jade-2)"}"></span><span class="mark" style="left:${(nat / max * 100).toFixed(1)}%"></span></span><span class="val">${pesos(r.federalizado_pc)}</span></div>`).join("")}</div>`;
      sortableTable($("#tabla"), [
        { k: "estado", label: "Estado" },
        { k: "poblacion", label: "Población 2025", n: 1, f: v => nf0.format(v) },
        { k: "participaciones", label: "Participaciones (R28)", n: 1, f: v => nf1.format(v) },
        { k: "aportaciones", label: "Aportaciones (R33)", n: 1, f: v => nf1.format(v) },
        { k: "federalizado_pc", label: "Por persona", n: 1, f: v => pesos(v) },
        { k: "ejercido_total", label: "Todo el gasto federal ubicado ahí", n: 1, f: v => nf1.format(v) },
      ], rows, "federalizado_pc");
      $("#nodist").textContent = mm(e.no_distribuible["No Distribuible Geográficamente"] || 0);
    },

    async p2027() {
      const p = await get("ppef_2027");
      $("#t26").textContent = mm(p.total_2026); $("#t27").textContent = mm(p.total_2027);
      $("#tc").textContent = pct((p.total_2027 / p.total_2026 - 1) * 100, true);
      const rs = p.ramos.filter(r => r.pef_2026 >= 3 && r.cambio_pct != null).sort((a, b) => b.cambio_pct - a.cambio_pct);
      diverging($("#cambios"), rs.map(r => ({ k: titulo(r.nombre), v: Math.max(-60, Math.min(60, r.cambio_pct)), raw: r, title: `2026: ${mm(r.pef_2026)} → 2027: ${mm(r.ppef_2027)}` })), { limit: 60, fmt: r => pct(r.raw.cambio_pct, true) });
      sortableTable($("#tabla27"), [
        { k: "nombre", label: "Ramo", f: v => esc(titulo(v)) },
        { k: "pef_2026", label: "Aprobado 2026", n: 1, f: v => nf1.format(v) },
        { k: "ppef_2027", label: "Propuesto 2027", n: 1, f: v => nf1.format(v) },
        { k: "cambio", label: "Cambio", n: 1, f: v => (v > 0 ? "+" : "") + nf1.format(v) },
        { k: "cambio_pct", label: "%", n: 1, f: v => pct(v, true) },
      ], p.ramos, "ppef_2027");
    },

    async fuentes() {
      const f = await get("fuentes");
      $("#lista").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Fuente</th><th>Para qué la usamos</th><th>Descargada</th><th>Huella (SHA-256)</th></tr></thead><tbody>${f.fuentes.map(x => `<tr><td><a href="${esc(x.pagina || x.url)}" rel="noopener" target="_blank">${esc(x.nombre)}</a><br><span class="note">${esc(x.responsable)}${x.bytes ? " · " + nf1.format(x.bytes / 1e6) + " MB" : ""}</span></td><td>${esc(x.uso)}</td><td class="mono" style="white-space:nowrap">${esc((x.descargado || "").replace("T", " ").replace("Z", " UTC"))}</td><td><code class="tag" style="word-break:break-all">${esc((x.sha256 || "").slice(0, 16))}…</code></td></tr>`).join("")}</tbody></table></div>`;
    },
  };

  nav();
  const fn = PAGES[document.body.dataset.page];
  if (fn) fn().catch(err => { console.error(err); document.querySelectorAll(".loading").forEach(e => e.textContent = "No pudimos cargar los datos. Recarga la página."); });
})();
