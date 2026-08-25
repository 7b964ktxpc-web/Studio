(() => {
  const globalKey = 'NowMainUiAnswerBridge';

  function resolveAdapter() {
    const adapter = window.NowAnswerRequestAdapter;
    if (!adapter || typeof adapter.submitAnswer !== 'function') {
      return { adapter: null, errors: ['Answer request adapter is not available'] };
    }
    return { adapter, errors: [] };
  }

  function createOptionalBridge({ onSuccess, onError, onStatus } = {}) {
    const resolved = resolveAdapter();
    const incoming = document.querySelector('#incomingDemo');
    const buttons = incoming ? [...incoming.querySelectorAll('[data-incoming]')] : [];

    if (!resolved.adapter || !incoming || buttons.length === 0) {
      return Object.freeze({
        enabled: false,
        errors: resolved.errors,
        bind() { return false; },
        applySnapshot() { return false; },
        unbind() {},
        getActiveRequestId() { return null; },
      });
    }

    let activeRequestId = null;
    let busy = false;
    let terminal = false;
    let bound = false;

    const setStatus = message => {
      if (incoming) {
        const status = incoming.querySelector('[data-answer-status]');
        if (status) status.textContent = message;
      }
      (onStatus ?? (() => {}))(message);
    };

    const disableButtons = disabled => buttons.forEach(button => { button.disabled = disabled; });

    const applySnapshot = snapshot => {
      const snapshotRequestId = String(snapshot?.request_id || snapshot?.id || '').trim();
      if (!snapshotRequestId || snapshotRequestId !== activeRequestId) return false;
      const status = String(snapshot?.request_status ?? snapshot?.status ?? '').toUpperCase();
      if (status === 'ANSWERED') {
        terminal = true;
        disableButtons(true);
        setStatus('На этот запрос уже ответили');
        return true;
      }
      if (status === 'EXPIRED') {
        terminal = true;
        disableButtons(true);
        setStatus('Этот запрос больше не принимает ответы');
        return true;
      }
      if (status === 'CANCELLED') {
        terminal = true;
        disableButtons(true);
        setStatus('Этот запрос отменён');
        return true;
      }
      if (status === 'SEARCHING') {
        terminal = false;
        if (!busy) disableButtons(false);
        setStatus('Вопрос от человека рядом');
        return true;
      }
      return false;
    };

    const clickHandler = async event => {
      const button = event.currentTarget;
      if (busy || terminal || !activeRequestId) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      const answer = String(button.dataset.incoming || '').trim();
      if (answer.length < 1 || answer.length > 240) {
        setStatus('Ответ должен быть от 1 до 240 символов');
        return;
      }

      busy = true;
      disableButtons(true);
      setStatus('Отправляем ответ…');
      try {
        const result = await resolved.adapter.submitAnswer({ request_id: activeRequestId, answer });
        if (result?.error?.code) throw Object.assign(new Error(result.error.message || result.error.code), { code: result.error.code });
        if (result?.ok === false) throw new Error('Answer request adapter rejected the answer');

        const requestId = activeRequestId;
        activeRequestId = null;
        terminal = true;
        onSuccess?.({ request_id: requestId, answer, result });
        setStatus('Спасибо! Ваш ответ отправлен анонимно');
        buttons.forEach(item => { item.hidden = true; });
      } catch (error) {
        const code = String(error?.code || '').toUpperCase();
        if (code === 'REQUEST_EXPIRED') {
          activeRequestId = null;
          terminal = true;
          disableButtons(true);
          setStatus('Этот запрос больше не принимает ответы');
        } else if (code === 'ALREADY_ANSWERED') {
          activeRequestId = null;
          terminal = true;
          disableButtons(true);
          setStatus('На этот запрос уже ответили');
        } else {
          setStatus(`Не удалось отправить ответ: ${error instanceof Error ? error.message : 'ошибка'}`);
          disableButtons(false);
        }
        onError?.(error);
      } finally {
        busy = false;
      }
    };

    const bind = requestId => {
      const normalized = String(requestId || '').trim();
      if (!normalized) return false;
      activeRequestId = normalized;
      terminal = false;
      incoming.style.display = '';
      buttons.forEach(button => {
        button.hidden = false;
        button.disabled = false;
        if (!bound) button.addEventListener('click', clickHandler, true);
      });
      bound = true;
      setStatus('Вопрос от человека рядом');
      return true;
    };

    const unbind = () => {
      activeRequestId = null;
      busy = false;
      terminal = false;
      buttons.forEach(button => {
        button.disabled = false;
        button.hidden = false;
        button.removeEventListener('click', clickHandler, true);
      });
      bound = false;
    };

    return Object.freeze({
      enabled: true,
      errors: [],
      bind,
      applySnapshot,
      unbind,
      getActiveRequestId: () => activeRequestId,
    });
  }

  window[globalKey] = Object.freeze({ resolveAdapter, createOptionalBridge });
  window.NowMainUiAnswerBridge = Object.freeze({
    enabled: false,
    errors: [],
    bind() { return false; },
    applySnapshot() { return false; },
    unbind() {},
    getActiveRequestId() { return null; },
  });
})();
