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

The standalone `index-integrated.html` now loads the three browser seam scripts and exposes `window.NowRequestRealtimeBridge`. Without an injected `window.NowRealtimeAdapter`, the bridge is disabled and the existing offline/demo flow remains the source of truth. No Supabase client, credentials, or production writes are created by this integration.

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
11. No production Supabase client or credentials are created by the browser seam itself.
