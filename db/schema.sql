-- SEN · Sistema de Envasado — esquema inicial (Neon / Postgres)

create table if not exists users (
  id            bigserial primary key,
  email         text not null unique,
  role          text not null check (role in ('Dirección','Gerencia','Planeador','Administrador','Supervisor','Operador')),
  status        text not null default 'invitado' check (status in ('invitado','activo')),
  password_hash text,
  created_at    timestamptz not null default now()
);

create table if not exists articles (
  id          integer primary key,          -- número de artículo
  description text not null,
  process     text not null check (process in ('Tecnovac','Multivac','Termo MK','Embolsado','Polar'))
);

-- Programa de empaque y de entregas por día y artículo.
create table if not exists programs (
  day        date    not null,
  kind       text    not null check (kind in ('empaque','entregas')),
  article_id integer not null references articles(id),
  qty        integer not null default 0,
  primary key (day, kind, article_id)
);

-- Piezas entregadas a embarques por día y artículo.
create table if not exists deliveries (
  day        date    not null,
  article_id integer not null references articles(id),
  qty        integer not null,
  primary key (day, article_id)
);

-- Registro por batch (Tecnovac, Termo MK, Embolsado, Polar).
create table if not exists batch_records (
  day         date    not null,
  machine     text    not null,
  batch_no    integer not null,
  real_time   time,
  downtime_min integer,
  kg_melted   numeric(10,2),
  piece_kg    numeric(8,3),
  pieces      integer,
  scrap_kg    numeric(10,2),
  primary key (day, machine, batch_no)
);

-- Registro por hora de Multivac, por producto.
create table if not exists hourly_records (
  day         date    not null,
  article_id  integer not null references articles(id),
  hour_idx    integer not null,
  end_time    time,
  pieces      integer,
  stored      integer,
  downtime_min integer,
  reel_changes integer,
  reel_change_min integer,
  primary key (day, article_id, hour_idx)
);

-- Horas esperadas y metas por máquina.
create table if not exists machine_config (
  machine     text not null,
  slot        integer not null,
  expected_at time,
  target_pcs  integer,
  primary key (machine, slot)
);

create table if not exists shift_sheets (
  id        bigserial primary key,
  day       date not null,
  machine   text not null,
  team      integer not null,
  leader    text,
  supervisor text,
  signed_by bigint references users(id),
  signed_at timestamptz,
  unique (day, machine, team)
);

-- Bitácora de cambios a programas y configuración.
create table if not exists audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  user_id    bigint references users(id),
  program    text not null,
  day        date,
  article_id integer,
  old_value  text,
  new_value  text,
  reason     text not null
);
