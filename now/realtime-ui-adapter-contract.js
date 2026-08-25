(() => {
  const globalKey = 'NowRealtimeAdapterContract';

  function isFunction(value) {
    return typeof value === 'function';
  }

  function validateAdapter(adapter) {
    const errors = [];
    if (!adapter || typeof adapter !== 'object') {
      errors.push('adapter must be an object');
      return { valid: false, errors };
    }
    if (!isFunction(adapter.start)) errors.push('start(requestId, handlers) is required');
    if (!isFunction(adapter.stop)) errors.push('stop() is required');
    return { valid: errors.length === 0, errors };
  }

  function resolveAdapter(candidate) {
    const result = validateAdapter(candidate);
    if (result.valid) return { adapter: candidate, errors: [] };
    return { adapter: null, errors: result.errors };
  }

  function createNoopAdapter() {
    return Object.freeze({
      async start() {},
      async stop() {},
    });
  }

  window[globalKey] = Object.freeze({
    validateAdapter,
    resolveAdapter,
    createNoopAdapter,
  });
})();
