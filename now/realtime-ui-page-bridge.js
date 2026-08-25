(() => {
  const globalKey = 'NowRealtimePageBridge';

  function resolveDependencies() {
    const contract = window.NowRealtimeAdapterContract;
    const lifecycleApi = window.__NOW_REALTIME_UI__;
    const resolved = contract?.resolveAdapter?.(window.NowRealtimeAdapter);

    if (!resolved?.adapter || !lifecycleApi?.createActiveRequestUiLifecycle) {
      return { lifecycle: null, errors: resolved?.errors || ['Realtime UI dependencies are not available'] };
    }

    return {
      lifecycle: lifecycleApi.createActiveRequestUiLifecycle(resolved.adapter),
      errors: [],
    };
  }

  function createOptionalBridge({ onSnapshot, onError, onStatus } = {}) {
    const dependencies = resolveDependencies();
    if (!dependencies.lifecycle) {
      return Object.freeze({
        enabled: false,
        errors: dependencies.errors,
        async start() {
          return null;
        },
        async stop() {},
        getActiveRequestId() {
          return null;
        },
      });
    }

    const lifecycle = dependencies.lifecycle;
    const guarded = window.__NOW_REALTIME_UI__?.createActiveRequestUiLifecycle;

    // Re-create the lifecycle with UI handlers only after the adapter has passed validation.
    const active = guarded(window.NowRealtimeAdapter, {
      onSnapshot,
      onError,
      onStatus,
    });

    return Object.freeze({
      enabled: true,
      errors: [],
      start: requestId => active.start(requestId),
      stop: () => active.stop(),
      getActiveRequestId: () => active.getActiveRequestId(),
      lifecycle,
    });
  }

  window[globalKey] = Object.freeze({
    resolveDependencies,
    createOptionalBridge,
  });
})();
