(() => {
  const globalKey = 'NowSupabaseAnswerRequestAdapter';

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
      async submitAnswer(input) {
        const requestId = String(input?.request_id || '').trim();
        const answer = String(input?.answer || '').trim();
        const { data, error } = await resolved.client.rpc('answer_request', {
          p_request_id: requestId,
          p_answer: answer,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        const returnedRequestId = String(row?.request_id || requestId).trim();
        if (!returnedRequestId || returnedRequestId !== requestId) {
          throw Object.assign(new Error('Supabase answer_request RPC returned mismatched request_id'), { code: 'INVALID_REQUEST' });
        }
        return row;
      },
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
})();
