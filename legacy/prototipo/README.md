# Ventanilla Abierta MX: prototipo

Prototipo de alto nivel de un asistente ciudadano conversacional para México, inspirado en America.gov (EE. UU., 29-sep-2026), con una capa de auditoría sobre registros públicos.

## Archivos
- `plantilla.html`: código de la página (asistente, auditoría, factibilidad, arquitectura, revisión).
- `build_data.py`: descarga datos reales y genera `data/datos.js`:
  - DOF: API JSON del SIDOF (`sidof.segob.gob.mx/dof/sidof/notas/DD-MM-AAAA` e `/indicadores/DD-MM-AAAA`), sin autenticación.
  - SAT: listado completo del artículo 69-B (CSV, 14,234 registros, corte 31-dic-2025).
- `build_html.py`: inserta los datos en la plantilla y genera `index.html`, un archivo único.

```
python3 build_data.py && python3 build_html.py
```

## Resultado de las pruebas de fuentes (5-nov-2026, desde un servidor fuera de México)
| Estado | Fuentes |
|---|---|
| Abiertas y probadas | DOF (SIDOF API), SAT 69-B |
| Token gratuito | Banxico SIE, INEGI BIE/DENUE, PDN (SESNA) |
| Portal sin API | gob.mx, Nómina Transparente, Declaraciones, ASF, CONEVAL |
| Bloqueadas fuera de MX (403 CDN/WAF) | datos.gob.mx, Catálogo Nacional de Trámites, PNT, Senado, IMSS datos, Llave MX |
| CAPTCHA | ComprasMX (consulta de procedimientos); no se forzó |
| Sin respuesta | Transparencia Presupuestaria, api.datos.gob.mx, SIL, Gaceta Diputados |

Conclusión: la producción debe alojarse en México. Los contratos públicos requieren las descargas de Data Buen Gobierno o un convenio. Las transacciones requieren un convenio con la ATDT (Llave MX).
