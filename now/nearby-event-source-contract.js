(() => {
  const globalKey = 'NowNearbyEventSourceContract';

  function validateSource(source) {
    const errors = [];
    if (!source || typeof source !== 'object') {
      errors.push('source must be an object');
      return { valid: false, errors };
    }
    if (typeof source.subscribe !== 'function') {
      errors.push('subscribe({ onEvent, onError }) is required');
    }
    return { valid: errors.length === 0, errors };
  }

  function resolveSource(candidate) {
    const result = validateSource(candidate);
    if (result.valid) return { source: candidate, errors: [] };
    return { source: null, errors: result.errors };
  }

  function createNoopSource() {
    return Object.freeze({
      async subscribe() {
        return async () => {};
      },
    });
  }

  window[globalKey] = Object.freeze({
    validateSource,
    resolveSource,
    createNoopSource,
  });
})();
