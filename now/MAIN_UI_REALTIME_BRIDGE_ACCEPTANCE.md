# Main UI Realtime bridge acceptance

`main-ui-realtime-bridge.js` is an opt-in seam for the existing `now/index.html` main UI.

## Contract

- targets the existing main UI selectors `#askBtn`, `#question`, and `#geo`;
- exposes its browser API as `window.NowMainUiRealtimeBridge`;
- self-loads `realtime-ui-adapter-contract.js` and `realtime-ui-lifecycle.js` when those globals are not already available;
- treats already-loaded dependency scripts as ready instead of waiting for an already-fired `load` event;
- installs the `#askBtn` capture hook synchronously before asynchronous dependency bootstrap;
- checks for the real create adapter at click time, so adapters injected immediately after bridge load cannot race the legacy inline handler;
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

`e2e-main-ui-realtime-bridge.html` loads the actual `index.html`, dynamically loads only `main-ui-realtime-bridge.js`, verifies that the bridge self-loads its two browser dependencies, injects deterministic in-memory adapters immediately after bridge load, and verifies both rejection and late-adapter success paths.

`e2e-main-ui-preloaded-dependencies.html` separately preloads the browser dependencies before loading the bridge and verifies that the bridge does not wait forever for an already-fired dependency `load` event.

1. the main page loads;
2. `#question`, `#askBtn`, and `#geo` exist;
3. the bridge installs its capture hook synchronously;
4. the bridge self-loads its adapter contract and lifecycle dependencies;
5. the bridge is disabled without an injected adapter;
6. deterministic geolocation accuracy `80 m` is rejected without calling create or Realtime;
7. the button is restored after the accuracy rejection;
8. deterministic browser geolocation at `25 m` is accepted;
9. the late-injected adapter click is claimed before the legacy inline click handler;
10. the bridge resolves dependencies and becomes enabled without a manual bridge recreation;
11. the actual `#askBtn` enters a busy/disabled state;
12. `createRequest()` receives the actual question text and coordinates;
13. the authoritative `request_id` returned by create is passed unchanged to Realtime;
14. the question is cleared only after successful create → Realtime handoff;
15. the button restores after the handoff;
16. no Supabase dependency is required;
17. preloaded dependencies do not cause a stuck bridge initialization.

The harnesses intentionally do not modify `index.html`; the current production/demo page remains the regression baseline until the seam is connected by an explicit script tag.

The harnesses must use the exact exported global `window.NowMainUiRealtimeBridge`; a different global name is a test failure.

## Next integration step

Add a single `<script src="/now/main-ui-realtime-bridge.js"></script>` tag to `index.html` only after the current standalone smoke regression is preserved. The bridge will self-load its browser dependencies; the existing inline UI logic must remain intact when adapters are absent.
