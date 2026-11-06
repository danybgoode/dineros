# Dineros

**El dinero público de México, en claro.** Cuánto recaudó y cuánto gastó el gobierno federal, en qué, dónde se desvió de lo aprobado y cuánto llega a cada estado. Todo con datos oficiales y en lenguaje claro.

- Sitio: https://dineros.pages.dev
- Fuentes: SHCP (Transparencia Presupuestaria y Estadísticas Oportunas), DOF (Ley de Ingresos), SAT (listas del art. 69 y 69-B del CFF), CONAPO.

## Cómo se construye
```
python3 pipeline/descargar.py      # descarga los archivos oficiales a data/raw/ (corre desde México)
python3 pipeline/procesar.py       # genera site/data/*.json
python3 pipeline/construir_sitio.py  # arma site/ a partir de site_src/
npx wrangler pages deploy site --project-name dineros
```
Solo usa la biblioteca estándar de Python y `curl`. Los archivos crudos (~650 MB) no se versionan. Su URL, fecha y SHA-256 quedan en `site/data/fuentes.json`.

## Estructura
- `pipeline/`: descarga, procesamiento y armado del sitio
- `site_src/`: páginas, estilos y JavaScript (sin dependencias)
- `site/`: sitio generado que se publica en Cloudflare Pages
- `docs/ESTRATEGIA.md`: estrategia del proyecto
- `legacy/prototipo/`: primer prototipo (Ventanilla Abierta: asistente, DOF y lista 69-B)

## Principios
Cada cifra enlaza con su fuente. Las cifras salen de los datos, nunca de un modelo de lenguaje. Del SAT solo se publican agregados, sin nombres de personas.
