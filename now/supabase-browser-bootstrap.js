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

      let session = (await client.auth.getSession()).data?.session || null;
      if (!session) {
        const signedIn = await client.auth.signInAnonymously();
        if (signedIn.error) throw signedIn.error;
        session = signedIn.data?.session || null;
      }
      if (!session?.user?.id) throw new Error('Authenticated Supabase session was not created');

      const realtimeFactory = window.NowSupabaseRealtimeAdapter?.createOptionalAdapter;
      const realtime = typeof realtimeFactory === 'function' ? realtimeFactory(client) : null;
      if (realtime?.enabled) window.NowRealtimeAdapter = realtime;

      window.NowSupabaseCreateRequestPageBridge?.install?.(client);
      window.NowSupabaseAnswerRequestPageBridge?.install?.(client);

      if (window.NowRealtimePageBridge?.createOptionalBridge) {
        window.NowRequestRealtimeBridge = window.NowRealtimePageBridge.createOptionalBridge({});
        window.NowRealtimePageBridge.installCreateRequestButtonHook?.();
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
