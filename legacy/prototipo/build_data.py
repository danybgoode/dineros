"""Descarga datos públicos reales para el prototipo (DOF + SAT 69-B) y genera data/datos.js"""
import json, csv, io, time, urllib.request, datetime, sys
OUT = 'data/datos.js'
def get(url, timeout=40):
    t = time.time()
    with urllib.request.urlopen(url, timeout=timeout) as r:
        b = r.read()
    return b, round(time.time() - t, 2)

# DOF: últimos N días
dias = []
hoy = datetime.date(2026, 11, 4)
for i in range(8):
    d = hoy - datetime.timedelta(days=i)
    f = d.strftime('%d-%m-%Y')
    try:
        b, s = get(f'https://sidof.segob.gob.mx/dof/sidof/notas/{f}')
        j = json.loads(b)
    except Exception as e:
        print('DOF fail', f, e); continue
    notas = []
    for ed in ('NotasMatutinas', 'NotasVespertinas', 'NotasExtraordinarias'):
        for n in j.get(ed, []) or []:
            if not n.get('titulo'): continue
            notas.append({'id': n['codNota'], 't': n['titulo'].strip(), 'p': n.get('nombreCodOrgaUno'),
                          'o': (n.get('codOrgaDos') or '').strip(), 'ed': ed.replace('Notas', '')[:3]})
    try:
        bi, _ = get(f'https://sidof.segob.gob.mx/dof/sidof/indicadores/{f}')
        ind = json.loads(bi).get('ListaIndicadores', [])
    except Exception:
        ind = []
    print(f, len(notas), 'notas', s, 's')
    if notas: dias.append({'f': f, 'notas': notas, 'ind': [x['valor'] for x in ind], 'lat': s})

# SAT 69-B
b, s = get('http://omawww.sat.gob.mx/cifras_sat/Documents/Listado_Completo_69-B.csv', 90)
txt = b.decode('latin1')
corte = txt.split('\n')[0][1:80]
rows = [r for r in csv.reader(io.StringIO(txt)) if len(r) > 3 and r[0].strip().isdigit()]
code = {'Definitivo': 'D', 'Presunto': 'P', 'Desvirtuado': 'X', 'Sentencia Favorable': 'S'}
efos = [[r[1].strip(), r[2].strip(), code.get(r[3].strip(), '?'), (r[15] or r[7] or '').strip()] for r in rows]
print('69-B', len(efos), s, 's')

meta = {'generado': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'corte69b': corte, 'lat69b': s}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('window.DATOS=' + json.dumps({'meta': meta, 'dof': dias, 'efos': efos}, ensure_ascii=False, separators=(',', ':')) + ';')
print('ok', OUT)
