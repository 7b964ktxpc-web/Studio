(() => {
  const globalKey = 'NowRealtimePageBridge';

  function resolveDependencies() {
    const contract = window.NowRealtimeAdapterContract;
    const lifecycleApi = window.__NOW_REALTIME_UI__;
    const resolved = contract?.resolveAdapter?.(window.NowRealtimeAdapter);

    if (!resolved?.adapter || !lifecycleApi?.createActiveRequestUiLifecycle) {
      return { adapter: null, lifecycleApi: null, errors: resolved?.errors || ['Realtime UI dependencies are not available'] };
    }

    return { adapter: resolved.adapter, lifecycleApi, errors: [] };
  }

  function createDefaultUiHandlers() {
    const geo = document.querySelector('#geo');
    if (!geo) return {};
    return {
      onSnapshot(snapshot) {
        const status = String(snapshot?.request_status ?? snapshot?.status ?? '').toUpperCase();
        if (snapshot?.event_kind === 'REQUEST_ANSWERED') geo.textContent = 'Получен ответ рядом';
        else if (status === 'ANSWERED') geo.textContent = 'Ответы собраны';
        else if (status === 'EXPIRED') geo.textContent = 'Время ожидания истекло';
        else if (status === 'CANCELLED') geo.textContent = 'Запрос отменён';
        else if (status === 'SEARCHING') geo.textContent = 'Ищем ответ рядом…';
      },
      onStatus(status) {
        const normalized = String(status || '').toUpperCase();
        if (normalized === 'SUBSCRIBED') geo.textContent = 'Связь с запросом установлена';
        else if (normalized === 'CHANNEL_ERROR') geo.textContent = 'Не удалось подключиться к запросу';
      },
      onError() { geo.textContent = 'Не удалось обновить запрос'; },
    };
  }

  function createOptionalBridge({ onSnapshot, onError, onStatus } = {}) {
    const dependencies = resolveDependencies();
    if (!dependencies.adapter || !dependencies.lifecycleApi) {
      return Object.freeze({ enabled: false, errors: dependencies.errors, async start(){ return null; }, async stop(){}, getActiveRequestId(){ return null; } });
    }

    const defaults = createDefaultUiHandlers();
    let active;
    const snapshotHandler = snapshot => {
      (onSnapshot ?? defaults.onSnapshot)?.(snapshot);
      const status = String(snapshot?.request_status ?? snapshot?.status ?? '').toUpperCase();
      if (['ANSWERED', 'EXPIRED', 'CANCELLED'].includes(status)) {
        const terminalRequestId = active?.getActiveRequestId?.() ?? null;
        Promise.resolve().then(() => {
          if (terminalRequestId && active.getActiveRequestId() !== terminalRequestId) return;
          return active.stop();
        }).catch(() => {});
      }
    };

    active = dependencies.lifecycleApi.createActiveRequestUiLifecycle(dependencies.adapter, {
      onSnapshot: snapshotHandler,
      onError: onError ?? defaults.onError,
      onStatus: onStatus ?? defaults.onStatus,
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
    if (!adapter || typeof adapter.createRequest !== 'function') throw new Error('Create request adapter is not available');

    const result = await adapter.createRequest(input);
    const requestId = String(result?.request_id || '').trim();
    if (!requestId) throw new Error('Create request adapter returned no request_id');

    window.NowMainUiRequestAnswersBridge?.bind?.(requestId);

    const start = window.NowStartRequestRealtime;
    if (typeof start !== 'function') throw new Error('Realtime start hook is not available');
    try {
      await start(requestId);
    } catch (error) {
      window.NowMainUiRequestAnswersBridge?.unbind?.();
      const stop = window.NowStopRequestRealtime;
      if (typeof stop === 'function') {
        try { await stop(); } catch { /* preserve original error */ }
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
      if (button.dataset.nowCreateRequestBusy === '1') {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }

      event.preventDefault(); event.stopImmediatePropagation();
      button.dataset.nowCreateRequestBusy = '1';
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const previousLabel = button.textContent;
      button.textContent = 'Отправляем…';
      const restoreButton = () => {
        button.dataset.nowCreateRequestBusy = '0';
        button.disabled = false;
        button.removeAttribute('aria-busy');
        button.textContent = previousLabel;
      };

      if (!navigator.geolocation?.getCurrentPosition) {
        if (geo) geo.textContent = 'Геолокация недоступна';
        restoreButton();
        return;
      }
      if (geo) geo.textContent = 'Проверяем точность геолокации…';

      navigator.geolocation.getCurrentPosition(async position => {
        const accuracy = Number(position?.coords?.accuracy);
        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (!Number.isFinite(accuracy) || accuracy > 50 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          if (geo) geo.textContent = 'Нужна точность геолокации ±50 м или лучше';
          restoreButton();
          return;
        }
        try {
          await createAndStartRequest({ text, latitude, longitude });
          if (question) question.value = '';
          if (geo) geo.textContent = `Вопрос отправлен · точность ±${Math.round(accuracy)} м`;
        } catch (error) {
          if (geo) geo.textContent = `Не удалось отправить: ${error instanceof Error ? error.message : 'ошибка'}`;
        } finally { restoreButton(); }
      }, () => {
        if (geo) geo.textContent = 'Не удалось получить геолокацию';
        restoreButton();
      }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 });
    }, true);
    return true;
  }

  window[globalKey] = Object.freeze({ resolveDependencies, createOptionalBridge, createAndStartRequest, installCreateRequestButtonHook });
  window.NowCreateAndStartRequest = createAndStartRequest;
  installCreateRequestButtonHook();
})();
