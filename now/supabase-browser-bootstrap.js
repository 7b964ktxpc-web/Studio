(() => {
  const PROJECT_URL = 'https://amyysvcpmbyuxelxixqj.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_3i7SUzaHZEproIBz4l8K-g_jsOhoiiB';
  const runtimeScripts = [
    'supabase-nearby-notification-source.js',
    'main-ui-answer-realtime-controller.js',
    'main-ui-answer-nearby-coordinator.js',
    'supabase-presence-adapter.js',
    'supabase-presence-page-bridge.js',
    'supabase-request-answers-adapter.js',
    'main-ui-request-answers-bridge.js',
    'supabase-finalize-request-adapter.js',
    'supabase-finalize-request-page-bridge.js',
  ];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(script => script.src.endsWith(`/${src}`))) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  async function bootstrap() {
    const status = document.querySelector('#geo');
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const client = createClient(PROJECT_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      window.supabase = client;

      let session = (await client.auth.getSession()).data?.session || null;
      if (!session) {
        const signedIn = await client.auth.signInAnonymously();
        if (signedIn.error) throw signedIn.error;
        session = signedIn.data?.session || null;
      }
      if (!session?.user?.id) throw new Error('Authenticated Supabase session was not created');

      for (const src of runtimeScripts) await loadScript(src);

      const realtimeFactory = window.NowSupabaseRealtimeAdapter?.createOptionalAdapter;
      const realtime = typeof realtimeFactory === 'function' ? realtimeFactory(client) : null;
      if (realtime?.enabled) window.NowRealtimeAdapter = realtime;

      window.NowSupabaseCreateRequestPageBridge?.install?.(client);
      window.NowSupabaseAnswerRequestPageBridge?.install?.(client);
      window.NowSupabasePresencePageBridge?.install?.(client);
      window.NowSupabaseFinalizeRequestPageBridge?.install?.(client);

      if (window.NowRealtimePageBridge?.createOptionalBridge) {
        window.NowRequestRealtimeBridge = window.NowRealtimePageBridge.createOptionalBridge({
          onSnapshot: snapshot => {
            window.NowMainUiRequestAnswersBridge?.applySnapshot?.(snapshot);
            if (!status) return;
            const statusKind = String(snapshot?.request_status || '').toUpperCase();
            if (snapshot?.event_kind === 'REQUEST_ANSWERED') {
              const latest = snapshot?.latest_answer?.answer;
              const count = Array.isArray(snapshot?.answers) ? snapshot.answers.length : 0;
              status.textContent = latest
                ? `Получен ответ: ${latest}${count > 1 ? ` · ответов ${count}` : ''}`
                : 'Получен новый ответ рядом';
              return;
            }
            if (statusKind === 'ANSWERED') status.textContent = 'Ответы собраны';
            else if (statusKind === 'EXPIRED') status.textContent = 'Время ожидания истекло';
            else if (statusKind === 'CANCELLED') status.textContent = 'Запрос отменён';
          },
        });
        window.NowRealtimePageBridge.installCreateRequestButtonHook?.();
      }

      const source = window.NowSupabaseNearbyNotificationSource?.createOptionalSource?.(client);
      const controller = window.NowMainUiAnswerRealtimeController?.create?.({
        bridge: window.NowMainUiAnswerBridge,
        onSnapshot: snapshot => window.NowMainUiRequestAnswersBridge?.applySnapshot?.(snapshot),
        onError: error => console.error('[Сейчас] answer realtime error', error),
      });

      if (source?.enabled && controller?.enabled && window.NowMainUiAnswerNearbyCoordinator?.create) {
        window.NowNearbyRequestEventSource = source;
        const coordinator = window.NowMainUiAnswerNearbyCoordinator.create({
          source,
          controller,
          bridge: window.NowMainUiAnswerBridge,
          onEvent: event => {
            const request = event?.request || {};
            const incoming = document.querySelector('#incoming');
            const title = incoming?.querySelector('[data-nearby-question]') || incoming?.querySelector('div[style*="font-size:18px"]');
            const distance = incoming?.querySelector('.distance');
            if (title && request.text) title.textContent = request.text;
            if (distance) {
              const distanceValue = Number(request.distance_m);
              distance.textContent = Number.isFinite(distanceValue)
                ? `📍 Ты примерно в ${Math.round(distanceValue)} м от места`
                : '📍 Вопрос от человека рядом';
            }
          },
          onError: error => console.error('[Сейчас] nearby notification error', error),
        });
        if (coordinator?.enabled) await coordinator.start();
        window.NowNearbyAnswerCoordinator = coordinator;
      }

      window.NowSupabaseRuntime = Object.freeze({ authenticated: true, userId: session.user.id });
      if (status) status.textContent = 'Supabase подключён';
    } catch (error) {
      window.NowSupabaseRuntime = Object.freeze({ authenticated: false, error: error?.message || String(error) });
      if (status) status.textContent = `Supabase/Auth: ${error?.message || 'ошибка подключения'}`;
      console.error('[Сейчас] Supabase bootstrap failed', error);
    }
  }

  window.NowSupabaseBootstrap = Object.freeze({ bootstrap });
  bootstrap();
})();
