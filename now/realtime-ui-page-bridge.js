(() => {
  const globalKey = 'NowRealtimePageBridge';

  function resolveDependencies() {
    const contract = window.NowRealtimeAdapterContract;
    const lifecycleApi = window.__NOW_REALTIME_UI__;
    const resolved = contract?.resolveAdapter?.(window.NowRealtimeAdapter);

    if (!resolved?.adapter || !lifecycleApi?.createActiveRequestUiLifecycle) {
      return { adapter: null, lifecycleApi: null, errors: resolved?.errors || ['Realtime UI dependencies are not available'] };
    }

    return {
      adapter: resolved.adapter,
      lifecycleApi,
      errors: [],
    };
  }

  function createOptionalBridge({ onSnapshot, onError, onStatus } = {}) {
    const dependencies = resolveDependencies();
    if (!dependencies.adapter || !dependencies.lifecycleApi) {
      return Object.freeze({
        enabled: false,
        errors: dependencies.errors,
        async start() {
          return null;
        },
        async stop() {},
        getActiveRequestId() {
          return null;
        },
      });
    }

    const active = dependencies.lifecycleApi.createActiveRequestUiLifecycle(dependencies.adapter, {
      onSnapshot,
      onError,
      onStatus,
    });

    return Object.freeze({
      enabled: true,
      errors: [],
      start: requestId => active.start(requestId),
      stop: () => active.stop(),
      getActiveRequestId: () => active.getActiveRequestId(),
    });
  }

  async function createAndStartRequest(input) {
    const adapter = window.NowCreateRequestAdapter;
    if (!adapter || typeof adapter.createRequest !== 'function') {
      throw new Error('Create request adapter is not available');
    }

    const result = await adapter.createRequest(input);
    const requestId = String(result?.request_id || '').trim();
    if (!requestId) throw new Error('Create request adapter returned no request_id');

    const start = window.NowStartRequestRealtime;
    if (typeof start !== 'function') throw new Error('Realtime start hook is not available');

    try {
      await start(requestId);
    } catch (error) {
      const stop = window.NowStopRequestRealtime;
      if (typeof stop === 'function') {
        try {
          await stop();
        } catch {
          // Preserve the original Realtime start failure; cleanup is best effort.
        }
      }
      throw error;
    }

    return result;
  }

  function installCreateRequestButtonHook() {
    const button = document.querySelector('#ask');
    if (!button || button.dataset.nowCreateRequestHook === '1') return false;
    button.dataset.nowCreateRequestHook = '1';

    button.addEventListener('click', event => {
      const realtime = window.NowRequestRealtimeBridge;
      const createAdapter = window.NowCreateRequestAdapter;
      if (!realtime?.enabled || !createAdapter || typeof createAdapter.createRequest !== 'function') return;

      const question = document.querySelector('#question');
      const geo = document.querySelector('#geo');
      const text = String(question?.value || '').trim();
      if (!text) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (!navigator.geolocation?.getCurrentPosition) {
        if (geo) geo.textContent = 'Геолокация недоступна';
        return;
      }

      if (geo) geo.textContent = 'Проверяем точность геолокации…';
      navigator.geolocation.getCurrentPosition(async position => {
        const accuracy = Number(position?.coords?.accuracy);
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);

        if (!Number.isFinite(accuracy) || accuracy > 50 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          if (geo) geo.textContent = 'Нужна точность геолокации ±50 м или лучше';
          return;
        }

        try {
          await createAndStartRequest({ text, latitude, longitude });
          if (question) question.value = '';
          if (geo) geo.textContent = `Вопрос отправлен · точность ±${Math.round(accuracy)} м`;
        } catch (error) {
          if (geo) geo.textContent = `Не удалось отправить: ${error instanceof Error ? error.message : 'ошибка'}`;
        }
      }, () => {
        if (geo) geo.textContent = 'Не удалось получить геолокацию';
      }, {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 15000,
      });
    }, true);

    return true;
  }

  window[globalKey] = Object.freeze({
    resolveDependencies,
    createOptionalBridge,
    createAndStartRequest,
    installCreateRequestButtonHook,
  });

  window.NowCreateAndStartRequest = createAndStartRequest;
  installCreateRequestButtonHook();
})();
