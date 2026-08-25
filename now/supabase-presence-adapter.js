(() => {
  const globalKey = 'NowPresenceService';

  function resolveClient(candidate = window.supabase) {
    const client = candidate && typeof candidate.rpc === 'function'
      ? candidate
      : null;
    return client
      ? { client, errors: [] }
      : { client: null, errors: ['Supabase client is not injected'] };
  }

  function createPresenceService(candidate = window.supabase, handlers = {}) {
    const resolved = resolveClient(candidate);
    if (!resolved.client) {
      return Object.freeze({
        enabled: false,
        errors: resolved.errors,
        async start() { return false; },
        async stop() {},
        getSnapshot() { return Object.freeze({ state: 'OFF' }); },
      });
    }

    let watchId = null;
    let stopping = false;
    let snapshot = { state: 'OFF' };

    const emit = next => {
      snapshot = Object.freeze({ ...next });
      handlers.onChange?.(snapshot);
      return snapshot;
    };

    const callPresence = async (position, available) => {
      const accuracy = Number(position?.coords?.accuracy);
      const latitude = Number(position?.coords?.latitude);
      const longitude = Number(position?.coords?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
        throw new Error('Invalid geolocation payload');
      }
      const { error } = await resolved.client.rpc('upsert_my_presence', {
        p_lat: latitude,
        p_lng: longitude,
        p_accuracy_m: accuracy,
        p_available: Boolean(available),
      });
      if (error) throw error;
      return { latitude, longitude, accuracy };
    };

    const stop = async () => {
      stopping = true;
      if (watchId !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      try {
        await resolved.client.rpc('disable_my_presence');
      } finally {
        emit({ state: 'OFF' });
      }
    };

    const start = async () => {
      if (watchId !== null) return true;
      if (!navigator.geolocation?.watchPosition) throw new Error('Geolocation is unavailable');
      stopping = false;
      emit({ state: 'STARTING' });

      watchId = navigator.geolocation.watchPosition(
        async position => {
          if (stopping) return;
          try {
            const accuracy = Number(position?.coords?.accuracy);
            const coordinates = {
              latitude: Number(position.coords.latitude),
              longitude: Number(position.coords.longitude),
              accuracy,
            };
            const available = Number.isFinite(accuracy) && accuracy <= 50;
            await callPresence(position, available);
            emit({
              state: available ? 'ENABLED' : 'LOW_ACCURACY',
              ...coordinates,
              available,
              updatedAt: Date.now(),
            });
          } catch (error) {
            emit({ state: 'ERROR', error: error?.message || 'Presence update failed' });
            handlers.onError?.(error);
          }
        },
        error => {
          emit({ state: 'ERROR', error: error?.message || 'Geolocation failed' });
          handlers.onError?.(error);
        },
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 },
      );
      return true;
    };

    return Object.freeze({
      enabled: true,
      errors: [],
      start,
      stop,
      getSnapshot: () => snapshot,
    });
  }

  window[globalKey] = Object.freeze({ resolveClient, createPresenceService });
})();
