(() => {
  const globalKey = 'NowSupabasePresenceAdapter';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.rpc === 'function'
      ? candidate
      : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase client is not injected'] };
  }

  function createOptionalAdapter(candidate = window.supabase) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) return Object.freeze({ enabled: false, errors: resolved.errors });

    let enabled = false;
    let lastPresence = null;

    const upsert = async ({ latitude, longitude, accuracy, available }) => {
      const pLat = Number(latitude);
      const pLng = Number(longitude);
      const pAccuracy = accuracy == null ? null : Number(accuracy);
      if (!Number.isFinite(pLat) || pLat < -90 || pLat > 90) throw new Error('Invalid latitude');
      if (!Number.isFinite(pLng) || pLng < -180 || pLng > 180) throw new Error('Invalid longitude');
      if (pAccuracy != null && (!Number.isFinite(pAccuracy) || pAccuracy < 0)) throw new Error('Invalid accuracy');
      if (pAccuracy != null && pAccuracy > 50 && available) throw new Error('Location accuracy must be 50 m or better');

      const { data, error } = await resolved.client.rpc('upsert_my_presence', {
        p_lat: pLat,
        p_lng: pLng,
        p_accuracy_m: pAccuracy,
        p_available: Boolean(available),
      });
      if (error) throw error;
      lastPresence = data;
      enabled = Boolean(available);
      return data;
    };

    const disable = async () => {
      const { error } = await resolved.client.rpc('disable_my_presence');
      if (error) throw error;
      enabled = false;
      lastPresence = null;
    };

    return Object.freeze({
      enabled: true,
      errors: [],
      upsert,
      disable,
      isEnabled: () => enabled,
      getLastPresence: () => lastPresence,
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createOptionalAdapter });
})();
