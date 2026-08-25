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

`e2e-main-ui-realtime-bridge.html` loads the actual `index.html`, dynamically loads the existing browser contract/lifecycle plus `main-ui-realtime-bridge.js`, injects deterministic in-memory adapters, and verifies the real button path.

1. the main page loads;
2. `#question`, `#askBtn`, and `#geo` exist;
3. the bridge is disabled without an injected adapter;
4. the bridge enables after deterministic adapter injection;
5. the actual `#askBtn` enters a busy/disabled state;
6. deterministic browser geolocation at ±25 m is accepted;
7. `createRequest()` receives the actual question text and coordinates;
8. the authoritative `request_id` returned by create is passed unchanged to Realtime;
9. the question is cleared only after successful create → Realtime handoff;
10. the button restores after the handoff;
11. no Supabase dependency is required.

The harness intentionally does not modify `index.html`; the current production/demo page remains the regression baseline until the seam is connected by an explicit script tag.

The harness must use the exact exported global `window.NowMainUiRealtimeBridge`; a different global name is a test failure.

## Next integration step

Add the three browser seam scripts and `main-ui-realtime-bridge.js` to `index.html` only after the current standalone smoke regression is preserved. This should be a script-tag-only change; the existing inline UI logic must remain intact when adapters are absent.
