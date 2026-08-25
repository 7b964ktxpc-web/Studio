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

    const emitAnswerSnapshot = async (normalized, handlers) => {
      let answers = [];
      if (typeof resolved.client.rpc === 'function') {
        const lookup = await resolved.client.rpc('my_request_answers', { p_request_id: normalized });
        if (!lookup.error && Array.isArray(lookup.data)) answers = lookup.data;
      }

      const payload = {
        request_id: normalized,
        request_status: 'SEARCHING',
        event_kind: 'REQUEST_ANSWERED',
        source: 'notification_events',
        answers,
        latest_answer: answers.length ? answers[answers.length - 1] : null,
      };
      handlers.onEvent?.(payload);
      handlers.onSnapshot?.(payload);
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

            // REQUEST_ANSWERED is an answer event, not a terminal request state.
            // answer_request() keeps the request SEARCHING so more confirmations
            // can be collected. Only a real terminal lifecycle event ends it.
            if (kind === 'REQUEST_ANSWERED') {
              Promise.resolve(emitAnswerSnapshot(normalized, handlers)).catch(error => handlers.onError?.(error));
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
