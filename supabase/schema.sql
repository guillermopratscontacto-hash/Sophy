-- Ejecutar una vez en Supabase: SQL Editor > New query > Run.

create table if not exists public.progreso (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  fecha   date not null,               -- día del contenido completado
  tema    text not null,               -- id del tema (pestaña)
  dia     date not null,               -- día en que se completó (hora local del usuario); es el que cuenta para la racha
  creado  timestamptz not null default now(),
  primary key (user_id, fecha, tema)
);

alter table public.progreso enable row level security;

-- Cada usuario solo ve y escribe su propio progreso.
create policy "leer lo propio" on public.progreso
  for select using (auth.uid() = user_id);

create policy "guardar lo propio" on public.progreso
  for insert with check (auth.uid() = user_id);
