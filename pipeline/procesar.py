"""Convierte data/raw/* en JSON pequeños para el sitio (site/data/).

Uso: python3 pipeline/procesar.py
Todas las cifras se reportan en pesos corrientes (nominales) salvo que se indique.
"""
import codecs
import collections
import csv
import html
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from fuentes import FUENTES  # noqa: E402

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"
OUT = RAIZ / "site" / "data"
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
         "Septiembre", "Octubre", "Noviembre", "Diciembre"]
csv.field_size_limit(1 << 30)


def num(s):
    s = (s or "").strip().replace(",", "")
    if not s or s == "-":
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def abrir(nombre):
    p = RAW / nombre
    with open(p, "rb") as f:
        muestra = f.read(4_000_000)
    try:
        codecs.getincrementaldecoder("utf-8")().decode(muestra, final=False)
        enc = "utf-8-sig"
    except UnicodeDecodeError:
        enc = "latin1"
    return open(p, encoding=enc, newline="")


def lector(nombre):
    f = abrir(nombre)
    r = csv.reader(f)
    h = [x.strip().upper() for x in next(r)]
    return r, {k: i for i, k in enumerate(h)}


def guardar(nombre, obj):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / nombre).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    print(f"✓ {nombre}: {(OUT / nombre).stat().st_size/1024:.0f} KB")


def mmdp(x):
    """pesos → miles de millones de pesos, 1 decimal"""
    return round(x / 1e9, 1)


# ------------------------------------------------------------------ ingresos
CONCEPTOS = {
    "XAB": "Ingresos presupuestarios",
    "XAB11": "Ingresos tributarios",
    "XAB1110": "ISR",
    "XAB1120": "IVA",
    "XAB1130": "IEPS",
    "XAB2214": "Impuestos a la importación",
    "XAB21": "Ingresos petroleros",
    "XAB20": "Ingresos de organismos y empresas",
    "XAB12": "Ingresos no tributarios del Gobierno Federal",
    "XAC": "Gasto neto pagado",
    "XAC10": "Gasto programable",
    "XAC20": "Gasto no programable",
    "XAC21": "Costo financiero de la deuda",
    "XAC22": "Participaciones a estados y municipios",
    "XAC1210": "Servicios personales (sueldos)",
    "XAC1310": "Inversión física",
    "XAA10": "Balance presupuestario",
    "XAB2210": "Impuestos no petroleros",
    "XAB2211": "ISR no petrolero", "XAB2212": "IVA no petrolero", "XAB2213": "IEPS no petrolero",
    "XAB2215": "Otros impuestos", "XAB2230": "Derechos, aprovechamientos y otros", "XAB2240": "IMSS, ISSSTE y CFE (ingresos propios)",
    "XAB2110": "Pemex (ingresos propios)", "XAB2120": "Petroleros del Gobierno Federal",
    "XAC1220": "Otros gastos de operación", "XAC1230": "Subsidios y transferencias", "XAC13": "Gasto de capital",
    "XAC23": "Adeudos de años anteriores", "XOA0135": "Pensiones y jubilaciones",
}


def ingresos_mensuales():
    r, I = lector("ingreso_gasto_finan.csv")
    vals = {}
    for x in r:
        c = x[I["CLAVE_DE_CONCEPTO"]]
        if c not in CONCEPTOS or not x[I["SECTOR"]].startswith("Sector Público Federal Presupuestario"):
            continue
        y, m = int(x[I["CICLO"]]), x[I["MES"]]
        if m not in MESES:
            continue
        vals[(c, y, MESES.index(m) + 1)] = num(x[I["MONTO"]]) * 1000  # miles de pesos → pesos
    return vals


def leer_lif(nombre):
    j = json.loads((RAW / nombre).read_text())
    t = html.unescape(re.sub(r"<[^>]+>", " ", j["Nota"]["cadenaContenido"]))
    t = re.sub(r"\s+", " ", t)
    a = t.find("CONCEPTO Ingreso Estimado")
    tab = t[a:a + 40000]

    def v(pat):
        m = re.search(pat + r"[^\d]{0,30}([\d,]+\.\d)", tab)
        return float(m.group(1).replace(",", "")) * 1e6 if m else None  # millones → pesos

    out = {
        "total": v(r"TOTAL"),
        "impuestos": v(r" 1\. Impuestos"),
        "isr": v(r"01\. Impuesto sobre la renta\."),
        "iva": v(r"01\. Impuesto al valor agregado\."),
        "ieps": v(r"02\. Impuesto especial sobre producción y servicios:"),
        "importacion": v(r"01\. A la importación\."),
        "financiamientos": v(r" 0\. Ingresos Derivados de Financiamientos"),
        "seguridad_social": v(r" 2\. Cuotas y Aportaciones de Seguridad Social"),
    }
    out["presupuestarios"] = out["total"] - out["financiamientos"]
    return out


