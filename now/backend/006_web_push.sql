-- Сейчас / backend migration 006
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.

create table if not exists public.push_subscriptions (
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id, updated_at desc);

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

create policy push_subscriptions_delete_own
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = auth.uid());

create or replace function public.upsert_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if length(trim(coalesce(p_endpoint, ''))) < 10
     or length(trim(coalesce(p_p256dh, ''))) < 10
     or length(trim(coalesce(p_auth, ''))) < 10 then
    return false;
  end if;

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent, updated_at
  ) values (
    auth.uid(), trim(p_endpoint), trim(p_p256dh), trim(p_auth), p_user_agent, now()
  )
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now();

  return true;
end;
$$;

grant execute on function public.upsert_push_subscription(text,text,text,text) to authenticated;

create or replace function public.disable_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or length(trim(coalesce(p_endpoint, ''))) < 10 then
    return false;
  end if;

  delete from public.push_subscriptions
  where user_id = auth.uid()
    and endpoint = trim(p_endpoint);

  return found;
end;
$$;

grant execute on function public.disable_push_subscription(text) to authenticated;

revoke execute on function public.upsert_push_subscription(text,text,text,text) from anon;
revoke execute on function public.disable_push_subscription(text) from anon;
