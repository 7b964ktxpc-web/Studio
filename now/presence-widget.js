(() => {
  const STATE = Object.freeze({
    OFF: 'OFF',
    STARTING: 'STARTING',
    ENABLED: 'ENABLED',
    LOW_ACCURACY: 'LOW_ACCURACY',
    PAUSED: 'PAUSED',
  });

  const LABELS = Object.freeze({
    OFF: 'Не беспокоить',
    STARTING: 'Определяем место…',
    ENABLED: '🟢 Я рядом',
    LOW_ACCURACY: '🟡 Уточняем место',
    PAUSED: '⏸ Временно недоступно',
  });

  function format(snapshot) {
    const state = snapshot?.state || STATE.OFF;
    const accuracy = Number.isFinite(snapshot?.accuracyM) ? Math.round(snapshot.accuracyM) : null;

    return {
      state,
      label: LABELS[state] || LABELS.OFF,
      accuracyText: accuracy === null ? 'Точность неизвестна' : `Точность ±${accuracy} м`,
      canReceiveNearby: state === STATE.ENABLED,
      radiusText: 'Основной радиус 50 м · максимум 250 м',
    };
  }

  function bindPresencePanel(root, service) {
    if (!root || !service) throw new Error('Presence panel requires root and service');

    const toggle = root.querySelector('[data-presence-toggle]');
    const stateNode = root.querySelector('[data-presence-state]');
    const accuracyNode = root.querySelector('[data-presence-accuracy]');
    const radiusNode = root.querySelector('[data-presence-radius]');
    if (!toggle || !stateNode || !accuracyNode || !radiusNode) {
      throw new Error('Presence panel markup is incomplete');
    }

    const render = snapshot => {
      const view = format(snapshot);
      stateNode.textContent = view.label;
      accuracyNode.textContent = view.accuracyText;
      radiusNode.textContent = view.radiusText;
      toggle.textContent = view.canReceiveNearby ? 'Выключить «Я рядом»' : 'Включить «Я рядом»';
      toggle.disabled = view.state === STATE.STARTING;
      root.dataset.presenceState = view.state;
    };

    render(service.getSnapshot());

    toggle.addEventListener('click', async () => {
      toggle.disabled = true;
      try {
        const state = service.getSnapshot().state;
        if (state === STATE.ENABLED || state === STATE.STARTING || state === STATE.LOW_ACCURACY) {
          await service.stop();
        } else {
          await service.start();
        }
      } finally {
        render(service.getSnapshot());
      }
    });

    return () => toggle.replaceWith(toggle.cloneNode(true));
  }

  window.NowPresenceWidget = { STATE, format, bindPresencePanel };
})();
