(() => {
  const globalKey = 'NowSupabaseFinalizeRequestPageBridge';

  function install(candidate = window.supabase) {
    const factory = window.NowSupabaseFinalizeRequestAdapter?.createOptionalAdapter;
    if (typeof factory !== 'function') {
      return Object.freeze({ enabled: false, errors: ['Supabase finalize adapter contract is unavailable'] });
    }
    const adapter = factory(candidate);
    if (!adapter?.enabled) {
      return Object.freeze({ enabled: false, errors: adapter?.errors || ['Supabase finalize adapter is disabled'] });
    }
    window.NowFinalizeRequestAdapter = adapter;
    return Object.freeze({ enabled: true, errors: [] });
  }

  window[globalKey] = Object.freeze({ install });
  window.NowSupabaseFinalizeRequestPageBridge = window[globalKey];
})();
