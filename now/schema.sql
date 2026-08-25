-- Сейчас / now-MVP
-- Draft schema for the first real backend. Do not run against the old STO-NSK database.

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  address text,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references places(id) on delete set null,
  text text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 1000,
  status text not null default 'waiting',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  answer text not null,
  distance_m integer,
  created_at timestamptz not null default now()
);

create table if not exists presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  lat double precision not null,
  lng double precision not null,
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists questions_expires_idx on questions(expires_at);
create index if not exists questions_status_idx on questions(status);
create index if not exists answers_question_idx on answers(question_id);
create index if not exists presence_updated_idx on presence(updated_at);
