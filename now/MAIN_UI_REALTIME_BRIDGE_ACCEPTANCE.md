# Main UI Realtime bridge acceptance

`main-ui-realtime-bridge.js` is an opt-in seam for the existing `now/index.html` main UI.

## Contract

- targets the existing main UI selectors `#askBtn`, `#question`, and `#geo`;
- exposes its browser API as `window.NowMainUiRealtimeBridge`;
- uses the existing validated browser Realtime adapter contract and generation-safe lifecycle;
- does not create a Supabase client or fabricate request IDs;
- without injected adapters the bridge is disabled and the current demo flow remains untouched;
- when both create and Realtime adapters are injected, the real button path requires geolocation accuracy `<= 50 m` before creating a request;
- the authoritative `request_id` returned by create is the only ID used to start Realtime;
- duplicate clicks are blocked while create + Realtime handoff is active;
- terminal UI status is driven by authoritative snapshot callbacks.

## E2E

`e2e-main-ui-realtime-bridge.html` loads the actual `index.html`, dynamically loads the existing browser contract/lifecycle plus `main-ui-realtime-bridge.js`, injects deterministic in-memory adapters, and verifies:

1. the main page loads;
2. `#question` and `#askBtn` exist;
3. the bridge is disabled without an injected adapter;
4. the bridge enables after deterministic adapter injection;
5. Realtime starts with the authoritative request ID returned by the create adapter;
6. no Supabase dependency is required.

The harness intentionally does not modify `index.html`; the current production/demo page remains the regression baseline until the seam is connected by an explicit script tag.

The harness must use the exact exported global `window.NowMainUiRealtimeBridge`; a different global name is a test failure.

## Next integration step

Add the three browser seam scripts and `main-ui-realtime-bridge.js` to `index.html` only after the current standalone smoke regression is preserved. This should be a script-tag-only change; the existing inline UI logic must remain intact when adapters are absent.
