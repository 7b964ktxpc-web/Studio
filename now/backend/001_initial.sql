-- Сейчас / backend migration 001
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- Do not run against STO-NSK or any unrelated database.

create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid null,
  text text not null check (char_length(text) between 1 and 160),
  location geography(Point, 4326) not null,
  radius_m integer not null default 50 check (radius_m between 50 and 250),
  status text not null default 'SEARCHING' check (status in ('SEARCHING','ANSWERED','EXPIRED','CANCELLED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists requests_status_created_idx
  on public.requests(status, created_at);
create index if not exists requests_location_gist_idx
  on public.requests using gist(location);

create table if not exists public.presence (
  user_id uuid primary key,
  location geography(Point, 4326) not null,
  accuracy_m double precision null check (accuracy_m is null or accuracy_m >= 0),
  available boolean not null default false,
  last_seen_at timestamptz not null default now()
);

create index if not exists presence_location_gist_idx
  on public.presence using gist(location);
create index if not exists presence_available_seen_idx
  on public.presence(available, last_seen_at);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  author_id uuid null,
  answer text not null check (char_length(answer) between 1 and 240),
  distance_m integer null check (distance_m is null or distance_m >= 0),
  created_at timestamptz not null default now(),
  unique(request_id, author_id)
);

create index if not exists answers_request_created_idx
  on public.answers(request_id, created_at);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid null references public.requests(id) on delete cascade,
  kind text not null check (kind in ('NEW_NEARBY_REQUEST','REQUEST_ANSWERED','REQUEST_EXPIRED')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz null
);

create index if not exists notification_events_user_created_idx
  on public.notification_events(user_id, created_at desc);
create unique index if not exists notification_events_dedupe_idx
  on public.notification_events(user_id, request_id, kind)
  where request_id is not null;

-- Server-side helper for proximity matching.
-- Exact user coordinates never need to be returned to the client.
create or replace function public.nearby_recipients(
  p_request_id uuid,
  p_limit integer default 8
)
returns table(user_id uuid, distance_m integer)
language sql
stable
security definer
set search_path = public
as $$
  with req as (
    select id, location
    from public.requests
    where id = p_request_id
      and status = 'SEARCHING'
      and expires_at > now()
  ),
  candidates as (
    select
      p.user_id,
      round(st_distance(p.location, r.location))::integer as distance_m
    from public.presence p
    cross join req r
    where p.available = true
      and p.last_seen_at >= now() - interval '5 minutes'
      and (p.accuracy_m is null or p.accuracy_m <= 50)
      and p.user_id <> coalesce((select author_id from public.requests where id = p_request_id), '00000000-0000-0000-0000-000000000000'::uuid)
      and st_dwithin(p.location, r.location, 250)
  )
  select c.user_id, c.distance_m
  from candidates c
  order by c.distance_m asc
  limit greatest(1, least(p_limit, 8));
$$;

-- RLS is intentionally enabled from the first migration. Policies should be added
-- alongside the real authentication decision before production traffic is enabled.
alter table public.requests enable row level security;
alter table public.presence enable row level security;
alter table public.answers enable row level security;
alter table public.notification_events enable row level security;
