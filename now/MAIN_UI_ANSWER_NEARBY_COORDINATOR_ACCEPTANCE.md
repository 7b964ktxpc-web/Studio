# Main UI answer nearby coordinator acceptance

`main-ui-answer-nearby-coordinator.js` is an opt-in browser seam between a nearby-request event source, the answer Realtime controller, and the answer bridge.

## Contract

- requires an injected event source with `subscribe({ onEvent, onError })`;
- accepts only nearby-request event kinds: `request.created`, `nearby.request`, `nearby_request`, `request.available`;
- requires a non-empty `request_id`; malformed events are ignored;
- ignores unrelated event kinds;
- first accepted nearby event binds the request ID and starts the answer Realtime controller;
- repeated events for the same request ID are idempotent;
- a different nearby request stops the previous controller lifecycle, unbinds the old answer request, then binds/starts the new request;
- failed controller start cleans up the new binding;
- `stop()` unsubscribes the event source, stops the controller, unbinds the bridge, and clears the active request;
- the coordinator does not create a Supabase client, generate request IDs, or perform answer authorization.

## E2E

`e2e-main-ui-answer-nearby-coordinator.html` verifies:

1. the coordinator enables only with injected source/controller/bridge seams;
2. malformed events are ignored;
3. unrelated event kinds are ignored;
4. the first nearby event activates the request;
5. duplicate nearby events for the same request are idempotent;
6. a second request switches the lifecycle and cleans up the previous request;
7. the new request becomes active;
8. `stop()` unsubscribes and fully cleans up.

The harness is deterministic and has no Supabase dependency.

## Integration boundary

The real notification/Realtime source remains an injected adapter. Connect that adapter only after its event contract is defined and tested; then connect the coordinator to the answer bridge and controller in the main UI.
