# Rediseño v2: de tablero a reportaje

## El problema de v1
v1 tenía los datos correctos, pero se leía como un tablero: muchas barras iguales y poca guía. Además, la lista de factureros (69-B) se procesaba pero no aparecía en el sitio.

## Principios
1. **Cada página responde una pregunta.** Seis capítulos numerados en el orden en que una persona se pregunta las cosas:
   01 ¿Cuánto entra y cuánto sale? → 02 ¿De dónde sale? → 03 ¿En qué se gasta y se respetó lo aprobado? → 04 ¿Cuánto llega a mi estado? → 05 ¿Quién no paga? → 06 ¿Qué viene en 2027?
2. **La respuesta primero.** Cada capítulo abre con un titular que es la conclusión y una caja «En 30 segundos» con 3 o 4 frases. Quien solo lee eso ya se va informado.
3. **Cada sección tiene cuatro partes:** la pregunta en el título, la gráfica, «Qué significa» en lenguaje claro y «Ojo» con las advertencias honestas (pesos corrientes, sumas brutas, que un sobreejercicio no es por sí mismo ilegal).
4. **Una forma de gráfica para cada idea:**
   - Parte de un todo: wafle de 100 pesos.
   - Lo que entró contra lo que salió: barras de balance con el déficit rayado.
   - Tendencia: líneas con cursor y etiquetas directas.
   - Qué tan rápido creció cada rubro: índice 2015 = 100.
   - Tamaño y desviación a la vez: treemap con escala divergente.
   - Plan contra realidad: dumbbell (anillo = aprobado, punto = ejercido).
   - Geografía: mosaico de los 32 estados.
   - Avance del año: medidores con marcas de referencia.
   - Concentración: par de wafles («1 de cada 100 deudores… 90 de cada 100 pesos»).
5. **Hacerlo personal:** calculadora «Tu peso», «Mi estado» guardado en el navegador y buscador de proveedores en la lista 69-B.
6. **Siempre guiar al siguiente paso:** barra de progreso de lectura, tarjeta «siguiente capítulo» al final de cada página e índice de capítulos en la portada.

## Color
- Marca: jade y rosa.
- Paleta categórica: 8 tonos en orden fijo, validados contra daltonismo en modo claro y oscuro.
- Escala divergente: naranja = más de lo aprobado, azul = menos, gris al centro.
- Escala secuencial en jade para los mapas.
- Rojo, verde y ámbar se reservan para estados del SAT: definitivo, desvirtuado y presunto.

## SAT (capítulo 05)
- Diagrama de cómo funciona el negocio de las facturas falsas.
- Buscador sobre los 14,234 registros de la lista 69-B.
- Desenlace de cada caso, señalamientos por año y edad de las empresas al ser señaladas.
- Cruce por RFC con las listas de cancelados y firmes.
- Concentración de la deuda cancelada y mapas por estado.
- Política: no se publican nombres de personas físicas con deudas. Solo se muestran con nombre la lista 69-B (que es pública para consulta) y las 25 empresas con más deuda cancelada.

## Siguiente
- Cruce de la lista 69-B con contratos de ComprasMX.
- Cifras ajustadas por inflación.
- Asistente conversacional.
- Imagen para compartir de cada gráfica.
