(() => {
  const globalKey = 'NowRealtimePageBridge';

  function resolveDependencies() {
    const contract = window.NowRealtimeAdapterContract;
    const lifecycleApi = window.__NOW_REALTIME_UI__;
    const resolved = contract?.resolveAdapter?.(window.NowRealtimeAdapter);

    if (!resolved?.adapter || !lifecycleApi?.createActiveRequestUiLifecycle) {
      return { adapter: null, lifecycleApi: null, errors: resolved?.errors || ['Realtime UI dependencies are not available'] };
    }

    return {
      adapter: resolved.adapter,
      lifecycleApi,
      errors: [],
    };
  }

  function createOptionalBridge({ onSnapshot, onError, onStatus } = {}) {
    const dependencies = resolveDependencies();
    if (!dependencies.adapter || !dependencies.lifecycleApi) {
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

    const active = dependencies.lifecycleApi.createActiveRequestUiLifecycle(dependencies.adapter, {
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
    });
  }

  window[globalKey] = Object.freeze({
    resolveDependencies,
    createOptionalBridge,
  });
})();
