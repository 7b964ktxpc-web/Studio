(() => {
  const globalKey = 'NowSupabaseRequestAnswersAdapter';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.rpc === 'function' ? candidate : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase request answers client is not injected'] };
  }

  function createOptionalAdapter(candidate = window.supabase) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) return Object.freeze({ enabled: false, errors: resolved.errors });

    return Object.freeze({
      enabled: true,
      errors: [],
      async listAnswers(requestId) {
        const normalized = String(requestId || '').trim();
        if (!normalized) throw new Error('requestId is required');
        const { data, error } = await resolved.client.rpc('my_request_answers', {
          p_request_id: normalized,
        });
        if (error) throw error;
        return Array.isArray(data) ? data : [];
      },
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
  window.NowSupabaseRequestAnswersAdapter = Object.freeze({ createOptionalAdapter });
})();
