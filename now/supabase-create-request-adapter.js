(() => {
  const globalKey = 'NowSupabaseCreateRequestAdapter';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.rpc === 'function' ? candidate : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase client is not injected'] };
  }

  function createOptionalAdapter(candidate = window.supabase) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) {
      return Object.freeze({ enabled: false, errors: resolved.errors });
    }

    return Object.freeze({
      enabled: true,
      errors: [],
      async createRequest(input) {
        const text = String(input?.text || '').trim();
        const latitude = Number(input?.latitude);
        const longitude = Number(input?.longitude);
        const { data, error } = await resolved.client.rpc('create_request', {
          p_text: text,
          p_latitude: latitude,
          p_longitude: longitude,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        const requestId = String(row?.request_id || '').trim();
        if (!requestId) {
          throw Object.assign(new Error('Supabase create_request RPC returned no request_id'), { code: 'INVALID_REQUEST' });
        }
        return row;
      },
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
})();
