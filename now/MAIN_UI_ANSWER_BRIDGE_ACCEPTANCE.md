# Main UI answer bridge acceptance

`main-ui-answer-bridge.js` is an opt-in seam for the existing nearby-question UI in `now/index.html`.

## Contract

- targets the existing `#incomingDemo` and `[data-incoming]` answer controls;
- exposes `window.NowMainUiAnswerBridge`;
- requires an injected `window.NowAnswerRequestAdapter.submitAnswer({ request_id, answer })` adapter;
- does not create a Supabase client or fabricate request IDs;
- the request ID is supplied by the caller and passed unchanged to the answer adapter;
- answers must contain 1–240 characters;
- duplicate clicks are blocked while an answer is being submitted;
- one successful answer unbinds the active request and hides the answer controls;
- `REQUEST_EXPIRED` and `ALREADY_ANSWERED` permanently disable the current request's answer controls;
- authoritative `applySnapshot(snapshot)` only affects the currently bound `request_id`;
- `ANSWERED`, `EXPIRED`, and `CANCELLED` snapshots lock the active request before a click can submit;
- `SEARCHING` re-enables the current request when it is not busy;
- terminal snapshots are idempotent;
- binding a new request ID after a terminal state reactivates the controls for that new request;
- other adapter failures restore the controls so the same request can be retried;
- when no adapter or target UI exists, the bridge is disabled and the existing demo flow is untouched.

## E2E

`e2e-main-ui-answer-bridge.html` loads the real `index.html`, dynamically loads only `main-ui-answer-bridge.js`, injects deterministic in-memory answer adapters, binds authoritative request IDs, and verifies:

1. the nearby-answer UI exists;
2. the opt-in bridge exports the expected global;
3. the injected answer adapter enables the bridge;
4. the authoritative request ID is bound unchanged;
5. two rapid clicks produce exactly one adapter call;
6. answer text is passed unchanged;
7. successful answer result reaches the UI callback;
8. the active request is cleared after success;
9. controls hide after a successful answer;
10. a snapshot for a different request ID is ignored;
11. matching `EXPIRED` snapshot disables the current request before a click;
12. a repeated terminal snapshot remains harmless;
13. binding a new request ID re-enables answer controls;
14. `REQUEST_EXPIRED` adapter failure remains terminal;
15. no Supabase dependency is required.

The harness does not modify `index.html` and does not claim production answer delivery. It verifies only the browser-side adapter seam and authoritative terminal-state guard.

## Next integration step

Connect the nearby-request notification/Realtime event to `bind(request_id)` and `applySnapshot(snapshot)`, then inject the real answer adapter. Only after those deterministic seams are green should the answer bridge be connected to `index.html`.
