# Notification center acceptance cases

1. Duplicate notification id is ignored.
2. Two different requests may coexist.
3. More than 50 saved items are trimmed to the newest 50.
4. Permission other than `granted` never creates a browser notification.
5. A visible app does not create a background notification.
6. When `Notification` constructor fails, the implementation falls back to Service Worker `showNotification`.
7. Notification click data must contain only the request id.
8. A stale/expired request must be rejected by the backend before UI delivery.

These are acceptance cases for the client adapter before wiring it to realtime events.
