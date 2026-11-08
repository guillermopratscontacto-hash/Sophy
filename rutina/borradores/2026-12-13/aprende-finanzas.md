<!-- resumen: La fórmula que en 1973 dio un precio racional a las opciones y transformó los mercados. Cómo se razona sin necesidad de matemáticas avanzadas. -->

## Ecuación de Black-Scholes

### Black-Scholes equation

*Derivados*

En 1973, los economistas Fischer Black y Myron Scholes publicaron un artículo con una fórmula para valorar opciones, completada por Robert Merton. Ese mismo año empezó a funcionar en Chicago el primer mercado organizado de opciones. La fórmula se extendió tan deprisa que en pocos años los operadores la llevaban en calculadoras. Scholes y Merton recibieron el Nobel de Economía en 1997; **Black había muerto en 1995** y el premio no se concede a título póstumo.

La gran idea es la cobertura dinámica. Una opción de compra sube cuando sube la acción. Si un banco vende una opción y, a la vez, compra la cantidad justa de acciones, que depende de la delta de la opción, las ganancias de una posición compensan las pérdidas de la otra ante pequeños movimientos. Ajustando continuamente esa cantidad, **la cartera combinada no tiene riesgo**. Y una cartera sin riesgo solo puede rendir el tipo de interés sin riesgo; de lo contrario habría arbitraje. De esa condición sale una ecuación cuya solución es el precio de la opción.

La fórmula final depende solo de cinco datos: el precio de la acción, el precio de ejercicio, el tiempo hasta el vencimiento, el tipo de interés sin riesgo y la volatilidad de la acción. Sorprendentemente, **no depende de la rentabilidad esperada** de la acción, ni de si el mercado es optimista o pesimista. Todo lo que importa del futuro está resumido en la volatilidad.

Ejemplo ilustrativo: una acción cotiza a 100 euros y se quiere valorar una opción de compra con precio de ejercicio de 100, a un año, con un tipo de interés del 3 % y una volatilidad del 20 %. La fórmula da un precio de unos 9,4 euros. Si la volatilidad sube al 30 %, el precio de la opción sube a unos 13,3 euros: más incertidumbre hace más valioso el derecho a comprar.

El modelo tiene supuestos irreales: volatilidad constante, movimientos de precios continuos sin saltos y posibilidad de negociar sin costes. Por eso los precios de mercado no encajan exactamente con él, y los operadores lo usan al revés: a partir del precio de la opción calculan la volatilidad implícita, que se ha convertido en el lenguaje común de los mercados de opciones.

**Para saber más:** [Wikipedia: Modelo de Black-Scholes](https://es.wikipedia.org/wiki/Modelo_de_Black-Scholes) · [Wikipedia: Black–Scholes model](https://en.wikipedia.org/wiki/Black–Scholes_model)
