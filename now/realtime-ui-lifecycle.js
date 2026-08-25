(() => {
  const globalKey = '__NOW_REALTIME_UI__';

  function createActiveRequestUiLifecycle(adapter, handlers = {}) {
    if (!adapter || typeof adapter.start !== 'function' || typeof adapter.stop !== 'function') {
      throw new Error('Invalid realtime adapter');
    }

    let generation = 0;
    let activeRequestId = null;

    const stop = async () => {
      generation += 1;
      activeRequestId = null;
      await adapter.stop();
    };

    const start = async requestId => {
      const normalized = String(requestId || '').trim();
      if (!normalized) throw new Error('Invalid request id');

      await stop();
      const myGeneration = generation;
      activeRequestId = normalized;

      await adapter.start(normalized, {
        onSnapshot: snapshot => {
          if (myGeneration !== generation || activeRequestId !== normalized) return;
          handlers.onSnapshot?.(snapshot);
        },
        onError: error => {
          if (myGeneration !== generation || activeRequestId !== normalized) return;
          handlers.onError?.(error);
        },
        onStatus: status => {
          if (myGeneration !== generation || activeRequestId !== normalized) return;
          handlers.onStatus?.(status);
        },
      });

      if (myGeneration !== generation || activeRequestId !== normalized) {
        throw new Error('Request realtime lifecycle became inactive');
      }

      return normalized;
    };

    return {
      start,
      stop,
      getActiveRequestId: () => activeRequestId,
    };
  }

  window[globalKey] = { createActiveRequestUiLifecycle };
})();
