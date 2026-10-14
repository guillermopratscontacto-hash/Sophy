## Skew de volatilidad y sonrisa implícita

### Volatility skew and smile

*Derivados*

El modelo de Black-Scholes supone una volatilidad constante, de modo que todas las opciones sobre un mismo subyacente y vencimiento deberían cotizar con la misma volatilidad implícita. El mercado no lo hace: al invertir la fórmula para cada strike aparece una curva, y el conjunto de esas curvas por vencimiento forma **la superficie de volatilidad implícita**, que es en la práctica la verdadera cotización de las opciones. Se habla de skew cuando la curva está inclinada y de sonrisa cuando sube en ambos extremos.

En los índices de renta variable domina un skew negativo: las puts fuera de dinero cotizan con una volatilidad claramente mayor que las calls equidistantes. Tres explicaciones se refuerzan entre sí. La primera es el efecto apalancamiento: cuando el precio cae, la deuda pesa más sobre el valor de los recursos propios y la volatilidad sube, de modo que rentabilidad y volatilidad correlacionan negativamente. La segunda es **la demanda estructural de cobertura**: gestores y aseguradoras compran puts para proteger carteras, mientras que la venta de calls cubiertas por inversores que buscan renta presiona a la baja la volatilidad de las calls. La tercera es la memoria de los crashes: desde 1987 el mercado exige una prima por el riesgo de saltos a la baja. En divisas, donde ninguna de las dos monedas es el activo natural, el patrón es una sonrisa más simétrica, y se cotiza con risk reversals y butterflies en lugar de strikes sueltos.

La conexión con la distribución es directa. La segunda derivada del precio de una call respecto al strike es la densidad neutral al riesgo (Breeden-Litzenberger), así que la pendiente del skew refleja **la asimetría de esa densidad** y la curvatura de la sonrisa, su exceso de curtosis. Un skew negativo equivale a una cola izquierda más pesada que la lognormal.

Para modelizarlo hay dos grandes familias. La volatilidad local de Dupire hace depender la volatilidad del nivel del subyacente y del tiempo, y reproduce exactamente la superficie de hoy, pero predice un skew futuro más plano que el observado. Los modelos de volatilidad estocástica, como el de Heston con correlación negativa entre precio y varianza, generan el skew de forma endógena y describen mejor su dinámica. De ahí el debate práctico sobre qué ocurre con la curva cuando se mueve el spot: **sticky strike** frente a **sticky delta**, dos supuestos que cambian la delta de cobertura efectiva y, con ella, el resultado de la cobertura.

Para quien opera, además, el skew es una prima. Vender puts con volatilidad implícita superior a la realizada ha sido históricamente rentable, hasta que llega una cola; es la cara visible de la prima de riesgo de varianza. La superficie nunca es un dato neutro: resume cuánto paga el mercado por asegurarse contra lo que el modelo daba por imposible.

**Para saber más:** [Wikipedia: Volatility smile](https://en.wikipedia.org/wiki/Volatility_smile) · [Wikipedia: Local volatility](https://en.wikipedia.org/wiki/Local_volatility) · [Wikipedia: Heston model](https://en.wikipedia.org/wiki/Heston_model)
