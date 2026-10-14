// ---------- Fechas y racha (lógica pura) ----------

function fechaLocal(d = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

function aFecha(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function sumarDias(texto, n) {
  const d = aFecha(texto);
  d.setDate(d.getDate() + n);
  return fechaLocal(d);
}

// Días seguidos con algo completado. Si hoy aún no hay nada, la racha de ayer
// sigue viva hasta que acabe el día.
function calcularRacha(dias, hoy) {
  let d = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  let n = 0;
  while (dias.has(d)) {
    n++;
    d = sumarDias(d, -1);
  }
  return n;
}

function mejorRacha(dias) {
  let mejor = 0;
  for (const d of dias) {
    if (dias.has(sumarDias(d, -1))) continue; // no es el inicio de una racha
    let n = 1;
    while (dias.has(sumarDias(d, n))) n++;
    mejor = Math.max(mejor, n);
  }
  return mejor;
}

if (typeof module !== "undefined") {
  module.exports = { fechaLocal, sumarDias, calcularRacha, mejorRacha };
}

// ---------- Aplicación ----------

if (typeof document !== "undefined") (function () {
  const SEGUNDOS_AL_FINAL = 2; // tiempo al final de la sección para darla por completada

  const cfg = window.CONFIG || {};
  const remoto = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const sb = remoto ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const $vista = $("vista");
  const $secciones = $("secciones");
  const $racha = $("racha");
  const $icono = $("icono");
  const $menu = $("menu");
  const $abrirMenu = $("abrir-menu");
  const $barra = $("lectura-barra");
  const $aviso = $("aviso-dia");
  const $lienzo = $("confeti");

  let indice = { temas: [], entradas: [] };
  let progreso = []; // [{ fecha, tema, dia }]
  let usuario = null;
  let perfil = null; // { codigo, nombre } o null si aún no está disponible
  let solicitudes = []; // solicitudes de amistad pendientes: [{ tipo: "recibida" | "enviada", usuario_id, codigo, nombre }]
  let marcadores = null; // Map "fecha|tema" -> fecha en que se guardó; null si no está disponible
  let valoraciones = null; // Map "fecha|tema" -> 1 (me gusta) o -1 (no me gusta); null si no está disponible
  let limpiarVista = null;
  let turno = 0; // identifica la navegación en curso
  let leyendo = false;

  const svg = (trazo) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazo}</svg>`;
  const ICONO = {
    llama: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    hecho: svg('<path d="M20 6 9 17l-5-5"/>'),
    atras: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
    marcador: svg('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/>'),
    gusta: svg('<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>'),
    noGusta: svg('<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>'),
  };

  // Minijuegos: se generan en el navegador a partir de la fecha, sin contenido diario.
  // Al completar uno se guarda en el progreso con tema "juego:<id>", así que cuenta para la racha.
  const JUEGOS = {
    palabra: { texto: "Seis intentos para acertar una palabra de cinco letras.", listo: true },
    sudoku: { texto: "Un sudoku nuevo cada día, en tres niveles de dificultad.", listo: true },
    "adivina-pais": { texto: "Reconoce el país del día por su silueta, con pistas de distancia y dirección.", listo: true },
  };
  const juegoHecho = (id, dia) => progreso.some((p) => p.tema === `juego:${id}` && p.fecha === dia);

  // El progreso se guarda en Supabase o, sin configurar, en este navegador.
  const CLAVE_LOCAL = "aprendizaje.progreso";
  const CLAVE_VOTOS = "aprendizaje.votos";
  const CLAVE_GUARDADOS = "aprendizaje.guardados";
  const almacen = remoto
    ? {
        async cargar() {
          const { data, error } = await sb.from("progreso").select("fecha,tema,dia");
          if (error) throw error;
          return data;
        },
        async guardar(registro) {
          const { error } = await sb.from("progreso").insert(registro);
          if (error && error.code !== "23505") throw error; // 23505: ya estaba guardado
        },
      }
    : {
        async cargar() {
          try {
            return JSON.parse(localStorage.getItem(CLAVE_LOCAL)) || [];
          } catch {
            return [];
          }
        },
        async guardar() {
          localStorage.setItem(CLAVE_LOCAL, JSON.stringify(progreso));
        },
      };

  const esc = (t) =>
    String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const enc = encodeURIComponent;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  const fechaLarga = (texto) =>
    aFecha(texto).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const fechaCorta = (texto) => aFecha(texto).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  // Secciones finales (las que tienen contenido), con su sección madre si la hay.
  const hojas = () => indice.temas.flatMap((t) => (t.subsecciones ? t.subsecciones.map((s) => ({ ...s, padre: t.id })) : [t]));
  const temaDe = (id) => hojas().find((t) => t.id === id) || indice.temas.find((t) => t.id === id) || { id, nombre: id };
  const nombreTema = (id) => temaDe(id).nombre;
  const registroDe = (e) => progreso.find((p) => p.fecha === e.fecha && p.tema === e.tema);
  const estaHecha = (e) => Boolean(registroDe(e));
  const diasHechos = () => new Set(progreso.map((p) => p.dia));
  const recientes = (entradas) => [...entradas].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  // ---------- Cabecera y menú ----------

  function pintarRacha() {
    const hoy = fechaLocal();
    const dias = diasHechos();
    const n = calcularRacha(dias, hoy);
    $racha.hidden = false;
    $racha.innerHTML = `${ICONO.llama}<span>${n}</span>`;
    $racha.classList.toggle("encendida", dias.has(hoy));
    $racha.setAttribute(
      "aria-label",
      `Racha de ${plural(n, "día", "días")}. ${dias.has(hoy) ? "Hoy ya cuenta." : "Completa una sección hoy para mantenerla."}`
    );
  }

  function pintarSecciones(activa) {
    const raiz = temaDe(activa).padre || activa;
    $secciones.innerHTML = indice.temas
      .map((t) => {
        return `<a class="sec${t.id === raiz ? " activa" : ""}" href="#/seccion/${enc(t.id)}"${t.id === raiz ? ' aria-current="page"' : ""}>${esc(t.nombre)}</a>`;
      })
      .join("");
    // Segunda fila fija, bajo las secciones: las subsecciones de la sección en la que se está.
    const madre = indice.temas.find((t) => t.id === raiz && t.subsecciones);
    const $subbarra = $("subbarra");
    $subbarra.hidden = !madre;
    document.body.classList.toggle("con-subbarra", Boolean(madre));
    $subbarra.innerHTML = madre
      ? `<div class="subbarra-dentro">
          <a class="subbarra-titulo" href="#/seccion/${enc(madre.id)}">${esc(madre.nombre)}</a>
          ${madre.subsecciones
            .map((sub) => `<a class="sub${sub.id === activa ? " actual" : ""}" href="#/seccion/${enc(sub.id)}"${sub.id === activa ? ' aria-current="page"' : ""}>${esc(sub.nombre)}</a>`)
            .join("")}
        </div>`
      : "";
    const subActual = $subbarra.querySelector(".actual");
    if (subActual) subActual.scrollIntoView({ block: "nearest", inline: "center" });
    const actual = $secciones.querySelector(".activa");
    if (actual) actual.scrollIntoView({ block: "nearest", inline: "center" });
    // Biblioteca, en el menú lateral: las mismas subsecciones, agrupadas por sección.
    $("menu-biblioteca").innerHTML = indice.temas
      .filter((t) => t.subsecciones && t.tipo !== "juegos")
      .map(
        (t) => `<div class="menu-sub-grupo"><span class="antetitulo">${esc(t.nombre)}</span>
          ${t.subsecciones.map((sub) => `<a href="#/biblioteca/${enc(sub.id)}">${esc(sub.nombre)}</a>`).join("")}</div>`
      )
      .join("");
    for (const enlace of $menu.querySelectorAll(".menu-enlaces a")) {
      enlace.classList.toggle("activa", enlace.getAttribute("href") === `#/${activa}`);
    }
  }

  function abrirMenu(abrir) {
    document.body.classList.toggle("menu-abierto", abrir);
    $menu.setAttribute("aria-hidden", String(!abrir));
    $abrirMenu.setAttribute("aria-expanded", String(abrir));
    if (abrir) $("cerrar-menu").focus();
  }

  $abrirMenu.addEventListener("click", () => abrirMenu(true));
  $("cerrar-menu").addEventListener("click", () => abrirMenu(false));
  $("velo").addEventListener("click", () => abrirMenu(false));
  $menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) abrirMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") abrirMenu(false);
  });

  // Filete bajo la cabecera y barra de progreso de lectura.
  let cuadroPendiente = false;
  function alDesplazar() {
    if (cuadroPendiente) return;
    cuadroPendiente = true;
    requestAnimationFrame(() => {
      cuadroPendiente = false;
      $("cabecera").classList.toggle("desplazada", window.scrollY > 8);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const avance = leyendo && total > 0 ? Math.min(1, window.scrollY / total) : 0;
      $barra.style.transform = `scaleX(${avance})`;
    });
  }
  window.addEventListener("scroll", alDesplazar, { passive: true });

  // ---------- Piezas comunes ----------

  // Marca de guardado en la tarjeta: abajo a la derecha de la imagen (o de la tarjeta, si no la tiene).
  // Es un span con rol de botón porque va dentro del enlace de la pieza.
  function marcaGuardar(e) {
    if (!marcadores) return "";
    const puesto = marcadores.has(`${e.fecha}|${e.tema}`);
    const texto = puesto ? "Quitar de guardados" : "Guardar para después";
    return `<span class="guardar-tarjeta${puesto ? " puesto" : ""}" role="button" tabindex="0" data-fecha="${e.fecha}" data-tema="${esc(e.tema)}" aria-pressed="${puesto}" aria-label="${texto}" title="${texto}">${ICONO.marcador}</span>`;
  }

  function pieza(e, i, destacada) {
    // Los álbumes de Música llevan artista y estilo bajo el título, y portada cuadrada.
    const clases = ["pieza", destacada ? "destacada" : "", e.imagen ? "" : "sin-imagen", e.estilo ? "album" : ""].join(" ");
    return `<li data-reveal style="--i:${Math.min(i, 6)}"${destacada ? ' class="ancha"' : ""}>
      <a class="${clases}" href="#/leer/${e.fecha}/${enc(e.tema)}">
        ${e.imagen ? `<span class="pieza-foto"><img src="${esc(e.imagen)}" alt="" loading="lazy">${marcaGuardar(e)}</span>` : ""}
        <span class="pieza-texto">
          <span class="antetitulo">${esc(nombreTema(e.tema))}</span>
          <span class="pieza-titulo">${esc(e.titulo)}</span>
          ${e.subtitulo ? `<span class="pieza-subtitulo">${esc(e.subtitulo)}</span>` : ""}
          ${e.estilo ? `<span class="pieza-estilo">${esc(e.estilo)}</span>` : ""}
          ${e.resumen ? `<span class="pieza-resumen">${esc(e.resumen)}</span>` : ""}
          <span class="pieza-meta">
            <span>${esc(fechaLarga(e.fecha))}</span>
            ${estaHecha(e) ? `<span class="hecha">${ICONO.hecho} Completada</span>` : ""}
          </span>
        </span>
        ${e.imagen ? "" : marcaGuardar(e)}
      </a>
    </li>`;
  }

  const piezas = (entradas, conDestacada) =>
    `<ul class="piezas">${entradas.map((e, i) => pieza(e, i, conDestacada && i === 0)).join("")}</ul>`;

  const vacio = (titulo, texto) => `<div class="vacio" data-reveal><b>${esc(titulo)}</b><span>${esc(texto)}</span></div>`;

  function cifras() {
    const hoy = fechaLocal();
    const dias = diasHechos();
    return `<div class="cifras" data-reveal>
      <div class="cifra${dias.has(hoy) ? " viva" : ""}"><b>${calcularRacha(dias, hoy)}</b><span>Racha actual</span></div>
      <div class="cifra"><b>${mejorRacha(dias)}</b><span>Mejor racha</span></div>
      <div class="cifra"><b>${dias.size}</b><span>Días activos</span></div>
      <div class="cifra"><b>${progreso.length}</b><span>Secciones</span></div>
    </div>`;
  }

  function activarApariciones() {
    const pendientes = $vista.querySelectorAll("[data-reveal]");
    if (sinMovimiento || !("IntersectionObserver" in window)) {
      pendientes.forEach((el) => el.classList.add("visto"));
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("visto");
          observador.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    pendientes.forEach((el) => observador.observe(el));
  }

  // ---------- Celebración ----------

  function lanzarConfeti(x, y) {
    const ctx = $lienzo.getContext("2d");
    const escala = Math.min(window.devicePixelRatio || 1, 2);
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    $lienzo.width = ancho * escala;
    $lienzo.height = alto * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    $lienzo.classList.add("activo");

    const estilos = getComputedStyle(document.documentElement);
    const colores = ["--rojo", "--tinta", "--buho", "--arena"].map((v) => estilos.getPropertyValue(v).trim());
    const trozos = Array.from({ length: 160 }, () => {
      // Abanico hacia la derecha y hacia abajo: el icono está arriba a la izquierda.
      const angulo = (-0.12 + Math.random() * 0.62) * Math.PI;
      const fuerza = 5 + Math.random() * 14;
      return {
        x,
        y,
        vx: Math.cos(angulo) * fuerza,
        vy: Math.sin(angulo) * fuerza - 3,
        giro: Math.random() * Math.PI * 2,
        vGiro: (Math.random() - 0.5) * 0.4,
        lado: 5 + Math.random() * 7,
        color: colores[Math.floor(Math.random() * colores.length)],
        redondo: Math.random() < 0.3,
        vida: 0,
        duracion: 110 + Math.random() * 80,
      };
    });

    (function cuadro() {
      ctx.clearRect(0, 0, ancho, alto);
      let vivos = 0;
      for (const t of trozos) {
        if (++t.vida > t.duracion) continue;
        vivos++;
        t.vx *= 0.985;
        t.vy = t.vy * 0.985 + 0.22;
        t.x += t.vx;
        t.y += t.vy;
        t.giro += t.vGiro;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (t.duracion - t.vida) / 30);
        ctx.fillStyle = t.color;
        ctx.translate(t.x, t.y);
        ctx.rotate(t.giro);
        if (t.redondo) {
          ctx.beginPath();
          ctx.arc(0, 0, t.lado / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.scale(1, Math.cos(t.vida * 0.18)); // aleteo
          ctx.fillRect(-t.lado / 2, -t.lado / 3, t.lado, t.lado * 0.66);
        }
        ctx.restore();
      }
      if (vivos) requestAnimationFrame(cuadro);
      else $lienzo.classList.remove("activo");
    })();
  }

  let avisoPendiente = null;
  function celebrarDia() {
    const n = calcularRacha(diasHechos(), fechaLocal());
    $aviso.innerHTML = `<b>Día completado</b> Racha de ${plural(n, "día", "días")}`;
    $aviso.classList.add("visible");
    clearTimeout(avisoPendiente);
    avisoPendiente = setTimeout(() => $aviso.classList.remove("visible"), 4200);

    $icono.classList.remove("festejo");
    void $icono.offsetWidth; // reinicia la animación si se repite
    $icono.classList.add("festejo");
    if (sinMovimiento) return;
    const caja = $icono.getBoundingClientRect();
    lanzarConfeti(caja.left + caja.width / 2, caja.top + caja.height / 2);
  }

  // ---------- Vistas ----------

  function vistaInicio() {
    pintarSecciones("");
    const hoy = fechaLocal();
    const dias = diasHechos();
    const n = calcularRacha(dias, hoy);
    const hora = new Date().getHours();
    const saludo = hora < 6 ? "Buenas noches" : hora < 13 ? "Buenos días" : hora < 21 ? "Buenas tardes" : "Buenas noches";
    const nombre = perfil && perfil.nombre ? `, <em>${esc(perfil.nombre)}</em>` : "";
    const estado = dias.has(hoy)
      ? `Hoy ya cuenta. Llevas una racha de ${plural(n, "día", "días")}.`
      : n
      ? `Llevas una racha de ${plural(n, "día", "días")}. Completa una sección hoy para mantenerla.`
      : "Completa una sección hoy y empieza tu racha.";

    const todas = recientes(indice.entradas);
    const ultima = todas.length ? todas[0].fecha : null;
    const orden = hojas().map((t) => t.id);
    const edicion = todas.filter((e) => e.fecha === ultima).sort((a, b) => orden.indexOf(a.tema) - orden.indexOf(b.tema));
    const pendientes = todas.filter((e) => e.fecha !== ultima && !estaHecha(e)).slice(0, 6);

    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">${esc(fechaLarga(hoy))}</span>
        <h1 class="titular-xl">${saludo}${nombre}.</h1>
        <p class="entradilla">${esc(estado)}</p>
      </section>
      <h2 class="rotulo">${ultima === hoy ? "La edición de hoy" : "Lo último publicado"}</h2>
      ${edicion.length ? piezas(edicion, true) : vacio("Todavía no hay nada", "La primera edición llegará pronto.")}
      ${pendientes.length ? `<h2 class="rotulo">Pendiente de días anteriores</h2>${piezas(pendientes, false)}` : ""}`;
  }

  function vistaSeccion(id, vigente) {
    pintarSecciones(id);
    const hoy = fechaLocal();
    const tema = temaDe(id);
    if (tema.tipo === "geografia") return vistaGeografia(tema, vigente);
    if (tema.tipo === "juegos") return vistaJuegos(tema);
    if (tema.padre && temaDe(tema.padre).tipo === "juegos") return vistaJuego(tema, vigente);

    // Sección con subsecciones (News, Cultura): todo lo publicado, en un listado por días.
    if (tema.subsecciones) {
      const ids = tema.subsecciones.map((sub) => sub.id);
      const entradas = indice.entradas.filter((e) => ids.includes(e.tema));
      const fechas = [...new Set(entradas.map((e) => e.fecha))].sort().reverse().slice(0, 30);
      const listado = fechas
        .map((f) => {
          const delDia = entradas.filter((e) => e.fecha === f).sort((x, y) => ids.indexOf(x.tema) - ids.indexOf(y.tema));
          return `<h2 class="rotulo">${f === hoy ? "Hoy" : esc(fechaLarga(f))}</h2>
            <ul class="listado">${delDia.map((e, i) => pieza(e, i, false)).join("")}</ul>`;
        })
        .join("");
      $vista.innerHTML = `
        <section data-reveal>
          <span class="antetitulo">Sección</span>
          <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        </section>
        ${listado || `<div style="margin-top:44px">${vacio("Próximamente", "Aquí aparecerá el contenido de esta sección, día a día.")}</div>`}`;
      return;
    }

    const entradas = recientes(indice.entradas.filter((e) => e.tema === id));
    const hechas = entradas.filter(estaHecha).length;
    const resumen = !entradas.length
      ? "Esta sección todavía está en preparación."
      : `Has completado ${hechas} de ${plural(entradas.length, "edición", "ediciones")}.`;
    // El lema de la sección (por ejemplo, «Recomendación del día» en Música) ocupa el hueco de la derecha.
    $vista.innerHTML = `
      <section class="${tema.lema ? "con-lema" : ""}" data-reveal>
        <div>
          ${
            tema.padre
              ? `<a class="volver" href="#/seccion/${enc(tema.padre)}">${ICONO.atras} ${esc(nombreTema(tema.padre))}</a>`
              : '<span class="antetitulo">Sección</span>'
          }
          <h1 class="titular-xl">${esc(tema.nombre)}</h1>
          <p class="entradilla">${esc(resumen)}</p>
        </div>
        ${tema.lema ? `<p class="lema">${esc(tema.lema)}</p>` : ""}
      </section>
      <h2 class="rotulo">Biblioteca</h2>
      ${entradas.length ? piezas(entradas, true) : vacio("Próximamente", "Aquí aparecerá el contenido de esta sección, día a día.")}`;
  }

  // ---------- Geografía: globo 3D y país del día ----------

  const GLOBO_URL = "https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js";
  const geo = { paises: null, mapa: null, galerias: {} }; // se cargan una vez por sesión

  const COMMONS = "https://commons.wikimedia.org/wiki/Special:FilePath/";
  // Convierte la imagen principal de la ficha en un pase de fotos: la principal y, tras ella,
  // las de la galería del país. Se cambia con las flechas o deslizando el dedo.
  function montarCarrusel($articulo, pais) {
    const $figura = $articulo.querySelector("figure");
    const extra = geo.galerias[pais.id] || [];
    if (!$figura || !extra.length) return;
    const $img = $figura.querySelector("img");
    const $pie = $figura.querySelector("figcaption");
    const fotos = [
      { src: $img.src, grande: $img.src, alt: $img.alt, pie: $pie ? $pie.textContent : "" },
      ...extra.map((f) => ({
        src: `${COMMONS}${enc(f.imagen)}?width=1200`,
        grande: `${COMMONS}${enc(f.imagen)}?width=1600`,
        alt: `Fotografía de ${pais.nombre}`,
        pie: `Foto: ${f.autor}, ${f.licencia}, vía Wikimedia Commons.`,
      })),
    ];
    let actual = 0;
    $figura.classList.add("carrusel");
    $figura.innerHTML = `
      <div class="carrusel-marco">
        <img alt="">
        <button type="button" class="carrusel-flecha anterior" aria-label="Foto anterior">${ICONO.atras}</button>
        <button type="button" class="carrusel-flecha siguiente" aria-label="Foto siguiente">${ICONO.atras}</button>
        <span class="carrusel-cuenta"></span>
      </div>
      <figcaption></figcaption>`;
    const $foto = $figura.querySelector("img");
    const mostrar = (n) => {
      actual = (n + fotos.length) % fotos.length;
      const f = fotos[actual];
      $foto.src = f.src;
      $foto.alt = f.alt;
      $foto.dataset.grande = f.grande;
      $figura.querySelector("figcaption").textContent = f.pie;
      $figura.querySelector(".carrusel-cuenta").textContent = `${actual + 1} / ${fotos.length}`;
      new Image().src = fotos[(actual + 1) % fotos.length].src; // la siguiente, ya descargada
    };
    $figura.querySelector(".anterior").addEventListener("click", () => mostrar(actual - 1));
    $figura.querySelector(".siguiente").addEventListener("click", () => mostrar(actual + 1));
    let inicio = null;
    $figura.addEventListener("touchstart", (e) => (inicio = e.touches[0].clientX), { passive: true });
    $figura.addEventListener("touchend", (e) => {
      if (inicio === null) return;
      const paso = e.changedTouches[0].clientX - inicio;
      inicio = null;
      if (Math.abs(paso) > 45) mostrar(actual + (paso < 0 ? 1 : -1));
    });
    mostrar(0);
  }

  const cargarScript = (src) =>
    new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = mal;
      document.head.append(s);
    });

  // El contador muestra el total de Estados miembros de la ONU, aunque todavía no estén todos publicados.
  const PAISES_ONU = 193;

  // El progreso de Geografía se guarda en la misma tabla, con tema "geo:<id del país>".
  const geoHechos = () => new Map(progreso.filter((p) => p.tema.startsWith("geo:")).map((p) => [p.tema.slice(4), p.dia]));

  // País del día: el completado hoy, si lo hay; si no, uno al azar entre los pendientes.
  // El sorteo depende del usuario y de cuántos lleva, así que no cambia hasta completarlo.
  function paisDelDia(paises) {
    const hoy = fechaLocal();
    const hechos = geoHechos();
    const deHoy = [...hechos].find(([, dia]) => dia === hoy);
    if (deHoy) return paises.find((p) => p.id === deHoy[0]) || null;
    const pendientes = paises.filter((p) => !hechos.has(p.id)).sort((a, b) => a.id.localeCompare(b.id));
    if (!pendientes.length) return null;
    let h = 2166136261;
    for (const c of `${usuario ? usuario.id : "local"}:${hechos.size}`) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return pendientes[(h >>> 0) % pendientes.length];
  }

  async function cargarGeografia() {
    if (!geo.paises) {
      const leer = async (ruta) => {
        const r = await fetch(ruta, { cache: "no-cache" });
        if (!r.ok) throw new Error(r.status);
        return r.json();
      };
      const [lista, mundo] = await Promise.all([leer("contenido/geografia/paises.json"), leer("contenido/geografia/mundo.json")]);
      // Territorios con contorno propio (los que no son un país del mapa base) se dibujan encima.
      const propios = await Promise.all(lista.paises.filter((p) => p.geo).map((p) => leer(p.geo)));
      geo.mapa = [...mundo.features, ...propios.map((f) => ({ ...f, encima: true }))];
      geo.paises = lista.paises;
      // Galería de cada país: opcional; si no carga, las fichas salen sin ella.
      geo.galerias = await leer("contenido/geografia/galerias.json").catch(() => ({}));
    }
    if (!window.Globe) await cargarScript(GLOBO_URL);
  }

  function centro(feature) {
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    const recorrer = (c) => {
      if (typeof c[0] === "number") {
        minX = Math.min(minX, c[0]);
        maxX = Math.max(maxX, c[0]);
        minY = Math.min(minY, c[1]);
        maxY = Math.max(maxY, c[1]);
      } else c.forEach(recorrer);
    };
    recorrer(feature.geometry.coordinates);
    return { lat: (minY + maxY) / 2, lng: (minX + maxX) / 2 };
  }

  function vistaGeografia(tema, vigente) {
    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">Sección</span>
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        <p class="entradilla" id="geo-resumen">Un país cada día. Gira el globo y descubre el de hoy.</p>
      </section>
      <div class="geo">
        <div class="geo-globo" data-reveal>
          <div id="globo" class="globo"><p class="nota globo-aviso">Cargando el globo…</p></div>
          <div id="mapa" class="globo mapa" hidden></div>
          <p class="geo-nombre" id="geo-nombre" aria-live="polite"></p>
          <div class="geo-modo" id="geo-modo" role="group" aria-label="Tipo de mapa">
            <button data-modo="3d" aria-pressed="true">3D</button><button data-modo="2d" aria-pressed="false">2D</button>
          </div>
          <button class="boton pequeno geo-hoy" id="geo-hoy" hidden>País del día</button>
          <button class="geo-info" id="geo-info" aria-label="Ir a la información del país">Info ${svg('<path d="M12 5v14M5 12l7 7 7-7"/>')}</button>
        </div>
        <div class="geo-ficha" id="geo-ficha"></div>
      </div>`;

    let globo = null;
    let medidor = null;
    limpiarVista = () => {
      if (medidor) medidor.disconnect();
      if (globo) {
        globo.pauseAnimation();
        if (globo._destructor) globo._destructor();
      }
    };

    (async () => {
      try {
        await cargarGeografia();
      } catch {
        if (vigente()) $("globo").innerHTML = '<p class="error globo-aviso">No se ha podido cargar el globo. Recarga la página.</p>';
        return;
      }
      if (!vigente()) return;

      const paises = geo.paises;
      const porId = new Map(paises.map((p) => [p.geo ? p.id : p.iso, p]));
      const idDe = (f) => f.properties.id;
      const textos = new Map();
      const estilos = getComputedStyle(document.documentElement);
      const color = (v) => estilos.getPropertyValue(v).trim();
      const hoy = fechaLocal();
      let delDia = paisDelDia(paises);
      let visible = null; // país cuya ficha se está mostrando

      const estado = (f) => {
        const pais = porId.get(idDe(f));
        if (!pais) return "resto";
        if (geoHechos().has(pais.id)) return "hecho";
        return delDia && pais.id === delDia.id ? "hoy" : "resto";
      };

      function resumen() {
        const hechos = geoHechos();
        $("geo-resumen").textContent = `${hechos.size} de ${PAISES_ONU} países completados.`;
      }

      // El nombre del país señalado se escribe encima del globo, no junto al puntero:
      // así no se pisan varios nombres, sobre todo en el móvil.
      let elegido = ""; // último país pulsado
      const nombrar = (nombre) => {
        const $nombre = $("geo-nombre");
        if (!$nombre || $nombre.textContent === nombre) return;
        $nombre.textContent = nombre;
        $nombre.classList.remove("entrando");
        void $nombre.offsetWidth;
        $nombre.classList.add("entrando");
      };

      // Pulsar un país, en el globo o en el mapa plano: muestra su nombre y, si es el del día
      // o está completado, abre su ficha.
      function pulsar(f) {
        elegido = f.properties.nombre;
        nombrar(elegido);
        const pais = porId.get(idDe(f));
        if (pais && estado(f) !== "resto") mostrar(pais, true);
      }

      // ----- Globo -----
      const $globo = $("globo");
      $globo.textContent = "";
      try {
        globo = window.Globe()($globo)
          .backgroundColor("rgba(0,0,0,0)")
          .showAtmosphere(true)
          .atmosphereColor(color("--arena"))
          .atmosphereAltitude(0.14)
          .polygonsData(geo.mapa)
          .polygonSideColor(() => color("--arena"))
          .polygonStrokeColor(() => `rgba(${color("--tinta-rgb")}, 0.45)`)
          .polygonLabel(() => "")
          .polygonsTransitionDuration(500)
          .onPolygonHover((f) => {
            nombrar(f ? f.properties.nombre : elegido);
          })
          .onPolygonClick(pulsar);
        globo.globeMaterial().color.set(color("--papel"));
      } catch {
        globo = null;
        $globo.textContent = ""; // sin 3D en este navegador: se usa el mapa plano
      }

      // ----- Mapa plano (2D): el mismo mapa y los mismos colores, sin relieve -----
      const $mapa = $("mapa");
      const LIMITE = { x0: -180, x1: 180, y0: -86, y1: 60 }; // x = longitud, y = -latitud
      const encuadre = { cx: 0, cy: -20, w: 360 }; // centro y ancho de lo que se ve
      let modo = "3d";
      let lienzo = null; // el <svg>; se crea la primera vez que se pide el mapa plano
      let animacion = 0;

      const altoDe = (w) => (w * $mapa.clientHeight) / Math.max(1, $mapa.clientWidth);
      const anchoMax = () => Math.min(360, ((LIMITE.y1 - LIMITE.y0) * $mapa.clientWidth) / Math.max(1, $mapa.clientHeight));

      function encuadrar() {
        if (!lienzo || !$mapa.clientWidth) return;
        const v = encuadre;
        v.w = Math.min(anchoMax(), Math.max(10, v.w));
        const h = altoDe(v.w);
        v.cx = Math.min(LIMITE.x1 - v.w / 2, Math.max(LIMITE.x0 + v.w / 2, v.cx));
        v.cy = Math.min(LIMITE.y1 - h / 2, Math.max(LIMITE.y0 + h / 2, v.cy));
        lienzo.setAttribute("viewBox", `${v.cx - v.w / 2} ${v.cy - h / 2} ${v.w} ${h}`);
      }

      function pintarMapa() {
        if (!lienzo) return;
        for (const p of lienzo.children) p.dataset.estado = estado(p.rasgo);
      }

      function volarMapa(f, ms) {
        if (!lienzo) return;
        const c = centro(f);
        const fin = { cx: c.lng, cy: -c.lat, w: Math.min(anchoMax(), 110) };
        const ini = { ...encuadre };
        const t0 = performance.now();
        cancelAnimationFrame(animacion);
        const paso = (t) => {
          if (!vigente()) return;
          const k = ms ? Math.min(1, (t - t0) / ms) : 1;
          const s = 1 - Math.pow(1 - k, 3);
          for (const campo of ["cx", "cy", "w"]) encuadre[campo] = ini[campo] + (fin[campo] - ini[campo]) * s;
          encuadrar();
          if (k < 1) animacion = requestAnimationFrame(paso);
        };
        paso(t0);
      }

      function crearMapa() {
        const NS = "http://www.w3.org/2000/svg";
        lienzo = document.createElementNS(NS, "svg");
        lienzo.setAttribute("role", "img");
        lienzo.setAttribute("aria-label", "Mapa del mundo");
        const trazo = (anillos) => anillos.map((a) => `M${a.map(([x, y]) => `${x},${-y}`).join("L")}Z`).join("");
        for (const f of geo.mapa) {
          const p = document.createElementNS(NS, "path");
          const g = f.geometry;
          p.setAttribute("d", g.type === "Polygon" ? trazo(g.coordinates) : g.coordinates.map(trazo).join(""));
          p.rasgo = f;
          lienzo.append(p);
        }
        $mapa.append(lienzo);
        pintarMapa();

        // Arrastrar para moverse; rueda o pellizco para acercarse.
        const dedos = new Map();
        let movido = 0;
        let separacion = 0;
        let pulsado = null;
        const aMundo = (x, y) => {
          const r = $mapa.getBoundingClientRect();
          const h = altoDe(encuadre.w);
          return { x: encuadre.cx - encuadre.w / 2 + ((x - r.left) / r.width) * encuadre.w, y: encuadre.cy - h / 2 + ((y - r.top) / r.height) * h };
        };
        const acercar = (factor, x, y) => {
          const antes = aMundo(x, y);
          encuadre.w *= factor;
          encuadrar();
          const despues = aMundo(x, y);
          encuadre.cx += antes.x - despues.x;
          encuadre.cy += antes.y - despues.y;
          encuadrar();
        };
        const distancia = () => {
          const [p, q] = [...dedos.values()];
          return Math.hypot(p.x - q.x, p.y - q.y) || 1;
        };
        $mapa.addEventListener("pointerdown", (e) => {
          cancelAnimationFrame(animacion);
          if (!dedos.size) {
            movido = 0;
            pulsado = e.target.rasgo || null;
          }
          dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (dedos.size === 2) separacion = distancia();
          $mapa.setPointerCapture(e.pointerId);
        });
        $mapa.addEventListener("pointermove", (e) => {
          const antes = dedos.get(e.pointerId);
          if (!antes) return;
          const dx = e.clientX - antes.x;
          const dy = e.clientY - antes.y;
          dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (dedos.size === 1) {
            movido += Math.abs(dx) + Math.abs(dy);
            encuadre.cx -= (dx / $mapa.clientWidth) * encuadre.w;
            encuadre.cy -= (dy / $mapa.clientHeight) * altoDe(encuadre.w);
            encuadrar();
          } else if (dedos.size === 2) {
            movido = 99;
            const [p, q] = [...dedos.values()];
            const ahora = distancia();
            acercar(separacion / ahora, (p.x + q.x) / 2, (p.y + q.y) / 2);
            separacion = ahora;
          }
        });
        const soltar = (e) => {
          if (!dedos.delete(e.pointerId)) return;
          if (e.type === "pointerup" && !dedos.size && movido < 8 && pulsado) pulsar(pulsado);
        };
        $mapa.addEventListener("pointerup", soltar);
        $mapa.addEventListener("pointercancel", soltar);
        $mapa.addEventListener(
          "wheel",
          (e) => {
            e.preventDefault();
            cancelAnimationFrame(animacion);
            acercar(e.deltaY > 0 ? 1.2 : 1 / 1.2, e.clientX, e.clientY);
          },
          { passive: false }
        );
        lienzo.addEventListener("pointerover", (e) => {
          if (e.pointerType === "mouse" && e.target.rasgo && !dedos.size) nombrar(e.target.rasgo.properties.nombre);
        });
        lienzo.addEventListener("pointerleave", () => nombrar(elegido));
      }

      const pintarGlobo = () => {
        pintarMapa();
        if (!globo) return;
        globo
          .polygonCapColor((f) => ({ hecho: color("--rojo"), hoy: color("--tinta"), resto: color("--blanco") }[estado(f)]))
          .polygonAltitude((f) => (f.encima ? 0.016 : 0.006) + (estado(f) === "resto" ? 0 : 0.012));
      };
      pintarGlobo();

      const ajustar = () => {
        if (globo && $globo.clientWidth) globo.width($globo.clientWidth).height($globo.clientHeight);
        encuadrar();
      };
      ajustar();
      medidor = new ResizeObserver(ajustar);
      medidor.observe($globo);
      medidor.observe($mapa);

      const volar = (pais, ms) => {
        const f = geo.mapa.find((x) => porId.get(idDe(x)) === pais);
        if (!f) return;
        if (modo === "2d") return volarMapa(f, sinMovimiento ? 0 : ms * 0.6);
        // Más lejos en pantallas estrechas, para que el globo quepa entero.
        if (globo) globo.pointOfView({ ...centro(f), altitude: $globo.clientWidth < 520 ? 2.5 : 2 }, ms);
      };

      // ----- Globo o mapa -----
      function ponerModo(nuevo, recordar) {
        modo = nuevo === "2d" || !globo ? "2d" : "3d";
        $globo.hidden = modo !== "3d";
        $mapa.hidden = modo !== "2d";
        $mapa.parentElement.classList.toggle("plano", modo === "2d");
        for (const b of $("geo-modo").children) {
          b.setAttribute("aria-pressed", String(b.dataset.modo === modo));
          if (b.dataset.modo === "3d") b.disabled = !globo;
        }
        if (modo === "2d" && !lienzo) crearMapa();
        if (globo) modo === "3d" ? globo.resumeAnimation() : globo.pauseAnimation();
        ajustar();
        const pais = visible || delDia;
        if (pais) volar(pais, 0);
        if (recordar) {
          try {
            localStorage.setItem("sophy-geo-modo", modo);
          } catch {}
        }
      }
      $("geo-modo").addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (b && b.dataset.modo !== modo) ponerModo(b.dataset.modo, true);
      });

      // ----- Ficha -----
      async function mostrar(pais, conVuelo) {
        visible = pais;
        elegido = pais.nombre;
        nombrar(elegido);
        $("geo-hoy").hidden = !delDia || pais.id === delDia.id;
        if (conVuelo) volar(pais, 1400);
        if (!textos.has(pais.id)) {
          try {
            const r = await fetch(pais.archivo, { cache: "no-cache" });
            if (!r.ok) throw new Error(r.status);
            textos.set(pais.id, await r.text());
          } catch {
            if (vigente()) $("geo-ficha").innerHTML = '<p class="error">No se ha podido cargar la ficha de este país.</p>';
            return;
          }
        }
        if (!vigente() || visible !== pais) return;

        const completado = geoHechos().get(pais.id);
        const esDelDia = delDia && pais.id === delDia.id;
        const pie = completado
          ? `<div class="fin hecho">${ICONO.hecho} Completado el ${esc(fechaCorta(completado))}</div>`
          : `<div class="siguiente"><button class="boton" id="geo-completar">Día completado</button></div>`;
        $("geo-ficha").innerHTML = `
          <article class="ficha-pais">
            <header class="ficha-cabecera">
              ${pais.bandera ? `<img class="ficha-bandera" src="${esc(pais.bandera)}" alt="Bandera de ${esc(pais.nombre)}">` : ""}
              <div>
                <span class="antetitulo">${esDelDia ? "País del día" : "País completado"}</span>
                <h2 class="titular">${esc(pais.nombre)}</h2>
                <p class="ficha-capital">Capital: <b>${esc(pais.capital)}</b></p>
              </div>
            </header>
            <div class="articulo">${window.marked.parse(textos.get(pais.id))}</div>
            ${pie}
          </article>`;
        $("geo-ficha").classList.remove("entrando");
        void $("geo-ficha").offsetWidth;
        $("geo-ficha").classList.add("entrando");

        montarCarrusel($("geo-ficha").querySelector(".articulo"), pais);
        const $completar = $("geo-completar");
        if ($completar) $completar.addEventListener("click", () => completar(pais, $completar));
      }

      async function completar(pais, $boton) {
        $boton.disabled = true;
        const registro = { fecha: hoy, tema: `geo:${pais.id}`, dia: hoy };
        progreso.push(registro);
        try {
          await almacen.guardar(registro);
        } catch {
          progreso = progreso.filter((p) => p !== registro);
          if (vigente()) {
            $boton.disabled = false;
            $boton.textContent = "No se ha podido guardar. Reintentar";
          }
          return;
        }
        pintarRacha();
        celebrarDia();
        if (!vigente()) return;
        pintarGlobo();
        resumen();
        mostrar(pais, false);
      }

      $("geo-hoy").addEventListener("click", () => delDia && mostrar(delDia, true));
      $("geo-info").addEventListener("click", () => {
        const y = $("geo-ficha").getBoundingClientRect().top + window.scrollY - $("cabecera").offsetHeight - 16;
        window.scrollTo({ top: y, behavior: sinMovimiento ? "auto" : "smooth" });
      });

      let guardado = "3d";
      try {
        guardado = localStorage.getItem("sophy-geo-modo") || "3d";
      } catch {}
      ponerModo(guardado, false);

      resumen();
      if (delDia) {
        const inicio = geo.mapa.find((x) => porId.get(idDe(x)) === delDia);
        if (inicio && globo) globo.pointOfView({ lat: 10, lng: centro(inicio).lng - 70, altitude: 3 }, 0);
        mostrar(delDia, true);
      } else {
        $("geo-ficha").innerHTML = vacio("Sección completada", "Has recorrido todos los países disponibles. Pulsa cualquiera en rojo para volver a leerlo.");
        $("geo-ficha").firstElementChild.classList.add("visto");
      }
    })();
  }

  // Reparte cada artículo en cabecera, imagen y texto para poder maquetarlo a dos columnas.
  function maquetar($articulo) {
    const grupos = [[]];
    for (const nodo of [...$articulo.children]) {
      if (nodo.tagName === "HR") grupos.push([]);
      else grupos[grupos.length - 1].push(nodo);
    }
    $articulo.textContent = "";
    const crear = (etiqueta, clase) => Object.assign(document.createElement(etiqueta), { className: clase });
    for (const grupo of grupos) {
      if (!grupo.length) continue;
      const cabecera = crear("header", "noticia-cabecera");
      const foto = crear("div", "noticia-foto");
      const texto = crear("div", "noticia-texto");
      let enCabecera = true;
      for (const nodo of grupo) {
        const em = nodo.tagName === "P" && nodo.children.length === 1 ? nodo.firstElementChild : null;
        const esData = Boolean(em) && em.tagName === "EM" && nodo.textContent.trim() === em.textContent.trim();
        if (nodo.tagName === "FIGURE") {
          foto.append(nodo);
          enCabecera = false;
        } else if (enCabecera && (nodo.tagName === "H2" || nodo.tagName === "H3" || esData)) {
          cabecera.append(nodo);
        } else {
          enCabecera = false;
          texto.append(nodo);
        }
      }
      const cuerpo = crear("div", foto.children.length ? "noticia-cuerpo" : "noticia-cuerpo sin-foto");
      if (foto.children.length) cuerpo.append(foto);
      cuerpo.append(texto);
      const noticia = crear("section", "noticia");
      noticia.append(cabecera, cuerpo);
      $articulo.append(noticia);
    }
  }

  async function vistaLeer(fecha, tema, vigente) {
    pintarSecciones(tema);
    const entrada = indice.entradas.find((e) => e.fecha === fecha && e.tema === tema);
    if (!entrada) {
      $vista.innerHTML = vacio("Esta sección no existe", "Puede que el enlace sea antiguo.");
      return;
    }
    let texto;
    try {
      const r = await fetch(entrada.archivo, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      texto = await r.text();
    } catch {
      if (vigente()) $vista.innerHTML = '<p class="error">No se ha podido cargar esta sección. Recarga la página.</p>';
      return;
    }
    if (!vigente()) return;

    $vista.innerHTML = `
      <div class="lectura${entrada.estilo ? " album" : ""}">
        <a class="volver" href="#/seccion/${enc(tema)}">${ICONO.atras} ${esc(nombreTema(tema))}</a>
        <div class="lectura-meta">
          <p class="lectura-fecha">${esc(fechaLarga(fecha))}</p>
          <button type="button" id="guardar" class="guardar" hidden></button>
        </div>
        <article class="articulo">${window.marked.parse(texto)}</article>
        <div id="fin" class="fin"></div>
        <div id="valorar" class="valorar" hidden></div>
        <div id="siguiente" class="siguiente"></div>
      </div>`;
    maquetar($vista.querySelector(".articulo"));
    leyendo = true;
    // Registro de lectura: una fila la primera vez que se abre; si ya existe o falla, no importa.
    if (remoto) sb.from("aperturas").insert({ fecha, tema }).then(() => {});
    activarValoracion(fecha, tema);
    activarGuardado(fecha, tema);

    const $fin = $("fin");
    const marcarHecha = () => {
      $fin.classList.add("hecho");
      $fin.innerHTML = `${ICONO.hecho} Sección completada`;
      // Enlace a la siguiente pieza sin completar de la misma edición.
      const orden = hojas().map((t) => t.id);
      const resto = indice.entradas
        .filter((e) => e.fecha === fecha && !estaHecha(e))
        .sort((a, b) => orden.indexOf(a.tema) - orden.indexOf(b.tema));
      $("siguiente").innerHTML = resto.length
        ? `<a class="boton" href="#/leer/${resto[0].fecha}/${enc(resto[0].tema)}">Siguiente: ${esc(nombreTema(resto[0].tema))}</a>`
        : '<a class="boton linea" href="#/">Edición completada · Volver al inicio</a>';
    };
    if (estaHecha(entrada)) {
      marcarHecha();
      return;
    }
    $fin.textContent = "Fin de la sección";

    let cuenta = null;
    const observador = new IntersectionObserver(([e]) => {
      clearTimeout(cuenta);
      if (!e.isIntersecting) return;
      cuenta = setTimeout(async () => {
        observador.disconnect();
        const registro = { fecha, tema, dia: fechaLocal() };
        const primeraDelDia = !diasHechos().has(registro.dia);
        progreso.push(registro);
        marcarHecha();
        pintarRacha();
        if (primeraDelDia) celebrarDia();
        try {
          await almacen.guardar(registro);
        } catch {
          progreso = progreso.filter((p) => p !== registro);
          pintarRacha();
          $fin.classList.remove("hecho");
          $("siguiente").textContent = "";
          $fin.textContent = "No se ha podido guardar el progreso. Recarga la página para reintentarlo.";
        }
      }, SEGUNDOS_AL_FINAL * 1000);
    });
    observador.observe($fin);
    limpiarVista = () => {
      clearTimeout(cuenta);
      observador.disconnect();
    };
  }

  // Guardar una pieza para leerla más tarde. Pulsar otra vez la quita de la lista.
  async function cambiarGuardado(fecha, tema) {
    const clave = `${fecha}|${tema}`;
    const antes = marcadores.get(clave);
    const ahora = new Date().toISOString();
    if (antes) marcadores.delete(clave);
    else marcadores.set(clave, ahora);
    let error = null;
    if (!remoto) {
      try {
        localStorage.setItem(CLAVE_GUARDADOS, JSON.stringify(Object.fromEntries(marcadores)));
      } catch {}
    } else if (antes) {
      ({ error } = await sb.from("guardados").delete().eq("fecha", fecha).eq("tema", tema));
    } else {
      ({ error } = await sb.from("guardados").insert({ fecha, tema }));
    }
    if (error && error.code !== "23505") {
      if (antes) marcadores.set(clave, antes);
      else marcadores.delete(clave);
      return false;
    }
    return true;
  }

  function activarGuardado(fecha, tema) {
    const $boton = $("guardar");
    if (!marcadores || !$boton) return;
    const pintar = () => {
      const puesto = marcadores.has(`${fecha}|${tema}`);
      $boton.hidden = false;
      $boton.setAttribute("aria-pressed", puesto);
      $boton.innerHTML = `${ICONO.marcador}<span>${puesto ? "Guardada" : "Guardar para después"}</span>`;
    };
    pintar();
    $boton.addEventListener("click", async () => {
      $boton.disabled = true;
      await cambiarGuardado(fecha, tema);
      $boton.disabled = false;
      if ($boton.isConnected) pintar();
    });
  }

  function vistaGuardados() {
    pintarSecciones("guardados");
    const lista = marcadores
      ? indice.entradas
          .filter((e) => marcadores.has(`${e.fecha}|${e.tema}`))
          .sort((a, b) => marcadores.get(`${b.fecha}|${b.tema}`).localeCompare(marcadores.get(`${a.fecha}|${a.tema}`)))
      : [];
    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">Para leer después</span>
        <h1 class="titular-xl">Guardados</h1>
        <p class="entradilla">${
          marcadores === null
            ? "Esta función todavía no está disponible."
            : lista.length
            ? `Tienes ${plural(lista.length, "pieza guardada", "piezas guardadas")}.`
            : "Aún no has guardado nada."
        }</p>
      </section>
      ${
        lista.length
          ? `<ul class="listado" style="margin-top:36px">${lista.map((e, i) => pieza(e, i, false)).join("")}</ul>`
          : `<div style="margin-top:44px">${vacio("Nada guardado todavía", "Pulsa «Guardar para después» al abrir una pieza y la encontrarás aquí.")}</div>`
      }`;
  }

  // Guardar o quitar desde la tarjeta de cualquier listado, sin entrar en la pieza.
  async function pulsarMarca(e) {
    const $marca = e.target.closest(".guardar-tarjeta");
    if (!$marca) return;
    e.preventDefault();
    e.stopPropagation();
    if ($marca.dataset.ocupado) return;
    $marca.dataset.ocupado = "1";
    const { fecha, tema } = $marca.dataset;
    const bien = await cambiarGuardado(fecha, tema);
    delete $marca.dataset.ocupado;
    if (!bien) return;
    if (location.hash === "#/guardados") return vistaGuardados();
    const puesto = marcadores.has(`${fecha}|${tema}`);
    for (const $m of $vista.querySelectorAll(".guardar-tarjeta")) {
      if ($m.dataset.fecha !== fecha || $m.dataset.tema !== tema) continue;
      $m.classList.toggle("puesto", puesto);
      $m.setAttribute("aria-pressed", puesto);
      const texto = puesto ? "Quitar de guardados" : "Guardar para después";
      $m.setAttribute("aria-label", texto);
      $m.title = texto;
    }
  }
  $vista.addEventListener("click", pulsarMarca);
  $vista.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("guardar-tarjeta")) pulsarMarca(e);
  });

  // Botones de me gusta / no me gusta al final de cada pieza. Pulsar el mismo otra vez lo quita.
  function activarValoracion(fecha, tema) {
    if (!valoraciones) return;
    const $caja = $("valorar");
    const clave = `${fecha}|${tema}`;
    const pintar = () => {
      const actual = valoraciones.get(clave) || 0;
      $caja.hidden = false;
      $caja.innerHTML = `<span>¿Te ha gustado?</span>
        <button class="voto" data-valor="1" aria-pressed="${actual === 1}" aria-label="Me gusta" title="Me gusta">${ICONO.gusta}</button>
        <button class="voto" data-valor="-1" aria-pressed="${actual === -1}" aria-label="No me gusta" title="No me gusta">${ICONO.noGusta}</button>`;
    };
    pintar();
    $caja.addEventListener("click", async (e) => {
      const $boton = e.target.closest(".voto");
      if (!$boton) return;
      const valor = Number($boton.dataset.valor);
      const anterior = valoraciones.get(clave);
      const quitar = anterior === valor;
      if (quitar) valoraciones.delete(clave);
      else valoraciones.set(clave, valor);
      pintar();

      let error = null;
      if (!remoto) {
        try {
          localStorage.setItem(CLAVE_VOTOS, JSON.stringify(Object.fromEntries(valoraciones)));
        } catch {}
      } else if (quitar) {
        ({ error } = await sb.from("valoraciones").delete().eq("fecha", fecha).eq("tema", tema));
      } else {
        ({ error } = await sb.from("valoraciones").upsert({ fecha, tema, valor }, { onConflict: "user_id,fecha,tema" }));
      }
      if (!error) return;
      if (anterior) valoraciones.set(clave, anterior);
      else valoraciones.delete(clave);
      if ($caja.isConnected) pintar();
    });
  }

  function vistaHistorial() {
    pintarSecciones("historial");
    const hoy = fechaLocal();
    const dias = diasHechos();

    // Cinco semanas completas, de lunes a domingo, acabando en la actual.
    const lunes = sumarDias(hoy, -((aFecha(hoy).getDay() + 6) % 7));
    const inicio = sumarDias(lunes, -28);
    let celdas = ["L", "M", "X", "J", "V", "S", "D"].map((d) => `<div class="cab">${d}</div>`).join("");
    for (let i = 0; i < 35; i++) {
      const d = sumarDias(inicio, i);
      const clases = ["dia", dias.has(d) ? "hecho" : "", d === hoy ? "hoy" : "", d > hoy ? "futuro" : ""].join(" ");
      celdas += `<div class="${clases}" title="${esc(fechaLarga(d))}">${aFecha(d).getDate()}</div>`;
    }

    const hechas = indice.entradas
      .filter(estaHecha)
      .sort((a, b) => registroDe(b).dia.localeCompare(registroDe(a).dia) || b.fecha.localeCompare(a.fecha));
    const lista = hechas.length
      ? `<ul class="registro">${hechas
          .map(
            (e, i) => `<li data-reveal style="--i:${Math.min(i, 6)}"><a href="#/leer/${e.fecha}/${enc(e.tema)}">
              <b>${esc(e.titulo)}</b>
              <span>${esc(nombreTema(e.tema))} · completada el ${esc(fechaCorta(registroDe(e).dia))}</span>
            </a></li>`
          )
          .join("")}</ul>`
      : vacio("Aún no hay nada aquí", "Las secciones que completes aparecerán en este registro.");

    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">Tu recorrido</span>
        <h1 class="titular-xl">Historial</h1>
      </section>
      ${cifras()}
      <h2 class="rotulo">Últimas cinco semanas</h2>
      <div class="calendario" data-reveal>${celdas}</div>
      <h2 class="rotulo">Secciones completadas</h2>
      ${lista}`;
  }

  const bloqueCodigo = () =>
    perfil
      ? `<span class="codigo">#${esc(perfil.codigo)}</span>
         <div class="fila"><button class="boton linea" id="copiar">Copiar código</button></div>`
      : '<span class="nota">Tu código todavía no está disponible.</span>';

  function activarCopia() {
    const $copiar = $("copiar");
    if (!$copiar) return;
    $copiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(`#${perfil.codigo}`);
        $copiar.textContent = "Copiado";
      } catch {
        $copiar.textContent = "No se ha podido copiar";
      }
      setTimeout(() => ($copiar.textContent = "Copiar código"), 2000);
    });
  }

  // Recordatorio de racha: una notificación a las 20:00 si ese día no se ha completado nada.
  // El navegador da una «dirección» del dispositivo, que se guarda en la tabla avisos;
  // el envío lo hace Supabase (supabase/functions/recordatorio).
  const CLAVE_AVISOS = "sophy-avisos"; // "si" cuando el usuario ha aceptado los avisos en este dispositivo
  const avisosPosibles = () =>
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && Boolean(cfg.VAPID_PUBLIC_KEY);

  // Da de alta este dispositivo para recibir el recordatorio. Necesita sesión y el permiso
  // de notificaciones ya concedido. Devuelve true si queda suscrito.
  async function suscribirAvisos() {
    if (!remoto || !usuario || !avisosPosibles() || Notification.permission !== "granted") return false;
    const registro = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    // La clave pública, de texto (base64url) a bytes, que es como la pide Safari.
    const b64 = cfg.VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
    const clave = Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const sus =
      (await registro.pushManager.getSubscription()) ||
      (await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }));
    const datos = sus.toJSON();
    const { error } = await sb
      .from("avisos")
      .upsert({ endpoint: datos.endpoint, user_id: usuario.id, p256dh: datos.keys.p256dh, auth: datos.keys.auth }, { onConflict: "endpoint" });
    if (error) throw error;
    return true;
  }

  async function activarRecordatorio() {
    const $estado = $("aviso-estado");
    const $activar = $("aviso-activar");
    const sigue = () => $estado.isConnected;
    const HORA = "Cada día a las 20:00 (hora de Madrid), si aún no has completado nada, te avisaremos para que no pierdas la racha.";

    if (!avisosPosibles()) {
      const enIphone = /iPhone|iPad|iPod/.test(navigator.userAgent);
      $estado.textContent = enIphone
        ? "Para recibir el recordatorio en el iPhone, instala Sophy en la pantalla de inicio (Compartir > Añadir a pantalla de inicio) y ábrela desde su icono."
        : "Este navegador no admite notificaciones.";
      return;
    }

    let registro;
    try {
      registro = await navigator.serviceWorker.register("sw.js");
      await navigator.serviceWorker.ready;
    } catch {
      if (sigue()) $estado.textContent = "No se han podido preparar las notificaciones en este dispositivo.";
      return;
    }
    if (!sigue()) return;

    async function pintar() {
      const sus = await registro.pushManager.getSubscription();
      if (!sigue()) return;
      const activo = Boolean(sus) && Notification.permission === "granted";
      $activar.hidden = activo;
      $estado.textContent =
        Notification.permission === "denied"
          ? "Las notificaciones de Sophy están bloqueadas en los ajustes de este dispositivo. Actívalas allí y vuelve a esta página."
          : activo
          ? `Recordatorio activado en este dispositivo. ${HORA}`
          : HORA;
      if (Notification.permission === "denied") $activar.hidden = true;
    }

    $activar.addEventListener("click", async () => {
      $activar.disabled = true;
      try {
        if ((await Notification.requestPermission()) === "granted") {
          await suscribirAvisos();
          try {
            localStorage.setItem(CLAVE_AVISOS, "si");
          } catch {}
        }
        await pintar();
      } catch {
        if (sigue()) $estado.textContent = "No se ha podido activar el recordatorio. Inténtalo de nuevo.";
      }
      $activar.disabled = false;
    });

    pintar();
  }

  function vistaUsuario() {
    pintarSecciones("usuario");
    if (!remoto) {
      $vista.innerHTML = `
        <section data-reveal><span class="antetitulo">Tu cuenta</span><h1 class="titular-xl">Usuario</h1>
        <p class="entradilla">Estás en modo local: no hay cuenta y el progreso se guarda solo en este navegador.</p></section>
        ${cifras()}`;
      return;
    }
    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">Tu cuenta</span>
        <h1 class="titular-xl">${perfil && perfil.nombre ? esc(perfil.nombre) : "Usuario"}</h1>
      </section>
      ${cifras()}
      <h2 class="rotulo">Datos</h2>
      <dl class="ficha" data-reveal>
        <div><dt>Correo</dt><dd>${esc(usuario.email)}</dd></div>
        <div><dt>Código de usuario</dt><dd>${bloqueCodigo()}</dd></div>
        ${
          perfil
            ? `<div><dt><label for="nombre">Nombre visible para tus amigos</label></dt>
               <dd><form class="fila" id="form-nombre">
                 <input class="entrada" id="nombre" maxlength="40" placeholder="Tu nombre" value="${esc(perfil.nombre || "")}">
                 <button class="boton">Guardar</button>
               </form><p class="nota" id="nombre-msg"></p></dd></div>`
            : ""
        }
        <div><dt>Miembro desde</dt><dd>${esc(fechaCorta(fechaLocal(new Date(usuario.created_at))))}</dd></div>
      </dl>
      <h2 class="rotulo">Recordatorio</h2>
      <div class="recordatorio" data-reveal>
        <p class="nota" id="aviso-estado">Comprobando…</p>
        <p class="fila">
          <button class="boton" id="aviso-activar" hidden>Activar recordatorio</button>
        </p>
      </div>
      <p style="margin-top:32px"><button class="boton linea" id="salir-cuenta">Cerrar sesión</button></p>`;

    activarCopia();
    activarRecordatorio();
    $("salir-cuenta").addEventListener("click", () => sb.auth.signOut());
    const $form = $("form-nombre");
    if ($form) {
      $form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nuevo = $("nombre").value.trim();
        const { error } = await sb.rpc("cambiar_nombre", { nuevo });
        if (!error) perfil.nombre = nuevo || null;
        if ($("nombre-msg")) $("nombre-msg").textContent = error ? "No se ha podido guardar." : "Guardado.";
      });
    }
  }

  // Aviso de solicitudes de amistad pendientes: punto en el botón del menú y contador junto a Friends.
  function pintarAvisos() {
    const n = solicitudes.filter((x) => x.tipo === "recibida").length;
    $abrirMenu.classList.toggle("con-aviso", n > 0);
    $abrirMenu.setAttribute("aria-label", n ? `Abrir menú (${plural(n, "solicitud de amistad", "solicitudes de amistad")})` : "Abrir menú");
    const $enlace = $menu.querySelector('a[href="#/friends"]');
    $enlace.innerHTML = `Friends${n ? ` <span class="contador">${n}</span>` : ""}`;
  }

  async function vistaFriends(vigente) {
    pintarSecciones("friends");
    const cabecera = `
      <section data-reveal>
        <span class="antetitulo">Aprender acompañado</span>
        <h1 class="titular-xl">Friends</h1>
        <p class="entradilla">Envía una solicitud con el código de otra persona. Cuando la acepte, veréis la constancia del otro día a día.</p>
      </section>`;
    if (!remoto || !perfil) {
      $vista.innerHTML = `${cabecera}<div style="margin-top:44px">${vacio(
        "Todavía no disponible",
        remoto ? "Friends se activará en cuanto esté lista la base de datos." : "Friends necesita una cuenta; en modo local no está disponible."
      )}</div>`;
      return;
    }

    $vista.innerHTML = `${cabecera}
      <h2 class="rotulo">Tu código</h2>
      <div class="tarjeta-papel" data-reveal>
        ${bloqueCodigo()}
        <p class="nota" style="margin:14px 0 0">Compártelo con quien quieras. Quien lo tenga podrá enviarte una solicitud; solo si la aceptas veréis los días completados del otro. Nunca se muestra tu correo ni qué has leído.</p>
      </div>
      <h2 class="rotulo">Añadir a alguien</h2>
      <form class="fila" id="form-amigo" data-reveal>
        <input class="entrada" id="codigo-amigo" placeholder="#CÓDIGO" maxlength="12" autocapitalize="characters" autocomplete="off" required aria-label="Código de usuario">
        <button class="boton">Enviar solicitud</button>
      </form>
      <p class="nota" id="amigo-msg" role="status"></p>
      <div id="lista-amigos"><p class="nota">Cargando…</p></div>`;
    activarCopia();

    const hoy = fechaLocal();
    const ultimos7 = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));
    const inicial = (titulo) => esc(titulo.replace("#", "").charAt(0).toUpperCase());

    const filaSolicitud = (x) => {
      const titulo = x.nombre || `#${x.codigo}`;
      const acciones =
        x.tipo === "recibida"
          ? `<button class="boton pequeno" data-accion="aceptar" data-id="${esc(x.usuario_id)}">Aceptar</button>
             <button class="boton linea pequeno" data-accion="rechazar" data-id="${esc(x.usuario_id)}">Rechazar</button>`
          : `<span class="nota">Pendiente de respuesta</span>
             <button class="quitar" data-accion="quitar" data-id="${esc(x.usuario_id)}">Cancelar</button>`;
      return `<li class="amigo">
        <span class="amigo-inicial">${inicial(titulo)}</span>
        <span class="amigo-datos"><b>${esc(titulo)}</b><span>#${esc(x.codigo)}</span></span>
        <span class="fila">${acciones}</span>
      </li>`;
    };

    const filaAmigo = (a) => {
      const dias = new Set(a.dias);
      const titulo = a.nombre || `#${a.codigo}`;
      return `<li class="amigo">
        <span class="amigo-inicial">${inicial(titulo)}</span>
        <span class="amigo-datos"><b>${esc(titulo)}</b><span>#${esc(a.codigo)} · ${plural(dias.size, "día activo", "días activos")}</span></span>
        <span class="semana" title="Últimos 7 días">${ultimos7.map((d) => `<i${dias.has(d) ? ' class="hecho"' : ""}></i>`).join("")}</span>
        <span class="amigo-racha${dias.has(hoy) ? " encendida" : ""}" title="Racha">${ICONO.llama}${calcularRacha(dias, hoy)}</span>
        <button class="quitar" data-accion="quitar" data-id="${esc(a.amigo_id)}">Quitar</button>
      </li>`;
    };

    async function pintarAmigos() {
      const [pendientes, amigos] = await Promise.all([sb.rpc("solicitudes"), sb.rpc("progreso_amigos")]);
      const $lista = $("lista-amigos");
      if (!vigente() || !$lista) return;
      if (pendientes.error || amigos.error) {
        $lista.innerHTML = '<p class="error">No se ha podido cargar la lista.</p>';
        return;
      }
      solicitudes = pendientes.data;
      pintarAvisos();
      const recibidas = solicitudes.filter((x) => x.tipo === "recibida");
      const enviadas = solicitudes.filter((x) => x.tipo === "enviada");
      const bloque = (titulo, filas) => (filas.length ? `<h2 class="rotulo">${titulo}</h2><ul class="amigos">${filas.join("")}</ul>` : "");
      $lista.innerHTML = `
        ${bloque("Solicitudes recibidas", recibidas.map(filaSolicitud))}
        ${bloque("Solicitudes enviadas", enviadas.map(filaSolicitud))}
        <h2 class="rotulo">Amigos</h2>
        ${amigos.data.length ? `<ul class="amigos">${amigos.data.map(filaAmigo).join("")}</ul>` : vacio("Aún no tienes amigos aquí", "Envía una solicitud con el código de alguien, o comparte el tuyo.")}`;
      $lista.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("visto"));
    }

    const RESPUESTAS = {
      enviada: "Solicitud enviada. Aparecerá en tu lista cuando la acepte.",
      aceptada: "Esa persona ya te había enviado una solicitud: ahora sois amigos.",
      ya_enviada: "Ya le habías enviado una solicitud.",
      ya_amigos: "Ya sois amigos.",
      eres_tu: "Ese es tu propio código.",
    };

    $("form-amigo").addEventListener("submit", async (e) => {
      e.preventDefault();
      const $msg = $("amigo-msg");
      const $campo = $("codigo-amigo");
      $msg.className = "nota";
      $msg.textContent = "Buscando…";
      const { data, error } = await sb.rpc("agregar_amigo", { codigo_amigo: $campo.value });
      if (!vigente()) return;
      if (error) {
        $msg.className = "error";
        $msg.textContent = "No se ha podido enviar. Inténtalo de nuevo.";
      } else if (data === "no_existe") {
        $msg.className = "error";
        $msg.textContent = "No hay ningún usuario con ese código.";
      } else {
        $msg.textContent = RESPUESTAS[data] || "Hecho.";
        $campo.value = "";
        pintarAmigos();
      }
    });

    $("lista-amigos").addEventListener("click", async (e) => {
      const $boton = e.target.closest("[data-accion]");
      if (!$boton) return;
      $boton.disabled = true;
      const id = $boton.dataset.id;
      if ($boton.dataset.accion === "quitar") await sb.rpc("quitar_amigo", { otro: id });
      else await sb.rpc("responder_solicitud", { solicitante: id, aceptar: $boton.dataset.accion === "aceptar" });
      if (vigente()) pintarAmigos();
    });

    pintarAmigos();
  }

  function vistaTerminos() {
    $vista.innerHTML = `
      <section data-reveal>
        <a class="volver" href="#/">${ICONO.atras} Volver</a>
        <h1 class="titular-xl">Términos y privacidad</h1>
        <p class="entradilla">Qué es Sophy, qué datos guarda de ti y quién puede verlos.</p>
      </section>
      <div class="legal" data-reveal>
        <h2>Privacidad</h2>
        <h3>Qué datos se guardan</h3>
        <ul>
          <li>Tu <b>correo electrónico</b> y tu contraseña (cifrada), para que puedas entrar en tu cuenta.</li>
          <li>El nombre que elijas y tu código de usuario.</li>
          <li>Tu <b>actividad</b>: qué piezas abres y cuándo, cuáles completas, qué juegos terminas, tus valoraciones («me gusta» y «no me gusta») y los días que cuentan para tu racha.</li>
          <li>Tus amistades dentro de Sophy.</li>
          <li>Si activas los avisos, un identificador de tu dispositivo para poder enviarte el recordatorio.</li>
        </ul>
        <h3>Para qué se usan</h3>
        <p>Para que Sophy funcione (guardar tu progreso y tu racha, mostrarte a tus amigos, enviarte el recordatorio) y para saber cómo se usa y mejorar el contenido.</p>
        <h3>Quién puede verlos</h3>
        <ul>
          <li><b>El administrador de Sophy puede consultar tu actividad asociada a tu correo electrónico</b>: sabe qué persona ha abierto, completado o valorado cada cosa.</li>
          <li>Tus amigos ven tu nombre, tu código y los días que has completado. No ven tu correo ni qué has leído.</li>
          <li>Los demás usuarios no ven nada tuyo.</li>
          <li>Tus datos no se venden ni se ceden a terceros, y Sophy no tiene publicidad. Se guardan en los servicios técnicos que hacen funcionar la web: Supabase (cuentas y base de datos) y GitHub Pages (alojamiento). Los avisos pasan por el servicio de notificaciones de tu dispositivo (Apple o Google).</li>
        </ul>
        <h3>Cuánto tiempo y cómo borrarlos</h3>
        <p>Se conservan mientras tengas la cuenta. Puedes pedir en cualquier momento ver tus datos, corregirlos o borrarlos junto con tu cuenta${
          cfg.CONTACTO ? `, escribiendo a <a href="mailto:${esc(cfg.CONTACTO)}">${esc(cfg.CONTACTO)}</a>` : ", escribiendo al administrador de Sophy"
        }.</p>
        <h3>En tu dispositivo</h3>
        <p>Sophy no usa cookies de publicidad ni de seguimiento. Guarda en tu navegador lo necesario para mantener la sesión iniciada, tus preferencias y las partidas de los minijuegos.</p>

        <h2>Términos del servicio</h2>
        <ul>
          <li>Sophy es un proyecto personal y gratuito de aprendizaje diario. Se ofrece tal cual, sin garantía de disponibilidad.</li>
          <li>Los textos se preparan con ayuda de inteligencia artificial a partir de las fuentes que se enlazan en cada pieza. Pueden contener errores: contrasta lo importante.</li>
          <li>Las imágenes proceden de Wikimedia Commons y de Cover Art Archive, y pertenecen a sus autores, con la licencia que se indica en cada una.</li>
          <li>La cuenta es personal. Si haces un uso abusivo del servicio, se puede cerrar.</li>
        </ul>
      </div>`;
  }

  function vistaAbout() {
    pintarSecciones("about");
    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">About Us</span>
        <h1 class="titular-xl">Aprender no debería ser <em>un privilegio</em>.</h1>
      </section>
      <div class="manifiesto" data-reveal style="margin-top:40px">
        <p>Sophy nace con un objetivo sencillo: democratizar el aprendizaje. Creemos que entender el mundo, y entenderse mejor a uno mismo, no debería depender del tiempo, el dinero o la formación que tenga cada persona.</p>
        <p>Por eso cada mañana preparamos una edición breve y cuidada, pensada para leerse en unos minutos. No es un reto ni una competición: es una biblioteca que crece contigo, un día detrás de otro.</p>
      </div>
      <h2 class="rotulo">En qué creemos</h2>
      <div class="pilares">
        <div class="pilar" data-reveal style="--i:0"><span class="antetitulo">Uno</span><b>Conocimiento para todos</b><p>Contenido claro y riguroso, con sus fuentes, al alcance de cualquiera.</p></div>
        <div class="pilar" data-reveal style="--i:1"><span class="antetitulo">Dos</span><b>Constancia antes que intensidad</b><p>Un poco cada día llega más lejos que mucho de vez en cuando. La racha está para recordártelo.</p></div>
        <div class="pilar" data-reveal style="--i:2"><span class="antetitulo">Tres</span><b>Crecer como persona</b><p>Aprender no es acumular datos: es mirar el mundo con más criterio y más curiosidad.</p></div>
      </div>`;
  }

  function vistaAcceso() {
    $vista.innerHTML = `
      <form class="acceso" id="acceso" data-reveal>
        <span class="antetitulo">Bienvenido</span>
        <h1 class="titular">Aprende algo cada día.</h1>
        <label class="campo">Correo <input type="email" name="correo" autocomplete="email" required></label>
        <label class="campo">Contraseña <input type="password" name="clave" autocomplete="current-password" minlength="6" required></label>
        <label class="casilla"><input type="checkbox" name="terminos" required>
          <span>Acepto los <a href="#/terminos">términos y la política de privacidad</a>. El administrador de Sophy puede ver mi actividad asociada a mi correo.</span></label>
        <label class="casilla"><input type="checkbox" name="avisos">
          <span>Acepto recibir notificaciones de Sophy, como el recordatorio diario de la racha</span></label>
        <div class="fila">
          <button class="boton" name="entrar">Entrar</button>
          <button class="boton linea" name="crear" type="button">Crear cuenta</button>
        </div>
        <p id="acceso-msg" class="acceso-msg nota" role="status"></p>
      </form>`;
    const $form = $("acceso");
    const $msg = $("acceso-msg");

    const enviar = async (crear) => {
      if (!$form.reportValidity()) return;
      // El permiso de notificaciones hay que pedirlo aquí, en el mismo toque del botón:
      // el iPhone no deja pedirlo más tarde. El alta del dispositivo se hace al abrir la sesión.
      const quiereAvisos = $form.avisos.checked;
      try {
        localStorage.setItem(CLAVE_AVISOS, quiereAvisos ? "si" : "no");
      } catch {}
      if (quiereAvisos && avisosPosibles() && Notification.permission === "default") {
        Promise.resolve(Notification.requestPermission())
          .then(() => suscribirAvisos())
          .catch(() => {});
      }
      const credenciales = { email: $form.correo.value.trim(), password: $form.clave.value };
      $form.entrar.disabled = $form.crear.disabled = true;
      $msg.className = "acceso-msg nota";
      $msg.textContent = "Un momento…";
      const { data, error } = crear
        ? await sb.auth.signUp({ ...credenciales, options: { emailRedirectTo: location.origin + location.pathname } })
        : await sb.auth.signInWithPassword(credenciales);
      if (!document.body.contains($form)) return; // la sesión ya ha cambiado de vista
      $form.entrar.disabled = $form.crear.disabled = false;
      if (error) {
        $msg.className = "acceso-msg error";
        $msg.textContent = error.message;
      } else if (!data.session) {
        $msg.textContent = "Cuenta creada. Revisa tu correo y confirma la dirección para poder entrar.";
      }
    };
    $form.addEventListener("submit", (e) => {
      e.preventDefault();
      enviar(false);
    });
    $form.crear.addEventListener("click", () => enviar(true));
  }

  // ---------- Biblioteca ----------

  // Sin tildes ni mayúsculas, para que «economia» encuentre «Economía».
  const llano = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function vistaBiblioteca(id) {
    pintarSecciones("biblioteca");
    const grupos = indice.temas.filter((t) => t.subsecciones && t.tipo !== "juegos");
    const ids = grupos.flatMap((t) => t.subsecciones.map((sub) => sub.id));
    // Si se llega desde el menú con una sección concreta, empieza marcada en el filtro.
    const inicial = ids.includes(id) ? id : "";
    const todas = indice.entradas.filter((e) => ids.includes(e.tema));
    const fechas = todas.map((e) => e.fecha).sort();

    $vista.innerHTML = `
      <section class="biblio-cabecera" data-reveal>
        <div>
          <span class="antetitulo">Todo lo publicado</span>
          <h1 class="titular-xl">Biblioteca</h1>
        </div>
        <form class="biblio-filtros" id="biblio-filtros" role="search">
          <details class="filtro-secciones" id="biblio-secciones">
            <summary class="entrada"><span>Secciones</span><b id="biblio-n" hidden></b></summary>
            <div class="filtro-panel">
              ${grupos
                .map(
                  (t) => `<fieldset>
                    <legend>${esc(t.nombre)}</legend>
                    ${t.subsecciones
                      .map(
                        (sub) => `<label class="casilla"><input type="checkbox" name="seccion" value="${esc(sub.id)}"${sub.id === inicial ? " checked" : ""}><span>${esc(sub.nombre)}</span></label>`
                      )
                      .join("")}
                  </fieldset>`
                )
                .join("")}
            </div>
          </details>
          <input class="entrada" id="biblio-buscar" type="search" placeholder="Buscar por palabras" aria-label="Buscar por palabras" autocomplete="off">
          <select class="entrada" id="biblio-orden" aria-label="Orden por fecha">
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguos primero</option>
          </select>
          <input class="entrada" id="biblio-fecha" type="date" aria-label="Ver solo una fecha"${fechas.length ? ` min="${fechas[0]}" max="${fechas[fechas.length - 1]}"` : ""}>
          <button class="boton pequeno linea" id="biblio-limpiar" type="reset" hidden>Quitar filtros</button>
        </form>
      </section>
      <p class="biblio-cuenta" id="biblio-cuenta" role="status"></p>
      <div id="biblio-lista"></div>`;

    const $buscar = $("biblio-buscar");
    if (enfocarBusqueda) setTimeout(() => $buscar.isConnected && $buscar.focus(), 350);
    enfocarBusqueda = false;
    const $orden = $("biblio-orden");
    const $fecha = $("biblio-fecha");

    const $secciones = $("biblio-secciones");
    const marcadas = () => [...$secciones.querySelectorAll("input:checked")].map((c) => c.value);

    function pintar() {
      const palabras = llano($buscar.value).split(/\s+/).filter(Boolean);
      const signo = $orden.value === "asc" ? 1 : -1;
      const orden = ids;
      const elegidas = marcadas();
      $("biblio-n").hidden = !elegidas.length;
      $("biblio-n").textContent = elegidas.length;
      const lista = todas
        .filter((e) => !elegidas.length || elegidas.includes(e.tema))
        .filter((e) => !$fecha.value || e.fecha === $fecha.value)
        .filter((e) => {
          const texto = llano(`${e.titulo} ${e.resumen || ""} ${nombreTema(e.tema)}`);
          return palabras.every((p) => texto.includes(p));
        })
        .sort((x, y) => signo * x.fecha.localeCompare(y.fecha) || orden.indexOf(x.tema) - orden.indexOf(y.tema));
      const filtrando = Boolean(palabras.length || $fecha.value || elegidas.length);
      $("biblio-limpiar").hidden = !filtrando && $orden.value === "desc";
      $("biblio-cuenta").textContent = filtrando
        ? `${plural(lista.length, "artículo", "artículos")} de ${todas.length}`
        : plural(todas.length, "artículo", "artículos");
      $("biblio-lista").innerHTML = lista.length
        ? `<ul class="listado">${lista.map((e, i) => pieza(e, i, false)).join("")}</ul>`
        : !todas.length
        ? vacio("Próximamente", "Aquí aparecerá todo lo que se publique en esta sección.")
        : vacio("Sin resultados", "Prueba con otras palabras o con otra fecha.");
      activarApariciones();
    }

    const $filtros = $("biblio-filtros");
    $filtros.addEventListener("input", pintar);
    $filtros.addEventListener("submit", (e) => e.preventDefault());
    // «Quitar filtros» deja el desplegable sin ninguna sección marcada, también la que venía del menú.
    $filtros.addEventListener("reset", () =>
      setTimeout(() => {
        $secciones.querySelectorAll("input").forEach((c) => (c.checked = false));
        pintar();
      })
    );
    // El desplegable se cierra al pulsar fuera de él o con Escape.
    const cerrarFuera = (e) => {
      if (!$secciones.contains(e.target)) $secciones.open = false;
    };
    document.addEventListener("click", cerrarFuera);
    $secciones.addEventListener("keydown", (e) => {
      if (e.key === "Escape") $secciones.open = false;
    });
    limpiarVista = () => document.removeEventListener("click", cerrarFuera);
    pintar();
  }

  // ---------- Minijuegos ----------

  function vistaJuegos(tema) {
    const hoy = fechaLocal();
    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">Sección</span>
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        <p class="entradilla">Un reto nuevo cada día. Completar uno también cuenta para tu racha.</p>
      </section>
      <ul class="juegos">${tema.subsecciones
        .map((j, i) => {
          const info = JUEGOS[j.id] || {};
          const estado = !info.listo ? "Próximamente" : juegoHecho(j.id, hoy) ? "Completado hoy" : "Disponible";
          return `<li data-reveal style="--i:${i}"><a class="juego-tarjeta${info.listo ? "" : " pronto"}" href="#/seccion/${enc(j.id)}">
            <span class="antetitulo">${estado}</span>
            <b>${esc(j.nombre)}</b>
            <span>${esc(info.texto || "")}</span>
          </a></li>`;
        })
        .join("")}</ul>`;
  }

  function vistaJuego(tema, vigente) {
    if (tema.id === "palabra") return vistaPalabra(tema, vigente);
    if (tema.id === "sudoku") return vistaSudoku(tema);
    if (tema.id === "adivina-pais") return vistaPais(tema, vigente);
    $vista.innerHTML = `
      <section data-reveal>
        <a class="volver" href="#/seccion/${enc(tema.padre)}">${ICONO.atras} ${esc(nombreTema(tema.padre))}</a>
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
      </section>
      <div style="margin-top:44px">${vacio("Próximamente", "Este juego está en preparación.")}</div>`;
  }

  // La palabra del día: la misma para todos, elegida por la fecha en una lista fija.
  const PALABRA = { inicio: "2026-10-13", intentos: 6, letras: 5, clave: "sophy-palabra", claveCifras: "sophy-palabra-cifras", datos: null };
  const TECLAS = ["QWERTYUIOP", "ASDFGHJKLÑ", "↵ZXCVBNM⌫"];

  // "si": letra en su sitio; "casi": está en otra posición; "no": no está. Cada letra de la solución se usa una vez.
  function puntuar(intento, solucion) {
    const marcas = Array(intento.length).fill("no");
    const resto = {};
    [...solucion].forEach((c, i) => {
      if (intento[i] === c) marcas[i] = "si";
      else resto[c] = (resto[c] || 0) + 1;
    });
    [...intento].forEach((c, i) => {
      if (marcas[i] === "si" || !resto[c]) return;
      marcas[i] = "casi";
      resto[c]--;
    });
    return marcas;
  }

  const leerLocal = (clave, defecto) => {
    try {
      return JSON.parse(localStorage.getItem(clave)) || defecto;
    } catch {
      return defecto;
    }
  };
  const guardarLocal = (clave, valor) => {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {}
  };

  async function vistaPalabra(tema, vigente) {
    const hoy = fechaLocal();
    $vista.innerHTML = `
      <section class="palabra" data-reveal>
        <a class="volver" href="#/seccion/${enc(tema.padre)}">${ICONO.atras} ${esc(nombreTema(tema.padre))}</a>
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        <p class="entradilla">Acierta la palabra de cinco letras en seis intentos.</p>
        <div id="palabra-tablero" class="tablero" role="grid" aria-label="Intentos"></div>
        <p id="palabra-aviso" class="palabra-aviso" role="status"></p>
        <div id="palabra-teclado" class="teclado"></div>
        <div id="palabra-final" class="palabra-final" hidden></div>
        <details class="palabra-reglas">
          <summary>Cómo se juega</summary>
          <p>Escribe una palabra de cinco letras y pulsa Enviar. Las tildes no cuentan.</p>
          <p><b class="letra si mini">A</b> la letra está en su sitio · <b class="letra casi mini">A</b> está en la palabra, en otra posición · <b class="letra no mini">A</b> no está.</p>
        </details>
      </section>`;
    if (!PALABRA.datos) {
      try {
        const r = await fetch("contenido/juegos/palabras.json", { cache: "no-cache" });
        if (!r.ok) throw new Error(r.status);
        const datos = await r.json();
        const admitidas = new Set();
        for (let i = 0; i < datos.admitidas.length; i += PALABRA.letras) admitidas.add(datos.admitidas.slice(i, i + PALABRA.letras));
        PALABRA.datos = { soluciones: datos.soluciones, admitidas };
      } catch {
        if (vigente()) $("palabra-aviso").textContent = "No se ha podido cargar el juego. Recarga la página.";
        return;
      }
    }
    if (!vigente()) return;

    const { soluciones, admitidas } = PALABRA.datos;
    const numero = Math.round((aFecha(hoy) - aFecha(PALABRA.inicio)) / 86400000);
    const solucion = soluciones[((numero % soluciones.length) + soluciones.length) % soluciones.length];
    const guardado = leerLocal(PALABRA.clave, {});
    const intentos = guardado.fecha === hoy && Array.isArray(guardado.intentos) ? guardado.intentos : [];
    let actual = "";
    let ocupado = false;
    const $tablero = $("palabra-tablero");
    const $aviso = $("palabra-aviso");
    const $teclado = $("palabra-teclado");
    const ganada = () => intentos.includes(solucion);
    const acabada = () => ganada() || intentos.length >= PALABRA.intentos;

    function pintar(revelar) {
      let filas = "";
      for (let f = 0; f < PALABRA.intentos; f++) {
        const hecha = f < intentos.length;
        const texto = hecha ? intentos[f] : f === intentos.length ? actual : "";
        const marcas = hecha ? puntuar(texto, solucion) : [];
        let celdas = "";
        for (let c = 0; c < PALABRA.letras; c++) {
          const clases = ["letra", marcas[c] || "", texto[c] && !hecha ? "llena" : "", hecha && revelar && f === intentos.length - 1 ? "gira" : ""].join(" ");
          celdas += `<span class="${clases}" style="--i:${c}" role="gridcell">${esc(texto[c] || "")}</span>`;
        }
        filas += `<div class="fila" role="row">${celdas}</div>`;
      }
      $tablero.innerHTML = filas;

      // Cada tecla toma el mejor resultado que haya tenido su letra.
      const orden = { no: 1, casi: 2, si: 3 };
      const mejor = {};
      for (const intento of intentos) {
        puntuar(intento, solucion).forEach((m, i) => {
          if ((orden[m] || 0) > (orden[mejor[intento[i]]] || 0)) mejor[intento[i]] = m;
        });
      }
      $teclado.innerHTML = TECLAS.map(
        (fila) =>
          `<div class="teclado-fila">${[...fila]
            .map((t) => {
              const nombre = t === "↵" ? "Enviar" : t === "⌫" ? "Borrar" : t;
              const ancha = t === "↵" || t === "⌫";
              return `<button type="button" class="tecla ${ancha ? "ancha" : mejor[t.toLowerCase()] || ""}" data-tecla="${t}" aria-label="${nombre}">${t === "↵" ? "Enviar" : t}</button>`;
            })
            .join("")}</div>`
      ).join("");
    }

    function avisar(texto, temblar) {
      $aviso.textContent = texto;
      if (!temblar) return;
      const $fila = $tablero.children[intentos.length];
      if (!$fila) return;
      $fila.classList.remove("tiembla");
      void $fila.offsetWidth;
      $fila.classList.add("tiembla");
    }

    function final() {
      const cifras = leerLocal(PALABRA.claveCifras, { jugadas: 0, ganadas: 0, racha: 0, mejor: 0, ultima: "" });
      const $final = $("palabra-final");
      const cuadros = intentos.map((i) => puntuar(i, solucion).map((m) => (m === "si" ? "🟩" : m === "casi" ? "🟨" : "⬛")).join("")).join("\n");
      const marcador = `${ganada() ? intentos.length : "X"}/${PALABRA.intentos}`;
      $teclado.hidden = true;
      $final.hidden = false;
      $final.innerHTML = `
        <b class="palabra-resultado">${ganada() ? ["¡Genial!", "¡Magnífico!", "¡Muy bien!", "¡Bien hecho!", "¡Conseguido!", "¡Por los pelos!"][intentos.length - 1] : "Otra vez será"}</b>
        <p>La palabra de hoy era <b class="palabra-solucion">${esc(solucion.toUpperCase())}</b>.
          <a href="https://dle.rae.es/${enc(solucion)}" target="_blank" rel="noopener">Ver su definición en el diccionario</a></p>
        <div class="cifras">
          <div class="cifra"><b>${cifras.jugadas}</b><span>Jugadas</span></div>
          <div class="cifra"><b>${cifras.jugadas ? Math.round((100 * cifras.ganadas) / cifras.jugadas) : 0}%</b><span>Acertadas</span></div>
          <div class="cifra"><b>${cifras.racha}</b><span>Seguidas</span></div>
        </div>
        <button type="button" class="boton" id="palabra-compartir">Compartir resultado</button>
        <p class="palabra-manana">Mañana habrá una palabra nueva.</p>`;
      $("palabra-compartir").addEventListener("click", async (e) => {
        const texto = `Sophy · La palabra del día ${marcador}\n${cuadros}`;
        try {
          if (navigator.share) await navigator.share({ text: texto });
          else {
            await navigator.clipboard.writeText(texto);
            e.target.textContent = "Copiado";
          }
        } catch {}
      });
    }

    function terminar() {
      // Las cifras se actualizan una sola vez por día.
      const cifras = leerLocal(PALABRA.claveCifras, { jugadas: 0, ganadas: 0, racha: 0, mejor: 0, ultima: "" });
      if (cifras.ultima !== hoy) {
        cifras.jugadas++;
        if (ganada()) cifras.ganadas++;
        cifras.racha = ganada() ? cifras.racha + 1 : 0;
        cifras.mejor = Math.max(cifras.mejor, cifras.racha);
        cifras.ultima = hoy;
        guardarLocal(PALABRA.claveCifras, cifras);
      }
      final();
      registrarJuego("palabra", hoy);
    }

    async function enviar() {
      if (actual.length < PALABRA.letras) return avisar("Faltan letras.", true);
      if (!admitidas.has(actual)) return avisar("Esa palabra no está en el diccionario del juego.", true);
      intentos.push(actual);
      actual = "";
      guardarLocal(PALABRA.clave, { fecha: hoy, intentos });
      $aviso.textContent = "";
      ocupado = true;
      pintar(true);
      await espera(sinMovimiento ? 0 : 1300);
      ocupado = false;
      if (vigente() && acabada()) terminar();
    }

    function pulsar(tecla) {
      if (ocupado || acabada()) return;
      if (tecla === "↵") return enviar();
      if (tecla === "⌫") actual = actual.slice(0, -1);
      else if (actual.length < PALABRA.letras) actual += tecla.toLowerCase();
      $aviso.textContent = "";
      pintar(false);
    }

    $teclado.addEventListener("click", (e) => {
      const $tecla = e.target.closest(".tecla");
      if ($tecla) pulsar($tecla.dataset.tecla);
    });
    const alTeclear = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains("menu-abierto")) return;
      if (e.key === "Enter") pulsar("↵");
      else if (e.key === "Backspace") pulsar("⌫");
      else if (/^[a-zñ]$/i.test(e.key)) pulsar(e.key.toUpperCase());
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", alTeclear);
    limpiarVista = () => document.removeEventListener("keydown", alTeclear);

    pintar(false);
    if (acabada()) terminar();
  }

  // Guarda en el progreso que el juego de hoy está completado; cuenta para la racha.
  async function registrarJuego(id, hoy) {
    if (juegoHecho(id, hoy)) return;
    const registro = { fecha: hoy, tema: `juego:${id}`, dia: hoy };
    const primeraDelDia = !diasHechos().has(hoy);
    progreso.push(registro);
    pintarRacha();
    if (primeraDelDia) celebrarDia();
    try {
      await almacen.guardar(registro);
    } catch {
      progreso = progreso.filter((p) => p !== registro);
      pintarRacha();
    }
  }

  // Sudoku del día: se genera en el navegador con la fecha como semilla, así que es el mismo para todos.
  // De cada nivel: nombre y número de pistas al que se intenta llegar.
  const SUDOKU = { clave: "sophy-sudoku", niveles: { facil: ["Fácil", 42], medio: ["Medio", 33], dificil: ["Difícil", 26] } };

  // Generador de números pseudoaleatorios a partir de un texto: mismo texto, misma secuencia.
  function azar(semilla) {
    let a = 2166136261;
    for (const c of semilla) {
      a ^= c.charCodeAt(0);
      a = Math.imul(a, 16777619);
    }
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function barajar(lista, rnd) {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
  }

  const cajaDe = (i) => ((i / 27) | 0) * 3 + (((i % 9) / 3) | 0);

  // Cuenta las soluciones de un tablero (como mucho 2), rellenando siempre la casilla con menos candidatos.
  function contarSoluciones(t) {
    const filas = Array(9).fill(0);
    const cols = Array(9).fill(0);
    const cajas = Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      if (!t[i]) continue;
      const b = 1 << t[i];
      filas[(i / 9) | 0] |= b;
      cols[i % 9] |= b;
      cajas[cajaDe(i)] |= b;
    }
    let total = 0;
    (function paso() {
      let mejor = -1;
      let menos = 10;
      let mascara = 0;
      for (let i = 0; i < 81 && menos > 1; i++) {
        if (t[i]) continue;
        const usados = filas[(i / 9) | 0] | cols[i % 9] | cajas[cajaDe(i)];
        let n = 0;
        for (let d = 1; d <= 9; d++) if (!(usados & (1 << d))) n++;
        if (n < menos) {
          menos = n;
          mejor = i;
          mascara = usados;
        }
      }
      if (mejor < 0) {
        total++;
        return;
      }
      const f = (mejor / 9) | 0;
      const c = mejor % 9;
      const k = cajaDe(mejor);
      for (let d = 1; d <= 9 && total < 2; d++) {
        const b = 1 << d;
        if (mascara & b) continue;
        t[mejor] = d;
        filas[f] |= b;
        cols[c] |= b;
        cajas[k] |= b;
        paso();
        t[mejor] = 0;
        filas[f] &= ~b;
        cols[c] &= ~b;
        cajas[k] &= ~b;
      }
    })();
    return total;
  }

  // Parte de una rejilla válida, la desordena sin romperla y quita números por parejas simétricas
  // mientras la solución siga siendo única.
  function generarSudoku(semilla, pistas) {
    const rnd = azar(semilla);
    const cifras = barajar([1, 2, 3, 4, 5, 6, 7, 8, 9], rnd);
    const orden = () => barajar([0, 1, 2], rnd).flatMap((g) => barajar([0, 1, 2], rnd).map((x) => g * 3 + x));
    const fs = orden();
    const cs = orden();
    const girar = rnd() < 0.5;
    const solucion = Array(81);
    for (let f = 0; f < 9; f++) {
      for (let c = 0; c < 9; c++) {
        const valor = cifras[(3 * (fs[f] % 3) + ((fs[f] / 3) | 0) + cs[c]) % 9];
        solucion[girar ? c * 9 + f : f * 9 + c] = valor;
      }
    }
    const inicial = solucion.slice();
    let quedan = 81;
    for (const i of barajar([...Array(81).keys()], rnd)) {
      if (quedan <= pistas) break;
      const j = 80 - i;
      if (!inicial[i]) continue;
      const [a, b] = [inicial[i], inicial[j]];
      inicial[i] = inicial[j] = 0;
      if (contarSoluciones(inicial.slice()) === 1) quedan -= i === j ? 1 : 2;
      else [inicial[i], inicial[j]] = [a, b];
    }
    return { inicial, solucion };
  }

  const reloj = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;

  function vistaSudoku(tema) {
    const hoy = fechaLocal();
    const guardado = leerLocal(SUDOKU.clave, {});
    const estado = guardado.fecha === hoy && guardado.partidas ? guardado : { fecha: hoy, nivel: "facil", partidas: {} };
    if (!(estado.nivel in SUDOKU.niveles)) estado.nivel = "facil";
    const tableros = {};
    let elegida = -1;
    let conNotas = false;

    $vista.innerHTML = `
      <section class="sudoku" data-reveal>
        <a class="volver" href="#/seccion/${enc(tema.padre)}">${ICONO.atras} ${esc(nombreTema(tema.padre))}</a>
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        <div class="sudoku-barra">
          <div id="sudoku-niveles" class="sudoku-niveles" role="group" aria-label="Dificultad"></div>
          <span id="sudoku-reloj" class="sudoku-reloj" aria-label="Tiempo"></span>
        </div>
        <div id="sudoku-rejilla" class="sudoku-rejilla" role="grid" aria-label="Sudoku"></div>
        <div id="sudoku-teclas" class="sudoku-teclas"></div>
        <div id="sudoku-final" class="palabra-final" hidden></div>
        <details class="palabra-reglas">
          <summary>Cómo se juega</summary>
          <p>Rellena la rejilla para que cada fila, cada columna y cada caja de 3×3 tenga los números del 1 al 9 sin repetir.</p>
          <p>Toca una casilla y después un número. Con «Notas» apuntas candidatos en pequeño. Los números repetidos en una fila, columna o caja se marcan en rojo.</p>
        </details>
      </section>`;
    const $rejilla = $("sudoku-rejilla");
    const $teclas = $("sudoku-teclas");
    const $final = $("sudoku-final");

    const tablero = () => (tableros[estado.nivel] = tableros[estado.nivel] || generarSudoku(`${hoy}:${estado.nivel}`, SUDOKU.niveles[estado.nivel][1]));
    const partida = () => (estado.partidas[estado.nivel] = estado.partidas[estado.nivel] || { valores: Array(81).fill(0), notas: {}, seg: 0, hecho: false });
    const guardar = () => guardarLocal(SUDOKU.clave, estado);
    const valor = (i) => tablero().inicial[i] || partida().valores[i];
    const vecinas = (a, b) => ((a / 9) | 0) === ((b / 9) | 0) || a % 9 === b % 9 || cajaDe(a) === cajaDe(b);

    function pintar() {
      const p = partida();
      const fijas = tablero().inicial;
      const visto = elegida >= 0 ? valor(elegida) : 0;
      const cuenta = Array(10).fill(0);
      let celdas = "";
      for (let i = 0; i < 81; i++) {
        const v = valor(i);
        cuenta[v]++;
        let mal = false;
        if (v) for (let j = 0; j < 81 && !mal; j++) mal = j !== i && valor(j) === v && vecinas(i, j);
        const clases = [
          "celda",
          fijas[i] ? "fija" : v ? "" : "vacia",
          i === elegida ? "elegida" : elegida >= 0 && vecinas(i, elegida) ? "vecina" : "",
          v && v === visto && i !== elegida ? "igual" : "",
          mal ? "mal" : "",
        ].join(" ");
        const notas = !v && p.notas[i] && p.notas[i].length
          ? `<span class="notas">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<i>${p.notas[i].includes(d) ? d : ""}</i>`).join("")}</span>`
          : "";
        celdas += `<button type="button" class="${clases}" data-i="${i}" role="gridcell" aria-label="Fila ${((i / 9) | 0) + 1}, columna ${(i % 9) + 1}${v ? `: ${v}` : ", vacía"}">${v || notas}</button>`;
      }
      $rejilla.innerHTML = celdas;
      $rejilla.classList.toggle("hecho", p.hecho);

      $("sudoku-niveles").innerHTML = Object.entries(SUDOKU.niveles)
        .map(([id, [nombre]]) => {
          const hecho = estado.partidas[id] && estado.partidas[id].hecho;
          return `<button type="button" data-nivel="${id}" aria-pressed="${id === estado.nivel}">${nombre}${hecho ? " ✓" : ""}</button>`;
        })
        .join("");
      $("sudoku-reloj").textContent = reloj(p.seg);
      $teclas.hidden = p.hecho;
      $teclas.innerHTML = `<div class="sudoku-numeros">${[1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((d) => `<button type="button" class="tecla${cuenta[d] >= 9 ? " agotada" : ""}" data-n="${d}">${d}</button>`)
        .join("")}</div>
        <div class="teclado-fila">
          <button type="button" class="tecla ancha" data-n="0">Borrar</button>
          <button type="button" class="tecla ancha${conNotas ? " activa" : ""}" data-notas aria-pressed="${conNotas}">Notas</button>
        </div>`;

      $final.hidden = !p.hecho;
      if (!p.hecho) return;
      const nombre = SUDOKU.niveles[estado.nivel][0].toLowerCase();
      $final.innerHTML = `
        <b class="palabra-resultado">¡Sudoku completado!</b>
        <p>Nivel ${esc(nombre)}, resuelto en <b>${reloj(p.seg)}</b>.</p>
        <button type="button" class="boton" id="sudoku-compartir">Compartir resultado</button>
        <p class="palabra-manana">Puedes probar otro nivel. Mañana habrá sudokus nuevos.</p>`;
      $("sudoku-compartir").addEventListener("click", async (e) => {
        const texto = `Sophy · Sudoku del día (${nombre}) en ${reloj(p.seg)}`;
        try {
          if (navigator.share) await navigator.share({ text: texto });
          else {
            await navigator.clipboard.writeText(texto);
            e.target.textContent = "Copiado";
          }
        } catch {}
      });
    }

    function poner(d) {
      const p = partida();
      if (p.hecho || elegida < 0 || tablero().inicial[elegida]) return;
      if (conNotas && d) {
        const notas = p.notas[elegida] || [];
        p.notas[elegida] = notas.includes(d) ? notas.filter((x) => x !== d) : [...notas, d];
        p.valores[elegida] = 0;
      } else {
        p.valores[elegida] = p.valores[elegida] === d ? 0 : d;
        delete p.notas[elegida];
        // Al fijar un número, deja de ser candidato en su fila, columna y caja.
        if (p.valores[elegida]) {
          for (const i of Object.keys(p.notas)) {
            if (vecinas(Number(i), elegida)) p.notas[i] = p.notas[i].filter((x) => x !== d);
          }
        }
      }
      if (tablero().solucion.every((s, i) => valor(i) === s)) {
        p.hecho = true;
        elegida = -1;
        registrarJuego("sudoku", hoy);
      }
      guardar();
      pintar();
    }

    $rejilla.addEventListener("click", (e) => {
      const $celda = e.target.closest(".celda");
      if (!$celda || partida().hecho) return;
      elegida = Number($celda.dataset.i);
      pintar();
    });
    $teclas.addEventListener("click", (e) => {
      const $tecla = e.target.closest(".tecla");
      if (!$tecla) return;
      if ("notas" in $tecla.dataset) {
        conNotas = !conNotas;
        pintar();
      } else poner(Number($tecla.dataset.n));
    });
    $("sudoku-niveles").addEventListener("click", (e) => {
      const $nivel = e.target.closest("button");
      if (!$nivel) return;
      estado.nivel = $nivel.dataset.nivel;
      elegida = -1;
      guardar();
      pintar();
    });
    const alTeclear = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || document.body.classList.contains("menu-abierto")) return;
      const paso = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (/^[1-9]$/.test(e.key)) poner(Number(e.key));
      else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") poner(0);
      else if (e.key.toLowerCase() === "n") {
        conNotas = !conNotas;
        pintar();
      } else if (paso) {
        const destino = elegida < 0 ? 40 : elegida + paso;
        const mismaFila = Math.abs(paso) !== 1 || ((destino / 9) | 0) === ((elegida / 9) | 0);
        if (destino >= 0 && destino < 81 && (elegida < 0 || mismaFila)) elegida = destino;
        pintar();
      } else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", alTeclear);
    // El reloj solo corre con la pestaña a la vista y el sudoku sin terminar.
    const tictac = setInterval(() => {
      const p = partida();
      if (p.hecho || document.visibilityState !== "visible") return;
      p.seg++;
      $("sudoku-reloj").textContent = reloj(p.seg);
      if (p.seg % 5 === 0) guardar();
    }, 1000);
    limpiarVista = () => {
      clearInterval(tictac);
      document.removeEventListener("keydown", alTeclear);
      guardar();
    };

    pintar();
    if (Object.values(estado.partidas).some((p) => p.hecho)) registrarJuego("sudoku", hoy);
  }

  // La lupa de la cabecera abre la Biblioteca con el cursor ya en el buscador.
  let enfocarBusqueda = false;
  $("ir-buscar").addEventListener("click", () => {
    const $buscar = $("biblio-buscar");
    if ($buscar) $buscar.focus();
    else enfocarBusqueda = true;
  });

  // ---------- Modo oscuro ----------

  // Sin elección guardada se sigue al sistema; el botón del menú fija claro u oscuro.
  const esOscuro = () => {
    const t = document.documentElement.dataset.tema;
    return t ? t === "oscuro" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  };
  function pintarTema() {
    $("tema").textContent = esOscuro() ? "Modo claro" : "Modo oscuro";
    $("color-tema").content = esOscuro() ? "#141414" : "#FFFFFF";
  }
  $("tema").addEventListener("click", () => {
    const nuevo = esOscuro() ? "claro" : "oscuro";
    document.documentElement.dataset.tema = nuevo;
    try {
      localStorage.setItem("sophy-tema", nuevo);
    } catch {}
    pintarTema();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", pintarTema);
  pintarTema();

  // ---------- Ampliar las imágenes de los artículos ----------

  // Al pulsar la imagen de una pieza abierta (no las miniaturas de los listados), se ve a pantalla completa.
  let cerrarVisor = null;
  $vista.addEventListener("click", (e) => {
    const $img = e.target.closest(".articulo figure img");
    if (!$img) return;
    const $pie = $img.closest("figure").querySelector("figcaption");
    const $visor = document.createElement("div");
    $visor.className = "visor";
    $visor.setAttribute("role", "dialog");
    $visor.setAttribute("aria-label", "Imagen ampliada");
    $visor.innerHTML = `<button type="button" class="visor-cerrar" aria-label="Cerrar">×</button>
      <img src="${esc($img.dataset.grande || $img.currentSrc || $img.src)}" alt="${esc($img.alt)}">
      ${$pie ? `<p>${esc($pie.textContent)}</p>` : ""}`;
    const alTeclear = (ev) => {
      if (ev.key === "Escape") cerrarVisor();
    };
    cerrarVisor = () => {
      $visor.remove();
      document.body.classList.remove("con-visor");
      document.removeEventListener("keydown", alTeclear);
      cerrarVisor = null;
    };
    $visor.addEventListener("click", () => cerrarVisor());
    document.addEventListener("keydown", alTeclear);
    document.body.classList.add("con-visor");
    document.body.append($visor);
    $visor.querySelector(".visor-cerrar").focus();
  });

  // ---------- Adivina el país ----------

  // País del día: se reconoce por su silueta; cada intento fallido dice a qué distancia y en qué dirección está.
  // Se elige por la fecha de una lista barajada con semilla fija, así que todos ven el mismo y no gasta tokens.
  const PAIS = {
    inicio: "2026-10-14",
    intentos: 6,
    clave: "sophy-pais",
    // Territorios y casos discutidos que no se proponen como respuesta (sí se aceptan como intento).
    excluidos: new Set(["TWN", "SOL", "SAH", "GRL", "NCL"]),
    datos: null,
  };

  const poligonos = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
  function cajaAnillo(anillo) {
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    for (const [x, y] of anillo) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return { x0, x1, y0, y1 };
  }
  const areaCaja = (c) => (c.x1 - c.x0) * (c.y1 - c.y0);

  // Polígono principal de un país (el de caja más grande) y su centro, para medir distancias.
  function principal(f) {
    let mejor = null;
    for (const p of poligonos(f)) {
      const caja = cajaAnillo(p[0]);
      if (!mejor || areaCaja(caja) > areaCaja(mejor.caja)) mejor = { p, caja };
    }
    return mejor;
  }
  const centroPais = (f) => {
    const { caja } = principal(f);
    return { lat: (caja.y0 + caja.y1) / 2, lng: (caja.x0 + caja.x1) / 2 };
  };

  // Silueta: el polígono principal y los cercanos (islas próximas); las colonias lejanas se dejan fuera.
  function siluetaSvg(f) {
    const { caja } = principal(f);
    const margen = Math.max(caja.x1 - caja.x0, caja.y1 - caja.y0) * 0.6;
    const elegidos = poligonos(f).filter((p) => {
      const c = cajaAnillo(p[0]);
      return c.x1 >= caja.x0 - margen && c.x0 <= caja.x1 + margen && c.y1 >= caja.y0 - margen && c.y0 <= caja.y1 + margen;
    });
    let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
    for (const p of elegidos) {
      const c = cajaAnillo(p[0]);
      x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1); y0 = Math.min(y0, c.y0); y1 = Math.max(y1, c.y1);
    }
    const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180); // las longitudes se acortan lejos del ecuador
    const ancho = (x1 - x0) * k;
    const alto = y1 - y0;
    const pad = Math.max(ancho, alto) * 0.08;
    const d = elegidos
      .map((p) => p.map((a) => `M${a.map(([x, y]) => `${((x - x0) * k).toFixed(3)},${(y1 - y).toFixed(3)}`).join("L")}Z`).join(""))
      .join("");
    return `<svg viewBox="${-pad} ${-pad} ${ancho + 2 * pad} ${alto + 2 * pad}" role="img" aria-label="Silueta del país del día" preserveAspectRatio="xMidYMid meet"><path d="${d}" fill-rule="evenodd"/></svg>`;
  }

  function distanciaKm(a, b) {
    const r = (g) => (g * Math.PI) / 180;
    const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function flechaHacia(a, b) {
    const r = (g) => (g * Math.PI) / 180;
    const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
    const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
    const rumbo = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    return ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][Math.round(rumbo / 45) % 8];
  }

  async function vistaPais(tema, vigente) {
    const hoy = fechaLocal();
    $vista.innerHTML = `
      <section class="palabra pais" data-reveal>
        <a class="volver" href="#/seccion/${enc(tema.padre)}">${ICONO.atras} ${esc(nombreTema(tema.padre))}</a>
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        <p class="entradilla">Reconoce el país por su silueta. Tienes seis intentos y cada fallo te dice a qué distancia está y hacia dónde.</p>
        <div id="pais-mapa" class="pais-mapa"></div>
        <ol id="pais-intentos" class="pais-intentos"></ol>
        <form id="pais-form" class="pais-form" autocomplete="off">
          <div class="pais-campo">
            <input class="entrada" id="pais-entrada" placeholder="Escribe un país" aria-label="País" autocapitalize="none" spellcheck="false">
            <ul id="pais-sugerencias" class="pais-sugerencias" hidden></ul>
          </div>
          <button class="boton" id="pais-enviar">Adivinar</button>
        </form>
        <p id="pais-aviso" class="palabra-aviso" role="status"></p>
        <div id="pais-final" class="palabra-final" hidden></div>
        <details class="palabra-reglas">
          <summary>Cómo se juega</summary>
          <p>La silueta es la de un país de hoy. Escribe un país y pulsa Adivinar: si no es el correcto, verás la distancia en kilómetros entre ambos, una flecha que apunta hacia el país buscado y un porcentaje de cercanía.</p>
          <p>La distancia se mide entre los centros de los dos países. Las colonias lejanas no aparecen en la silueta.</p>
        </details>
      </section>`;
    if (!PAIS.datos) {
      try {
        const r = await fetch("contenido/geografia/mundo.json", { cache: "no-cache" });
        if (!r.ok) throw new Error(r.status);
        const { features } = await r.json();
        const todos = features.map((f) => ({ id: f.properties.id, nombre: f.properties.nombre, f, centro: centroPais(f), llano: llano(f.properties.nombre) }));
        const candidatos = todos
          .filter((p) => !PAIS.excluidos.has(p.id) && areaCaja(principal(p.f).caja) >= 3)
          .sort((a, b) => a.id.localeCompare(b.id));
        PAIS.datos = { todos, orden: barajar(candidatos, azar("sophy-pais")) };
      } catch {
        if (vigente()) $("pais-aviso").textContent = "No se ha podido cargar el juego. Recarga la página.";
        return;
      }
    }
    if (!vigente()) return;

    const { todos, orden } = PAIS.datos;
    const numero = Math.round((aFecha(hoy) - aFecha(PAIS.inicio)) / 86400000);
    const solucion = orden[((numero % orden.length) + orden.length) % orden.length];
    const guardado = leerLocal(PAIS.clave, {});
    const intentos = guardado.fecha === hoy && Array.isArray(guardado.intentos) ? guardado.intentos.filter((id) => todos.some((p) => p.id === id)) : [];
    const $entrada = $("pais-entrada");
    const $sug = $("pais-sugerencias");
    const $aviso = $("pais-aviso");
    const ganado = () => intentos.includes(solucion.id);
    const acabado = () => ganado() || intentos.length >= PAIS.intentos;
    const porId = (id) => todos.find((p) => p.id === id);
    const cercania = (km) => Math.max(0, Math.round(100 * (1 - km / 20000)));

    $("pais-mapa").innerHTML = siluetaSvg(solucion.f);

    function pintar() {
      $("pais-intentos").innerHTML = intentos
        .map((id) => {
          const p = porId(id);
          if (id === solucion.id) return `<li class="acierto"><b>${esc(p.nombre)}</b><span>¡Correcto!</span></li>`;
          const km = Math.round(distanciaKm(p.centro, solucion.centro));
          return `<li><b>${esc(p.nombre)}</b><span>${km.toLocaleString("es-ES")} km</span><span class="flecha" aria-label="dirección">${flechaHacia(p.centro, solucion.centro)}</span><span>${cercania(km)} %</span></li>`;
        })
        .join("");
      $("pais-form").hidden = acabado();
      $("pais-final").hidden = !acabado();
      if (!acabado()) return;
      const cuadros = intentos
        .map((id) => (id === solucion.id ? "🟩" : cercania(distanciaKm(porId(id).centro, solucion.centro)) >= 85 ? "🟨" : "⬛"))
        .join("");
      const marcador = `${ganado() ? intentos.length : "X"}/${PAIS.intentos}`;
      $("pais-final").innerHTML = `
        <b class="palabra-resultado">${ganado() ? ["¡Al instante!", "¡Magnífico!", "¡Muy bien!", "¡Bien hecho!", "¡Conseguido!", "¡Por los pelos!"][intentos.length - 1] : "Otra vez será"}</b>
        <p>El país de hoy era <b class="palabra-solucion">${esc(solucion.nombre.toUpperCase())}</b>.</p>
        <button type="button" class="boton" id="pais-compartir">Compartir resultado</button>
        <p class="palabra-manana">Mañana habrá un país nuevo.</p>`;
      $("pais-compartir").addEventListener("click", async (e) => {
        const texto = `Sophy · Adivina el país ${marcador}\n${cuadros}`;
        try {
          if (navigator.share) await navigator.share({ text: texto });
          else {
            await navigator.clipboard.writeText(texto);
            e.target.textContent = "Copiado";
          }
        } catch {}
      });
    }

    function sugerir() {
      const q = llano($entrada.value.trim());
      const lista = q ? todos.filter((p) => p.llano.includes(q) && !intentos.includes(p.id)).sort((a, b) => a.llano.indexOf(q) - b.llano.indexOf(q) || a.llano.localeCompare(b.llano)).slice(0, 6) : [];
      $sug.hidden = !lista.length;
      $sug.innerHTML = lista.map((p) => `<li><button type="button" data-id="${p.id}">${esc(p.nombre)}</button></li>`).join("");
    }

    function adivinar(p) {
      intentos.push(p.id);
      guardarLocal(PAIS.clave, { fecha: hoy, intentos });
      $entrada.value = "";
      $sug.hidden = true;
      $aviso.textContent = "";
      pintar();
      if (acabado()) registrarJuego("adivina-pais", hoy);
    }

    $entrada.addEventListener("input", sugerir);
    $sug.addEventListener("click", (e) => {
      const $b = e.target.closest("button");
      if ($b) adivinar(porId($b.dataset.id));
    });
    $("pais-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (acabado()) return;
      const q = llano($entrada.value.trim());
      const p = todos.find((x) => x.llano === q) || (() => {
        const parecidos = todos.filter((x) => x.llano.includes(q) && !intentos.includes(x.id));
        return q && parecidos.length === 1 ? parecidos[0] : null;
      })();
      if (!p) return ($aviso.textContent = "Elige un país de la lista de sugerencias.");
      if (intentos.includes(p.id)) return ($aviso.textContent = "Ya lo has probado.");
      adivinar(p);
    });
    pintar();
    if (acabado()) registrarJuego("adivina-pais", hoy);
  }

  // ---------- Navegación y arranque ----------

  async function navegar() {
    const yo = ++turno;
    const vigente = () => yo === turno;
    if (limpiarVista) limpiarVista();
    limpiarVista = null;
    if (cerrarVisor) cerrarVisor();
    leyendo = false;
    abrirMenu(false);

    const dentro = !remoto || Boolean(usuario);
    document.body.classList.toggle("sin-sesion", !dentro);

    $vista.classList.remove("entrando");
    if ($vista.childElementCount) {
      $vista.classList.add("saliendo");
      await espera(sinMovimiento ? 0 : 180);
      if (!vigente()) return;
    }

    const [, ruta, a, b] = location.hash.split("/").map(decodeURIComponent);
    if (ruta === "terminos") vistaTerminos();
    else if (!dentro) vistaAcceso();
    else if (ruta === "seccion" && a) vistaSeccion(a, vigente);
    else if (ruta === "leer" && a && b) await vistaLeer(a, b, vigente);
    else if (ruta === "biblioteca") vistaBiblioteca(a);
    else if (ruta === "guardados") vistaGuardados();
    else if (ruta === "historial") vistaHistorial();
    else if (ruta === "usuario") vistaUsuario();
    else if (ruta === "friends") vistaFriends(vigente);
    else if (ruta === "about") vistaAbout();
    else vistaInicio();
    if (!vigente()) return;

    window.scrollTo(0, 0);
    $vista.classList.remove("saliendo");
    void $vista.offsetWidth;
    $vista.classList.add("entrando");
    activarApariciones();
    alDesplazar();
  }

  async function abrirSesion() {
    try {
      const [datos, respuesta, votos, pendientes, guardadas] = await Promise.all([
        almacen.cargar(),
        remoto ? sb.rpc("mi_perfil") : null,
        remoto ? sb.from("valoraciones").select("fecha,tema,valor") : null,
        remoto ? sb.rpc("solicitudes") : null,
        remoto ? sb.from("guardados").select("fecha,tema,creado") : null,
      ]);
      progreso = datos;
      perfil = respuesta && !respuesta.error ? respuesta.data : null;
      solicitudes = pendientes && !pendientes.error ? pendientes.data : [];
      pintarAvisos();
      if (remoto) {
        valoraciones = votos.error ? null : new Map(votos.data.map((v) => [`${v.fecha}|${v.tema}`, v.valor]));
        // Sin la tabla (todavía no creada), el botón de guardar se oculta.
        marcadores = guardadas.error ? null : new Map(guardadas.data.map((g) => [`${g.fecha}|${g.tema}`, g.creado]));
      } else {
        try {
          marcadores = new Map(Object.entries(JSON.parse(localStorage.getItem(CLAVE_GUARDADOS)) || {}));
        } catch {
          marcadores = new Map();
        }
        let guardados = {};
        try {
          guardados = JSON.parse(localStorage.getItem(CLAVE_VOTOS)) || {};
        } catch {}
        valoraciones = new Map(Object.entries(guardados));
      }
    } catch {
      $vista.innerHTML = '<p class="error">No se ha podido cargar tu progreso. Recarga la página.</p>';
      return;
    }
    pintarRacha();
    navegar();
    let aceptados = "";
    try {
      aceptados = localStorage.getItem(CLAVE_AVISOS);
    } catch {}
    if (aceptados === "si") suscribirAvisos().catch(() => {});
  }

  async function iniciar() {
    try {
      const r = await fetch("contenido/indice.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      indice = await r.json();
    } catch {
      $vista.innerHTML = '<p class="error">No se ha podido cargar el contenido. Recarga la página.</p>';
      return;
    }
    window.addEventListener("hashchange", navegar);

    if (!remoto) return abrirSesion();

    $("salir").addEventListener("click", () => sb.auth.signOut());
    sb.auth.onAuthStateChange((_evento, sesion) => {
      const nuevo = sesion ? sesion.user : null;
      if ((nuevo && nuevo.id) === (usuario && usuario.id) && (usuario || $("acceso"))) return;
      usuario = nuevo;
      perfil = null;
      $("salir").hidden = !usuario;
      $("menu-correo").textContent = usuario ? usuario.email : "";
      // Fuera del callback: supabase-js se bloquea si se le llama desde dentro.
      setTimeout(() => (usuario ? abrirSesion() : navegar()), 0);
    });
  }

  iniciar();
})();
