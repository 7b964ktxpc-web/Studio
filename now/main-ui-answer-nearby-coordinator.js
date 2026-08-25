(() => {
  const globalKey = 'NowMainUiAnswerNearbyCoordinator';

  function resolveSource(candidate) {
    const source = candidate || window.NowNearbyRequestEventSource;
    if (!source || typeof source.subscribe !== 'function') {
      return { source: null, errors: ['Nearby request event source with subscribe(handlers) is required'] };
    }
    return { source, errors: [] };
  }

  function normalizeEvent(input) {
    if (!input || typeof input !== 'object') return null;
    const kind = String(input.kind || input.event || input.type || '').toLowerCase();
    const requestId = String(input.request_id || input.requestId || '').trim();
    if (!kind || !requestId) return null;
    return { ...input, kind, request_id: requestId };
  }

  function create({ controller, bridge, source, onEvent, onError } = {}) {
    if (!controller || typeof controller.start !== 'function' || typeof controller.stop !== 'function') {
      return Object.freeze({ enabled: false, errors: ['Answer realtime controller is required'], async start() { return false; }, async stop() {} });
    }
    if (!bridge || typeof bridge.bind !== 'function' || typeof bridge.unbind !== 'function') {
      return Object.freeze({ enabled: false, errors: ['Answer bridge with bind/unbind is required'], async start() { return false; }, async stop() {} });
    }
    const resolved = resolveSource(source);
    if (!resolved.source) {
      return Object.freeze({ enabled: false, errors: resolved.errors, async start() { return false; }, async stop() {} });
    }

    let unsubscribe = null;
    let activeRequestId = null;

    const handleEvent = async raw => {
      const event = normalizeEvent(raw);
      if (!event) return false;
      if (!['request.created', 'nearby.request', 'nearby_request', 'request.available'].includes(event.kind)) return false;
      if (activeRequestId === event.request_id) return true;

      const previous = activeRequestId;
      if (previous) {
        await controller.stop();
        bridge.unbind();
      }

      if (!bridge.bind(event.request_id)) return false;
      const started = await controller.start(event.request_id);
      if (!started) {
        bridge.unbind();
        activeRequestId = null;
        return false;
      }
      activeRequestId = event.request_id;
      onEvent?.(event);
      return true;
    };

    return Object.freeze({
      enabled: true,
      errors: [],
      async start() {
        if (unsubscribe) return true;
        const result = await resolved.source.subscribe({ onEvent: handleEvent, onError });
        unsubscribe = typeof result === 'function' ? result : (result?.unsubscribe || null);
        return true;
      },
      async stop() {
        if (typeof unsubscribe === 'function') await unsubscribe();
        unsubscribe = null;
        await controller.stop();
        bridge.unbind();
        activeRequestId = null;
      },
      getActiveRequestId: () => activeRequestId,
    });
  }

  window[globalKey] = Object.freeze({ resolveSource, normalizeEvent, create });
})();
