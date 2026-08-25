(() => {
  const normalizeRequestId = value => String(value || '').trim();

  function resolveAdapter(candidate = window.NowCreateRequestAdapter) {
    if (!candidate || typeof candidate.createRequest !== 'function') {
      return { adapter: null, errors: ['Create request adapter is not available'] };
    }
    return { adapter: candidate, errors: [] };
  }

  function validateInput(input) {
    const text = String(input?.text || '').trim();
    const latitude = Number(input?.latitude);
    const longitude = Number(input?.longitude);
    if (text.length < 1 || text.length > 160) {
      throw Object.assign(new Error('Create request text must contain 1–160 characters'), { code: 'INVALID_REQUEST' });
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw Object.assign(new Error('Create request coordinates are invalid'), { code: 'LOCATION_REQUIRED' });
    }
    return { text, latitude, longitude };
  }

  async function createRequest(input, candidate = window.NowCreateRequestAdapter) {
    const { adapter, errors } = resolveAdapter(candidate);
    if (!adapter) throw Object.assign(new Error(errors[0]), { code: 'UNAVAILABLE' });
    const normalized = validateInput(input);
    const result = await adapter.createRequest(normalized);
    const requestId = normalizeRequestId(result?.request_id ?? result?.id);
    if (!requestId) {
      throw Object.assign(new Error('Create request adapter returned no authoritative request_id'), { code: 'INVALID_REQUEST' });
    }
    return { ...result, request_id: requestId };
  }

  window.NowCreateRequestAdapterContract = Object.freeze({
    resolveAdapter,
    validateInput,
    createRequest,
  });
})();