def construir_ingresos():
    vals = ingresos_mensuales()
    ultimo = max((y, m) for (_, y, m) in vals if y == max(k[1] for k in vals))
    y_act, m_act = ultimo
    anual = collections.defaultdict(dict)
    for c in CONCEPTOS:
        for y in range(2011, y_act + 1):
            meses = [vals.get((c, y, m)) for m in range(1, 13)]
            if y < y_act and all(v is not None for v in meses):
                anual[c][y] = sum(meses)
    ytd = {c: {y: sum(vals.get((c, y, m), 0) for m in range(1, m_act + 1)) for y in (y_act - 1, y_act)} for c in CONCEPTOS}

    lif = {2025: leer_lif("lif_2025.json"), 2026: leer_lif("lif_2026.json")}
    comp = []
    pares = [("presupuestarios", "XAB", "Ingresos totales (sin deuda)"), ("impuestos", "XAB11", "Todos los impuestos"),
             ("isr", "XAB1110", "ISR (impuesto sobre la renta)"), ("iva", "XAB1120", "IVA"),
             ("ieps", "XAB1130", "IEPS (gasolinas, refrescos, alcohol, tabaco…)"),
             ("importacion", "XAB2214", "Impuestos a la importación")]
    for k, c, nombre in pares:
        e25, e26 = lif[2025][k], lif[2026][k]
        o25 = anual[c].get(2025)
        comp.append({
            "clave": k, "nombre": nombre,
            "esperado_2025": mmdp(e25), "recaudado_2025": mmdp(o25), "dif_2025_pct": round((o25 / e25 - 1) * 100, 1),
            "esperado_2026": mmdp(e26), "recaudado_2026_ytd": mmdp(ytd[c][y_act]),
            "avance_2026_pct": round(ytd[c][y_act] / e26 * 100, 1),
            "avance_2025_mismo_periodo_pct": round(ytd[c][y_act - 1] / e25 * 100, 1),
        })

    serie = {CONCEPTOS[c]: {str(y): mmdp(v) for y, v in sorted(anual[c].items()) if y >= 2015} for c in CONCEPTOS}
    ytd_out = {CONCEPTOS[c]: {str(y): mmdp(v) for y, v in ytd[c].items()} for c in CONCEPTOS}
    def comp_de(partes, total_c, y):
        tot = anual[total_c][y]
        out = [{"k": n, "v": mmdp(anual[c][y]), "pct": round(anual[c][y] / tot * 100, 1)} for c, n in partes]
        resto = tot - sum(anual[c][y] for c, _ in partes)
        if abs(resto) / tot > 0.002:
            out.append({"k": "Otros", "v": mmdp(resto), "pct": round(resto / tot * 100, 1)})
        return out

    composicion = {
        "ingresos": comp_de([("XAB2211", "ISR"), ("XAB2212", "IVA"), ("XAB2213", "IEPS (sin gasolinas)"),
                             ("XAB2214", "Importación"), ("XAB2215", "Otros impuestos"),
                             ("XAB21", "Petróleo (Pemex y derechos)"), ("XAB2240", "IMSS, ISSSTE y CFE"),
                             ("XAB2230", "Derechos y aprovechamientos")], "XAB", y_act - 1),
        "gasto": comp_de([("XAC1210", "Sueldos del sector público"), ("XAC1220", "Operación (materiales, servicios)"),
                          ("XOA0135", "Pensiones y jubilaciones"), ("XAC1230", "Subsidios y programas sociales"), ("XAC13", "Inversión (obras y capital)"),
                          ("XAC21", "Intereses de la deuda"), ("XAC22", "Participaciones a estados"),
                          ("XAC23", "Adeudos de años anteriores")], "XAC", y_act - 1),
    }
    return {
        "composicion": composicion,
        "ultimo_mes": f"{MESES[m_act-1]} {y_act}", "mes_num": m_act, "anio_actual": y_act,
        "lif": {str(y): {k: mmdp(v) for k, v in d.items()} for y, d in lif.items()},
        "comparacion": comp, "serie_anual": serie, "acumulado": ytd_out,
    }


