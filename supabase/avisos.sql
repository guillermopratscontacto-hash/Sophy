-- Recordatorio de racha a las 20:00 (hora de Madrid).
-- Ejecutar una vez en Supabase: SQL Editor > New query > Run.
-- Antes hay que haber creado la función (código en supabase/functions/recordatorio/index.ts).
-- En este proyecto su dirección es «hyper-api»: Supabase la asignó al crearla.

-- Dispositivos que han activado los avisos. Cada fila es un móvil u ordenador.
create table if not exists public.avisos (
  endpoint     text primary key,       -- dirección del dispositivo que da el navegador
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh       text not null,
  auth         text not null,
  ultimo_aviso date,                   -- último día en que se le envió el recordatorio
  creado       timestamptz not null default now()
);

alter table public.avisos enable row level security;

-- Cada usuario solo ve y gestiona sus propios dispositivos.
drop policy if exists "leer lo propio" on public.avisos;
drop policy if exists "guardar lo propio" on public.avisos;
drop policy if exists "cambiar lo propio" on public.avisos;
drop policy if exists "borrar lo propio" on public.avisos;
create policy "leer lo propio" on public.avisos for select using (auth.uid() = user_id);
create policy "guardar lo propio" on public.avisos for insert with check (auth.uid() = user_id);
create policy "cambiar lo propio" on public.avisos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "borrar lo propio" on public.avisos for delete using (auth.uid() = user_id);

-- Días en que un usuario completó algo. Solo la usa la función «recordatorio» para calcular la racha.
create or replace function public.dias_completados(uid uuid)
returns setof date
language sql
security definer
set search_path = public
as $$
  select distinct dia from public.progreso where user_id = uid order by dia desc limit 2000;
$$;
revoke all on function public.dias_completados(uuid) from public, anon, authenticated;
grant execute on function public.dias_completados(uuid) to service_role;

-- El reloj: Supabase llama a la función cada día a las 18:00 y a las 19:00 UTC.
-- Una de las dos es siempre las 20:00 en Madrid (según sea horario de verano o de invierno);
-- la función comprueba la hora y solo envía en la que toca.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sophy-recordatorio-verano', '0 18 * * *',
  $$ select net.http_post(
       url := 'https://mgqryktywqdlifdksxjv.supabase.co/functions/v1/hyper-api',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
select cron.schedule(
  'sophy-recordatorio-invierno', '0 19 * * *',
  $$ select net.http_post(
       url := 'https://mgqryktywqdlifdksxjv.supabase.co/functions/v1/hyper-api',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
