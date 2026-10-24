## Modelo de Merton y distancia al impago

### Merton model and distance to default

*Crédito*

En 1974, el economista Robert Merton propuso mirar la deuda de una empresa como si fuera una opción. La idea parte de una pregunta sencilla: ¿cuándo quiebra una empresa? Cuando el valor de lo que posee, sus **activos**, cae por debajo de lo que debe. Eso permite calcular el riesgo de impago a partir de datos del mercado.

Una opción de compra (call) da derecho a comprar algo a un precio fijado. Merton observó que los accionistas se parecen a quien tiene una call sobre los activos de la empresa, con la deuda como precio de ejercicio. Si al vencimiento de la deuda los activos valen más que lo debido, los accionistas pagan y se quedan con la diferencia. Si valen menos, lo razonable es entregar la empresa a los acreedores y no poner más dinero, porque **las acciones no pueden valer menos que cero**.

El problema es que el valor de los activos no se ve: solo cotizan las acciones. Merton lo resuelve al revés: con el precio y la volatilidad de la acción, más la deuda, se estima el valor de los activos y su volatilidad. Volatilidad es cuánto se mueve el precio de un activo en un año.

Con eso se calcula la **distancia al impago**: cuántas desviaciones típicas (la unidad habitual para medir la dispersión) separan el valor de los activos de la deuda. Cuanto menor es la distancia, más cerca está la empresa de no pagar. Una fórmula en texto plano: distancia = (valor de los activos − deuda) / (valor de los activos × volatilidad).

Un ejemplo ilustrativo con números sencillos: una empresa tiene activos de 100 millones, una deuda de 70 y una volatilidad de sus activos del 15% anual. La distancia es (100 − 70) / (100 × 0,15) = 2 desviaciones típicas. Si la volatilidad sube al 30%, la distancia baja a 1, y la probabilidad de impago estimada se dispara aunque nada haya cambiado en el balance.

En la práctica, el modelo se usa para vigilar riesgo de crédito y fijar precios de bonos. Sirve para detectar deterioros antes de que lo hagan las agencias de calificación, pero **tiene límites**: supone un único vencimiento de la deuda, ignora que las empresas pueden quebrar antes y depende de que el mercado de acciones valore bien el riesgo. Por eso se usan variantes más completas, y su fiabilidad sigue en debate.

**Para saber más:** [Wikipedia: Merton model](https://en.wikipedia.org/wiki/Merton_model) · [Wikipedia: Robert C. Merton](https://en.wikipedia.org/wiki/Robert_C._Merton)
