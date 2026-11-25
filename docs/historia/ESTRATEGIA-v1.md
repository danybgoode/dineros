# Dineros: estrategia v1

> Documento de traspaso entre la sesión en la nube y la sesión local (`dobby/dineros`).
> Se escribió el 6-nov-2026. Antecedente: `prototipo/` (Ventanilla Abierta, con el DOF, el listado 69-B y la matriz de fuentes).

## 1. Tesis
En México casi toda la información sobre el dinero público es **pública por ley**, pero en la práctica es **opaca**:
- Está **dispersa** entre SHCP, SAT, ASF, CONEVAL, ComprasMX, el DOF y los portales estatales.
- Viene en **formatos hostiles**: PDF, CSV con claves, portales que bloquean el tráfico extranjero.
- Usa un **lenguaje técnico**: ramo, programa presupuestario, capítulo 1000, adecuaciones, subejercicio, RFSP…

El producto convierte eso en respuestas que entiende cualquier persona y que siempre se pueden verificar contra el registro original. El LLM traduce y explica. Las cifras salen de los datos y nunca del modelo.

## 2. Estrategia de arriba hacia abajo
Se empieza por la pregunta más grande y se baja al detalle. Cada nivel enlaza con su fuente.

**Nivel 0. «El dinero de México en una página»**
- Cuánto entró y de dónde; cuánto salió y a dónde. Es un diagrama de flujo (Sankey) de ingresos a gasto.
- Se presenta como «de cada 100 pesos…», más el déficit y la deuda.

**Nivel 1. Cuatro preguntas**
1. **Ingresos.** ¿Cuánto se esperaba recaudar (Ley de Ingresos) contra cuánto se recaudó? Por ISR, IVA, IEPS, petroleros, etcétera.
2. **Quién paga.** ¿Cuántos contribuyentes activos hay y qué tan concentrada está la recaudación (grandes contribuyentes)? También la informalidad (ENOE) y los créditos fiscales firmes o cancelados (listas del SAT, art. 69).
3. **Gasto.** Presupuesto aprobado contra modificado contra ejercido, por ramo, función, programa y capítulo. Se marcan en rojo el **subejercicio** y el **sobreejercicio**.
4. **Territorio.** ¿A qué estados llega el gasto federalizado (Ramo 28 participaciones, Ramo 33 aportaciones)? Gasto y recaudación por entidad, aclarando que la recaudación se registra en el domicilio fiscal y no donde ocurre la actividad.

**Nivel 2. Ficha de cada programa**
Presupuesto y su avance, metas contra resultados (indicadores de la MIR), evaluaciones de CONEVAL, observaciones de la ASF y, en la fase 2, sus contratos.

**Nivel 3 (fase 2). Fugas**
Contratos (exportaciones de ComprasMX o Data Buen Gobierno) cruzados con el listado 69-B y las listas del art. 69. Es el puente con el prototipo de auditoría.

**Capa transversal: lenguaje claro**
- Un glosario curado (el LLM redacta, una persona revisa y se publica con su fuente).
- Tooltips en cada término técnico.
- Más adelante, un asistente conversacional sobre los mismos datos.

## 3. Alcance de la v1 (lo que se publica primero)
| Página | Contenido | Datos |
|---|---|---|
| Inicio | Ingresos → gasto del último año cerrado (Cuenta Pública 2025) + avance 2026 | SHCP |
| Ingresos | Ley de Ingresos contra recaudación por concepto, 2019–2025 + 2026 a la fecha | Estadísticas oportunas y Cuenta Pública |
| Gasto | Aprobado/modificado/ejercido por ramo y función; ranking de desviaciones | Cuenta Pública y avance trimestral |
| Estados | Participaciones y aportaciones por entidad, per cápita | SHCP + población del INEGI/CONAPO |
| Glosario | ~40 términos en lenguaje claro | Curado |
| Fuentes | Cada archivo, su URL, la fecha de descarga y su hash | Pipeline |

Gancho de coyuntura: el **PEF 2027** debe aprobarse a más tardar el 15 de noviembre de 2026. Una vista «qué cambia en 2027 contra 2026» por ramo lo aprovecha.

## 4. Fuentes por verificar desde México
Desde la nube (servidores en EE. UU.) todos estos dominios rechazaron la conexión el 6-nov-2026. Hay que probarlos localmente:
- `transparenciapresupuestaria.gob.mx`: datos abiertos del PEF, la Cuenta Pública, el avance trimestral y los indicadores de la MIR (CSV).
- `cuentapublica.hacienda.gob.mx`: Cuenta Pública anual.
- `finanzaspublicas.hacienda.gob.mx`: estadísticas oportunas mensuales de ingresos y gasto.
- `ppef.hacienda.gob.mx`: proyecto de presupuesto 2027.
- `datos.gob.mx`: catálogo general (bloqueado por Akamai fuera de MX).

Ya probadas y abiertas desde la nube:
- Listados del SAT en `omawww.sat.gob.mx/cifras_sat/Documents/`: `Listado_Completo_69-B.csv` (14,234 registros), `Firmes.csv` (243,791), `No%20localizados.csv` (53,412), `Cancelados.csv` (176,687, con monto).
- API del DOF (`sidof.segob.gob.mx`).

ComprasMX: el usuario puede aportar exportaciones o navegar con Chrome. Para fase 2.

## 5. Decisiones técnicas propuestas
- **Sitio estático**: Astro, con gráficas en islas (ECharts o Observable Plot).
- **Pipeline de datos en Python**: descarga → normalización → JSON versionado en `public/data/`, con un manifiesto de fuentes (URL, fecha, sha256).
- **Despliegue**: Cloudflare Pages, gratis, con nodos en México y dominio propio cuando haya uno.
- **Actualización de datos**: los runners de GitHub Actions están fuera de México y los bloquearían. La v1 se actualiza corriendo el pipeline localmente. Después: un runner propio o una VM en una región de México.
- **Repositorio nuevo**: `dineros`, público y de código abierto, para ser coherentes con la misión. El repositorio `draft` queda como antecedente.

## 6. Siguientes pasos (sesión local)
1. Teletransportar la sesión a `dobby/dineros` (clon de `draft`) y crear el repositorio nuevo con historial limpio.
2. Probar las fuentes de la sección 4 desde México y escribir el pipeline.
3. Construir la v1 (sección 3), revisarla y desplegarla en Cloudflare Pages (`wrangler login` con la cuenta del usuario).
