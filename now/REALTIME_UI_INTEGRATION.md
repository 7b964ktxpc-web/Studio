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

The page creates the lifecycle wrapper only when this adapter exists. Without the adapter, the current offline/demo behavior remains unchanged.

## Acceptance

1. Demo page loads without any backend dependency.
2. Missing `window.NowRealtimeAdapter` does not throw.
3. A real adapter may be injected before a request is started.
4. Starting request B stops request A first.
5. Late callbacks from A are ignored after B becomes active.
6. No callback from an inactive request may mutate the active request UI.
