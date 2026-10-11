-- Seguimiento de lectura y valoraciones (me gusta / no me gusta).
-- Ejecutar una vez en Supabase: SQL Editor > New query > Run.

-- Una fila la primera vez que un usuario abre una pieza.
create table if not exists public.aperturas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha   date not null,
  tema    text not null,
  creado  timestamptz not null default now(),
  primary key (user_id, fecha, tema)
);

alter table public.aperturas enable row level security;

drop policy if exists "leer mis aperturas" on public.aperturas;
create policy "leer mis aperturas" on public.aperturas
  for select using (auth.uid() = user_id);

drop policy if exists "registrar mis aperturas" on public.aperturas;
create policy "registrar mis aperturas" on public.aperturas
  for insert with check (auth.uid() = user_id);

-- Valoración de cada usuario por pieza: 1 = me gusta, -1 = no me gusta.
create table if not exists public.valoraciones (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha   date not null,
  tema    text not null,
  valor   smallint not null check (valor in (1, -1)),
  creado  timestamptz not null default now(),
  primary key (user_id, fecha, tema)
);

alter table public.valoraciones enable row level security;

drop policy if exists "mis valoraciones" on public.valoraciones;
create policy "mis valoraciones" on public.valoraciones
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Resúmenes para consultar desde el panel de Supabase (Table Editor o SQL Editor).
-- Con security_invoker, desde la web cada usuario solo vería sus propios datos;
-- desde el panel se ven los de todos.
create or replace view public.estadisticas_piezas with (security_invoker = true) as
select x.fecha, x.tema,
  (select count(*) from public.aperturas a where a.fecha = x.fecha and a.tema = x.tema) as aperturas,
  (select count(*) from public.progreso p where p.fecha = x.fecha and p.tema = x.tema) as completadas,
  (select count(*) from public.valoraciones v where v.fecha = x.fecha and v.tema = x.tema and v.valor = 1) as me_gusta,
  (select count(*) from public.valoraciones v where v.fecha = x.fecha and v.tema = x.tema and v.valor = -1) as no_me_gusta
from (
  select fecha, tema from public.aperturas
  union select fecha, tema from public.progreso
  union select fecha, tema from public.valoraciones
) x
order by x.fecha desc, x.tema;

create or replace view public.estadisticas_secciones with (security_invoker = true) as
select tema,
  sum(aperturas) as aperturas,
  sum(completadas) as completadas,
  sum(me_gusta) as me_gusta,
  sum(no_me_gusta) as no_me_gusta
from public.estadisticas_piezas
group by tema
order by aperturas desc;
