/* Vencimento PA - Supabase bootstrap (non-invasive)
 * This file intentionally does not sync or alter local data yet.
 * Configure the public project values through window.VPA_SUPABASE_CONFIG
 * before enabling the future synchronization layer.
 */
(function () {
  const config = window.VPA_SUPABASE_CONFIG || {};
  const state = {
    configured: Boolean(config.url && config.anonKey),
    url: config.url || '',
    client: null,
    error: null
  };

  window.VPASupabase = {
    state,
    isConfigured() { return state.configured; },
    getConfigStatus() {
      return {
        configured: state.configured,
        urlPresent: Boolean(state.url),
        keyPresent: Boolean(config.anonKey),
        message: state.configured
          ? 'Configuração pública encontrada; sincronização ainda não ativada.'
          : 'Supabase ainda não configurado no aplicativo.'
      };
    }
  };

  console.info('[VPA] Supabase bootstrap carregado:', window.VPASupabase.getConfigStatus());
})();
