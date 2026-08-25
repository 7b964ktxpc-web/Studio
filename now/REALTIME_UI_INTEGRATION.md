# Browser UI Realtime lifecycle seam

The current `index-integrated.html` is a self-contained browser page and does not have a TypeScript bundler/import pipeline. It therefore must not import `realtime-request-controller.ts` directly.

`realtime-ui-lifecycle.js` provides the browser-side lifecycle seam with the same safety contract:

- only one request may be active;
- starting a new request stops the previous one first;
- callbacks from an older request are ignored after the generation changes;
- `snapshot`, `status`, and `error` callbacks are delivered only while that request is active;
- the adapter is injected explicitly and is not created by the demo page;
- no Supabase client, credentials, or production writes are introduced by this seam.

## Adapter contract

Expose a browser adapter as `window.NowRealtimeAdapter`:

```js
window.NowRealtimeAdapter = {
  async start(requestId, handlers) {
    // Connect the real application adapter here.
    // Call handlers.onSnapshot(snapshot), handlers.onStatus(status), handlers.onError(error).
  },
  async stop() {
    // Unsubscribe the active request channel.
  }
};
```

`realtime-ui-adapter-contract.js` provides runtime validation for the injected object. A valid adapter must expose callable `start()` and `stop()` methods. Invalid candidates resolve to `null` with explicit validation errors instead of being invoked.

`realtime-ui-page-bridge.js` is the opt-in browser bridge. It resolves the validated adapter and creates exactly one active-request UI lifecycle. When the adapter or lifecycle dependency is missing, it returns a safe disabled bridge and does not create a backend fallback.

The same bridge exposes `window.NowCreateAndStartRequest(input)`. It accepts a browser-injected `window.NowCreateRequestAdapter` with `createRequest(input)`, requires a non-empty returned `request_id`, and only then calls the existing `NowStartRequestRealtime(request_id)` hook. It does not create backend rows itself and never fabricates request IDs.

When Realtime start fails after request creation, the handoff performs a best-effort `NowStopRequestRealtime()` cleanup and rethrows the original start error. This prevents a partially-created Realtime subscription from surviving a failed handoff without masking the original failure.

The standalone `index-integrated.html` loads the three browser seam scripts and exposes `window.NowRequestRealtimeBridge`. Without an injected `window.NowRealtimeAdapter`, the bridge is disabled and the existing offline/demo flow remains the source of truth. No Supabase client, credentials, or production writes are created by this integration.

## Active request UI hook

The standalone UI also exposes:

```js
window.NowStartRequestRealtime(requestId)
window.NowStopRequestRealtime()
```

`NowStartRequestRealtime(requestId)` is intentionally an adapter hand-off rather than a create-request action. It accepts only an existing request ID and starts the validated Realtime lifecycle when the bridge is enabled. It does not fabricate IDs, create backend rows, or infer a request from the demo button.

`NowStopRequestRealtime()` unsubscribes the active lifecycle. Both hooks are safe when no adapter is injected; the start hook returns `null` in that disabled state.

## Create → Realtime handoff E2E

`e2e-create-to-realtime.html` loads the actual `index-integrated.html` and injects deterministic in-memory create and Realtime adapters after page boot. It checks:

1. the public `NowCreateAndStartRequest()` hook exists;
2. the create adapter is called once;
3. the created `request_id` is returned unchanged;
4. Realtime starts with exactly that created `request_id`;
5. the Realtime bridge reports the same request as active;
6. a create result without `request_id` is rejected;
7. a missing `request_id` does not start Realtime.

The harness does not create a Supabase client and does not write production data.

## Create → Realtime failure E2E

`e2e-create-to-realtime-failure.html` loads the actual `index-integrated.html` and injects a create adapter plus a deterministic Realtime adapter whose `start()` intentionally fails. It checks:

1. the original Realtime start error is preserved;
2. Realtime start is attempted exactly once;
3. cleanup `stop()` is attempted after the failed start;
4. no active request remains after the failed handoff.

The harness does not create a Supabase client and does not write production data.

## Create → Realtime switch E2E

`e2e-create-to-realtime-switch.html` loads the actual `index-integrated.html` and injects deterministic create and Realtime adapters after page boot. It creates request A and then request B through the public `NowCreateAndStartRequest()` handoff. It checks:

1. request A is created and started;
2. A becomes the active request;
3. request B is created and started with its own authoritative `request_id`;
4. the lifecycle invokes `stop()` before B is active, including the controller's initial cleanup;
5. B is the only active request after the switch.

The harness does not create a Supabase client and does not write production data.

## Deterministic browser E2E

`e2e-realtime-page-bridge.html` loads the contract, lifecycle, and page bridge in a real browser context and checks:

1. a valid injected adapter enables the bridge;
2. request A becomes active;
3. starting request B replaces A;
4. a late `A.onSnapshot` delivered after B is active is ignored;
5. stopping clears the active request.

The harness does not create a Supabase client and uses an in-memory adapter only for the test.

## Standalone UI smoke E2E

`e2e-index-integrated-smoke.html` loads the actual `index-integrated.html` in an iframe and checks the current browser surface without invoking geolocation or backend writes:

1. the standalone page loads;
2. brand and presence controls exist;
3. the question input and all four preset buttons exist;
4. the preset interaction still updates the question input;
5. the optional `NowRequestRealtimeBridge` is disabled when no adapter is injected;
6. the page starts without an injected Realtime adapter;
7. the page starts without a Supabase client dependency.

This keeps the existing demo UI as the regression baseline while the Realtime bridge remains opt-in.

## Active request hook E2E

`e2e-request-realtime-hook.html` loads the actual `index-integrated.html` and injects an in-memory adapter **after page boot** to exercise the public adapter hand-off explicitly. This is a deterministic test mode, not the production boot path. It checks:

1. the public `NowStartRequestRealtime` / `NowStopRequestRealtime` hooks exist;
2. injecting a valid adapter enables the bridge;
3. an existing request ID becomes active;
4. `onStatus` and authoritative `onSnapshot` callbacks reach the hook handlers;
5. an empty request ID is rejected;
6. stopping clears the active request.

The harness does not create a Supabase client and does not write production data.

## Acceptance

1. Demo page loads without any backend dependency.
2. Missing `window.NowRealtimeAdapter` does not throw.
3. A candidate without `start()` or `stop()` is rejected before invocation.
4. A valid real adapter may be injected before a request is started.
5. The page bridge creates exactly one lifecycle wrapper for the validated adapter.
6. Starting request B stops request A first.
7. Late callbacks from A are ignored after B becomes active.
8. No callback from an inactive request may mutate the active request UI.
9. The deterministic browser E2E passes the A → B → stale A scenario.
10. The standalone UI smoke E2E passes with the bridge disabled when no adapter is injected.
11. `NowStartRequestRealtime(requestId)` rejects an empty request ID and does not fabricate one.
12. `NowStopRequestRealtime()` is safe when no adapter is injected.
13. The active request hook E2E passes with an injected in-memory adapter without requiring Supabase.
14. `NowCreateAndStartRequest()` passes through the authoritative `request_id` from the injected create adapter and only then starts Realtime.
15. A create result without `request_id` cannot start Realtime.
16. A failed Realtime start triggers best-effort cleanup and preserves the original start error.
17. The create → Realtime failure E2E passes without requiring Supabase.
18. A second successful create → Realtime handoff stops the previous request before activating the new request.
19. The create → Realtime switch E2E passes without requiring Supabase.
20. No production Supabase client or credentials are created by the browser seam itself.
