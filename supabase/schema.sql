-- ============================================================
-- KABERT MUSIC MANAGER — Esquema de base de datos (Supabase)
-- Kabert Studio · LMKE
-- Ejecutar completo en el SQL Editor de tu proyecto Supabase.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- CONFIGURACIÓN DE LA INSTITUCIÓN ----------
create table if not exists configuracion (
  id int primary key default 1,
  nombre_institucion text not null default 'Escuela de Música Kabert',
  subtitulo text default 'Sistema de Gestión Académica',
  logo_url text,
  moneda text default 'Bs',
  constraint singleton check (id = 1)
);
insert into configuracion (id) values (1) on conflict (id) do nothing;

-- ---------- ESPECIALIDADES ----------
create table if not exists especialidades (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null unique,
  activo boolean default true,
  creado_en timestamptz default now()
);

-- ---------- ESTUDIANTES ----------
create table if not exists estudiantes (
  id uuid primary key default uuid_generate_v4(),
  codigo text unique not null,
  nombre_completo text not null,
  usuario text unique not null,
  password text not null, -- almacenar con hash en producción (ver notas README)
  foto_url text,
  especialidad_id uuid references especialidades(id),
  telefono text,
  correo text,
  fecha_ingreso date not null default current_date,
  estado text not null default 'activo', -- activo | baja
  dias_clase text[] not null default '{}', -- ej: ['martes','jueves']
  hora_inicio time,
  hora_fin time,
  monto_mensual numeric(10,2) default 0,
  fecha_inicio_mensualidad date,
  proxima_mensualidad date,
  saldo_pendiente numeric(10,2) default 0,
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

-- ---------- CALENDARIO / EVENTOS DE CLASE ----------
create table if not exists eventos_calendario (
  id uuid primary key default uuid_generate_v4(),
  estudiante_id uuid references estudiantes(id) on delete cascade,
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  estado text not null default 'programada',
  -- programada | asistio | permiso | falta | reposicion
  es_reposicion_de uuid references eventos_calendario(id),
  creado_en timestamptz default now()
);
create index if not exists idx_eventos_fecha on eventos_calendario(fecha);
create index if not exists idx_eventos_estudiante on eventos_calendario(estudiante_id);

-- ---------- PAGOS ----------
create table if not exists pagos (
  id uuid primary key default uuid_generate_v4(),
  estudiante_id uuid references estudiantes(id) on delete cascade,
  numero_recibo text unique not null,
  fecha date not null default current_date,
  monto numeric(10,2) not null,
  tipo text not null default 'completo', -- completo | parcial
  saldo_pendiente numeric(10,2) default 0,
  observaciones text,
  creado_en timestamptz default now()
);

-- ---------- HISTORIAL ----------
create table if not exists historial (
  id uuid primary key default uuid_generate_v4(),
  estudiante_id uuid references estudiantes(id) on delete cascade,
  tipo text not null,
  -- alta | asistencia | permiso | reposicion | pago | cambio_horario | cambio_especialidad | baja | reactivacion
  descripcion text not null,
  fecha timestamptz default now()
);

-- ---------- ROW LEVEL SECURITY ----------
-- Nota: el administrador se valida con una contraseña fija en el cliente
-- (no usa Supabase Auth), por lo que el acceso se hace con la clave "anon".
-- Para un entorno de producción real, se recomienda mover la lógica
-- administrativa a una Edge Function protegida. Aquí se deja RLS abierto
-- a nivel de "anon" para simplificar el despliegue estático en GitHub Pages.

alter table configuracion enable row level security;
alter table especialidades enable row level security;
alter table estudiantes enable row level security;
alter table eventos_calendario enable row level security;
alter table pagos enable row level security;
alter table historial enable row level security;

create policy "public read config" on configuracion for select using (true);
create policy "public write config" on configuracion for update using (true);

create policy "public all especialidades" on especialidades for all using (true) with check (true);
create policy "public all estudiantes" on estudiantes for all using (true) with check (true);
create policy "public all eventos" on eventos_calendario for all using (true) with check (true);
create policy "public all pagos" on pagos for all using (true) with check (true);
create policy "public all historial" on historial for all using (true) with check (true);

-- Especialidades iniciales de ejemplo (opcional)
insert into especialidades (nombre) values
  ('Piano'), ('Guitarra'), ('Canto'), ('Violín'), ('Bajo'), ('Producción Musical')
on conflict (nombre) do nothing;
