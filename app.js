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
    gusta: svg('<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>'),
    noGusta: svg('<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>'),
  };

  // El progreso se guarda en Supabase o, sin configurar, en este navegador.
  const CLAVE_LOCAL = "aprendizaje.progreso";
  const CLAVE_VOTOS = "aprendizaje.votos";
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

  let cerrarDesplegable = false; // tras elegir una opción, el desplegable se cierra hasta que el ratón salga

  function pintarSecciones(activa) {
    const raiz = temaDe(activa).padre || activa;
    $secciones.innerHTML = indice.temas
      .map((t) => {
        const enlace = `<a class="sec${t.id === raiz ? " activa" : ""}" href="#/seccion/${enc(t.id)}"${t.id === raiz ? ' aria-current="page"' : ""}>${esc(t.nombre)}</a>`;
        if (!t.subsecciones) return enlace;
        // Panel a todo el ancho con las subsecciones y el último titular de cada una.
        const opciones = t.subsecciones
          .map((sub, i) => {
            const ultima = recientes(indice.entradas.filter((e) => e.tema === sub.id))[0];
            return `<a class="opcion${sub.id === activa ? " actual" : ""}" style="--i:${i}" href="#/seccion/${enc(sub.id)}">
              <span class="opcion-nombre">${esc(sub.nombre)}</span>
              <span class="opcion-titular">${ultima ? esc(ultima.titulo) : "Próximamente"}</span>
            </a>`;
          })
          .join("");
        return `<div class="seccion-grupo${cerrarDesplegable ? " cerrado" : ""}">${enlace}
          <div class="desplegable"><div class="desplegable-dentro">
            <div class="desplegable-intro">
              <span class="antetitulo">Sección</span>
              <span class="desplegable-titulo">${esc(t.nombre)}</span>
              <a class="desplegable-todo" href="#/seccion/${enc(t.id)}">Ver todo</a>
            </div>
            <div class="desplegable-opciones">${opciones}</div>
          </div></div>
        </div>`;
      })
      .join("");
    cerrarDesplegable = false;
    for (const grupo of $secciones.querySelectorAll(".seccion-grupo")) {
      grupo.addEventListener("pointerleave", () => grupo.classList.remove("cerrado"));
    }
    const actual = $secciones.querySelector(".activa");
    if (actual) actual.scrollIntoView({ block: "nearest", inline: "center" });
    // Biblioteca, en el menú lateral: las mismas subsecciones, agrupadas por sección.
    $("menu-biblioteca").innerHTML = indice.temas
      .filter((t) => t.subsecciones)
      .map(
        (t) => `<div class="menu-sub-grupo"><span class="antetitulo">${esc(t.nombre)}</span>
          ${t.subsecciones.map((sub) => `<a href="#/biblioteca/${enc(sub.id)}">${esc(sub.nombre)}</a>`).join("")}</div>`
      )
      .join("");
    for (const enlace of $menu.querySelectorAll(".menu-enlaces a")) {
      enlace.classList.toggle("activa", enlace.getAttribute("href") === `#/${activa}`);
    }
  }

  $secciones.addEventListener("click", (e) => {
    if (!e.target.closest(".seccion-grupo a")) return;
    cerrarDesplegable = true;
    if (document.activeElement) document.activeElement.blur();
  });

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

  function pieza(e, i, destacada) {
    const clases = ["pieza", destacada ? "destacada" : "", e.imagen ? "" : "sin-imagen"].join(" ");
    return `<li data-reveal style="--i:${Math.min(i, 6)}"${destacada ? ' class="ancha"' : ""}>
      <a class="${clases}" href="#/leer/${e.fecha}/${enc(e.tema)}">
        ${e.imagen ? `<span class="pieza-foto"><img src="${esc(e.imagen)}" alt="" loading="lazy"></span>` : ""}
        <span class="pieza-texto">
          <span class="antetitulo">${esc(nombreTema(e.tema))}</span>
          <span class="pieza-titulo">${esc(e.titulo)}</span>
          ${e.resumen ? `<span class="pieza-resumen">${esc(e.resumen)}</span>` : ""}
          <span class="pieza-meta">
            <span>${esc(fechaLarga(e.fecha))}</span>
            ${estaHecha(e) ? `<span class="hecha">${ICONO.hecho} Completada</span>` : ""}
          </span>
        </span>
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
        <nav class="subsecciones" aria-label="Secciones de ${esc(tema.nombre)}" data-reveal>
          ${tema.subsecciones.map((sub) => `<a href="#/seccion/${enc(sub.id)}">${esc(sub.nombre)}</a>`).join("")}
        </nav>
        ${listado || `<div style="margin-top:44px">${vacio("Próximamente", "Aquí aparecerá el contenido de esta sección, día a día.")}</div>`}`;
      return;
    }

    const entradas = recientes(indice.entradas.filter((e) => e.tema === id));
    const hechas = entradas.filter(estaHecha).length;
    const resumen = !entradas.length
      ? "Esta sección todavía está en preparación."
      : `Has completado ${hechas} de ${plural(entradas.length, "edición", "ediciones")}.`;
    $vista.innerHTML = `
      <section data-reveal>
        ${
          tema.padre
            ? `<a class="volver" href="#/seccion/${enc(tema.padre)}">${ICONO.atras} ${esc(nombreTema(tema.padre))}</a>`
            : '<span class="antetitulo">Sección</span>'
        }
        <h1 class="titular-xl">${esc(tema.nombre)}</h1>
        <p class="entradilla">${esc(resumen)}</p>
      </section>
      <h2 class="rotulo">Biblioteca</h2>
      ${entradas.length ? piezas(entradas, true) : vacio("Próximamente", "Aquí aparecerá el contenido de esta sección, día a día.")}`;
  }

  // ---------- Geografía: globo 3D y país del día ----------

  const GLOBO_URL = "https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js";
  const geo = { paises: null, mapa: null }; // se cargan una vez por sesión

  const cargarScript = (src) =>
    new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = mal;
      document.head.append(s);
    });

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
        $("geo-resumen").textContent = `${hechos.size} de ${plural(paises.length, "país completado", "países completados")}.`;
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
        } else if (enCabecera && (nodo.tagName === "H2" || esData)) {
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
      <div class="lectura">
        <a class="volver" href="#/seccion/${enc(tema)}">${ICONO.atras} ${esc(nombreTema(tema))}</a>
        <p class="lectura-fecha">${esc(fechaLarga(fecha))}</p>
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
        <h1 class="titular-xl">Términos y condiciones</h1>
        <p class="entradilla">Los términos y condiciones del servicio todavía no están publicados. Aparecerán en esta página.</p>
      </section>`;
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
          <span>Acepto los <a href="#/terminos">términos y condiciones del servicio</a></span></label>
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
    const grupos = indice.temas.filter((t) => t.subsecciones);
    const ids = grupos.flatMap((t) => t.subsecciones.map((sub) => sub.id));
    const seccion = ids.includes(id) ? id : "";
    const todas = indice.entradas.filter((e) => (seccion ? e.tema === seccion : ids.includes(e.tema)));
    const fechas = todas.map((e) => e.fecha).sort();

    $vista.innerHTML = `
      <section class="biblio-cabecera" data-reveal>
        <div>
          ${seccion ? `<a class="volver" href="#/biblioteca">${ICONO.atras} Biblioteca</a>` : `<span class="antetitulo">Todo lo publicado</span>`}
          <h1 class="titular-xl">${esc(seccion ? nombreTema(seccion) : "Biblioteca")}</h1>
        </div>
        <form class="biblio-filtros" id="biblio-filtros" role="search">
          <input class="entrada" id="biblio-buscar" type="search" placeholder="Buscar por palabras" aria-label="Buscar por palabras" autocomplete="off">
          <select class="entrada" id="biblio-orden" aria-label="Orden por fecha">
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguos primero</option>
          </select>
          <input class="entrada" id="biblio-fecha" type="date" aria-label="Ver solo una fecha"${fechas.length ? ` min="${fechas[0]}" max="${fechas[fechas.length - 1]}"` : ""}>
          <button class="boton pequeno linea" id="biblio-limpiar" type="reset" hidden>Quitar filtros</button>
        </form>
      </section>
      <nav class="subsecciones visibles" aria-label="Secciones de la biblioteca" data-reveal>
        <a href="#/biblioteca"${seccion ? "" : ' class="actual"'}>Todas</a>
        ${grupos
          .flatMap((t) => t.subsecciones)
          .map((sub) => `<a href="#/biblioteca/${enc(sub.id)}"${sub.id === seccion ? ' class="actual"' : ""}>${esc(sub.nombre)}</a>`)
          .join("")}
      </nav>
      <p class="biblio-cuenta" id="biblio-cuenta" role="status"></p>
      <div id="biblio-lista"></div>`;

    const $buscar = $("biblio-buscar");
    const $orden = $("biblio-orden");
    const $fecha = $("biblio-fecha");

    function pintar() {
      const palabras = llano($buscar.value).split(/\s+/).filter(Boolean);
      const signo = $orden.value === "asc" ? 1 : -1;
      const orden = ids;
      const lista = todas
        .filter((e) => !$fecha.value || e.fecha === $fecha.value)
        .filter((e) => {
          const texto = llano(`${e.titulo} ${e.resumen || ""} ${nombreTema(e.tema)}`);
          return palabras.every((p) => texto.includes(p));
        })
        .sort((x, y) => signo * x.fecha.localeCompare(y.fecha) || orden.indexOf(x.tema) - orden.indexOf(y.tema));
      const filtrando = Boolean(palabras.length || $fecha.value);
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
    $filtros.addEventListener("reset", () => setTimeout(pintar));
    pintar();
  }

  // ---------- Navegación y arranque ----------

  async function navegar() {
    const yo = ++turno;
    const vigente = () => yo === turno;
    if (limpiarVista) limpiarVista();
    limpiarVista = null;
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
      const [datos, respuesta, votos, pendientes] = await Promise.all([
        almacen.cargar(),
        remoto ? sb.rpc("mi_perfil") : null,
        remoto ? sb.from("valoraciones").select("fecha,tema,valor") : null,
        remoto ? sb.rpc("solicitudes") : null,
      ]);
      progreso = datos;
      perfil = respuesta && !respuesta.error ? respuesta.data : null;
      solicitudes = pendientes && !pendientes.error ? pendientes.data : [];
      pintarAvisos();
      if (remoto) {
        valoraciones = votos.error ? null : new Map(votos.data.map((v) => [`${v.fecha}|${v.tema}`, v.valor]));
      } else {
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