# ------------------------------------------------------------------ población
def poblacion():
    t = json.loads((RAW / "poblacion_2025.json").read_text())["parse"]["wikitext"]
    out = {}
    for m in re.finditer(r"\{\{bandera2\|([^}|]+)[^}]*\}\}\s*\n\|[^\n]*formatnum\|(\d+)", t):
        out[m.group(1).strip()] = int(m.group(2))
    return out


NOMBRES_EF = {  # nombre en la Cuenta Pública → nombre en la tabla de población
    "Ciudad de México": "Ciudad de México", "México": "Estado de México", "Estado de México": "Estado de México",
    "Coahuila": "Coahuila", "Coahuila de Zaragoza": "Coahuila", "Michoacán": "Michoacán",
    "Michoacán de Ocampo": "Michoacán", "Veracruz": "Veracruz", "Veracruz de Ignacio de la Llave": "Veracruz",
}


def canon(nombre, pob):
    n = NOMBRES_EF.get(nombre, nombre)
    if n in pob:
        return n
    for k in pob:
        if k.lower() == n.lower() or k.lower().startswith(n.lower()) or n.lower().startswith(k.lower()):
            return k
    return None


# ------------------------------------------------------------------ gasto 2025
def construir_gasto_2025(pob):
    r, I = lector("cuenta_publica_2025.csv")
    O, M, E = I["ORIGINAL_BRUTO"], I["MODIFICADO_BRUTO"], I["EJERCIDO_BRUTO"]
    ramo = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    ramo_n = {}
    funcion = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    capitulo = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    prog = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    prog_n = {}
    ef = collections.defaultdict(lambda: collections.defaultdict(float))
    for x in r:
        o, m, e = num(x[O]), num(x[M]), num(x[E])
        rk = x[I["R"]].strip()
        ramo_n[rk] = x[I["RAMO_DESC"]].strip()
        for d, k in ((ramo, rk), (funcion, x[I["FUN_DESC"]].strip()),
                     (capitulo, x[I["PTDA"]].strip()[:1] + "000")):
            a = d[k]; a[0] += o; a[1] += m; a[2] += e
        pk = (rk, x[I["MOD"]].strip() + x[I["PP"]].strip().zfill(3))
        a = prog[pk]; a[0] += o; a[1] += m; a[2] += e
        prog_n[pk] = (x[I["PP_DESC"]].strip(), x[I["MOD_DESC"]].strip())
        est = x[I["EF_DESC"]].strip()
        ef[est]["total"] += e
        if rk in ("28", "33"):
            ef[est]["r" + rk] += e

    def fila(k, a, nombre):
        return {"clave": k, "nombre": nombre, "aprobado": mmdp(a[0]), "modificado": mmdp(a[1]), "ejercido": mmdp(a[2]),
                "dif": mmdp(a[2] - a[0]), "dif_pct": round((a[2] / a[0] - 1) * 100, 1) if a[0] else None}

    ramos = sorted((fila(k, a, ramo_n[k]) for k, a in ramo.items() if a[0] or a[2]), key=lambda f: -f["ejercido"])
    funciones = sorted((fila(k, a, k) for k, a in funcion.items() if a[2] > 0), key=lambda f: -f["ejercido"])
    CAP = {"1000": "Sueldos y prestaciones", "2000": "Materiales y suministros", "3000": "Servicios generales",
           "4000": "Transferencias, subsidios y apoyos", "5000": "Bienes muebles e inmuebles", "6000": "Obra pública",
           "7000": "Inversiones financieras", "8000": "Participaciones y aportaciones a estados", "9000": "Deuda pública"}
    capitulos = sorted((fila(k, a, CAP.get(k, k)) for k, a in capitulo.items() if a[2] > 0), key=lambda f: -f["ejercido"])

    progs = []
    for k, a in prog.items():
        if max(a[0], a[2]) < 1e9:  # solo programas de más de mil millones
            continue
        f = fila(f"{k[0]}-{k[1]}", a, prog_n[k][0])
        f["ramo"] = ramo_n[k[0]]
        f["modalidad"] = prog_n[k][1]
        progs.append(f)
    es_bolsa = lambda p: p["clave"].split("-")[1].startswith("R")
    reales = [p for p in progs if not es_bolsa(p)]
    sub = sorted([p for p in reales if p["dif"] < 0], key=lambda p: p["dif"])[:20]
    sobre = sorted([p for p in reales if p["dif"] > 0], key=lambda p: -p["dif"])[:20]
    sub_pct = sorted([p for p in reales if p["aprobado"] >= 2 and p["dif_pct"] is not None and p["dif_pct"] <= -25],
                     key=lambda p: p["dif_pct"])[:20]
    bolsas = sorted([p for p in progs if es_bolsa(p) and p["dif"] < -1], key=lambda p: p["dif"])[:10]

    estados = []
    for est, d in ef.items():
        c = canon(est, pob)
        if not c:
            continue
        p = pob[c]
        estados.append({"estado": c, "poblacion": p, "ejercido_total": mmdp(d["total"]),
                        "participaciones": mmdp(d["r28"]), "aportaciones": mmdp(d["r33"]),
                        "federalizado_pc": round((d["r28"] + d["r33"]) / p), "total_pc": round(d["total"] / p)})
    no_geo = {k: mmdp(v["total"]) for k, v in ef.items() if not canon(k, pob)}
    estados.sort(key=lambda e: -e["federalizado_pc"])
    tot = [sum(a[i] for a in ramo.values()) for i in range(3)]
    return {
        "anio": 2025, "suma_bruta": {"aprobado": mmdp(tot[0]), "modificado": mmdp(tot[1]), "ejercido": mmdp(tot[2])},
        "ramos": ramos, "funciones": funciones, "capitulos": capitulos,
        "programas_subejercicio": sub, "programas_sobreejercicio": sobre, "programas_recorte_pct": sub_pct, "bolsas_reasignadas": bolsas,
        "n_programas": len(progs),
    }, {"anio": 2025, "estados": estados, "no_distribuible": no_geo}


