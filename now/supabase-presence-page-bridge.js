(() => {
  const globalKey = 'NowSupabasePresencePageBridge';
  let service = null;
  let button = null;
  let installed = false;

  function resolveTargets() {
    return {
      button: document.querySelector('#presenceToggle'),
      status: document.querySelector('#presenceStatus'),
      hint: document.querySelector('#presenceHint'),
      accuracy: document.querySelector('#accuracy'),
      lastSeen: document.querySelector('#lastSeen'),
      geo: document.querySelector('#geo'),
    };
  }

  function render(snapshot = {}) {
    const { status, hint, accuracy, lastSeen, geo } = resolveTargets();
    const state = String(snapshot.state || 'OFF').toUpperCase();
    const acc = Number(snapshot.accuracy);
    if (accuracy && Number.isFinite(acc)) accuracy.textContent = `±${Math.round(acc)} м`;
    if (lastSeen && snapshot.updatedAt) lastSeen.textContent = new Date(snapshot.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (state === 'ENABLED') {
      if (status) status.textContent = '🟢 Я рядом';
      if (hint) hint.textContent = 'Вы участвуете в nearby matching';
      if (button) { button.textContent = 'Выключить'; button.classList.add('on'); }
      if (geo) geo.textContent = Number.isFinite(acc) ? `Место подтверждено · точность ±${Math.round(acc)} м` : 'Место подтверждено';
      return;
    }
    if (state === 'LOW_ACCURACY') {
      if (status) status.textContent = '🟡 Уточняем место';
      if (hint) hint.textContent = 'Точность должна быть ±50 м или лучше';
      if (button) { button.textContent = 'Выключить'; button.classList.remove('on'); }
      if (geo) geo.textContent = Number.isFinite(acc) ? `Точность пока ±${Math.round(acc)} м` : 'Уточняем геолокацию…';
      return;
    }
    if (state === 'STARTING') {
      if (status) status.textContent = 'Определяем место…';
      if (hint) hint.textContent = 'Пока не участвуете в matching';
      if (button) { button.textContent = 'Остановить'; button.classList.remove('on'); }
      if (geo) geo.textContent = 'Определяем ваше место…';
      return;
    }
    if (state === 'ERROR') {
      if (status) status.textContent = 'Не удалось определить место';
      if (hint) hint.textContent = snapshot.error || 'Попробуйте ещё раз';
      if (button) { button.textContent = 'Я рядом'; button.classList.remove('on'); }
      return;
    }
    if (status) status.textContent = 'Не беспокоить';
    if (hint) hint.textContent = 'Вы не получаете nearby-вопросы';
    if (button) { button.textContent = 'Я рядом'; button.classList.remove('on'); }
  }

  function install(client = window.supabase) {
    if (installed) return Object.freeze({ enabled: !!service, errors: [] });
    const factory = window.NowPresenceService?.createPresenceService;
    const targets = resolveTargets();
    if (typeof factory !== 'function' || !targets.button) {
      return Object.freeze({ enabled: false, errors: ['Presence service or #presenceToggle is unavailable'] });
    }

    service = factory(client, {
      onChange: render,
      onError: error => render({ state: 'ERROR', error: error?.message || 'Ошибка presence' }),
    });
    if (!service.enabled) return Object.freeze({ enabled: false, errors: service.errors || ['Presence service disabled'] });

    button = targets.button;
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const state = String(service.getSnapshot()?.state || 'OFF').toUpperCase();
      button.disabled = true;
      try {
        if (['ENABLED', 'LOW_ACCURACY', 'STARTING', 'ERROR'].includes(state)) await service.stop();
        else await service.start();
      } catch (error) {
        render({ state: 'ERROR', error: error?.message || 'Не удалось изменить статус' });
      } finally {
        button.disabled = false;
      }
    }, true);
    installed = true;
    render(service.getSnapshot());
    return Object.freeze({ enabled: true, errors: [], stop: () => service.stop() });
  }

  window[globalKey] = Object.freeze({ install, render });
})();
