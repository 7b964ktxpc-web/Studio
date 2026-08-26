(() => {
  const globalKey = 'NowSupabaseRequestSnapshotAdapter';

  function createOptionalAdapter(candidate = window.supabase) {
    const client = candidate && typeof candidate.rpc === 'function' ? candidate : null;
    if (!client) {
      return Object.freeze({
        enabled: false,
        errors: ['Supabase client is not injected'],
      });
    }

    function normalizeSnapshot(value) {
      const row = Array.isArray(value) ? value[0] : value;
      if (!row || typeof row !== 'object') throw new Error('Invalid request snapshot response');
      const record = row;
      const status = String(record.status || '').toUpperCase();
      if (!record.id || !record.text || !record.created_at || !record.expires_at) {
        throw new Error('Invalid request snapshot response');
      }
      if (!['SEARCHING', 'ANSWERED', 'EXPIRED', 'CANCELLED'].includes(status)) {
        throw new Error('Unexpected request status');
      }
      return Object.freeze({
        id: String(record.id),
        text: String(record.text),
        status,
        created_at: String(record.created_at),
        expires_at: String(record.expires_at),
      });
    }

    return Object.freeze({
      enabled: true,
      errors: [],
      async refreshRequest(requestId) {
        const normalized = String(requestId || '').trim();
        if (!normalized) throw new Error('Invalid request id');
        const { data, error } = await client.rpc('my_request', { p_request_id: normalized });
        if (error) throw error;
        return normalizeSnapshot(data);
      },
    });
  }

  window[globalKey] = Object.freeze({ createOptionalAdapter });
})();
