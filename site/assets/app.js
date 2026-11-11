/* Dineros v2 — gráficas y páginas a partir de /data/*.json. Sin dependencias.
   Componentes: tooltip, wafle, balance, líneas con cursor, treemap, mosaico de estados,
   dumbbell, columnas apiladas, medidores de avance, buscador 69-B. */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf0 = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cache = {};
  const get = n => (cache[n] ||= fetch("/data/" + n + ".json").then(r => { if (!r.ok) throw new Error(n); return r.json(); }));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } } };

  /* ---------- formatos (mmdp = miles de millones de pesos) ---------- */
  const mm = v => v == null ? "–" : Math.abs(v) >= 1000 ? "$" + nf2.format(v / 1000) + " billones" : "$" + nf1.format(v) + " mil millones";
  const mmS = v => v == null ? "–" : Math.abs(v) >= 1000 ? (v < 0 ? "-" : "") + "$" + nf2.format(Math.abs(v) / 1000) + " bdp" : (v < 0 ? "-" : "") + "$" + nf1.format(Math.abs(v)) + " mmdp";
  const mdp = v => v >= 1000 ? mmS(v / 1000) : "$" + nf1.format(v) + " mdp";
  const pesos = v => "$" + nf0.format(Math.round(v));
  const pct = (v, sign) => v == null ? "–" : (sign && v > 0 ? "+" : "") + nf1.format(v) + "%";
  const pct0 = (v, sign) => v == null ? "–" : (sign && v > 0 ? "+" : "") + nf0.format(v) + "%";
  const titulo = s => String(s || "").replace(/\s+/g, " ").trim();
  const CAT = i => `var(--c${i + 1})`;

  /* ---------- tooltip ---------- */
  const tipEl = () => $("#tip");
  const T = (t, rows = [], x = "") => esc(`<span class="t">${esc(t)}</span>` + rows.map(([a, b]) => `<span class="r"><span>${esc(a)}</span><span>${esc(b)}</span></span>`).join("") + (x ? `<span class="x">${esc(x)}</span>` : ""));
  function tipShow(html, cx, cy) {
    const el = tipEl(); if (!el) return;
    el.innerHTML = html; el.classList.add("on");
    const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
    let x = cx + 14, y = cy + 16;
    if (x + r.width > vw - 8) x = Math.max(8, cx - r.width - 14);
    if (y + r.height > vh - 8) y = Math.max(8, cy - r.height - 14);
    el.style.transform = `translate(${x}px,${y}px)`;
  }
  const tipHide = () => tipEl()?.classList.remove("on");
  function bindTips() {
    const on = e => { const t = e.target.closest?.("[data-tip]"); if (t && t.dataset.tip) tipShow(t.dataset.tip, e.clientX, e.clientY); else if (!e.target.closest?.(".chart")) tipHide(); };
    document.addEventListener("pointermove", on, { passive: true });
    document.addEventListener("pointerdown", on, { passive: true });
    addEventListener("scroll", tipHide, { passive: true });
    document.addEventListener("focusin", e => { const t = e.target.closest?.("[data-tip]"); if (t && t.dataset.tip) { const r = t.getBoundingClientRect(); tipShow(t.dataset.tip, r.left + r.width / 2, r.bottom); } });
  }

  /* re-dibuja cuando cambia el ancho del contenedor */
  function responsive(el, draw) {
    let w0 = 0;
    const run = () => { const w = Math.round(el.clientWidth); if (w && Math.abs(w - w0) > 4) { w0 = w; draw(w); } };
    if ("ResizeObserver" in window) new ResizeObserver(run).observe(el);
    run();
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))); for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p; return 10 * p; }

  /* ---------- wafle: 100 cuadritos = 100 pesos ---------- */
  function fold(items, max = 8) {
    if (items.length <= max) return items;
    const keep = items.slice(0, max - 1), rest = items.slice(max - 1);
    return [...keep, { k: "Otros", v: rest.reduce((a, b) => a + b.v, 0), pct: rest.reduce((a, b) => a + b.pct, 0) }];
  }
  function cuadros(items) { // método del mayor residuo para que sumen exactamente 100
    const tot = items.reduce((a, b) => a + b.pct, 0), raw = items.map(it => it.pct / tot * 100);
    const n = raw.map(Math.floor); const rest = 100 - n.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - n[i], i]).sort((a, b) => b[0] - a[0]).slice(0, rest).forEach(([, i]) => n[i]++);
    return n;
  }
  function waffle(el, items, opt = {}) {
    items = fold(items);
    const n = cuadros(items);
    const amount = opt.amount;
    const val = it => amount != null ? pesos(amount * it.pct / 100) : mmS(it.v);
    const tipOf = (it, i) => T(it.k, [["De cada 100 pesos", nf0.format(n[i])], [amount != null ? "De tus pesos" : "Monto 2025", val(it)]], opt.notes?.[it.k] || "");
    let sq = "";
    items.forEach((it, i) => { for (let j = 0; j < n[i]; j++) sq += `<i data-g="${i}" style="background:${CAT(i)}" data-tip="${tipOf(it, i)}"></i>`; });
    el.innerHTML = `<div class="waffle-wrap"><div class="waffle" role="img" aria-label="${esc(opt.label || "")}">${sq}</div>
      <ol class="wlist">${items.map((it, i) => `<li data-g="${i}" tabindex="0" data-tip="${tipOf(it, i)}"><i style="background:${CAT(i)}"></i><b>${n[i]}</b><span>${esc(it.k)}</span><em>${val(it)}</em></li>`).join("")}</ol></div>`;
    if (el._wbound) return; el._wbound = true;
    const hl = g => { const w = $(".waffle", el); if (!w) return; w.classList.toggle("dim", g != null); $$("i", w).forEach(x => x.classList.toggle("on", x.dataset.g === g)); $$("li", el).forEach(x => x.classList.toggle("on", x.dataset.g === g)); };
    el.addEventListener("pointerover", e => { const t = e.target.closest("[data-g]"); hl(t ? t.dataset.g : null); });
    el.addEventListener("pointerleave", () => hl(null));
    el.addEventListener("focusin", e => { const t = e.target.closest("[data-g]"); if (t) hl(t.dataset.g); });
  }

  /* ---------- balance: lo que entró vs lo que salió ---------- */
  function balance(el, ing, gas, deficit, pob) {
    const I = ing.reduce((a, b) => a + b.v, 0), G = gas.reduce((a, b) => a + b.v, 0), M = Math.max(G, I + deficit);
    const seg = (it, cls) => { const w = it.v / M * 100; return `<span class="seg ${cls}${w > 8.5 ? " lb" : ""}" style="flex:0 0 calc(${w.toFixed(3)}% - 2px);background:${cls === "in" ? "var(--jade)" : "var(--ink-2)"};color:var(--surface)" data-tip="${T(it.k, [["2025", mm(it.v)], ["Por persona", pesos(it.v * 1e9 / pob)], ["Del total", pct(it.v / (cls === "in" ? I : G) * 100)]])}">${w > 8.5 ? `${esc(it.k)}<small>${mmS(it.v)}</small>` : ""}</span>`; };
    el.innerHTML = `<div class="bal">
      <div class="row"><span>Entró<small>${mmS(I)}</small></span><div class="bar" role="img" aria-label="Ingresos 2025 por fuente">${ing.map(it => seg(it, "in")).join("")}<span class="seg debt" style="flex:1 1 auto" data-tip="${T("Faltante: se pidió prestado", [["2025", mm(deficit)], ["Por persona", pesos(deficit * 1e9 / pob)]], "Es el déficit. Se cubre con deuda que se paga después, con intereses.")}"><b>Deuda</b></span></div></div>
      <div class="row"><span>Salió<small>${mmS(G)}</small></span><div class="bar" role="img" aria-label="Gasto 2025 por destino">${gas.map(it => seg(it, "out")).join("")}</div></div>
      <div class="legend"><span><i style="background:var(--jade)"></i>Ingresos por fuente</span><span><i style="background:var(--ink-2)"></i>Gasto por destino</span><span><i class="hatch"></i>Faltante cubierto con deuda</span><span>· Pasa el cursor o toca cada bloque</span></div></div>`;
  }

  /* ---------- líneas con cursor ---------- */
  function lineChart(el, o) {
    responsive(el, W => {
      const narrow = W < 600, H = narrow ? 240 : 320, L = 40, R = narrow ? 10 : 150, Tp = 12, B = 26;
      const all = o.series.flatMap(s => s.vals);
      let lo = o.min ?? 0, hi = Math.max(...all);
      const step = niceStep((hi - lo) / 4); hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step;
      const n = o.x.length, x = i => L + i * (W - L - R) / (n - 1), y = v => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B);
      const path = arr => arr.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
      let g = "";
      for (let t = lo; t <= hi + 1e-9; t += step) g += `<line class="${t === lo ? "base" : "gl"}" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ax" x="${L - 7}" y="${y(t) + 4}" text-anchor="end">${o.tick ? o.tick(t) : t}</text>`;
      if (o.ref != null) g += `<line x1="${L}" x2="${W - R}" y1="${y(o.ref)}" y2="${y(o.ref)}" stroke="var(--muted)" stroke-width="1.5"/>`;
      const every = narrow ? Math.ceil(n / 5) : 1;
      o.x.forEach((lab, i) => { if ((i % every === 0 && (n - 1 - i >= every || i === n - 1)) || i === n - 1) g += `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${lab}</text>`; });
      if (o.band) {
        const [a, b] = o.band.map(k => o.series[k].vals);
        g += `<path fill="var(--rosa)" opacity=".13" d="M${a.map((v, i) => x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" L")} L${b.map((v, i) => [i, v]).reverse().map(([i, v]) => x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" L")} Z"/>`;
      }
      o.series.forEach(s => { g += `<path d="${path(s.vals)}" fill="none" stroke="${s.color}" stroke-width="${s.w || 2.5}" stroke-linejoin="round" stroke-linecap="round"/>`; });
      o.series.forEach(s => { g += `<circle cx="${x(n - 1)}" cy="${y(s.vals[n - 1])}" r="4.5" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`; });
      if (!narrow) { // etiquetas directas al final, separadas al menos 30px
        const labs = o.series.map(s => ({ s, yy: y(s.vals[n - 1]) })).sort((a, b) => a.yy - b.yy);
        for (let i = 1; i < labs.length; i++) if (labs[i].yy - labs[i - 1].yy < 30) labs[i].yy = labs[i - 1].yy + 30;
        labs.forEach(l => { g += `<text class="lab" x="${x(n - 1) + 12}" y="${l.yy - 1}">${esc(l.s.k)}</text><text class="ax" x="${x(n - 1) + 12}" y="${l.yy + 13}">${esc(o.fmt(l.s.vals[n - 1]))}</text>`; });
      }
      g += `<line class="xh" x1="0" x2="0" y1="${Tp}" y2="${H - B}"/><g class="dots"></g><rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent"/>`;
      el.innerHTML = `<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "")}">${g}</svg></div>
        <div class="legend">${o.series.map(s => `<span><i class="line" style="background:${s.color}"></i>${esc(s.k)}</span>`).join("")}${o.bandLabel ? `<span><i style="background:var(--rosa);opacity:.3"></i>${esc(o.bandLabel)}</span>` : ""}</div>`;
      const svg = $("svg", el), ch = $(".chart", el), xh = $(".xh", el), dots = $(".dots", el);
      const move = e => {
        const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) * W / r.width;
        const i = clamp(Math.round((px - L) / ((W - L - R) / (n - 1))), 0, n - 1);
        ch.classList.add("hover"); xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i));
        dots.innerHTML = o.series.map(s => `<circle cx="${x(i)}" cy="${y(s.vals[i])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`).join("");
        const rows = o.series.map(s => [s.k, o.fmt(s.vals[i])]);
        if (o.extra) rows.push(...o.extra(i));
        tipShow(T(String(o.x[i]), rows), e.clientX, e.clientY);
      };
      svg.addEventListener("pointermove", move);
      svg.addEventListener("pointerdown", move);
      svg.addEventListener("pointerleave", () => { ch.classList.remove("hover"); dots.innerHTML = ""; tipHide(); });
    });
  }

  /* ---------- treemap (algoritmo squarified) ---------- */
  function squarify(data, W, H) {
    const tot = data.reduce((a, b) => a + b.v, 0), out = [];
    const items = data.map(d => ({ ...d, a: d.v / tot * W * H }));
    let x = 0, y = 0, w = W, h = H, row = [], i = 0;
    const worst = (r, len) => { const s = r.reduce((a, b) => a + b.a, 0), mx = Math.max(...r.map(q => q.a)), mn = Math.min(...r.map(q => q.a)); return Math.max(len * len * mx / (s * s), s * s / (len * len * mn)); };
    const lay = r => {
      const s = r.reduce((a, b) => a + b.a, 0);
      if (w >= h) { const cw = s / h; let cy = y; r.forEach(q => { const qh = q.a / cw; out.push({ ...q, x, y: cy, w: cw, h: qh }); cy += qh; }); x += cw; w -= cw; }
      else { const rh = s / w; let cx = x; r.forEach(q => { const qw = q.a / rh; out.push({ ...q, x: cx, y, w: qw, h: rh }); cx += qw; }); y += rh; h -= rh; }
    };
    while (i < items.length) { const len = Math.min(w, h), c = items[i]; if (!row.length || worst([...row, c], len) <= worst(row, len)) { row.push(c); i++; } else { lay(row); row = []; } }
    if (row.length) lay(row);
    return out;
  }
  const divColor = t => `color-mix(in oklab, var(${t >= 0 ? "--up" : "--down"}) ${(Math.abs(t) * 85).toFixed(0)}%, var(--mid))`;
  function treemap(el, items, opt = {}) {
    responsive(el, W => {
      const H = Math.round(W < 700 ? W * 1.25 : W * 9 / 16);
      const cells = squarify(items.slice().sort((a, b) => b.v - a.v), W, H);
      el.innerHTML = `<div class="tm" style="aspect-ratio:auto;height:${H}px" role="img" aria-label="${esc(opt.label || "")}">${cells.map(c => {
        const big = c.w > 74 && c.h > 40, t = c.t ?? 0;
        return `<div class="c${Math.abs(t) > .55 ? " dk" : ""}" style="left:${c.x.toFixed(1)}px;top:${c.y.toFixed(1)}px;width:${c.w.toFixed(1)}px;height:${c.h.toFixed(1)}px;background:${divColor(t)}" data-tip="${c.tip}">${big ? `<b>${esc(c.k)}</b><span>${esc(c.lab || "")}</span>` : ""}</div>`;
      }).join("")}</div>`;
    });
  }

  /* ---------- mosaico de México (cada cuadro un estado, en su posición aproximada) ---------- */
  const EDOS = [["BC", "Baja California", 0, 0], ["SON", "Sonora", 1, 0], ["CHIH", "Chihuahua", 2, 0], ["COAH", "Coahuila", 3, 0], ["NL", "Nuevo León", 4, 0], ["TAMS", "Tamaulipas", 5, 0],
    ["BCS", "Baja California Sur", 0, 1], ["SIN", "Sinaloa", 1, 1], ["DGO", "Durango", 2, 1], ["ZAC", "Zacatecas", 3, 1], ["SLP", "San Luis Potosí", 4, 1], ["VER", "Veracruz", 5, 1],
    ["NAY", "Nayarit", 1, 2], ["JAL", "Jalisco", 2, 2], ["AGS", "Aguascalientes", 3, 2], ["GTO", "Guanajuato", 4, 2], ["QRO", "Querétaro", 5, 2], ["HGO", "Hidalgo", 6, 2],
    ["COL", "Colima", 1, 3], ["MICH", "Michoacán", 2, 3], ["MEX", "Estado de México", 3, 3], ["CDMX", "Ciudad de México", 4, 3], ["TLAX", "Tlaxcala", 5, 3], ["PUE", "Puebla", 6, 3], ["YUC", "Yucatán", 8, 3],
    ["GRO", "Guerrero", 3, 4], ["MOR", "Morelos", 4, 4], ["OAX", "Oaxaca", 5, 4], ["TAB", "Tabasco", 6, 4], ["CAMP", "Campeche", 7, 4], ["QROO", "Quintana Roo", 8, 4],
    ["CHIS", "Chiapas", 6, 5]];
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const EDO_BY = {}; EDOS.forEach(e => { EDO_BY[norm(e[1])] = e[0]; });
  Object.assign(EDO_BY, { "mexico": "MEX", "coahuila de zaragoza": "COAH", "michoacan de ocampo": "MICH", "veracruz de ignacio de la llave": "VER", "distrito federal": "CDMX" });
  const edo = s => EDO_BY[norm(s)];
  const EDO_NOMBRE = Object.fromEntries(EDOS.map(e => [e[0], e[1]]));
  function tilemap(el, vals, opt) {
    const vs = Object.values(vals).map(v => v.v), lo = opt.min ?? Math.min(...vs), hi = Math.max(...vs);
    const p = v => 10 + 90 * clamp((v - lo) / (hi - lo || 1), 0, 1);
    el.innerHTML = `<div class="tilemap" role="img" aria-label="${esc(opt.label || "")}">${EDOS.map(([c, , col, row]) => {
      const d = vals[c]; if (!d) return "";
      const pp = p(d.v);
      return `<div class="t${pp > 55 ? " dk" : ""}" style="grid-column:${col + 1};grid-row:${row + 1};background:color-mix(in oklab, var(--jade) ${pp.toFixed(0)}%, var(--surface));${opt.sel === c ? "box-shadow:inset 0 0 0 3px var(--rosa)" : ""}" data-tip="${d.tip}"><b>${c}</b><span>${esc(opt.short(d.v))}</span></div>`;
    }).join("")}</div>
    <div class="scale"><span>${esc(opt.fmt(lo))}</span><span class="grad" style="background:linear-gradient(90deg,color-mix(in oklab, var(--jade) 10%, var(--surface)),var(--jade))"></span><span>${esc(opt.fmt(hi))}</span><span>${esc(opt.unit || "")}</span></div>`;
  }

  /* ---------- dumbbell: de A (anillo) a B (punto) ---------- */
  function dumbbell(el, rows, opt = {}) {
    const max = opt.max || Math.max(...rows.flatMap(r => [r.a, r.b])) * 1.03;
    el.innerHTML = `<div class="db">${opt.head ? `<div class="hd"><span>${esc(opt.head[0])}</span><span>${esc(opt.head[1])}</span><span>${esc(opt.head[2])}</span></div>` : ""}${rows.map(r => {
      const a = r.a / max * 100, b = r.b / max * 100, up = r.b >= r.a, cls = up ? "up" : "down";
      return `<div class="r" data-tip="${r.tip}"><span class="lab">${esc(r.k)}</span><span class="tr"><span class="ln ${cls}" style="left:${Math.min(a, b).toFixed(2)}%;width:${Math.abs(b - a).toFixed(2)}%"></span><span class="a" style="left:${a.toFixed(2)}%"></span><span class="e ${cls}" style="left:${b.toFixed(2)}%"></span></span><span class="v ${up ? "up-t" : "down-t"}">${esc(r.v)}</span></div>`;
    }).join("")}</div>`;
  }

  /* ---------- columnas (apiladas o simples) ---------- */
  function columns(el, cats, opt) {
    const max = Math.max(...cats.map(c => c.parts.reduce((a, b) => a + b, 0)));
    el.innerHTML = `<div class="cols"><div class="plot" role="img" aria-label="${esc(opt.label || "")}">${cats.map(c => {
      const tot = c.parts.reduce((a, b) => a + b, 0), hp = v => `calc((100% - 16px) * ${(v / max).toFixed(4)})`;
      return `<div class="col" data-tip="${c.tip}">${c.parts.map((v, i) => v > 0 ? `<i style="height:${hp(v)};background:${opt.colors[i]}"></i>` : "").join("")}${opt.top ? `<span class="tv" style="bottom:calc((100% - 16px) * ${(tot / max).toFixed(4)} + ${2 * c.parts.filter(v => v > 0).length}px)">${esc(opt.top(tot, c))}</span>` : ""}</div>`;
    }).join("")}</div><div class="xs">${cats.map(c => `<span>${esc(cats.length > 8 && /^\d{4}$/.test(c.k) ? "’" + c.k.slice(2) : c.k)}</span>`).join("")}</div></div>`;
  }

  /* ---------- barras divergentes ---------- */
  function diverging(el, rows, opt = {}) {
    const lim = opt.limit || Math.max(...rows.map(r => Math.abs(r.v)), 1);
    el.innerHTML = `<div class="div">${rows.map(r => {
      const w = Math.min(50, Math.abs(r.v) / lim * 50);
      return `<div class="drow" data-tip="${r.tip || ""}"><span class="lab">${esc(r.k)}</span><span class="track"><span class="axis"></span><span class="fill ${r.v >= 0 ? "pos" : "neg"}" style="width:${w.toFixed(2)}%"></span></span><span class="val">${esc(opt.fmt ? opt.fmt(r) : pct(r.v, true))}</span></div>`;
    }).join("")}</div>`;
  }

  function sortableTable(el, cols, rows, initial, dir0 = -1) {
    let key = initial || cols[0].k, dir = dir0;
    const draw = () => {
      const rs = rows.slice().sort((a, b) => { const x = a[key], y = b[key]; return (typeof x === "string" ? x.localeCompare(y, "es") : (x ?? -1e18) - (y ?? -1e18)) * dir; });
      el.innerHTML = `<div class="tablewrap"><table><thead><tr>${cols.map(c => `<th class="${c.n ? "n" : ""}" aria-sort="${key === c.k ? (dir > 0 ? "ascending" : "descending") : "none"}"><button data-k="${c.k}">${esc(c.label)}</button></th>`).join("")}</tr></thead><tbody>${rs.map(r => `<tr>${cols.map(c => `<td class="${c.n ? "n" : ""}">${c.f ? c.f(r[c.k], r) : esc(r[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      $$("th button", el).forEach(b => b.onclick = () => { if (key === b.dataset.k) dir *= -1; else { key = b.dataset.k; dir = -1; } draw(); });
    };
    draw();
  }

  function toggle(group, cb) {
    const bs = $$("button", group);
    bs.forEach(b => b.onclick = () => { bs.forEach(x => x.setAttribute("aria-pressed", x === b)); cb(b.dataset.m); });
  }

  /* ---------- medidor de avance anual ---------- */
  function gauge(el, o) {
    el.innerHTML = `<div class="gauge"><div class="top"><span>${esc(o.label)}</span><b class="${o.behind ? "up-t" : "jade-t"}">${pct(o.value)}</b></div>
      <div class="track" data-tip="${o.tip || ""}"><span class="fill${o.behind ? " behind" : ""}" style="width:${clamp(o.value, 0, 100)}%"></span>${o.marks.map(m => `<span class="mk ${m.cls || ""}" style="left:${clamp(m.p, 0, 100)}%"><span>${esc(m.label)}</span></span>`).join("")}</div>
      ${o.note ? `<p class="note">${o.note}</p>` : ""}</div>`;
  }

  /* ================================================================== páginas */
  const PAGES = {
    async inicio() {
      const [ing, fu, av] = await Promise.all([get("ingresos"), get("fuentes"), get("avance_2026")]);
      const pob = fu.poblacion_total, s = ing.serie_anual, Y = "2025";
      const I = s["Ingresos presupuestarios"][Y], G = s["Gasto neto pagado"][Y], D = -s["Balance presupuestario"][Y];
      balance($("#balance"), ing.composicion.ingresos, ing.composicion.gasto, D, pob);
      $("#pp").innerHTML = `Por persona: entraron <b class="jade-t">${pesos(I * 1e9 / pob)}</b>, salieron <b>${pesos(G * 1e9 / pob)}</b> y faltaron <b class="rosa-t">${pesos(D * 1e9 / pob)}</b>.`;

      // calculadora "tu peso"
      const inp = $("#monto"), out = $("#tu-peso");
      const draw = () => {
        const v = Math.max(0, Number(String(inp.value).replace(/[^\d.]/g, "")) || 0);
        waffle(out, ing.composicion.gasto, { amount: v, label: "Cómo se reparte tu dinero", notes: { "Intereses de la deuda": "Pago por deuda de años anteriores. No compra ningún bien ni servicio nuevo.", "Participaciones a estados": "Dinero que la Federación reparte a estados y municipios para que lo usen como decidan." } });
        const it = ing.composicion.gasto.find(x => x.k.startsWith("Intereses"));
        $("#tu-intereses").innerHTML = `De esos ${pesos(v)}, <b class="rosa-t">${pesos(v * it.pct / 100)}</b> se van solo a pagar intereses de la deuda.`;
        store.set("dineros-monto", String(v));
      };
      inp.value = store.get("dineros-monto") || "10000";
      inp.addEventListener("input", draw);
      $$("#presets button").forEach(b => b.onclick = () => { inp.value = b.dataset.v; draw(); });
      draw();

      const yrs = Object.keys(s["Ingresos presupuestarios"]);
      const ser = k => yrs.map(y => s[k][y]);
      lineChart($("#tendencia"), {
        x: yrs, label: "Ingresos y gasto 2015–2025", band: [1, 0], bandLabel: "Déficit: lo que se pidió prestado",
        series: [{ k: "Ingresos", vals: ser("Ingresos presupuestarios"), color: "var(--jade)" }, { k: "Gasto", vals: ser("Gasto neto pagado"), color: "var(--rosa)" }],
        fmt: mmS, tick: t => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(t / 1000), extra: i => [["Déficit", mmS(-s["Balance presupuestario"][yrs[i]])]],
      });
      const idx = k => { const v = ser(k); return v.map(x => x / v[0] * 100); };
      lineChart($("#crece"), {
        x: yrs, label: "Crecimiento de rubros de gasto, índice 2015 = 100", ref: 100,
        series: [{ k: "Intereses de la deuda", vals: idx("Costo financiero de la deuda"), color: "var(--c8)" },
          { k: "Pensiones", vals: idx("Pensiones y jubilaciones"), color: "var(--c7)" },
          { k: "Ingresos totales", vals: idx("Ingresos presupuestarios"), color: "var(--muted)", w: 2 },
          { k: "Inversión física", vals: idx("Inversión física"), color: "var(--c1)" }],
        fmt: v => "×" + nf1.format(v / 100), tick: t => nf0.format(t),
      });

      const c = ing.comparacion.find(x => x.clave === "presupuestarios"), m = ing.mes_num;
      gauge($("#g-ing"), { label: "Recaudación 2026 contra la meta del año", value: c.avance_2026_pct, behind: c.avance_2026_pct < c.avance_2025_mismo_periodo_pct,
        marks: [{ p: c.avance_2025_mismo_periodo_pct, label: `2025 a la fecha: ${nf0.format(c.avance_2025_mismo_periodo_pct)}%` }, { p: m / 12 * 100, label: `${m} de 12 meses`, cls: "b" }],
        tip: T("Ingresos 2026", [["Meta anual", mmS(c.esperado_2026)], ["Recaudado a " + ing.ultimo_mes.toLowerCase(), mmS(c.recaudado_2026_ytd)]]),
        note: `Van ${mmS(c.recaudado_2026_ytd)} de los ${mmS(c.esperado_2026)} que prometió la Ley de Ingresos. Datos a ${esc(ing.ultimo_mes.toLowerCase())}.` });
      gauge($("#g-gas"), { label: "Gasto pagado contra lo programado a septiembre", value: av.total.avance_pct, behind: false,
        marks: [{ p: 100, label: "100% = al día", cls: "r" }],
        tip: T("Gasto 2026", [["Programado al periodo", mmS(av.total.programado_al_periodo)], ["Pagado", mmS(av.total.pagado)]]),
        note: `Las dependencias han pagado ${mmS(av.total.pagado)} de los ${mmS(av.total.programado_al_periodo)} que tenían programados para enero–septiembre.` });
    },

    async ingresos() {
      const ing = await get("ingresos");
      $$(".ult").forEach(e => e.textContent = ing.ultimo_mes.toLowerCase());
      waffle($("#w-ing"), ing.composicion.ingresos, { label: "De cada 100 pesos que entraron en 2025", notes: {
        "ISR": "Impuesto sobre la renta: lo pagan las empresas por sus ganancias y las personas por su sueldo.",
        "IVA": "El 16% que se suma al precio de casi todo lo que compras.",
        "Petróleo (Pemex y derechos)": "Ventas de Pemex y derechos que paga por extraer petróleo.",
        "IMSS, ISSSTE y CFE": "Cuotas de seguridad social y ventas de electricidad.",
        "IEPS (sin gasolinas)": "Impuesto a refrescos, alcohol, tabaco y otros. El de gasolinas se cuenta en «Petróleo».",
      } });
      const comp = ing.comparacion;
      $("#bullet").innerHTML = `<div class="bars">${comp.map(c => {
        const r = c.recaudado_2025 / c.esperado_2025 * 100, sc = v => v / 120 * 100;
        return `<div class="brow" data-tip="${T(c.nombre, [["Se esperaba", mmS(c.esperado_2025)], ["Se recaudó", mmS(c.recaudado_2025)], ["Diferencia", mmS(c.recaudado_2025 - c.esperado_2025)]])}"><span class="lab">${esc(c.nombre)}</span><span class="track"><span class="fill" style="width:${sc(r).toFixed(2)}%;background:${r >= 100 ? "var(--jade)" : "var(--up)"}"></span><span class="mark" style="left:${sc(100).toFixed(2)}%"></span></span><span class="val"><span class="pill ${r >= 100 ? "ok" : "warn"}">${pct(c.dif_2025_pct, true)}</span></span></div>`;
      }).join("")}</div>`;
      $("#pace").innerHTML = `<div class="pace">${comp.map(c => {
        const behind = c.avance_2026_pct < c.avance_2025_mismo_periodo_pct - 1;
        return `<div class="prow" data-tip="${T(c.nombre, [["Meta 2026", mmS(c.esperado_2026)], ["Cobrado", mmS(c.recaudado_2026_ytd)], ["Avance 2026", pct(c.avance_2026_pct)], ["2025 a la misma fecha", pct(c.avance_2025_mismo_periodo_pct)]])}"><span>${esc(c.nombre)}</span><span class="track"><span class="fill ${behind ? "behind" : ""}" style="width:${Math.min(100, c.avance_2026_pct)}%"></span><span class="tick" style="left:${Math.min(100, c.avance_2025_mismo_periodo_pct)}%"></span></span><span class="val">${nf0.format(c.avance_2026_pct)}% <span class="muted">vs ${nf0.format(c.avance_2025_mismo_periodo_pct)}%</span></span></div>`;
      }).join("")}</div>`;
      const s = ing.serie_anual, yrs = Object.keys(s.ISR), ser = k => yrs.map(y => s[k][y]);
      lineChart($("#fuentes-hist"), {
        x: yrs, label: "Principales fuentes de ingreso 2015–2025",
        series: [{ k: "ISR", vals: ser("ISR"), color: "var(--c1)" }, { k: "IVA", vals: ser("IVA"), color: "var(--c2)" },
          { k: "Petróleo", vals: ser("Ingresos petroleros"), color: "var(--c3)" }, { k: "IEPS", vals: ser("IEPS"), color: "var(--c4)" }],
        fmt: mmS, tick: t => nf0.format(t),
      });
    },

    async gasto() {
      const [g, av] = await Promise.all([get("gasto_2025"), get("avance_2026")]);
      const tot = g.ramos.reduce((a, r) => a + r.ejercido, 0);
      const big = g.ramos.filter(r => r.ejercido >= tot * 0.004), small = g.ramos.filter(r => r.ejercido < tot * 0.004);
      const tmItems = big.map(r => ({ k: titulo(r.nombre), v: r.ejercido, t: clamp(r.dif_pct / 60, -1, 1), lab: `${mmS(r.ejercido)} · ${pct0(r.dif_pct, true)}`,
        tip: T(titulo(r.nombre), [["Aprobado", mmS(r.aprobado)], ["Ejercido", mmS(r.ejercido)], ["Diferencia", `${mmS(r.dif)} (${pct(r.dif_pct, true)})`]]) }));
      const sa = small.reduce((a, r) => a + r.aprobado, 0), se = small.reduce((a, r) => a + r.ejercido, 0);
      tmItems.push({ k: `Otras ${small.length} dependencias`, v: se, t: clamp((se / sa - 1) * 100 / 60, -1, 1), lab: mmS(se), tip: T(`Otras ${small.length} dependencias`, [["Aprobado", mmS(sa)], ["Ejercido", mmS(se)]], small.slice(0, 8).map(r => titulo(r.nombre)).join(", ") + "…") });
      treemap($("#treemap"), tmItems, { label: "Gasto ejercido 2025 por dependencia" });

      const movers = g.ramos.filter(r => r.aprobado >= 5 || r.ejercido >= 5).sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif)).slice(0, 14);
      dumbbell($("#ramos"), movers.map(r => ({ k: titulo(r.nombre), a: r.aprobado, b: r.ejercido, v: pct0(r.dif_pct, true),
        tip: T(titulo(r.nombre), [["Aprobado", mmS(r.aprobado)], ["Ejercido", mmS(r.ejercido)], ["Diferencia", mmS(r.dif)]]) })), { head: ["Dependencia", "Aprobado ○ → ● ejercido", "Cambio"] });

      const prog = (el, list) => dumbbell(el, list.map(p => ({ k: titulo(p.nombre), a: p.aprobado, b: p.ejercido, v: (p.dif > 0 ? "+" : "") + nf1.format(p.dif),
        tip: T(titulo(p.nombre), [["Dependencia", titulo(p.ramo)], ["Clave", p.clave], ["Aprobado", mmS(p.aprobado)], ["Ejercido", mmS(p.ejercido)], ["Diferencia", pct(p.dif_pct, true)]]) })), { head: ["Programa", "Aprobado ○ → ● ejercido", "mmdp"] });
      prog($("#sub"), g.programas_subejercicio.slice(0, 10));
      prog($("#sobre"), g.programas_sobreejercicio.slice(0, 10));
      prog($("#bolsas"), g.bolsas_reasignadas.slice(0, 6));

      const capMax = Math.max(...g.capitulos.map(c => Math.max(c.ejercido, c.aprobado)));
      $("#cap").innerHTML = `<div class="bars">${g.capitulos.map(c => `<div class="brow" data-tip="${T(c.nombre, [["Aprobado", mmS(c.aprobado)], ["Ejercido", mmS(c.ejercido)], ["Diferencia", pct(c.dif_pct, true)]])}"><span class="lab">${esc(c.nombre)}</span><span class="track"><span class="fill" style="width:${(c.ejercido / capMax * 100).toFixed(1)}%;background:var(--ink-2)"></span><span class="mark" style="left:${(c.aprobado / capMax * 100).toFixed(1)}%;background:var(--rosa)"></span></span><span class="val"><span class="pill ${c.dif_pct > 5 ? "up" : c.dif_pct < -5 ? "down" : "neutral"}">${pct0(c.dif_pct, true)}</span></span></div>`).join("")}</div>`;

      const ar = av.ramos.filter(r => r.programado_al_periodo >= 5 && r.avance_pct != null).sort((a, b) => a.avance_pct - b.avance_pct);
      $("#avance").innerHTML = `<div class="pace">${ar.slice(0, 16).map(r => `<div class="prow" data-tip="${T(titulo(r.nombre), [["Aprobado para el año", mmS(r.aprobado_anual)], ["Programado a septiembre", mmS(r.programado_al_periodo)], ["Pagado", mmS(r.pagado)]])}"><span>${esc(titulo(r.nombre))}</span><span class="track"><span class="fill ${r.avance_pct < 90 ? "behind" : ""}" style="width:${Math.min(100, r.avance_pct / 1.2)}%"></span><span class="tick" style="left:${100 / 1.2}%"></span></span><span class="val">${nf0.format(r.avance_pct)}%</span></div>`).join("")}</div>`;
      $("#avance-total").textContent = pct(av.total.avance_pct);
    },

    async estados() {
      const e = await get("estados");
      const rows = e.estados.map(s => ({ ...s, cod: edo(s.estado), fed: s.participaciones + s.aportaciones,
        part_pc: s.participaciones * 1e9 / s.poblacion, apor_pc: s.aportaciones * 1e9 / s.poblacion }));
      const P = rows.reduce((a, r) => a + r.poblacion, 0);
      const nat = { federalizado_pc: rows.reduce((a, r) => a + r.fed, 0) * 1e9 / P, part_pc: rows.reduce((a, r) => a + r.participaciones, 0) * 1e9 / P, apor_pc: rows.reduce((a, r) => a + r.aportaciones, 0) * 1e9 / P };
      $$(".nac").forEach(x => x.textContent = pesos(nat.federalizado_pc));
      const sel = $("#estado");
      sel.innerHTML = `<option value="">Elige tu estado…</option>` + rows.slice().sort((a, b) => a.estado.localeCompare(b.estado, "es")).map(r => `<option value="${r.cod}">${esc(r.estado)}</option>`).join("");
      let metric = "federalizado_pc", mine = store.get("dineros-estado") || "";
      const NAMES = { federalizado_pc: "Total por persona", part_pc: "Participaciones por persona", apor_pc: "Aportaciones por persona" };
      const draw = () => {
        const vals = {};
        rows.forEach(r => vals[r.cod] = { v: r[metric], tip: T(r.estado, [["Total por persona", pesos(r.federalizado_pc)], ["Participaciones (libre uso)", pesos(r.part_pc)], ["Aportaciones (etiquetadas)", pesos(r.apor_pc)], ["Población 2025", nf0.format(r.poblacion)]]) });
        tilemap($("#mapa"), vals, { sel: mine, label: NAMES[metric] + " por estado", fmt: pesos, short: v => "$" + nf0.format(v / 1000) + " mil", unit: "· " + NAMES[metric].toLowerCase() + ", 2025" });
        const rs = rows.slice().sort((a, b) => b[metric] - a[metric]), max = rs[0][metric];
        $("#pc").innerHTML = `<div class="bars">${rs.map(r => `<div class="brow" data-tip="${vals[r.cod].tip}" style="${r.cod === mine ? "background:var(--rosa-soft)" : ""}"><span class="lab">${r.cod === mine ? "★ " : ""}${esc(r.estado)}</span><span class="track"><span class="fill" style="width:${(r[metric] / max * 100).toFixed(1)}%;background:${r[metric] >= nat[metric] ? "var(--jade)" : "var(--jade-2)"}"></span><span class="mark" style="left:${(nat[metric] / max * 100).toFixed(1)}%"></span></span><span class="val">${pesos(r[metric])}</span></div>`).join("")}</div>`;
        const me = rows.find(r => r.cod === mine);
        if (me) {
          const d = (me.federalizado_pc / nat.federalizado_pc - 1) * 100, rank = rows.slice().sort((a, b) => b.federalizado_pc - a.federalizado_pc).findIndex(r => r.cod === mine) + 1;
          $("#tu-estado").innerHTML = `<p class="lede">En <b>${esc(me.estado)}</b> llegaron <b class="jade-t">${pesos(me.federalizado_pc)}</b> de dinero federal por habitante en 2025: <b>${pct0(Math.abs(d))} ${d >= 0 ? "más" : "menos"}</b> que el promedio nacional. Es el lugar <b>${rank} de 32</b>. De eso, ${pesos(me.part_pc)} son participaciones, que el gobierno local usa como quiere, y ${pesos(me.apor_pc)} son aportaciones, que ya vienen etiquetadas para escuelas, salud, seguridad u obras.</p>`;
        } else $("#tu-estado").innerHTML = `<p class="note">Elige tu estado para verlo marcado en el mapa y en la lista.</p>`;
      };
      sel.value = mine; sel.onchange = () => { mine = sel.value; store.set("dineros-estado", mine); draw(); };
      toggle($("#metrica"), m => { metric = m; draw(); });
      draw();
      sortableTable($("#tabla"), [
        { k: "estado", label: "Estado" },
        { k: "poblacion", label: "Población", n: 1, f: v => nf0.format(v) },
        { k: "participaciones", label: "Participaciones", n: 1, f: v => nf1.format(v) },
        { k: "aportaciones", label: "Aportaciones", n: 1, f: v => nf1.format(v) },
        { k: "federalizado_pc", label: "Por persona", n: 1, f: v => pesos(v) },
        { k: "ejercido_total", label: "Todo el gasto federal ahí", n: 1, f: v => nf1.format(v) },
      ], rows, "federalizado_pc");
      $("#nodist").textContent = mm(e.no_distribuible["No Distribuible Geográficamente"] || 0);
    },

    async sat() {
      const [sat, est] = await Promise.all([get("sat"), get("estados")]);
      const E = sat.efos, D = sat.efos_det, C = sat.cancelados;
      buscador();
      const ST = [["Presunto", "st0", "señalados; aún pueden defenderse"], ["Definitivo", "st1", "confirmados como factureros"], ["Desvirtuado", "st2", "probaron que sus operaciones eran reales"], ["Sentencia Favorable", "st3", "un tribunal les dio la razón"]];
      $("#flujo").innerHTML = `<div class="flow"><div class="bar" role="img" aria-label="Situación de los contribuyentes en la lista 69-B">${ST.map(([k, c, d]) => { const n = E[k] || 0, w = n / sat.efos_total * 100; return `<span class="seg ${c}" style="flex:0 0 calc(${w.toFixed(2)}% - 2px)" data-tip="${T(k, [["Contribuyentes", nf0.format(n)], ["Del total", pct(w)]], d)}"><b>${nf0.format(n)}</b>${w > 12 ? esc(k) : ""}</span>`; }).join("")}</div></div>
        <div class="legend">${ST.map(([k, c, d]) => `<span><i class="${c}"></i><b>${esc(k)}</b>: ${esc(d)}</span>`).join("")}</div>`;
      columns($("#efos-anio"), D.por_anio.map(a => ({ k: a.k, parts: [a.v[1], a.v[3], a.v[2], a.v[0]], tip: T(`Señalados en ${a.k}`, [["Total", nf0.format(a.v.reduce((x, y) => x + y, 0))], ["Hoy definitivos", nf0.format(a.v[1])], ["Sentencia favorable", nf0.format(a.v[3])], ["Desvirtuados", nf0.format(a.v[2])], ["Aún presuntos", nf0.format(a.v[0])]]) })),
        { colors: ["var(--bad)", "var(--jade-2)", "var(--ok)", "var(--warn)"], top: t => nf0.format(t), label: "Contribuyentes señalados por año" });
      columns($("#edades"), D.edades.map(a => ({ k: a.k.replace(" años", ""), parts: [a.n], tip: T(a.k, [["Empresas", nf0.format(a.n)]]) })), { colors: ["var(--rosa)"], top: t => nf0.format(t), label: "Edad de las empresas al ser señaladas" });
      $("#cruce").innerHTML = `
        <div class="kpi rosa"><span class="v">${nf0.format(D.cruce.def_con_cancelacion)}</span><span class="l">factureros confirmados a los que el SAT <b>además</b> les canceló deudas</span><span class="s">${mm(D.cruce.def_cancelado_millones / 1000)} cancelados</span></div>
        <div class="kpi"><span class="v">${nf0.format(D.cruce.def_con_deuda_firme)}</span><span class="l">factureros confirmados que <b>además</b> tienen deudas firmes sin pagar</span><span class="s">lista de créditos firmes del SAT</span></div>`;

      // deudas canceladas
      const top1 = C.curva.find(c => c.pct_casos === 1).pct_monto;
      const w = n => Array.from({ length: 100 }, (_, i) => `<i style="background:${i < n ? "var(--rosa)" : "var(--sunk)"}"></i>`).join("");
      $("#concentra").innerHTML = `<div class="pair">
        <figure><div class="waffle" role="img" aria-label="100 deudores, 1 resaltado">${w(1)}</div><figcaption><b>1 de cada 100</b>deudores con deuda cancelada…</figcaption></figure>
        <figure><div class="waffle" role="img" aria-label="100 pesos, ${Math.round(top1)} resaltados">${w(Math.round(top1))}</div><figcaption><b>${nf0.format(top1)} de cada 100 pesos</b>…concentra este monto del total cancelado.</figcaption></figure></div>`;
      columns($("#canc-anio"), C.por_anio.filter(a => +a.k >= 2012).map(a => ({ k: a.k, parts: [a.millones], tip: T(`Cancelado en ${a.k}`, [["Monto", mdp(a.millones)], ["Casos", nf0.format(a.n)]]) })),
        { colors: ["var(--rosa)"], top: t => t >= 1000 ? nf0.format(t / 1000) : "", label: "Monto cancelado por año" });
      const vals = {}; C.por_estado.forEach(r => { const c = edo(r.k); if (c) vals[c] = { v: r.millones, tip: T(EDO_NOMBRE[c], [["Cancelado", mdp(r.millones)], ["Casos", nf0.format(r.n)]]) }; });
      tilemap($("#canc-mapa"), vals, { label: "Deuda cancelada por estado", fmt: mdp, short: v => v >= 1000 ? nf0.format(v / 1000) + " mm" : "<1 mm", unit: "· por domicilio fiscal del deudor" });
      const det = $("#top-emp").closest("details");
      det.addEventListener("toggle", () => { if (det.open && !det._ok) { det._ok = true; topEmp(); } });
      const topEmp = () => sortableTable($("#top-emp"), [
        { k: "nombre", label: "Empresa", f: (v, r) => `${esc(titulo(v))}<br><span class="tag">${esc(r.rfc)}</span>` },
        { k: "estado", label: "Estado", f: v => esc(v) },
        { k: "anio", label: "Año", n: 1 },
        { k: "millones", label: "Cancelado (mdp)", n: 1, f: v => nf1.format(v) },
      ], C.top_empresas, "millones");

      // deudas firmes por cada 100 mil habitantes
      const pob = {}; est.estados.forEach(s => { pob[edo(s.estado)] = s.poblacion; });
      const fv = {}; sat.firmes.por_estado.forEach(([k, n]) => { const c = edo(k); if (c && pob[c]) fv[c] = { v: n / pob[c] * 1e5, tip: T(EDO_NOMBRE[c], [["Deudores firmes", nf0.format(n)], ["Por cada 100 mil habitantes", nf0.format(n / pob[c] * 1e5)]]) }; });
      tilemap($("#firmes-mapa"), fv, { label: "Deudores firmes por cada 100 mil habitantes", fmt: v => nf0.format(v), short: v => nf0.format(v), unit: "· deudores por cada 100 mil habitantes" });
    },

    async p2027() {
      const p = await get("ppef_2027");
      $("#t26").textContent = mm(p.total_2026); $("#t27").textContent = mm(p.total_2027);
      $("#tc").textContent = pct((p.total_2027 / p.total_2026 - 1) * 100, true);
      $("#tcm").textContent = "+" + mm(p.total_2027 - p.total_2026);
      const movers = p.ramos.filter(r => r.cambio_pct != null).sort((a, b) => Math.abs(b.cambio) - Math.abs(a.cambio)).slice(0, 14);
      dumbbell($("#flechas"), movers.map(r => ({ k: titulo(r.nombre), a: r.pef_2026, b: r.ppef_2027, v: (r.cambio > 0 ? "+" : "") + nf1.format(r.cambio),
        tip: T(titulo(r.nombre), [["Aprobado 2026", mmS(r.pef_2026)], ["Propuesto 2027", mmS(r.ppef_2027)], ["Cambio", pct(r.cambio_pct, true)]]) })), { head: ["Ramo", "2026 ○ → ● 2027", "mmdp"] });
      const rs = p.ramos.filter(r => r.pef_2026 >= 3 && r.cambio_pct != null).sort((a, b) => b.cambio_pct - a.cambio_pct);
      diverging($("#cambios"), rs.map(r => ({ k: titulo(r.nombre), v: clamp(r.cambio_pct, -60, 60), raw: r, tip: T(titulo(r.nombre), [["2026", mmS(r.pef_2026)], ["2027", mmS(r.ppef_2027)], ["Cambio", pct(r.cambio_pct, true)]]) })), { limit: 60, fmt: r => pct0(r.raw.cambio_pct, true) });
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
      $("#lista").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Fuente</th><th>Para qué la usamos</th><th>Descargada</th><th>Huella (SHA-256)</th></tr></thead><tbody>${f.fuentes.map(x => `<tr><td><a href="${esc(x.pagina || x.url)}" rel="noopener" target="_blank">${esc(x.nombre)}</a><br><span class="note">${esc(x.responsable)}${x.bytes ? " · " + nf1.format(x.bytes / 1e6) + " MB" : ""}</span></td><td>${esc(x.uso)}</td><td class="mono" style="white-space:nowrap">${esc((x.descargado || "").slice(0, 10))}</td><td><code class="tag" style="word-break:break-all">${esc((x.sha256 || "").slice(0, 16))}…</code></td></tr>`).join("")}</tbody></table></div>`;
    },
  };

  /* ---------- buscador de la lista 69-B ---------- */
  function buscador() {
    const inp = $("#q"), out = $("#res"), info = $("#res-info");
    let data = null;
    const load = () => data || (data = get("efos").then(d => { d.idx = d.filas.map(f => norm(f[0] + " " + f[1])); return d; }));
    const PILL = [["warn", "Presunto"], ["bad", "Definitivo"], ["ok", "Desvirtuado"], ["ok", "Sentencia favorable"]];
    const fecha = s => s ? new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "";
    const run = async () => {
      const q = norm(inp.value);
      if (q.length < 3) { out.innerHTML = ""; info.textContent = "Escribe al menos 3 letras de un nombre o de un RFC."; return; }
      info.textContent = "Buscando…";
      const d = await load(), toks = q.split(" ").filter(Boolean), hits = [];
      for (let i = 0; i < d.idx.length && hits.length < 200; i++) if (toks.every(t => d.idx[i].includes(t))) hits.push(d.filas[i]);
      if (norm(inp.value) !== q) return; // el usuario siguió escribiendo
      info.textContent = hits.length ? `${hits.length >= 200 ? "Más de 200" : nf0.format(hits.length)} resultado${hits.length === 1 ? "" : "s"}${hits.length > 12 ? ". Agrega otra palabra para afinar." : "."}` : "No aparece en la lista 69-B. No es una garantía, pero es buena señal.";
      let shown = 12;
      const render = () => { out.innerHTML = hits.slice(0, shown).map(card).join("") + (hits.length > shown ? `<button class="more-btn" type="button">Ver ${Math.min(24, hits.length - shown)} más</button>` : "");
        const mb = $(".more-btn", out); if (mb) mb.onclick = () => { shown += 24; render(); }; };
      render();
    };
    const card = f => {
        const [rfc, nom, st, fp, fd, firme, canc] = f, [pc, pl] = PILL[st];
        return `<div class="res"><span class="n">${esc(nom)}</span><span class="pill ${pc}">${pl}</span><span class="rfc">${esc(rfc)} · ${rfc.length === 12 ? "empresa" : "persona física"}</span><span></span>
          <span class="meta">${fp ? `<span>Señalado: ${fecha(fp)}</span>` : ""}${fd ? `<span>· Definitivo: ${fecha(fd)}</span>` : ""}${firme ? `<span class="pill neutral">También tiene deuda firme con el SAT</span>` : ""}${canc > 0 ? `<span class="pill neutral">Le cancelaron ${mdp(canc)} en deudas</span>` : ""}</span></div>`;
    };
    let tm; inp.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(run, 160); });
    inp.addEventListener("focus", load, { once: true });
    $$("[data-q]").forEach(b => b.onclick = () => { inp.value = b.dataset.q; run(); });
    const pre = new URLSearchParams(location.search).get("q"); if (pre) { inp.value = pre; run(); }
  }

  /* ---------- arranque ---------- */
  function progress() {
    const bar = $(".progress"); if (!bar) return;
    const f = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.width = (h > 0 ? scrollY / h * 100 : 0) + "%"; };
    addEventListener("scroll", f, { passive: true }); f();
  }
  bindTips(); progress();
  const fn = PAGES[document.body.dataset.page];
  if (fn) fn().catch(err => { console.error(err); $$(".loading").forEach(e => e.textContent = "No pudimos cargar los datos. Recarga la página."); });
})();
