/* Vencimento PA - Supabase client bootstrap
 * Safe phase: initializes the public Supabase client only.
 * It does not upload, modify, or delete local IndexedDB data.
 */
(function () {
  'use strict';

  const config = window.VPA_SUPABASE_CONFIG || {};
  const state = {
    configured: Boolean(config.url && config.anonKey),
    initialized: false,
    loading: false,
    url: config.url || '',
    client: null,
    error: null
  };

  let loadingPromise = null;

  function status(message) {
    return {
      configured: state.configured,
      initialized: state.initialized,
      loading: state.loading,
      urlPresent: Boolean(state.url),
      keyPresent: Boolean(config.anonKey),
      message: message || (state.initialized
        ? 'Cliente Supabase inicializado; sincronização ainda não ativada.'
        : state.configured
          ? 'Configuração pública encontrada; aguardando inicialização.'
          : 'Supabase ainda não configurado no aplicativo.'),
      error: state.error
    };
  }

  function loadLibrary() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return Promise.resolve(window.supabase);
    }
    if (loadingPromise) return loadingPromise;

    state.loading = true;
    loadingPromise = new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.async = true;
      script.onload = function () {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          resolve(window.supabase);
        } else {
          reject(new Error('Biblioteca Supabase carregada, mas createClient não foi encontrado.'));
        }
      };
      script.onerror = function () {
        reject(new Error('Não foi possível carregar a biblioteca Supabase. Verifique a conexão.'));
      };
      document.head.appendChild(script);
    }).then(function (lib) {
      state.loading = false;
      return lib;
    }).catch(function (error) {
      state.loading = false;
      state.error = error.message;
      throw error;
    });

    return loadingPromise;
  }

  async function init() {
    if (!state.configured) {
      throw new Error('Configure VPA_SUPABASE_CONFIG com url e anonKey antes de inicializar.');
    }
    if (state.client) return state.client;

    const lib = await loadLibrary();
    state.client = lib.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    state.initialized = true;
    state.error = null;
    console.info('[VPA] Cliente Supabase inicializado. Nenhum dado local foi enviado.');
    return state.client;
  }

  async function getSession() {
    const client = await init();
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session;
  }

  async function signIn(email, password) {
    const client = await init();
    const result = await client.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    return result.data;
  }

  async function signOut() {
    const client = await init();
    const result = await client.auth.signOut();
    if (result.error) throw result.error;
    return true;
  }

  window.VPASupabase = {
    state: state,
    isConfigured: function () { return state.configured; },
    getConfigStatus: status,
    init: init,
    getSession: getSession,
    signIn: signIn,
    signOut: signOut,
    getClient: function () { return state.client; }
  };

  if (state.configured) {
    init().catch(function (error) {
      console.warn('[VPA] Supabase não inicializado:', error.message);
    });
  } else {
    console.info('[VPA] Supabase aguardando configuração.');
  }
})();
