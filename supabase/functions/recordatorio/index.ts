// Función de Supabase (Edge Function) «recordatorio».
//
// A las 20:00 de Madrid envía una notificación a quien tiene los avisos activados
// y todavía no ha completado nada hoy: «¡No pierdas tu racha de X días!».
// La llama el reloj de la base de datos (ver supabase/avisos.sql). No usa IA.
//
// También sirve de prueba: si la llama un usuario con la sesión iniciada (botón
// «Enviar aviso de prueba» en la web), le envía su aviso solo a él, a cualquier hora.
//
// Ajustes al crearla en Supabase:
//   - Nombre: recordatorio (en este proyecto su dirección es «hyper-api»)
//   - «Verify JWT» desactivado
//   - Secreto VAPID_PRIVATE_KEY (Edge Functions > Secrets)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Clave pública de los avisos: la misma que hay en config.js. La privada es el secreto.
const VAPID_PUBLICA = "BDnCM5f4fvDUvzaIksTS-nB5tHqtnYxg9X_f3tD6xTo0-_yEY6k8IhTfayrQWqdGtdAGLbFByar0HviV-F4VWOs";
const WEB = "https://guillermopratscontacto-hash.github.io/Sophy/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Fecha (AAAA-MM-DD) y hora actuales en Madrid.
function madrid() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: Number(v("hour")) };
}

const diaAnterior = (fecha: string) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Días seguidos completados hasta ayer.
function rachaHastaAyer(dias: Set<string>, hoy: string) {
  let n = 0;
  for (let d = diaAnterior(hoy); dias.has(d); d = diaAnterior(d)) n++;
  return n;
}

const mensaje = (racha: number) =>
  racha > 0
    ? { titulo: `¡No pierdas tu racha de ${racha} ${racha === 1 ? "día" : "días"}!`, texto: "Completa algo hoy en Sophy para mantenerla." }
    : { titulo: "Empieza hoy tu racha en Sophy", texto: "Completa una pieza y enciende la llama." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const clavePrivada = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!clavePrivada) return responder({ error: "Falta el secreto VAPID_PRIVATE_KEY" }, 500);
  webpush.setVapidDetails(WEB, VAPID_PUBLICA, clavePrivada.trim());

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { fecha: hoy, hora } = madrid();

  // ¿La llama un usuario con sesión? Entonces es una prueba, solo para él.
  let probador: string | null = null;
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (token) {
    const { data } = await admin.auth.getUser(token);
    probador = data?.user?.id ?? null;
  }

  if (!probador && hora !== 20) return responder({ enviados: 0, motivo: "No son las 20:00 en Madrid" });

  let consulta = admin.from("avisos").select("endpoint, user_id, p256dh, auth, ultimo_aviso");
  if (probador) consulta = consulta.eq("user_id", probador);
  const { data: dispositivos, error } = await consulta;
  if (error) return responder({ error: error.message }, 500);

  // En el envío programado, un solo aviso por dispositivo y día.
  const pendientes = (dispositivos || []).filter((d) => probador || d.ultimo_aviso !== hoy);

  const rachas = new Map<string, { hechoHoy: boolean; racha: number }>();
  for (const uid of new Set(pendientes.map((d) => d.user_id))) {
    const { data: filas } = await admin.rpc("dias_completados", { uid });
    const dias = new Set<string>((filas || []).map((f: string) => String(f)));
    rachas.set(uid, { hechoHoy: dias.has(hoy), racha: rachaHastaAyer(dias, hoy) });
  }

  let enviados = 0;
  for (const d of pendientes) {
    const estado = rachas.get(d.user_id)!;
    if (!probador && estado.hechoHoy) continue; // ya ha cumplido hoy: no se le molesta
    try {
      await webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify(mensaje(estado.racha)),
        { TTL: 3 * 60 * 60 } // si el móvil está apagado, deja de intentarlo a las 23:00
      );
      enviados++;
      if (!probador) await admin.from("avisos").update({ ultimo_aviso: hoy }).eq("endpoint", d.endpoint);
    } catch (e) {
      // 404 o 410: el dispositivo ya no acepta avisos (desinstalado o permiso retirado).
      const codigo = (e as { statusCode?: number }).statusCode;
      if (codigo === 404 || codigo === 410) await admin.from("avisos").delete().eq("endpoint", d.endpoint);
    }
  }

  return responder({ enviados, dispositivos: pendientes.length });
});
