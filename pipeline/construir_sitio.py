"""Arma site/ a partir de site_src/: envuelve cada página con el layout común.

Cada página en site_src/pages/*.html empieza con un comentario JSON:
<!--{"titulo": "...", "descripcion": "...", "pagina": "inicio", "ruta": "/"}-->
"""
import json
import pathlib
import re
import shutil

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / "site_src"
OUT = RAIZ / "site"
SITIO = "https://dineros.battle-for-la-roma.workers.dev"

NAV = [("inicio", "/", "Resumen"), ("ingresos", "/ingresos/", "Ingresos"), ("gasto", "/gasto/", "Gasto"),
       ("estados", "/estados/", "Estados"), ("p2027", "/2027/", "Presupuesto 2027"),
       ("glosario", "/glosario/", "Glosario"), ("fuentes", "/fuentes/", "Fuentes")]

LAYOUT = """<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{titulo}</title>
<meta name="description" content="{descripcion}">
<meta property="og:title" content="{titulo}">
<meta property="og:description" content="{descripcion}">
<meta property="og:type" content="website">
<meta property="og:url" content="{sitio}{ruta}">
<meta property="og:locale" content="es_MX">
<meta name="twitter:card" content="summary">
<link rel="canonical" href="{sitio}{ruta}">
<link rel="icon" href="/assets/icono.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/estilo.css?v={v}">
</head>
<body data-page="{pagina}">
<a class="tag" href="#contenido" style="position:absolute;left:-999px">Saltar al contenido</a>
<header class="top"><div class="wrap">
  <a class="brand" href="/"><span class="mark">$</span><b>Dineros</b></a>
  <nav class="tabs" aria-label="Secciones">{nav}</nav>
</div></header>
<main id="contenido" class="wrap">
{cuerpo}
</main>
<footer><div class="wrap">
  <p><b>Dineros</b> traduce las finanzas públicas de México a lenguaje claro. Es un proyecto ciudadano independiente: no es un sitio del gobierno.</p>
  <p>Todas las cifras vienen de fuentes oficiales (SHCP, SAT, DOF, CONAPO) y cada una se puede verificar en <a href="/fuentes/">Fuentes</a>. Montos en pesos corrientes, sin ajustar por inflación. Código abierto en <a href="https://github.com/danybgoode/dineros">GitHub</a>.</p>
</div></footer>
<script src="/assets/app.js?v={v}" defer></script>
</body>
</html>
"""


def main():
    if OUT.exists():
        for p in OUT.iterdir():
            if p.name != "data":
                shutil.rmtree(p) if p.is_dir() else p.unlink()
    OUT.mkdir(exist_ok=True)
    shutil.copytree(SRC / "assets", OUT / "assets", dirs_exist_ok=True)
    for f in ("_headers", "robots.txt"):
        if (SRC / f).exists():
            shutil.copy(SRC / f, OUT / f)
    v = str(abs(hash((SRC / "assets" / "app.js").read_text() + (SRC / "assets" / "estilo.css").read_text())) % 10**8)
    rutas = []
    for p in sorted((SRC / "pages").glob("*.html")):
        txt = p.read_text()
        m = re.match(r"\s*<!--(\{.*?\})-->\s*", txt, re.S)
        meta = json.loads(m.group(1))
        cuerpo = txt[m.end():]
        nav = "".join(f'<a href="{r}" data-p="{k}">{n}</a>' for k, r, n in NAV)
        html = LAYOUT.format(titulo=meta["titulo"], descripcion=meta["descripcion"], pagina=meta["pagina"],
                             ruta=meta["ruta"], sitio=SITIO, nav=nav, cuerpo=cuerpo, v=v)
        dest = OUT / meta["ruta"].strip("/") / "index.html" if meta["ruta"] != "/" else OUT / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html)
        rutas.append(meta["ruta"])
        print("✓", meta["ruta"])
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                                     + "".join(f"<url><loc>{SITIO}{r}</loc></url>" for r in rutas) + "</urlset>\n")


if __name__ == "__main__":
    main()
