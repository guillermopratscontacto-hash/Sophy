<!-- resumen: Delta, gamma, vega y theta miden cómo cambia el precio de una opción cuando se mueven el mercado, la volatilidad o el tiempo. -->

## Griegas de las opciones: delta, gamma, vega y theta

### Option Greeks

*Derivados*

Una opción es un contrato que da el derecho, pero no la obligación, de comprar o vender un activo a un precio fijado de antemano, llamado precio de ejercicio. Su valor depende de varios factores que cambian todo el tiempo: el precio del activo, su volatilidad, el tiempo que queda hasta el vencimiento y los tipos de interés. Las «griegas» son **medidas de sensibilidad** que indican cuánto cambia el precio de la opción cuando se mueve cada uno de esos factores.

La delta mide cuánto varía la opción cuando el activo sube un euro. Una opción de compra muy por encima de su precio de ejercicio tiene una delta cercana a 1: se mueve casi como la acción. Una muy alejada tiene una delta cercana a 0. La gamma mide **cuánto cambia la delta** cuando se mueve el activo; es máxima en opciones cuyo precio de ejercicio está cerca del precio actual y que vencen pronto. La vega mide la sensibilidad a la volatilidad: cuanto más incierto es el futuro, más valen las opciones. Y la theta mide cuánto valor pierde la opción cada día que pasa, el llamado desgaste temporal.

Ejemplo ilustrativo: una opción de compra sobre una acción que cotiza a 100 euros vale 5 euros y tiene una delta de 0,5, una gamma de 0,04 y una theta de −0,05. Si la acción sube a 101 euros, la opción subirá aproximadamente 0,50 euros, hasta 5,50, y su nueva delta será de 0,54. Si al día siguiente no pasa nada, la opción perderá unos 5 céntimos por el paso del tiempo.

Las griegas permiten gestionar el riesgo. Quien vende opciones, como un banco, suele cubrir la delta comprando o vendiendo el activo subyacente para que pequeños movimientos no le afecten. Pero como la delta cambia, esa cobertura hay que ajustarla, y ahí entra la gamma. Existe además un equilibrio entre gamma y theta: **quien compra opciones gana con los movimientos bruscos** pero paga el desgaste del tiempo; quien las vende cobra ese desgaste pero sufre con los sobresaltos.

En la práctica, las griegas son aproximaciones válidas para movimientos pequeños y dependen del modelo utilizado para valorar las opciones. Los operadores las vigilan constantemente y las suman para toda la cartera, de modo que saben qué riesgo concentran ante cada tipo de movimiento del mercado.

**Para saber más:** [Wikipedia: Griegas (finanzas)](https://es.wikipedia.org/wiki/Griegas_%28finanzas%29) · [Wikipedia: Greeks (finance)](https://en.wikipedia.org/wiki/Greeks_%28finance%29)
