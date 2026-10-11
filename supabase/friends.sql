-- Perfiles (código de usuario) y Friends.
-- Ejecutar una vez en Supabase: SQL Editor > New query > Run.

create table if not exists public.perfiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  codigo  text not null unique,        -- código público, se muestra como #CODIGO
  nombre  text,
  creado  timestamptz not null default now()
);

alter table public.perfiles enable row level security;

-- Cada usuario solo lee su perfil; los cambios pasan por las funciones de abajo.
drop policy if exists "leer mi perfil" on public.perfiles;
create policy "leer mi perfil" on public.perfiles
  for select using (auth.uid() = user_id);

create table if not exists public.amigos (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amigo_id uuid not null references auth.users (id) on delete cascade,
  creado   timestamptz not null default now(),
  primary key (user_id, amigo_id)
);

alter table public.amigos enable row level security;

drop policy if exists "leer mis amigos" on public.amigos;
create policy "leer mis amigos" on public.amigos
  for select using (auth.uid() = user_id);

drop policy if exists "quitar mis amigos" on public.amigos;
create policy "quitar mis amigos" on public.amigos
  for delete using (auth.uid() = user_id);

-- Devuelve el perfil propio y lo crea, con un código nuevo, si aún no existe.
create or replace function public.mi_perfil()
returns public.perfiles
language plpgsql security definer set search_path = public
as $$
declare
  p public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'sin sesion';
  end if;
  loop
    select * into p from perfiles where user_id = auth.uid();
    if found then
      return p;
    end if;
    begin
      insert into perfiles (user_id, codigo)
      values (auth.uid(), upper(substr(md5(gen_random_uuid()::text), 1, 8)))
      returning * into p;
      return p;
    exception when unique_violation then
      null; -- código repetido o perfil creado a la vez en otra pestaña: se reintenta
    end;
  end loop;
end;
$$;

create or replace function public.cambiar_nombre(nuevo text)
returns void
language sql security definer set search_path = public
as $$
  update perfiles set nombre = nullif(left(trim(nuevo), 40), '') where user_id = auth.uid();
$$;

-- Añade a un amigo por su código. Devuelve 'ok', 'no_existe' o 'eres_tu'.
create or replace function public.agregar_amigo(codigo_amigo text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  destino uuid;
begin
  if auth.uid() is null then
    raise exception 'sin sesion';
  end if;
  select user_id into destino from perfiles
  where codigo = upper(replace(trim(codigo_amigo), '#', ''));
  if destino is null then
    return 'no_existe';
  end if;
  if destino = auth.uid() then
    return 'eres_tu';
  end if;
  insert into amigos (user_id, amigo_id) values (auth.uid(), destino) on conflict do nothing;
  return 'ok';
end;
$$;

-- Días completados de cada amigo. Quien conoce tu código puede ver qué días
-- has completado algo, pero no qué secciones ni tu correo.
create or replace function public.progreso_amigos()
returns table (amigo_id uuid, codigo text, nombre text, dias date[])
language sql stable security definer set search_path = public
as $$
  select a.amigo_id, p.codigo, p.nombre,
         coalesce((select array_agg(distinct g.dia) from progreso g where g.user_id = a.amigo_id), '{}')
  from amigos a
  join perfiles p on p.user_id = a.amigo_id
  where a.user_id = auth.uid()
  order by a.creado;
$$;

revoke all on function public.mi_perfil(), public.cambiar_nombre(text),
  public.agregar_amigo(text), public.progreso_amigos() from public, anon;
grant execute on function public.mi_perfil(), public.cambiar_nombre(text),
  public.agregar_amigo(text), public.progreso_amigos() to authenticated;
