(() => {
  const globalKey = 'NowSupabaseRealtimeAdapter';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.channel === 'function' && typeof candidate.removeChannel === 'function'
      ? candidate
      : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase realtime client is not injected'] };
  }

  function createOptionalAdapter(candidate = window.supabase) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) return Object.freeze({ enabled: false, errors: resolved.errors });

    let activeChannel = null;
    let activeRequestId = null;

    const stop = async () => {
      const channel = activeChannel;
      activeChannel = null;
      activeRequestId = null;
      if (channel) {
        try { await resolved.client.removeChannel(channel); } catch { /* best effort */ }
      }
    };

    const start = async (requestId, handlers = {}) => {
      const normalized = String(requestId || '').trim();
      if (!normalized) throw new Error('requestId is required');
      await stop();
      activeRequestId = normalized;

      const channel = resolved.client
        .channel(`now-request-${normalized}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notification_events', filter: `request_id=eq.${normalized}` },
          payload => {
            const row = payload?.new || {};
            const kind = String(row.kind || '').toUpperCase();
            if (String(row.request_id || '') !== normalized) return;
            if (kind === 'REQUEST_ANSWERED') {
              handlers.onSnapshot?.({ request_id: normalized, request_status: 'ANSWERED', source: 'notification_events' });
            }
          },
        )
        .subscribe((status, error) => {
          handlers.onStatus?.(status);
          if (error) handlers.onError?.(error);
        });

      activeChannel = channel;
      return normalized;
    };

    return Object.freeze({
      enabled: true,
      errors: [],
      start,
      stop,
      getActiveRequestId: () => activeRequestId,
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
})();
