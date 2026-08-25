# Main UI answer Realtime controller acceptance

`main-ui-answer-realtime-controller.js` is an opt-in browser seam between the existing Realtime adapter contract and `main-ui-answer-bridge.js`.

## Contract

- uses the existing `window.NowRealtimeAdapter.start(requestId, handlers)` / `stop()` contract;
- requires `window.NowMainUiAnswerBridge.applySnapshot(snapshot)`;
- forwards only snapshots whose `request_id` matches the currently active request;
- normalizes `requestId`/`status` aliases into `request_id` / `request_status`;
- ignores malformed snapshots and snapshots for another request;
- forwards `SEARCHING`, `ANSWERED`, `EXPIRED`, and `CANCELLED` snapshots to the answer bridge;
- does not create a Supabase client or fabricate request IDs;
- `stop()` clears the active request before releasing the Realtime adapter;
- a failed Realtime start clears the active request and reports the error;
- the controller is disabled when the validated Realtime adapter or answer bridge is unavailable.

## E2E

`e2e-main-ui-answer-realtime-controller.html` injects a deterministic Realtime adapter and answer bridge into the real `index.html`, starts request `req-73`, emits matching and non-matching snapshots, and verifies that only the matching request is applied and that `stop()` releases the controller.

This is a browser-side controller acceptance test only. It does not claim real Supabase Realtime or push delivery.

## Next integration step

Connect the real nearby-request notification/Realtime event to `create().start(request_id)` and bind its authoritative snapshots to `main-ui-answer-bridge.js`. Only after this browser seam remains green should the answer bridge be connected to `index.html` and a real answer adapter.
