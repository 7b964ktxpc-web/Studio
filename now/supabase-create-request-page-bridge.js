(() => {
  const globalKey = 'NowSupabaseCreateRequestPageBridge';

  function install(candidate = window.supabase) {
    const factory = window.NowSupabaseCreateRequestAdapter?.createOptionalAdapter;
    if (typeof factory !== 'function') {
      return Object.freeze({ enabled: false, errors: ['Supabase create adapter contract is unavailable'] });
    }

    const adapter = factory(candidate);
    if (!adapter?.enabled) {
      return Object.freeze({ enabled: false, errors: adapter?.errors || ['Supabase create adapter is disabled'] });
    }

    window.NowCreateRequestAdapter = adapter;
    return Object.freeze({ enabled: true, errors: [] });
  }

  window[globalKey] = Object.freeze({ install });
  window.NowSupabaseCreateRequestPageBridge = Object.freeze({ install });
})();
