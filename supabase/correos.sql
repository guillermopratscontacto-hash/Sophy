-- Actividad de cada usuario con su correo, para consultarla desde el panel de Supabase.
-- Ejecutar una vez en Supabase: SQL Editor > New query > Run. Se puede volver a ejecutar.
--
-- Las tablas siguen guardando el identificador interno del usuario (user_id); estas
-- vistas lo cruzan con el correo de su cuenta. Viven en un esquema aparte, "privado",
-- que la web no puede leer: solo se ven desde el panel (Table Editor > esquema
-- "privado", o SQL Editor). Los usuarios lo aceptan en la pantalla de acceso.

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- Una fila por usuario, con el resumen de lo que ha hecho.
create or replace view privado.usuarios as
select u.email as correo,
       p.nombre,
       p.codigo,
       u.created_at::date as alta,
       u.last_sign_in_at as ultimo_acceso,
       (select count(distinct g.dia) from public.progreso g where g.user_id = u.id) as dias_activos,
       (select max(g.dia) from public.progreso g where g.user_id = u.id) as ultimo_dia_activo,
       (select count(*) from public.aperturas a where a.user_id = u.id) as piezas_abiertas,
       (select count(*) from public.progreso g where g.user_id = u.id) as completadas,
       (select count(*) from public.valoraciones v where v.user_id = u.id and v.valor = 1) as me_gusta,
       (select count(*) from public.valoraciones v where v.user_id = u.id and v.valor = -1) as no_me_gusta,
       exists (select 1 from public.avisos n where n.user_id = u.id) as avisos_activados
from auth.users u
left join public.perfiles p on p.user_id = u.id
order by ultimo_acceso desc nulls last;

-- Todo lo que hace cada persona, lo más reciente primero.
-- "tema" es la sección; en Geografía es "geo:<país>" y en Minijuegos, "juego:<juego>".
create or replace view privado.actividad as
select u.email as correo, x.cuando, x.accion, x.fecha as edicion, x.tema
from (
  select user_id, creado as cuando, 'abre' as accion, fecha, tema from public.aperturas
  union all
  select user_id, creado, 'completa', fecha, tema from public.progreso
  union all
  select user_id, creado, case when valor = 1 then 'me gusta' else 'no me gusta' end, fecha, tema from public.valoraciones
) x
join auth.users u on u.id = x.user_id
order by x.cuando desc;

-- Las mismas tablas de siempre, con el correo delante.
create or replace view privado.aperturas as
select u.email as correo, a.fecha, a.tema, a.creado
from public.aperturas a join auth.users u on u.id = a.user_id
order by a.creado desc;

create or replace view privado.completadas as
select u.email as correo, g.fecha, g.tema, g.dia, g.creado
from public.progreso g join auth.users u on u.id = g.user_id
order by g.creado desc;

create or replace view privado.valoraciones as
select u.email as correo, v.fecha, v.tema, v.valor, v.creado
from public.valoraciones v join auth.users u on u.id = v.user_id
order by v.creado desc;

revoke all on all tables in schema privado from public, anon, authenticated;
