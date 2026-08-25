# Realtime subscription acceptance cases

## Request answers

- subscribes to `answers` filtered by `request_id`;
- transforms only the public answer fields into the internal realtime event;
- sends the event through the existing safety validator;
- triggers `refreshRequest(requestId)` after `answer.created`;
- adds one notification for the event id;
- duplicate delivery of the same answer id does not trigger a second refresh or notification.

## Request status

- subscribes only to UPDATE events for the current request id;
- accepts only the known lifecycle states;
- triggers authoritative refresh instead of trusting the event as final state;
- duplicate delivery of the same lifecycle status does not trigger a second refresh.

## Cleanup

- `unsubscribe()` detaches the channel;
- repeated cleanup is safe when the transport implementation returns no value.

## Security

- channel name contains the request id only;
- no exact user coordinates are sent through the event adapter;
- no private user profile fields are copied from realtime payloads;
- answer distance is treated as optional and remains capped by the shared validator.
