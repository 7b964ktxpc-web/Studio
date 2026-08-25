-- Сейчас / backend migration 006
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create index if not exists push_subscriptions_user_enabled_idx
  on public.push_subscriptions(user_id, enabled);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own
  on public.push_subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create policy push_subscriptions_insert_own
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = auth.uid());

create policy push_subscriptions_update_own
  on public.push_subscriptions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.push_subscriptions to authenticated;
