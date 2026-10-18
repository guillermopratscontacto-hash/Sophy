## Gamma scalping y cobertura delta dinámica

### Gamma scalping and dynamic delta hedging

*Derivados*

Imagina que compras una opción y quieres ganar con lo que se mueve el activo, no con hacia dónde va. Esa es la idea del gamma scalping: una estrategia de operadores de opciones que busca beneficiarse de las oscilaciones del precio manteniéndose neutral ante su dirección. Para entenderla hacen falta tres piezas, que definimos una a una.

La primera es la **delta**: lo que varía el precio de una opción cuando el activo subyacente sube un euro. Una opción de compra con delta de 0,50 gana unos 0,50 euros si el subyacente sube un euro. La segunda es la **cobertura delta**: compensar esa sensibilidad comprando o vendiendo el subyacente, de modo que la posición total no gane ni pierda por pequeños movimientos. La tercera es la **gamma**: lo rápido que cambia la delta cuando se mueve el precio.

Aquí está el truco. Quien compra opciones tiene gamma positiva: si el precio sube, su delta aumenta; si baja, disminuye. Así, tras cada movimiento debe reajustar la cobertura, y ese reajuste lo obliga a **vender tras las subidas y comprar tras las bajadas**, es decir, a hacer lo que cualquiera querría. Cada ajuste deja un pequeño beneficio, de ahí el nombre «scalping».

Ejemplo ilustrativo, con números sencillos: un operador compra una opción con delta de 0,50 sobre 100 acciones y vende 50 acciones para quedar neutral. Si el precio sube y la delta pasa a 0,60, le conviene vender otras 10 acciones más caras; si luego el precio vuelve atrás, las recompra más baratas. Repetido muchas veces, esa ganancia pequeña se acumula.

Pero no es dinero gratis. La opción pierde valor con el paso del tiempo, un efecto llamado theta, y el operador paga además comisiones. **La estrategia sale bien solo si el activo se mueve más de lo que el mercado ya esperaba al comprar**, es decir, si la volatilidad real supera a la implícita, la que refleja el precio de la opción. Si el activo apenas se mueve, el tiempo se come el beneficio.

En la práctica, importa por una razón: conecta tres cosas que a menudo se explican por separado, delta, gamma y volatilidad. Además, los ajustes de cobertura de grandes operadores pueden amplificar movimientos del mercado, un efecto que sigue en debate. Es una técnica profesional, con costes y riesgos, y esto no es una recomendación de inversión.

**Para saber más:** [Wikipedia: Delta hedging](https://en.wikipedia.org/wiki/Delta_neutral) · [Wikipedia: Option Greeks](https://en.wikipedia.org/wiki/Option_Greeks)
