# Main UI Realtime bridge acceptance

`main-ui-realtime-bridge.js` is an opt-in seam for the existing `now/index.html` main UI.

## Contract

- targets the existing main UI selectors `#askBtn`, `#question`, and `#geo`;
- exposes its browser API as `window.NowMainUiRealtimeBridge`;
- self-loads `realtime-ui-adapter-contract.js` and `realtime-ui-lifecycle.js` when those globals are not already available;
- resolves a late-injected `window.NowCreateRequestAdapter` and `window.NowRealtimeAdapter` on the actual button click; no manual bridge recreation is required;
- claims the real button click synchronously when a create adapter is present, before asynchronous dependency bootstrap, so the legacy inline handler cannot race the real create path;
- uses the existing validated browser Realtime adapter contract and generation-safe lifecycle;
- does not create a Supabase client or fabricate request IDs;
- without injected adapters the bridge is disabled and the current demo flow remains untouched;
- when both create and Realtime adapters are injected, the real button path requires geolocation accuracy `<= 50 m` before creating a request;
- accuracy worse than `50 m` must not call `createRequest()` or start Realtime;
- the authoritative `request_id` returned by create is the only ID used to start Realtime;
- duplicate clicks are blocked while create + Realtime handoff is active;
- repeated loading of the bridge script does not install a second button handler;
- terminal UI status is driven by authoritative snapshot callbacks.

## E2E

`e2e-main-ui-realtime-bridge.html` loads the actual `index.html`, dynamically loads only `main-ui-realtime-bridge.js`, verifies that the bridge self-loads its two browser dependencies, injects deterministic in-memory adapters **after the bridge is already loaded**, and verifies both rejection and success paths.

1. the main page loads;
2. `#question`, `#askBtn`, and `#geo` exist;
3. the bridge script self-loads its adapter contract and lifecycle dependencies;
4. the bridge is disabled without an injected adapter;
5. a second bridge script load does not duplicate the button hook;
6. deterministic geolocation accuracy `80 m` is rejected without calling create or Realtime;
7. the button is restored after the accuracy rejection;
8. deterministic browser geolocation at `25 m` is accepted;
9. the late-injected adapter path claims the real `#askBtn` click synchronously, so the legacy handler does not run;
10. the actual `#askBtn` enters a busy/disabled state;
11. `createRequest()` receives the actual question text and coordinates;
12. the authoritative `request_id` returned by create is passed unchanged to Realtime;
13. the bridge becomes enabled from the late-injected adapters without manual `createOptionalBridge()` recreation;
14. the question is cleared only after successful create → Realtime handoff;
15. the button restores after the handoff;
16. no Supabase dependency is required.

The harness intentionally does not modify `index.html`; the current production/demo page remains the regression baseline until the seam is connected by an explicit script tag.

The harness must use the exact exported global `window.NowMainUiRealtimeBridge`; a different global name is a test failure.

## Next integration step

Add a single `<script src="/now/main-ui-realtime-bridge.js"></script>` tag to `index.html` only after the current standalone smoke regression is preserved. The bridge will self-load its browser dependencies; the existing inline UI logic must remain intact when adapters are absent.
