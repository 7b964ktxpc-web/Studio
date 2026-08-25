(() => {
  const globalKey = 'NowMainUiAnswerRealtimeController';

  function resolveRealtimeAdapter() {
    const adapter = window.NowRealtimeAdapter;
    const contract = window.NowRealtimeAdapterContract;
    const resolved = contract?.resolveAdapter?.(adapter);
    if (resolved?.adapter) return { adapter: resolved.adapter, errors: [] };
    return { adapter: null, errors: resolved?.errors || ['Realtime adapter is not available'] };
  }

  function resolveAnswerBridge(candidate) {
    const bridge = candidate || window.NowMainUiAnswerBridge;
    if (!bridge || typeof bridge.applySnapshot !== 'function') {
      return { bridge: null, errors: ['Answer bridge with applySnapshot(snapshot) is required'] };
    }
    return { bridge, errors: [] };
  }

  function normalizeSnapshot(input) {
    if (!input || typeof input !== 'object') return null;
    const requestId = String(input.request_id || input.requestId || '').trim();
    const status = String(input.request_status || input.status || '').toUpperCase();
    if (!requestId || !status) return null;
    return { ...input, request_id: requestId, request_status: status };
  }

  function create({ bridge, onSnapshot, onStatus, onError } = {}) {
    const realtime = resolveRealtimeAdapter();
    const answer = resolveAnswerBridge(bridge);
    if (!realtime.adapter || !answer.bridge) {
      return Object.freeze({
        enabled: false,
        errors: [...realtime.errors, ...answer.errors],
        async start() { return false; },
        async stop() {},
        getActiveRequestId() { return null; },
      });
    }

    let activeRequestId = null;
    let running = false;

    const handleSnapshot = raw => {
      const snapshot = normalizeSnapshot(raw);
      if (!snapshot || snapshot.request_id !== activeRequestId) return;
      answer.bridge.applySnapshot(snapshot);
      onSnapshot?.(snapshot);
    };

    const handleStatus = status => onStatus?.(status);
    const handleError = error => onError?.(error);

    return Object.freeze({
      enabled: true,
      errors: [],
      async start(requestId) {
        const normalized = String(requestId || '').trim();
        if (!normalized || running) return false;
        activeRequestId = normalized;
        running = true;
        try {
          await realtime.adapter.start(normalized, {
            onSnapshot: handleSnapshot,
            onStatus: handleStatus,
            onError: handleError,
            onEvent: handleSnapshot,
          });
          return true;
        } catch (error) {
          running = false;
          activeRequestId = null;
          handleError(error);
          return false;
        }
      },
      async stop() {
        if (!running) return;
        running = false;
        activeRequestId = null;
        await realtime.adapter.stop();
      },
      getActiveRequestId: () => activeRequestId,
    });
  }

  window[globalKey] = Object.freeze({ resolveRealtimeAdapter, resolveAnswerBridge, normalizeSnapshot, create });
})();