# ------------------------------------------------------------------ avance 2026
def construir_avance_2026():
    r, I = lector("avance_3t_2026.csv")
    ramo = collections.defaultdict(lambda: [0.0, 0.0, 0.0, 0.0, 0.0])
    ramo_n = {}
    for x in r:
        k = x[I["ID_RAMO"]].strip()
        ramo_n[k] = x[I["DESC_RAMO"]].strip()
        a = ramo[k]
        a[0] += num(x[I["MONTO_APROBADO"]]); a[1] += num(x[I["MONTO_MODIFICADO"]])
        a[2] += num(x[I["MONTO_APROBADO_MENSUAL"]]); a[3] += num(x[I["MONTO_MODIFICADO_MENSUAL"]])
        a[4] += num(x[I["MONTO_PAGADO"]])
    filas = []
    for k, a in ramo.items():
        if a[0] <= 0 and a[4] <= 0:
            continue
        filas.append({"clave": k, "nombre": ramo_n[k], "aprobado_anual": mmdp(a[0]), "modificado_anual": mmdp(a[1]),
                      "programado_al_periodo": mmdp(a[2]), "pagado": mmdp(a[4]),
                      "avance_pct": round(a[4] / a[2] * 100, 1) if a[2] else None,
                      "avance_anual_pct": round(a[4] / a[0] * 100, 1) if a[0] else None})
    filas.sort(key=lambda f: -f["aprobado_anual"])
    t = [sum(a[i] for a in ramo.values()) for i in range(5)]
    return {"periodo": "enero–septiembre 2026", "ramos": filas,
            "total": {"aprobado_anual": mmdp(t[0]), "programado_al_periodo": mmdp(t[2]), "pagado": mmdp(t[4]),
                      "avance_pct": round(t[4] / t[2] * 100, 1)}}


# ------------------------------------------------------------------ 2027
def por_ramo(nombre, col_r, col_d, col_m):
    r, I = lector(nombre)
    d = collections.defaultdict(float); n = {}
    for x in r:
        k = x[I[col_r]].strip(); d[k] += num(x[I[col_m]]); n[k] = x[I[col_d]].strip()
    return d, n


