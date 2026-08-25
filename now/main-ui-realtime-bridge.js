(() => {
  const globalKey = 'NowMainUiRealtimeBridge';

  function resolveDependencies() {
    const contract = window.NowRealtimeAdapterContract;
    const lifecycleApi = window.__NOW_REALTIME_UI__;
    const resolved = contract?.resolveAdapter?.(window.NowRealtimeAdapter);

    if (!resolved?.adapter || !lifecycleApi?.createActiveRequestUiLifecycle) {
      return {
        adapter: null,
        lifecycleApi: null,
        errors: resolved?.errors || ['Realtime UI dependencies are not available'],
      };
    }

    return { adapter: resolved.adapter, lifecycleApi, errors: [] };
  }

  function createOptionalBridge({ onSnapshot, onError, onStatus } = {}) {
    const dependencies = resolveDependencies();
    if (!dependencies.adapter || !dependencies.lifecycleApi) {
      return Object.freeze({
        enabled: false,
        errors: dependencies.errors,
        async start() { return null; },
        async stop() {},
        getActiveRequestId() { return null; },
      });
    }

    const geo = document.querySelector('#geo');
    let active;

    const defaultSnapshot = snapshot => {
      const status = String(snapshot?.request_status ?? snapshot?.status ?? '').toUpperCase();
      if (!geo) return;
      if (status === 'ANSWERED') geo.textContent = 'Ответ получен';
      else if (status === 'EXPIRED') geo.textContent = 'Время ожидания истекло';
      else if (status === 'CANCELLED') geo.textContent = 'Запрос отменён';
      else if (status === 'SEARCHING') geo.textContent = 'Ищем ответ рядом…';
    };

    const snapshotHandler = snapshot => {
      (onSnapshot ?? defaultSnapshot)?.(snapshot);
    };

    active = dependencies.lifecycleApi.createActiveRequestUiLifecycle(dependencies.adapter, {
      onSnapshot: snapshotHandler,
      onError: onError ?? (() => { if (geo) geo.textContent = 'Не удалось обновить запрос'; }),
      onStatus: onStatus ?? (status => {
        const normalized = String(status || '').toUpperCase();
        if (!geo) return;
        if (normalized === 'SUBSCRIBED') geo.textContent = 'Связь с запросом установлена';
        else if (normalized === 'CHANNEL_ERROR') geo.textContent = 'Не удалось подключиться к запросу';
      }),
    });

    return Object.freeze({
      enabled: true,
      errors: [],
      start: requestId => active.start(requestId),
      stop: () => active.stop(),
      getActiveRequestId: () => active.getActiveRequestId(),
    });
  }

  function installCreateButtonHook() {
    const button = document.querySelector('#askBtn');
    if (!button || button.dataset.nowMainCreateHook === '1') return false;
    button.dataset.nowMainCreateHook = '1';

    button.addEventListener('click', event => {
      const bridge = window.NowMainUiRealtimeBridge;
      const createAdapter = window.NowCreateRequestAdapter;
      if (!bridge?.enabled || !createAdapter || typeof createAdapter.createRequest !== 'function') return;

      const question = document.querySelector('#question');
      const geo = document.querySelector('#geo');
      const text = String(question?.value || '').trim();
      if (!text) return;

      if (button.dataset.nowMainCreateBusy === '1') {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      button.dataset.nowMainCreateBusy = '1';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const previousLabel = button.textContent;
      button.textContent = 'Отправляем…';

      const restore = () => {
        button.dataset.nowMainCreateBusy = '0';
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = previousLabel;
      };

      if (!navigator.geolocation?.getCurrentPosition) {
        if (geo) geo.textContent = 'Геолокация недоступна';
        restore();
        return;
      }

      if (geo) geo.textContent = 'Проверяем точность геолокации…';
      navigator.geolocation.getCurrentPosition(async position => {
        const accuracy = Number(position?.coords?.accuracy);
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(accuracy) || accuracy > 50 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          if (geo) geo.textContent = 'Нужна точность геолокации ±50 м или лучше';
          restore();
          return;
        }

        try {
          const result = await createAdapter.createRequest({ text, latitude, longitude });
          const requestId = String(result?.request_id || '').trim();
          if (!requestId) throw new Error('Create request adapter returned no request_id');
          await bridge.start(requestId);
          if (question) question.value = '';
          if (geo) geo.textContent = `Вопрос отправлен · точность ±${Math.round(accuracy)} м`;
        } catch (error) {
          if (geo) geo.textContent = `Не удалось отправить: ${error instanceof Error ? error.message : 'ошибка'}`;
        } finally {
          restore();
        }
      }, () => {
        if (geo) geo.textContent = 'Не удалось получить геолокацию';
        restore();
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
    installCreateButtonHook,
  });

  window.NowMainUiRealtimeBridge = createOptionalBridge();
  installCreateButtonHook();
})();
