## Valor en riesgo frente a déficit esperado

### Value at Risk versus Expected Shortfall

*Gestión de riesgos*

Toda entidad que invierte necesita responder a una pregunta sencilla: ¿cuánto podemos perder? El **valor en riesgo** (VaR, por *Value at Risk*) es la respuesta más extendida. Y el **déficit esperado** (ES, por *Expected Shortfall*) es la medida que completa lo que el VaR deja sin decir.

El VaR fija un umbral de pérdida para un periodo y un nivel de confianza. Un VaR diario al 99% de un millón de euros significa que, en condiciones normales, solo en uno de cada cien días se perdería más de esa cifra. Es fácil de comunicar, y por eso se usa mucho en bancos y reguladores. Pero tiene un punto ciego: **no dice nada sobre lo que pasa dentro de ese 1% de días malos**. Podrían ser pérdidas de 1,1 millones o de 50 millones.

El déficit esperado cubre ese hueco. Responde a otra pregunta: si ya estamos en uno de esos peores días, **¿cuánto perdemos de media?** En términos prácticos, se calcula como el promedio de todas las pérdidas que superan el umbral del VaR. En fórmula, en texto plano: ES = media de las pérdidas que superan el VaR.

Ejemplo ilustrativo, con números inventados. Dos carteras tienen el mismo VaR al 99% de un millón de euros. En la primera, los peores días rondan los 1,2 millones. En la segunda, existe una pequeña posibilidad de perder 20 millones. El VaR las trata igual; el déficit esperado, no: sería algo superior al millón en la primera y mucho mayor en la segunda.

Hay otra diferencia técnica. El déficit esperado es una medida «coherente», lo que significa, entre otras cosas, que respeta la diversificación: el riesgo de dos carteras juntas nunca supera la suma de sus riesgos por separado. El VaR no siempre cumple esta propiedad.

Por estas razones, los reguladores bancarios han ido dando más peso al déficit esperado en sus marcos de capital para el riesgo de mercado. Aun así, el VaR sigue en uso, y entre expertos se debate cuál es más fiable para estimar, porque el déficit esperado depende más de datos escasos sobre eventos extremos.

En la práctica, conviene usar ambos: el VaR para un umbral de referencia y el déficit esperado para **calibrar la gravedad de los escenarios extremos**, sin olvidar que ninguna medida estadística sustituye al juicio ni a las pruebas de estrés.

**Para saber más:** [Wikipedia: Value at risk](https://en.wikipedia.org/wiki/Value_at_risk) · [Wikipedia: Expected shortfall](https://en.wikipedia.org/wiki/Expected_shortfall)
