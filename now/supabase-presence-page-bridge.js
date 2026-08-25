(() => {
  const globalKey = 'NowSupabasePresencePageBridge';
  let active = null;

  function resolveAdapter() {
    const adapter = window.NowSupabasePresenceAdapter?.createOptionalAdapter?.();
    return adapter?.enabled
      ? { adapter, errors: [] }
      : { adapter: null, errors: adapter?.errors || ['Supabase presence adapter is unavailable'] };
  }

  function install(candidateClient) {
    const button = document.querySelector('#presenceToggle');
    if (!button || button.dataset.nowPresenceHook === '1') return false;
    button.dataset.nowPresenceHook = '1';

    const resolved = window.NowSupabasePresenceAdapter?.createOptionalAdapter?.(candidateClient);
    if (!resolved?.enabled) return false;

    const geo = document.querySelector('#geo');
    const status = document.querySelector('#presenceStatus');
    const hint = document.querySelector('#presenceHint');
    const accuracyEl = document.querySelector('#accuracy');
    const lastSeen = document.querySelector('#lastSeen');

    let watchId = null;
    let activePresence = false;
    let busy = false;

    const setState = (on, location = null) => {
      activePresence = on;
      if (!on) {
        if (status) status.textContent = 'Не беспокоить';
        if (hint) hint.textContent = 'Вы не получаете nearby-вопросы';
        button.textContent = 'Я рядом';
        button.classList.remove('on');
        return;
      }
      const accuracy = location?.coords?.accuracy;
      if (Number.isFinite(accuracy) && accuracy <= 50) {
        if (status) status.textContent = '🟢 Я рядом';
        if (hint) hint.textContent = 'Вы участвуете в nearby matching';
        button.textContent = 'Выключить';
        button.classList.add('on');
        if (accuracyEl) accuracyEl.textContent = `±${Math.round(accuracy)} м`;
        if (lastSeen) lastSeen.textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      } else {
        if (status) status.textContent = '🟡 Уточняем место';
        if (hint) hint.textContent = 'Точность должна быть ±50 м или лучше';
        button.textContent = 'Выключить';
        button.classList.remove('on');
      }
    };

    const stopWatch = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    };

    const disable = async () => {
      stopWatch();
      try {
        await resolved.disable();
      } finally {
        setState(false);
        if (geo) geo.textContent = 'Геолокация отключена';
      }
    };

    const update = async position => {
      const accuracy = Number(position?.coords?.accuracy);
      if (!Number.isFinite(accuracy) || accuracy > 50) {
        setState(true, position);
        if (geo) geo.textContent = Number.isFinite(accuracy)
          ? `Точность пока ±${Math.round(accuracy)} м`
          : 'Нужна точность геолокации ±50 м или лучше';
        return;
      }

      try {
        await resolved.upsert({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
          available: true,
        });
        setState(true, position);
        if (geo) geo.textContent = `Место подтверждено · точность ±${Math.round(accuracy)} м`;
      } catch (error) {
        if (geo) geo.textContent = `Не удалось обновить присутствие: ${error?.message || 'ошибка'}`;
      }
    };

    const enable = () => {
      if (!navigator.geolocation?.watchPosition) {
        if (geo) geo.textContent = 'Геолокация недоступна';
        return;
      }
      activePresence = true;
      button.disabled = true;
      if (geo) geo.textContent = 'Определяем ваше место…';
      watchId = navigator.geolocation.watchPosition(update, async () => {
        await disable();
        if (geo) geo.textContent = 'Не удалось получить геолокацию';
      }, {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 15000,
      });
      button.disabled = false;
    };

    button.addEventListener('click', async event => {
      if (busy) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      busy = true;
      button.setAttribute('aria-busy', 'true');
      try {
        if (activePresence) await disable();
        else enable();
      } finally {
        busy = false;
        button.removeAttribute('aria-busy');
      }
    }, true);

    active = Object.freeze({ stop: disable, isActive: () => activePresence });
    window.NowSupabasePresenceState = active;
    return true;
  }

  window[globalKey] = Object.freeze({ resolveAdapter, install });
})();
