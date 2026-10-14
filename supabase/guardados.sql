-- Piezas guardadas para leer más tarde.
-- Ejecutar una vez en Supabase: SQL Editor > New query > Run. Se puede volver a ejecutar.
-- No toca ninguna tabla existente. Hasta que se ejecute, la web oculta el botón de guardar.

create table if not exists public.guardados (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha   date not null,               -- edición de la pieza
  tema    text not null,               -- sección de la pieza
  creado  timestamptz not null default now(),
  primary key (user_id, fecha, tema)
);

alter table public.guardados enable row level security;

-- Cada usuario ve, añade y quita solo lo suyo.
drop policy if exists "mis guardados" on public.guardados;
create policy "mis guardados" on public.guardados
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Para consultarlo desde el panel con el correo (esquema privado, ver correos.sql).
create schema if not exists privado;
create or replace view privado.guardados as
select u.email as correo, g.fecha, g.tema, g.creado
from public.guardados g join auth.users u on u.id = g.user_id
order by g.creado desc;
revoke all on privado.guardados from public, anon, authenticated;
