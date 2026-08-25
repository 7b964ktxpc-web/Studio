(() => {
  const globalKey = 'NowMainUiRequestAnswersBridge';
  let activeRequestId = null;
  let card = null;
  let busy = false;

  function resolveAdapter() {
    const factory = window.NowSupabaseRequestAnswersAdapter?.createOptionalAdapter;
    const adapter = typeof factory === 'function' ? factory(window.supabase) : null;
    return adapter?.enabled
      ? { adapter, errors: [] }
      : { adapter: null, errors: ['Request answers adapter is not available'] };
  }

  function resolveFinalizeAdapter() {
    const factory = window.NowSupabaseFinalizeRequestAdapter?.createOptionalAdapter;
    const adapter = typeof factory === 'function' ? factory(window.supabase) : null;
    return adapter?.enabled
      ? { adapter, errors: [] }
      : { adapter: null, errors: ['Request finalize adapter is not available'] };
  }

  function ensureCard() {
    if (card?.isConnected) return card;
    const ask = document.querySelector('.ask');
    if (!ask) return null;
    card = document.createElement('section');
    card.className = 'card';
    card.id = 'requestAnswersSummary';
    card.hidden = true;
    card.style.borderColor = '#d2e8d7';
    card.style.background = '#f4fbf5';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <div>
          <div class="eyebrow">Ответы рядом</div>
          <div data-answer-count style="font-size:18px;font-weight:900;margin-top:6px">Ждём первый ответ</div>
        </div>
        <div data-answer-live style="font-size:12px;color:#4c7956">Поиск продолжается</div>
      </div>
      <div data-answer-latest style="margin-top:10px;font-size:15px"></div>
      <div data-answer-list style="display:grid;gap:6px;margin-top:10px"></div>
      <button data-finalize-request type="button" style="margin-top:12px;width:100%;border:0;border-radius:12px;padding:12px;background:#151515;color:#fff;font:inherit;font-weight:850">Завершить и показать итог</button>
    `;
    const button = card.querySelector('[data-finalize-request]');
    button?.addEventListener('click', async () => {
      if (busy || !activeRequestId) return;
      const resolved = resolveFinalizeAdapter();
      if (!resolved.adapter) return;
      busy = true;
      button.disabled = true;
      button.textContent = 'Завершаем…';
      try {
        await resolved.adapter.finalizeRequest(activeRequestId);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Завершить и показать итог';
        busy = false;
        const live = card?.querySelector('[data-answer-live]');
        if (live) live.textContent = error?.message || 'Не удалось завершить запрос';
      }
    });
    ask.insertAdjacentElement('afterend', card);
    return card;
  }

  function render(answers = [], terminalStatus = null) {
    const root = ensureCard();
    if (!root) return;
    root.hidden = !activeRequestId;
    const count = root.querySelector('[data-answer-count]');
    const latest = root.querySelector('[data-answer-latest]');
    const list = root.querySelector('[data-answer-list]');
    const live = root.querySelector('[data-answer-live]');
    const finalize = root.querySelector('[data-finalize-request]');
    if (count) count.textContent = answers.length ? `${answers.length} ${answers.length === 1 ? 'ответ' : 'ответа'}` : 'Ждём первый ответ';
    if (latest) latest.textContent = answers.length ? `Последний: ${answers[answers.length - 1].answer}` : '';
    if (list) {
      list.replaceChildren(...answers.map(item => {
        const row = document.createElement('div');
        row.style.cssText = 'border:1px solid #dcecdf;background:#fff;border-radius:11px;padding:9px 10px;font-size:13px';
        row.textContent = item.answer;
        return row;
      }));
    }
    if (live) {
      if (terminalStatus === 'ANSWERED') live.textContent = 'Запрос завершён';
      else if (terminalStatus === 'EXPIRED') live.textContent = 'Время истекло';
      else if (terminalStatus === 'CANCELLED') live.textContent = 'Запрос отменён';
      else live.textContent = 'Поиск продолжается';
    }
    if (finalize) {
      finalize.hidden = !!terminalStatus;
      if (!terminalStatus && !busy) {
        finalize.disabled = false;
        finalize.textContent = 'Завершить и показать итог';
      }
    }
  }

  async function refresh(requestId) {
    const normalized = String(requestId || '').trim();
    if (!normalized) return [];
    const resolved = resolveAdapter();
    if (!resolved.adapter) return [];
    const answers = await resolved.adapter.listAnswers(normalized);
    if (normalized !== activeRequestId) return [];
    render(answers);
    return answers;
  }

  window[globalKey] = Object.freeze({
    bind(requestId) {
      activeRequestId = String(requestId || '').trim() || null;
      busy = false;
      render([]);
      if (activeRequestId) refresh(activeRequestId).catch(() => {});
      return !!activeRequestId;
    },
    refresh,
    applySnapshot(snapshot) {
      const requestId = String(snapshot?.request_id || '').trim();
      if (!requestId || requestId !== activeRequestId) return false;
      const eventKind = String(snapshot?.event_kind || '').toUpperCase();
      const status = String(snapshot?.request_status || '').toUpperCase();
      const answers = Array.isArray(snapshot?.answers) ? snapshot.answers : [];
      if (eventKind === 'REQUEST_ANSWERED') refresh(requestId).catch(() => {});
      if (['ANSWERED', 'EXPIRED', 'CANCELLED'].includes(status)) render(answers, status);
      else if (eventKind === 'REQUEST_ANSWERED') render(answers, null);
      return true;
    },
    unbind() {
      activeRequestId = null;
      busy = false;
      if (card) card.hidden = true;
    },
    getActiveRequestId() { return activeRequestId; },
  });
})();
