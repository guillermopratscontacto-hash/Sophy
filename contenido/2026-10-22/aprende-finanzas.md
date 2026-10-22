## Duración por vértices (key rate duration)

### Key rate duration

*Renta fija*

Un bono pierde valor cuando suben los tipos de interés. La **duración** es la medida habitual de esa sensibilidad: un bono con duración de 5 años perdería aproximadamente un 5% de su precio si todos los tipos subieran un punto porcentual. Es una aproximación útil, pero esconde una suposición: que los tipos de todos los plazos se mueven por igual, es decir, que la curva de tipos (la relación entre el plazo de un préstamo y su tipo de interés) solo se desplaza en paralelo.

En la práctica, las curvas rara vez se mueven así. A veces suben los tipos a corto plazo, porque el banco central endurece su política, mientras los de largo plazo apenas cambian, o ocurre lo contrario. La **duración por vértices** (key rate duration) nace para medir este riesgo con más precisión. Consiste en elegir unos plazos de referencia, llamados vértices, como 2, 5, 10 y 30 años, y calcular cuánto cambia el precio de la cartera si **solo se mueve el tipo de uno de ellos** y los demás quedan quietos.

El resultado no es un número, sino un perfil de sensibilidades. Sumadas, las duraciones por vértices dan aproximadamente la duración total, pero repartidas indican dónde se concentra el riesgo.

Un ejemplo ilustrativo con cifras sencillas: una cartera tiene una duración total de 6 años, repartida así: 1 año en el vértice de 2 años, 1 en el de 5 años y 4 en el de 10 años. Si el tipo a 10 años sube un punto y el resto no cambia, la cartera pierde cerca de un 4%. Si lo que sube un punto es el tipo a 2 años, pierde cerca de un 1%. Dos carteras con la misma duración total pueden, pues, reaccionar de forma muy distinta ante un mismo movimiento de la curva.

Esta herramienta sirve para varias cosas. Permite cubrir el riesgo de forma selectiva, por ejemplo con futuros sobre bonos de un plazo concreto, en vez de neutralizar toda la cartera. Permite construir carteras que repliquen un índice vértice a vértice. Y ayuda a evaluar **estrategias de curva**, como apostar a que la curva se aplana o se empina, que son decisiones sobre el cambio de forma y no solo de nivel.

Conviene conocer sus límites. Los vértices son una elección del analista y los resultados cambian con ella. La medida es lineal, así que pierde precisión ante movimientos grandes, donde interviene la convexidad. Y los bonos con opciones incorporadas, como los amortizables, complican el cálculo. En la práctica, lo que importa es no mirar solo la duración total: **el tramo de la curva en el que se concentra el riesgo** puede decidir el resultado.

**Para saber más:** [Wikipedia: Bond duration](https://en.wikipedia.org/wiki/Bond_duration) · [Wikipedia: Yield curve](https://en.wikipedia.org/wiki/Yield_curve)
