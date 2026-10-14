## Skew de volatilidad y sonrisa implícita

### Volatility skew and smile

*Derivados*

Cuando se negocia una opción, el mercado no habla en euros sino en **volatilidad implícita**: la volatilidad que habría que introducir en la fórmula de Black-Scholes para que devuelva exactamente el precio que se ve en pantalla. Es el precio de la opción traducido a una unidad que permite comparar opciones distintas. La volatilidad, a su vez, mide cuánto se espera que oscile el activo.

Black-Scholes supone que esa volatilidad es la misma para todas las opciones sobre un activo. Si fuera cierto, la implícita sería idéntica para cualquier *strike*, es decir, para cualquier precio al que la opción permite comprar o vender. Pero al calcularla strike por strike sale una curva. Cuando está inclinada se habla de **skew**, y cuando sube por ambos extremos, de sonrisa. Un ejemplo ilustrativo: con un índice en 100, una put de strike 90, que protege de una caída del 10 %, puede cotizar con una volatilidad implícita del 24 %, mientras que una call de strike 110 lo hace con un 16 %. Es el mismo activo y el mismo vencimiento, con volatilidades distintas.

¿Por qué se paga más por protegerse de las caídas? Hay tres razones que se refuerzan. La primera es que las bolsas suelen caer más deprisa de lo que suben y, cuando caen, la volatilidad se dispara: **el miedo es asimétrico**. La segunda es que gestores y aseguradoras compran puts para proteger sus carteras, y esa demanda constante empuja su precio hacia arriba. La tercera es que, desde el crash de 1987, los operadores exigen un sobreprecio por el riesgo de un desplome brusco, algo que el modelo, con sus movimientos suaves, no contempla. En divisas, donde ninguna moneda es el activo «natural» que se protege, la curva es más simétrica y de ahí viene la forma de sonrisa.

La curva no es un capricho: resume lo que el mercado cree sobre los extremos. Un skew pronunciado significa que se considera **más probable un desplome que una subida del mismo tamaño**. Es la forma que tiene el mercado de corregir a Black-Scholes sin abandonarlo: en lugar de una única volatilidad, cada strike usa la suya.

Para quien opera, esto tiene consecuencias directas. Una put lejana cuesta más de lo que el modelo simple diría, y por eso proteger una cartera sale más caro de lo esperado. Vender esas puts caras ha sido históricamente rentable, hasta que llega una caída fuerte: esa renta es en realidad una **prima de riesgo** por asumir el desplome. Los modelos más completos, como la volatilidad local o el de Heston, se construyen precisamente para reproducir esta curva.

**Para saber más:** [Wikipedia: Volatility smile](https://en.wikipedia.org/wiki/Volatility_smile) · [Wikipedia: Implied volatility](https://en.wikipedia.org/wiki/Implied_volatility) · [Wikipedia: Heston model](https://en.wikipedia.org/wiki/Heston_model)
