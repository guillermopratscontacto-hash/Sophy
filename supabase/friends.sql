-- Perfiles (código de usuario) y Friends con solicitudes de amistad.
-- Ejecutar en Supabase: SQL Editor > New query > Run.
-- Se puede ejecutar aunque ya se hubiera ejecutado la versión anterior.

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

-- Una fila por solicitud: user_id la envía y amigo_id la recibe. Cuando se
-- acepta, la amistad es mutua: los dos ven los días completados del otro.
create table if not exists public.amigos (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amigo_id uuid not null references auth.users (id) on delete cascade,
  creado   timestamptz not null default now(),
  primary key (user_id, amigo_id)
);

alter table public.amigos
  add column if not exists estado text not null default 'pendiente'
  check (estado in ('pendiente', 'aceptada'));

alter table public.amigos enable row level security;

-- Solo lectura de las filas propias; enviar, aceptar y quitar pasan por funciones.
drop policy if exists "leer mis amigos" on public.amigos;
drop policy if exists "quitar mis amigos" on public.amigos;
create policy "leer mis amigos" on public.amigos
  for select using (auth.uid() in (user_id, amigo_id));

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

-- Envía una solicitud de amistad por código. Si esa persona ya me había enviado
-- una a mí, la acepta. Devuelve 'enviada', 'aceptada', 'ya_enviada', 'ya_amigos',
-- 'no_existe' o 'eres_tu'.
create or replace function public.agregar_amigo(codigo_amigo text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  destino uuid;
  actual  text;
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

  select estado into actual from amigos where user_id = auth.uid() and amigo_id = destino;
  if found then
    return case when actual = 'aceptada' then 'ya_amigos' else 'ya_enviada' end;
  end if;

  select estado into actual from amigos where user_id = destino and amigo_id = auth.uid();
  if found then
    if actual = 'aceptada' then
      return 'ya_amigos';
    end if;
    update amigos set estado = 'aceptada' where user_id = destino and amigo_id = auth.uid();
    return 'aceptada';
  end if;

  insert into amigos (user_id, amigo_id) values (auth.uid(), destino);
  return 'enviada';
end;
$$;

-- Acepta o rechaza una solicitud recibida.
create or replace function public.responder_solicitud(solicitante uuid, aceptar boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if aceptar then
    update amigos set estado = 'aceptada'
    where user_id = solicitante and amigo_id = auth.uid() and estado = 'pendiente';
  else
    delete from amigos
    where user_id = solicitante and amigo_id = auth.uid() and estado = 'pendiente';
  end if;
end;
$$;

-- Deshace la amistad con otra persona o cancela una solicitud enviada.
create or replace function public.quitar_amigo(otro uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from amigos
  where (user_id = auth.uid() and amigo_id = otro) or (user_id = otro and amigo_id = auth.uid());
$$;

-- Solicitudes pendientes: las recibidas (para aceptar o rechazar) y las enviadas.
create or replace function public.solicitudes()
returns table (tipo text, usuario_id uuid, codigo text, nombre text)
language sql stable security definer set search_path = public
as $$
  select 'recibida', a.user_id, p.codigo, p.nombre
  from amigos a join perfiles p on p.user_id = a.user_id
  where a.amigo_id = auth.uid() and a.estado = 'pendiente'
  union all
  select 'enviada', a.amigo_id, p.codigo, p.nombre
  from amigos a join perfiles p on p.user_id = a.amigo_id
  where a.user_id = auth.uid() and a.estado = 'pendiente';
$$;

-- Días completados de cada amigo aceptado, en cualquiera de los dos sentidos.
-- Se ven los días, pero no qué secciones ni el correo.
create or replace function public.progreso_amigos()
returns table (amigo_id uuid, codigo text, nombre text, dias date[])
language sql stable security definer set search_path = public
as $$
  select o.id, p.codigo, p.nombre,
         coalesce((select array_agg(distinct g.dia) from progreso g where g.user_id = o.id), '{}')
  from (
    select case when a.user_id = auth.uid() then a.amigo_id else a.user_id end as id, a.creado
    from amigos a
    where a.estado = 'aceptada' and auth.uid() in (a.user_id, a.amigo_id)
  ) o
  join perfiles p on p.user_id = o.id
  order by o.creado;
$$;

revoke all on function public.mi_perfil(), public.cambiar_nombre(text), public.agregar_amigo(text),
  public.responder_solicitud(uuid, boolean), public.quitar_amigo(uuid), public.solicitudes(),
  public.progreso_amigos() from public, anon;
grant execute on function public.mi_perfil(), public.cambiar_nombre(text), public.agregar_amigo(text),
  public.responder_solicitud(uuid, boolean), public.quitar_amigo(uuid), public.solicitudes(),
  public.progreso_amigos() to authenticated;
