(() => {
  const globalKey = 'NowSupabaseNearbyNotificationSource';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.channel === 'function' && typeof candidate.removeChannel === 'function' && typeof candidate.rpc === 'function'
      ? candidate
      : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase realtime client is not injected'] };
  }

  function createOptionalSource(candidate = window.supabase) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) return Object.freeze({ enabled: false, errors: resolved.errors });

    return Object.freeze({
      enabled: true,
      errors: [],
      async subscribe(handlers = {}) {
        const { data, error } = await resolved.client.auth.getUser();
        if (error) throw error;
        const userId = String(data?.user?.id || '').trim();
        if (!userId) throw new Error('Authenticated user is required for nearby notifications');

        const channel = resolved.client
          .channel(`now-user-notifications-${userId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notification_events',
              filter: `user_id=eq.${userId}`,
            },
            async payload => {
              const row = payload?.new || {};
              const kind = String(row.kind || '').toUpperCase();
              const requestId = String(row.request_id || '').trim();
              if (!requestId || kind !== 'NEW_NEARBY_REQUEST') return;

              try {
                const lookup = await resolved.client.rpc('nearby_request_for_answer', {
                  p_request_id: requestId,
                });
                if (lookup.error) throw lookup.error;
                const request = Array.isArray(lookup.data) ? lookup.data[0] : lookup.data;
                if (!request?.id || String(request.id) !== requestId) return;

                handlers.onEvent?.({
                  kind: 'nearby.request',
                  request_id: requestId,
                  source: 'notification_events',
                  event_id: row.id || null,
                  created_at: row.created_at || null,
                  request,
                });
              } catch (lookupError) {
                handlers.onError?.(lookupError);
              }
            },
          );

        await new Promise((resolve, reject) => {
          channel.subscribe((status, subscribeError) => {
            handlers.onStatus?.(status);
            if (subscribeError) {
              handlers.onError?.(subscribeError);
              reject(subscribeError);
              return;
            }
            if (status === 'SUBSCRIBED') resolve();
          });
        });

        return async () => {
          try { await resolved.client.removeChannel(channel); } catch { /* best effort */ }
        };
      },
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalSource });
})();
