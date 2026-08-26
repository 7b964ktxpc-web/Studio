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

    const snapshotAdapter = window.NowSupabaseRequestSnapshotAdapter?.createOptionalAdapter?.(resolved.client);
    if (!snapshotAdapter?.enabled) {
      return Object.freeze({
        enabled: false,
        errors: snapshotAdapter?.errors || ['Authoritative request snapshot adapter is unavailable'],
      });
    }

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

    const loadAnswers = async normalized => {
      if (typeof resolved.client.rpc !== 'function') return [];
      const lookup = await resolved.client.rpc('my_request_answers', { p_request_id: normalized });
      if (lookup.error || !Array.isArray(lookup.data)) return [];
      return lookup.data;
    };

    const refreshRequest = async (normalized, handlers, eventKind = null) => {
      const snapshot = await snapshotAdapter.refreshRequest(normalized);
      const answers = await loadAnswers(normalized);
      const payload = {
        ...snapshot,
        request_id: snapshot.id,
        request_status: snapshot.status,
        event_kind: eventKind,
        source: 'authoritative_snapshot',
        answers,
        latest_answer: answers.length ? answers[answers.length - 1] : null,
      };
      handlers.onEvent?.(payload);
      handlers.onSnapshot?.(payload);
      return payload;
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

            if (kind === 'REQUEST_ANSWERED' || kind === 'REQUEST_FINALIZED') {
              Promise.resolve(refreshRequest(normalized, handlers, kind))
                .catch(error => handlers.onError?.(error));
            }
          },
        )
        .subscribe((status, error) => {
          handlers.onStatus?.(status);
          if (error) handlers.onError?.(error);
        });

      activeChannel = channel;
      await refreshRequest(normalized, handlers, null);
      return normalized;
    };

    return Object.freeze({
      enabled: true,
      errors: [],
      start,
      stop,
      refreshRequest,
      getActiveRequestId: () => activeRequestId,
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
})();
