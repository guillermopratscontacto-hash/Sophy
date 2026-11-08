<!-- resumen: Comprar una acción, comprar una opción de venta y vender una de compra con el mismo precio: la paridad put-call ata sus precios entre sí. -->

## Paridad put-call

### Put-call parity

*Derivados*

Las opciones de compra, llamadas «call», dan derecho a comprar un activo a un precio fijado, el precio de ejercicio. Las opciones de venta, llamadas «put», dan derecho a venderlo. Podría pensarse que sus precios son independientes, pero no lo son. La paridad put-call es **una relación exacta** que une el precio de una call y el de una put con el mismo activo, el mismo precio de ejercicio y el mismo vencimiento.

La idea se entiende comparando dos carteras que pagan lo mismo al vencimiento. La primera: comprar una call y depositar en el banco el dinero necesario para pagar el precio de ejercicio al vencimiento. La segunda: comprar la acción y comprar una put. En cualquier escenario, las dos carteras terminan valiendo lo mismo: si la acción sube por encima del precio de ejercicio, ambas valen la acción; si baja, ambas valen el precio de ejercicio. Si dos carteras pagan siempre lo mismo, **deben costar lo mismo hoy**.

La relación, en texto plano, para opciones europeas, que solo se ejercen al vencimiento, y sin dividendos: call + valor actual del precio de ejercicio = put + precio de la acción.

Ejemplo ilustrativo: una acción cotiza a 100 euros, el precio de ejercicio es 100, el vencimiento es a un año y el tipo de interés es del 4 %. El valor actual del precio de ejercicio es 100 / 1,04, unos 96,15 euros. Si la put cuesta 6 euros, la call debería costar aproximadamente 6 + 100 − 96,15 = 9,85 euros. Si cotizara a 12, un operador podría vender la call, comprar la acción y la put, pedir prestado el resto y **obtener un beneficio sin riesgo**: un arbitraje. Esas operaciones devuelven los precios a su relación.

En la práctica, la paridad tiene varias utilidades. Permite construir posiciones sintéticas: por ejemplo, combinar una call y una put para replicar la compra de una acción. Sirve para detectar precios incoherentes y para deducir el tipo de interés o los dividendos implícitos que descuenta el mercado. En la realidad, los costes de transacción, los dividendos y las opciones americanas, que se pueden ejercer antes, hacen que la relación se cumpla de forma aproximada, dentro de un margen.

**Para saber más:** [Wikipedia: Put–call parity](https://en.wikipedia.org/wiki/Put–call_parity) · [Wikipedia: Modelo de Black-Scholes](https://es.wikipedia.org/wiki/Modelo_de_Black-Scholes)
