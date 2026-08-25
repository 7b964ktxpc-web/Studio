(() => {
  const PROJECT_URL = 'https://amyysvcpmbyuxelxixqj.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_3i7SUzaHZEproIBz4l8K-g_jsOhoiiB';

  async function bootstrap() {
    const status = document.querySelector('#geo');
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const client = createClient(PROJECT_URL, PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      window.supabase = client;

      const session = await client.auth.getSession();
      if (!session.data?.session) {
        const signedIn = await client.auth.signInAnonymously();
        if (signedIn.error) throw signedIn.error;
      }

      const realtimeFactory = window.NowSupabaseRealtimeAdapter?.createOptionalAdapter;
      const realtime = typeof realtimeFactory === 'function' ? realtimeFactory(client) : null;
      if (realtime?.enabled) window.NowRealtimeAdapter = realtime;

      const createBridge = window.NowSupabaseCreateRequestPageBridge;
      const answerBridge = window.NowSupabaseAnswerRequestPageBridge;
      createBridge?.install?.(client);
      answerBridge?.install?.(client);

      if (window.NowRealtimePageBridge?.createOptionalBridge) {
        window.NowRequestRealtimeBridge = window.NowRealtimePageBridge.createOptionalBridge({});
        window.NowRealtimePageBridge.installCreateRequestButtonHook?.();
      }

      window.NowSupabaseRuntime = Object.freeze({ authenticated: true, userId: signedInUserId(client) });
      if (status) status.textContent = 'Supabase подключён';
    } catch (error) {
      window.NowSupabaseRuntime = Object.freeze({ authenticated: false, error: error?.message || String(error) });
      if (status) status.textContent = `Supabase/Auth: ${error?.message || 'ошибка подключения'}`;
      console.error('[Сейчас] Supabase bootstrap failed', error);
    }
  }

  function signedInUserId(client) {
    return client.auth.getUser().then ? null : null;
  }

  window.NowSupabaseBootstrap = Object.freeze({ bootstrap });
  bootstrap();
})();
