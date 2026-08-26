-- «Сейчас» / backend migration 025
-- Allow the terminal REQUEST_FINALIZED event emitted by finalize_request.
-- Keep notification event kinds explicit and fail closed for unknown values.

alter table public.notification_events
  drop constraint if exists notification_events_kind_check;

alter table public.notification_events
  add constraint notification_events_kind_check
  check (
    kind = any (
      array[
        'NEW_NEARBY_REQUEST'::text,
        'REQUEST_ANSWERED'::text,
        'REQUEST_FINALIZED'::text,
        'REQUEST_EXPIRED'::text
      ]
    )
  );
