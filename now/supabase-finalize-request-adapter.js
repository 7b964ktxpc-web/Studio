(() => {
  const globalKey = 'NowSupabaseFinalizeRequestAdapter';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.rpc === 'function' ? candidate : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase client is not injected'] };
  }

  function createOptionalAdapter(candidate = window.supabase) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) return Object.freeze({ enabled: false, errors: resolved.errors });

    return Object.freeze({
      enabled: true,
      errors: [],
      async finalizeRequest(requestId) {
        const normalized = String(requestId || '').trim();
        if (!normalized) throw new Error('requestId is required');
        const { data, error } = await resolved.client.rpc('finalize_request', {
          p_request_id: normalized,
        });
        if (error) throw error;
        if (data !== true) throw new Error('Request is no longer active');
        return { request_id: normalized, request_status: 'ANSWERED' };
      },
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
  window.NowSupabaseFinalizeRequestAdapter = window[globalKey];
})();
