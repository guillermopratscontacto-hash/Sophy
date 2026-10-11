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
  let limpiarVista = null;
  let turno = 0; // identifica la navegación en curso
  let leyendo = false;

  const svg = (trazo) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazo}</svg>`;
  const ICONO = {
    llama: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    hecho: svg('<path d="M20 6 9 17l-5-5"/>'),
    atras: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  };

  // El progreso se guarda en Supabase o, sin configurar, en este navegador.
  const CLAVE_LOCAL = "aprendizaje.progreso";
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

  const nombreTema = (id) => (indice.temas.find((t) => t.id === id) || { nombre: id }).nombre;
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
    $secciones.innerHTML = indice.temas
      .map((t) => `<a href="#/seccion/${enc(t.id)}"${t.id === activa ? ' class="activa" aria-current="page"' : ""}>${esc(t.nombre)}</a>`)
      .join("");
    const actual = $secciones.querySelector(".activa");
    if (actual) actual.scrollIntoView({ block: "nearest", inline: "center" });
    for (const a of $menu.querySelectorAll(".menu-enlaces a")) {
      a.classList.toggle("activa", a.getAttribute("href") === `#/${activa}`);
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
    const edicion = todas.filter((e) => e.fecha === ultima);
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

  function vistaSeccion(id) {
    pintarSecciones(id);
    const entradas = recientes(indice.entradas.filter((e) => e.tema === id));
    const hechas = entradas.filter(estaHecha).length;
    $vista.innerHTML = `
      <section data-reveal>
        <span class="antetitulo">Sección</span>
        <h1 class="titular-xl">${esc(nombreTema(id))}</h1>
        <p class="entradilla">${
          entradas.length ? `${hechas} de ${plural(entradas.length, "edición completada", "ediciones completadas")}.` : "Esta sección todavía está en preparación."
        }</p>
      </section>
      <h2 class="rotulo">Biblioteca</h2>
      ${entradas.length ? piezas(entradas, true) : vacio("Próximamente", "Aquí aparecerá el contenido de esta sección, día a día.")}`;
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
        <h1 class="titular">${esc(entrada.titulo)}</h1>
        <p class="lectura-fecha">${esc(fechaLarga(fecha))}</p>
        <article class="articulo">${window.marked.parse(texto)}</article>
        <div id="fin" class="fin"></div>
      </div>`;
    leyendo = true;

    const $fin = $("fin");
    const marcarHecha = () => {
      $fin.classList.add("hecho");
      $fin.innerHTML = `${ICONO.hecho} Sección completada`;
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
      <p style="margin-top:32px"><button class="boton linea" id="salir-cuenta">Cerrar sesión</button></p>`;

    activarCopia();
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

  async function vistaFriends(vigente) {
    pintarSecciones("friends");
    const cabecera = `
      <section data-reveal>
        <span class="antetitulo">Aprender acompañado</span>
        <h1 class="titular-xl">Friends</h1>
        <p class="entradilla">Añade a otras personas con su código de usuario y sigue su constancia día a día.</p>
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
        <p class="nota" style="margin:14px 0 0">Compártelo con quien quieras. Quien lo tenga podrá ver qué días has completado algo, pero no tu correo ni qué has leído.</p>
      </div>
      <h2 class="rotulo">Añadir a alguien</h2>
      <form class="fila" id="form-amigo" data-reveal>
        <input class="entrada" id="codigo-amigo" placeholder="#CÓDIGO" maxlength="12" autocapitalize="characters" autocomplete="off" required aria-label="Código de usuario">
        <button class="boton">Añadir</button>
      </form>
      <p class="nota" id="amigo-msg" role="status"></p>
      <h2 class="rotulo">Siguiendo</h2>
      <div id="lista-amigos"><p class="nota">Cargando…</p></div>`;
    activarCopia();

    const hoy = fechaLocal();
    const ultimos7 = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, i - 6));

    async function pintarAmigos() {
      const { data, error } = await sb.rpc("progreso_amigos");
      const $lista = $("lista-amigos");
      if (!vigente() || !$lista) return;
      if (error) {
        $lista.innerHTML = '<p class="error">No se ha podido cargar la lista.</p>';
        return;
      }
      if (!data.length) {
        $lista.innerHTML = vacio("Aún no sigues a nadie", "Pide su código a alguien y añádelo arriba.");
        $lista.firstElementChild.classList.add("visto");
        return;
      }
      $lista.innerHTML = `<ul class="amigos">${data
        .map((a) => {
          const dias = new Set(a.dias);
          const n = calcularRacha(dias, hoy);
          const titulo = a.nombre || `#${a.codigo}`;
          return `<li class="amigo">
            <span class="amigo-inicial">${esc(titulo.replace("#", "").charAt(0).toUpperCase())}</span>
            <span class="amigo-datos"><b>${esc(titulo)}</b><span>#${esc(a.codigo)} · ${plural(dias.size, "día activo", "días activos")}</span></span>
            <span class="semana" title="Últimos 7 días">${ultimos7.map((d) => `<i${dias.has(d) ? ' class="hecho"' : ""}></i>`).join("")}</span>
            <span class="amigo-racha${dias.has(hoy) ? " encendida" : ""}" title="Racha">${ICONO.llama}${n}</span>
            <button class="quitar" data-id="${esc(a.amigo_id)}">Quitar</button>
          </li>`;
        })
        .join("")}</ul>`;
    }

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
        $msg.textContent = "No se ha podido añadir. Inténtalo de nuevo.";
      } else if (data === "no_existe") {
        $msg.className = "error";
        $msg.textContent = "No hay ningún usuario con ese código.";
      } else if (data === "eres_tu") {
        $msg.textContent = "Ese es tu propio código.";
      } else {
        $msg.textContent = "Añadido.";
        $campo.value = "";
        pintarAmigos();
      }
    });

    $("lista-amigos").addEventListener("click", async (e) => {
      const $quitar = e.target.closest(".quitar");
      if (!$quitar) return;
      $quitar.disabled = true;
      await sb.from("amigos").delete().eq("amigo_id", $quitar.dataset.id);
      if (vigente()) pintarAmigos();
    });

    pintarAmigos();
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
    if (!dentro) vistaAcceso();
    else if (ruta === "seccion" && a) vistaSeccion(a);
    else if (ruta === "leer" && a && b) await vistaLeer(a, b, vigente);
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
      const [datos, respuesta] = await Promise.all([almacen.cargar(), remoto ? sb.rpc("mi_perfil") : null]);
      progreso = datos;
      perfil = respuesta && !respuesta.error ? respuesta.data : null;
    } catch {
      $vista.innerHTML = '<p class="error">No se ha podido cargar tu progreso. Recarga la página.</p>';
      return;
    }
    pintarRacha();
    navegar();
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
