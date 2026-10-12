// Datos del proyecto de Supabase (Project Settings > API).
// La clave "anon" es pública por diseño: lo que protege los datos son las
// políticas de supabase/schema.sql, así que puede estar en el repositorio.
// Con los dos valores vacíos la web funciona en modo local, guardando el
// progreso solo en este navegador.
window.CONFIG = {
  SUPABASE_URL: "https://mgqryktywqdlifdksxjv.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_hAPFgnZiCJ0lg3nDLX0CLg_UYwY3N21",
  // Clave pública de los avisos (recordatorio de racha). También es pública por
  // diseño; la privada vive solo en Supabase, como secreto de la función.
  VAPID_PUBLIC_KEY: "BDnCM5f4fvDUvzaIksTS-nB5tHqtnYxg9X_f3tD6xTo0-_yEY6k8IhTfayrQWqdGtdAGLbFByar0HviV-F4VWOs",
};
