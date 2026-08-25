-- «Сейчас» / backend migration 017
-- Draft only. Apply only to the NEW «Сейчас» Supabase project.
-- The browser realtime adapter listens for REQUEST_ANSWERED / NEW_NEARBY_REQUEST
-- inserts on notification_events.

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication p
      join pg_publication_rel pr on pr.prpubid = p.oid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'notification_events'
    ) then
      execute 'alter publication supabase_realtime add table public.notification_events';
    end if;
  end if;
end;
$$;
