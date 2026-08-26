(() => {
  const globalKey = 'NowSupabasePushAdapter';

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
      async saveSubscription(payload) {
        if (!payload?.endpoint || !payload?.p256dh || !payload?.auth) {
          throw new Error('Complete push subscription payload is required');
        }
        const { data, error } = await resolved.client.rpc('upsert_push_subscription', {
          p_endpoint: payload.endpoint,
          p_p256dh: payload.p256dh,
          p_auth: payload.auth,
          p_user_agent: payload.userAgent || null,
        });
        if (error) throw error;
        if (data !== true) throw new Error('Push subscription persistence was rejected');
        return true;
      },
      async disableSubscription(endpoint) {
        const normalized = String(endpoint || '').trim();
        if (!normalized) return false;
        const { data, error } = await resolved.client.rpc('disable_push_subscription', {
          p_endpoint: normalized,
        });
        if (error) throw error;
        return data === true;
      },
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
})();
