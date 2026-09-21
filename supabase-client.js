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

  async function getProfile(userId) {
    const client = await init();
    if (!userId) return null;
    const result = await client.from('profiles').select('id, full_name, role, active').eq('id', userId).maybeSingle();
    if (result.error) throw result.error;
    return result.data || null;
  }


  const statusMap = {
    corredor: 'in_corridor',
    vencimento: 'found',
    separado: 'separated',
    resolvido: 'resolved'
  };

  async function syncProduct(product, corridorNumber) {
    const client = await init();
    const session = await getSession();
    if (!session || !session.user) throw new Error('Nenhuma sessão autenticada encontrada.');
    if (!product || !product.id) throw new Error('Produto sem identificador local.');
    if (!Number.isFinite(Number(corridorNumber))) throw new Error('Corredor local sem número válido.');

    const corridorResult = await client
      .from('corridors')
      .select('id, corridor_number')
      .eq('corridor_number', Number(corridorNumber))
      .eq('active', true)
      .maybeSingle();
    if (corridorResult.error) throw corridorResult.error;
    if (!corridorResult.data) {
      throw new Error('Corredor ' + corridorNumber + ' não encontrado no Supabase. Cadastre-o na tabela corridors antes de sincronizar.');
    }

    const payload = {
      id: product.id,
      name: String(product.name || '').trim(),
      ean: product.ean ? String(product.ean).trim() : null,
      corridor_id: corridorResult.data.id,
      quantity_found: Math.max(0, Number(product.quantity || product.quantityFound || 0)),
      quantity_separated: Math.max(0, Number(product.quantitySeparated || 0)),
      expiration_date: product.expiry || null,
      status: statusMap[product.status] || 'found',
      registered_by: session.user.id
    };
    if (!payload.name) throw new Error('Produto sem nome.');
    const result = await client.from('products').upsert(payload, { onConflict: 'id' }).select().single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function syncProducts(products) {
    const list = Array.isArray(products) ? products : [];
    const results = { total: list.length, synced: 0, failed: 0, errors: [] };
    for (const product of list) {
      try {
        const number = product.corridorNumber ?? product.corridor?.number;
        await syncProduct(product, number);
        results.synced += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({ id: product?.id || null, name: product?.name || 'Produto', message: error?.message || 'Falha desconhecida' });
      }
    }
    return results;
  }


  const batchStatusMap = {
    aberta: 'in_progress',
    finalizada: 'completed',
    cancelada: 'cancelled'
  };

  async function syncBatch(batch, corridorNumber) {
    const client = await init();
    const session = await getSession();
    if (!session || !session.user) throw new Error('Nenhuma sessão autenticada encontrada.');
    if (!batch || !batch.id) throw new Error('Batida sem identificador local.');
    if (!Number.isFinite(Number(corridorNumber))) throw new Error('Batida sem número de corredor válido.');

    const corridorResult = await client
      .from('corridors')
      .select('id, corridor_number')
      .eq('corridor_number', Number(corridorNumber))
      .eq('active', true)
      .maybeSingle();
    if (corridorResult.error) throw corridorResult.error;
    if (!corridorResult.data) {
      throw new Error('Corredor ' + corridorNumber + ' não encontrado no Supabase.');
    }

    const payload = {
      id: batch.id,
      corridor_id: corridorResult.data.id,
      performed_by: session.user.id,
      started_at: batch.startedAt || new Date().toISOString(),
      completed_at: batch.finishedAt || null,
      status: batchStatusMap[batch.status] || 'in_progress',
      notes: batch.notes || null
    };
    const result = await client.from('batidas').upsert(payload, { onConflict: 'id' }).select().single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function syncBatches(batches, corridors) {
    const list = Array.isArray(batches) ? batches : [];
    const results = { total: list.length, synced: 0, failed: 0, errors: [] };
    for (const batch of list) {
      try {
        const corridor = (Array.isArray(corridors) ? corridors : []).find((item) => item.id === batch.corridorId);
        await syncBatch(batch, corridor?.number);
        results.synced += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push({ id: batch?.id || null, message: error?.message || 'Falha desconhecida' });
      }
    }
    return results;
  }

  window.VPASupabase = {
    state: state,
    isConfigured: function () { return state.configured; },
    getConfigStatus: status,
    init: init,
    getSession: getSession,
    signIn: signIn,
    signOut: signOut,
    getProfile: getProfile,
    syncProduct: syncProduct,
    syncProducts: syncProducts,
    syncBatch: syncBatch,
    syncBatches: syncBatches,
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