def construir_2027():
    p26, n26 = por_ramo("pef_2026.csv", "ID_RAMO", "DESC_RAMO", "MONTO_PEF_2026")
    p27, n27 = por_ramo("ppef_2027.csv", "RAMO", "RAMO_DESCRIPCION", "IMPORTE_PROYECTO")
    filas = []
    for k in set(p26) | set(p27):
        a, b = p26.get(k, 0), p27.get(k, 0)
        if max(a, b) < 1e8:
            continue
        filas.append({"clave": k, "nombre": n27.get(k) or n26.get(k), "pef_2026": mmdp(a), "ppef_2027": mmdp(b),
                      "cambio": mmdp(b - a), "cambio_pct": round((b / a - 1) * 100, 1) if a else None})
    filas.sort(key=lambda f: -f["ppef_2027"])
    return {"ramos": filas, "total_2026": mmdp(sum(p26.values())), "total_2027": mmdp(sum(p27.values()))}


# ------------------------------------------------------------------ SAT
def construir_sat():
    r, I = lector("sat_cancelados.csv")
    por_anio = collections.defaultdict(lambda: [0, 0.0])
    por_tipo = collections.defaultdict(lambda: [0, 0.0])
    por_sup = collections.defaultdict(lambda: [0, 0.0])
    por_est = collections.defaultdict(lambda: [0, 0.0])
    montos = []
    mcol = [k for k in I if k.startswith("MONTO")][0]
    for x in r:
        if len(x) < len(I):
            continue
        m = num(x[I[mcol]])
        y = x[I["FECHA DE CANCELACIÓN"]][-4:] if "FECHA DE CANCELACIÓN" in I else ""
        t = {"F": "Personas físicas", "M": "Empresas (personas morales)"}.get(x[I["TIPO PERSONA"]].strip(), "Otro")
        for d, k in ((por_anio, y), (por_tipo, t), (por_sup, x[I["SUPUESTO"]].strip().capitalize()),
                     (por_est, x[I["ENTIDAD FEDERATIVA"]].strip().title())):
            d[k][0] += 1; d[k][1] += m
        montos.append(m)
    montos.sort(reverse=True)
    total = sum(montos)
    top1 = sum(montos[: max(1, len(montos) // 100)])
    top100 = sum(montos[:100])

    def tab(d, key=None):
        return [{"k": k, "n": v[0], "monto": mmdp(v[1]), "millones": round(v[1] / 1e6, 1)}
                for k, v in sorted(d.items(), key=key or (lambda kv: -kv[1][1]))]

    canc = {"registros": len(montos), "monto_total": mmdp(total), "top1pct_share": round(top1 / total * 100, 1),
            "top100_share": round(top100 / total * 100, 1), "top100_monto": mmdp(top100),
            "por_anio": [a for a in tab(por_anio, key=lambda kv: kv[0]) if a["k"].isdigit()],
            "por_tipo": tab(por_tipo), "por_supuesto": tab(por_sup), "por_estado": tab(por_est)[:32]}

    r, I = lector("sat_firmes.csv")
    tipo = collections.Counter(); est = collections.Counter(); n = 0
    for x in r:
        if len(x) < 4:
            continue
        n += 1; tipo[x[I["TIPO PERSONA"]].strip()] += 1; est[x[I["ENTIDAD FEDERATIVA"]].strip().title()] += 1
    firmes = {"registros": n, "personas_fisicas": tipo["F"], "empresas": tipo["M"], "por_estado": est.most_common(32)}

    rows = [x for x in csv.reader(abrir("sat_69b.csv")) if len(x) > 3 and x[0].strip().isdigit()]
    efos = collections.Counter(x[3].strip() for x in rows)
    return {"cancelados": canc, "firmes": firmes, "efos": dict(efos), "efos_total": len(rows)}


def main():
    man = json.loads((RAW / "manifiesto.json").read_text())
    pob = poblacion()
    print("población:", len(pob), "entidades,", sum(pob.values()))
    ing = construir_ingresos(); guardar("ingresos.json", ing)
    g25, est = construir_gasto_2025(pob); guardar("gasto_2025.json", g25); guardar("estados.json", est)
    guardar("avance_2026.json", construir_avance_2026())
    guardar("ppef_2027.json", construir_2027())
    guardar("sat.json", construir_sat())
    fuentes = []
    for f in FUENTES:
        m = man.get(f["id"], {})
        fuentes.append({**{k: f[k] for k in ("id", "nombre", "responsable", "url", "uso")}, "pagina": f.get("pagina"),
                        "descargado": m.get("descargado"), "sha256": m.get("sha256"), "bytes": m.get("bytes")})
    guardar("fuentes.json", {"fuentes": fuentes, "poblacion_total": sum(pob.values())})


if __name__ == "__main__":
    main()
