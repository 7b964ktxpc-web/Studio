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

The page creates the lifecycle wrapper only when a valid adapter exists. Without the adapter, the current offline/demo behavior remains unchanged. `createNoopAdapter()` is available for deterministic tests, but the demo page does not silently treat the no-op adapter as a real backend.

## Acceptance

1. Demo page loads without any backend dependency.
2. Missing `window.NowRealtimeAdapter` does not throw.
3. A candidate without `start()` or `stop()` is rejected before invocation.
4. A valid real adapter may be injected before a request is started.
5. Starting request B stops request A first.
6. Late callbacks from A are ignored after B becomes active.
7. No callback from an inactive request may mutate the active request UI.
8. No production Supabase client or credentials are created by the browser seam itself.
