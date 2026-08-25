# Realtime client acceptance checks

1. Unsafe event is ignored and produces no notification.
2. `request.created` is accepted but does not fabricate an answer notification.
3. `answer.created` creates exactly one local notification for its event id.
4. Duplicate `answer.created` event ids do not duplicate the notification-center entry.
5. `answer.created` triggers an authoritative request refresh.
6. `request.status_changed` triggers an authoritative request refresh.
7. `distanceM > 250` is rejected by the realtime validator.
8. Exact coordinates are not represented in the client event shape.
9. Notification payload uses only the answer text, request id, event id, timestamp and coarse distance.
