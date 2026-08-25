-- Standalone schema for «Сейчас». Apply only to the new Supabase project.
create extension if not exists pgcrypto;

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  address text,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid references places(id) on delete set null,
  text text not null check (char_length(trim(text)) between 2 and 160),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m integer not null default 1000 check (radius_m between 300 and 2000),
  status text not null default 'waiting' check (status in ('waiting','answered','cancelled','expired')),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create table if not exists presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answer text not null check (char_length(trim(answer)) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists questions_user_idx on questions(user_id, created_at desc);
create index if not exists questions_status_expiry_idx on questions(status, expires_at);
create index if not exists answers_question_idx on answers(question_id, created_at desc);
create index if not exists presence_updated_idx on presence(updated_at);
