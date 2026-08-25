(() => {
  const globalKey = 'NowSupabaseAnswerRequestPageBridge';

  function install(candidate = window.supabase) {
    const factory = window.NowSupabaseAnswerRequestAdapter;
    if (!factory || typeof factory.createOptionalAdapter !== 'function') {
      return Object.freeze({ enabled: false, errors: ['NowSupabaseAnswerRequestAdapter is not loaded'] });
    }
    const adapter = factory.createOptionalAdapter(candidate);
    if (!adapter.enabled) {
      return Object.freeze({ enabled: false, errors: adapter.errors || [] });
    }
    window.NowAnswerRequestAdapter = adapter;
    return Object.freeze({ enabled: true, errors: [] });
  }

  window[globalKey] = Object.freeze({ install });
  window[globalKey].install();
})();
