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

  const $vista = document.getElementById("vista");
  const $pestanas = document.getElementById("pestanas");
  const $racha = document.getElementById("racha");
  const $salir = document.getElementById("salir");

  let indice = { temas: [], entradas: [] };
  let progreso = []; // [{ fecha, tema, dia }]
  let usuario = null;
  let limpiarVista = null;

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

  const fechaLarga = (texto) =>
    aFecha(texto).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const nombreTema = (id) => (indice.temas.find((t) => t.id === id) || { nombre: id }).nombre;
  const estaHecha = (e) => progreso.some((p) => p.fecha === e.fecha && p.tema === e.tema);
  const diasHechos = () => new Set(progreso.map((p) => p.dia));
  const recientes = (entradas) => [...entradas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  // ---------- Piezas comunes ----------

  function pintarRacha() {
    const hoy = fechaLocal();
    const dias = diasHechos();
    $racha.hidden = false;
    $racha.textContent = `🔥 ${calcularRacha(dias, hoy)}`;
    $racha.classList.toggle("apagada", !dias.has(hoy));
    $racha.title = dias.has(hoy) ? "Racha: hoy ya cuenta" : "Racha: completa una sección hoy para mantenerla";
  }

  function pintarPestanas(activa) {
    const enlaces = [
      ["hoy", "#/hoy", "Hoy"],
      ...indice.temas.map((t) => [`tema/${t.id}`, `#/tema/${encodeURIComponent(t.id)}`, t.nombre]),
      ["historial", "#/historial", "Historial"],
    ];
    $pestanas.hidden = false;
    $pestanas.innerHTML = enlaces
      .map(([id, href, texto]) => `<a href="${href}"${id === activa ? ' class="activa"' : ""}>${esc(texto)}</a>`)
      .join("");
    const actual = $pestanas.querySelector(".activa");
    if (actual) actual.scrollIntoView({ block: "nearest", inline: "center" });
  }

  function tarjetas(entradas, conTema) {
    if (!entradas.length) return '<p class="aviso">Todavía no hay nada aquí.</p>';
    return `<ul class="lista">${entradas
      .map((e) => {
        const meta = conTema ? `${nombreTema(e.tema)} · ${fechaLarga(e.fecha)}` : fechaLarga(e.fecha);
        return `<li><a class="tarjeta" href="#/leer/${e.fecha}/${encodeURIComponent(e.tema)}">
          <span class="tarjeta-texto">
            <span class="tarjeta-titulo">${esc(e.titulo)}</span>
            <span class="tarjeta-meta">${esc(meta)}</span>
          </span>
          <span class="marca-hecho${estaHecha(e) ? " si" : ""}">✓</span>
        </a></li>`;
      })
      .join("")}</ul>`;
  }

  const bandaLocal = () =>
    remoto ? "" : '<div class="banda">Modo local: el progreso se guarda solo en este navegador.</div>';

  // ---------- Vistas ----------

  function vistaHoy() {
    pintarPestanas("hoy");
    const todas = recientes(indice.entradas);
    if (!todas.length) {
      $vista.innerHTML = `${bandaLocal()}<h1>Hoy</h1><p class="aviso">Todavía no hay contenido publicado.</p>`;
      return;
    }
    const ultima = todas[0].fecha;
    const deHoy = todas.filter((e) => e.fecha === ultima);
    const pendientes = todas.filter((e) => e.fecha !== ultima && !estaHecha(e)).slice(0, 5);
    const sub = ultima === fechaLocal() ? fechaLarga(ultima) : `Lo último publicado: ${fechaLarga(ultima)}`;
    $vista.innerHTML = `${bandaLocal()}
      <h1>Hoy</h1>
      <p class="sub">${esc(sub)}</p>
      ${tarjetas(deHoy, true)}
      ${pendientes.length ? `<h2>Pendiente de días anteriores</h2>${tarjetas(pendientes, true)}` : ""}`;
  }

  function vistaTema(id) {
    pintarPestanas(`tema/${id}`);
    const entradas = recientes(indice.entradas.filter((e) => e.tema === id));
    const hechas = entradas.filter(estaHecha).length;
    $vista.innerHTML = `
      <h1>${esc(nombreTema(id))}</h1>
      <p class="sub">${hechas} de ${entradas.length} secciones completadas</p>
      ${tarjetas(entradas, false)}`;
  }

  async function vistaLeer(fecha, tema) {
    pintarPestanas(`tema/${tema}`);
    const entrada = indice.entradas.find((e) => e.fecha === fecha && e.tema === tema);
    if (!entrada) {
      $vista.innerHTML = '<p class="aviso">Esta sección no existe.</p>';
      return;
    }
    $vista.innerHTML = '<p class="aviso">Cargando…</p>';
    let texto;
    try {
      const r = await fetch(entrada.archivo, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      texto = await r.text();
    } catch {
      $vista.innerHTML = '<p class="error">No se ha podido cargar esta sección.</p>';
      return;
    }
    if (location.hash !== `#/leer/${fecha}/${encodeURIComponent(tema)}`) return; // se navegó mientras cargaba

    $vista.innerHTML = `
      <a class="volver" href="#/tema/${encodeURIComponent(tema)}">← ${esc(nombreTema(tema))}</a>
      <h1>${esc(entrada.titulo)}</h1>
      <p class="sub">${esc(fechaLarga(fecha))}</p>
      <article class="articulo">${window.marked.parse(texto)}</article>
      <div id="fin" class="fin"></div>`;
    window.scrollTo(0, 0);

    const $fin = document.getElementById("fin");
    const marcarHecha = () => {
      $fin.classList.add("hecho");
      $fin.textContent = "✓ Sección completada";
    };
    if (estaHecha(entrada)) {
      marcarHecha();
      return;
    }
    $fin.textContent = "Fin de la sección";

    let espera = null;
    const observador = new IntersectionObserver(([e]) => {
      clearTimeout(espera);
      if (!e.isIntersecting) return;
      espera = setTimeout(async () => {
        observador.disconnect();
        const registro = { fecha, tema, dia: fechaLocal() };
        progreso.push(registro);
        marcarHecha();
        pintarRacha();
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
      clearTimeout(espera);
      observador.disconnect();
    };
  }

  function vistaHistorial() {
    pintarPestanas("historial");
    const hoy = fechaLocal();
    const dias = diasHechos();

    // Cinco semanas completas, de lunes a domingo, acabando en la actual.
    const lunes = sumarDias(hoy, -((aFecha(hoy).getDay() + 6) % 7));
    const inicio = sumarDias(lunes, -28);
    let celdas = ["L", "M", "X", "J", "V", "S", "D"].map((d) => `<div class="cab">${d}</div>`).join("");
    for (let i = 0; i < 35; i++) {
      const d = sumarDias(inicio, i);
      const clases = ["dia", dias.has(d) ? "hecho" : "", d === hoy ? "hoy" : ""].join(" ");
      celdas += `<div class="${clases}" title="${esc(fechaLarga(d))}">${aFecha(d).getDate()}</div>`;
    }

    const hechas = recientes(indice.entradas.filter(estaHecha));
    $vista.innerHTML = `
      <h1>Historial</h1>
      <p class="sub">Últimas cinco semanas</p>
      <div class="resumen">
        <div class="dato"><b>${calcularRacha(dias, hoy)}</b><span>Racha actual</span></div>
        <div class="dato"><b>${mejorRacha(dias)}</b><span>Mejor racha</span></div>
        <div class="dato"><b>${progreso.length}</b><span>Secciones</span></div>
      </div>
      <div class="calendario">${celdas}</div>
      <h2>Secciones completadas</h2>
      ${tarjetas(hechas, true)}`;
  }

  function vistaAcceso(mensaje = "") {
    $pestanas.hidden = true;
    $racha.hidden = true;
    $salir.hidden = true;
    $vista.innerHTML = `
      <form class="acceso" id="acceso">
        <h1>Entrar</h1>
        <label>Correo <input type="email" name="correo" autocomplete="email" required></label>
        <label>Contraseña <input type="password" name="clave" autocomplete="current-password" minlength="6" required></label>
        <div class="botones">
          <button class="boton" name="entrar">Entrar</button>
          <button class="boton secundario" name="crear" type="button">Crear cuenta</button>
        </div>
        <p id="acceso-msg" class="aviso">${esc(mensaje)}</p>
      </form>`;
    const $form = document.getElementById("acceso");
    const $msg = document.getElementById("acceso-msg");

    const enviar = async (crear) => {
      if (!$form.reportValidity()) return;
      const credenciales = { email: $form.correo.value.trim(), password: $form.clave.value };
      $form.entrar.disabled = $form.crear.disabled = true;
      $msg.className = "aviso";
      $msg.textContent = "Un momento…";
      const { data, error } = crear
        ? await sb.auth.signUp({ ...credenciales, options: { emailRedirectTo: location.origin + location.pathname } })
        : await sb.auth.signInWithPassword(credenciales);
      if (!document.body.contains($form)) return; // la sesión ya ha cambiado de vista
      $form.entrar.disabled = $form.crear.disabled = false;
      if (error) {
        $msg.className = "error";
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

  function navegar() {
    if (limpiarVista) limpiarVista();
    limpiarVista = null;
    if (remoto && !usuario) return vistaAcceso();
    const [, ruta, a, b] = location.hash.split("/").map(decodeURIComponent);
    if (ruta === "tema" && a) return vistaTema(a);
    if (ruta === "leer" && a && b) return vistaLeer(a, b);
    if (ruta === "historial") return vistaHistorial();
    return vistaHoy();
  }

  async function abrirSesion() {
    try {
      progreso = await almacen.cargar();
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
      $vista.innerHTML = '<p class="error">No se ha podido cargar el contenido.</p>';
      return;
    }
    window.addEventListener("hashchange", navegar);

    if (!remoto) return abrirSesion();

    $salir.addEventListener("click", () => sb.auth.signOut());
    sb.auth.onAuthStateChange((_evento, sesion) => {
      const nuevo = sesion ? sesion.user : null;
      if ((nuevo && nuevo.id) === (usuario && usuario.id) && (usuario || document.getElementById("acceso"))) return;
      usuario = nuevo;
      $salir.hidden = !usuario;
      // Fuera del callback: supabase-js se bloquea si se le llama desde dentro.
      setTimeout(() => (usuario ? abrirSesion() : navegar()), 0);
    });
  }

  iniciar();
})();
