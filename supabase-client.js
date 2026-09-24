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
  let initPromise = null;
  const activeChannels = new Map();

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
    if (initPromise) return initPromise;

    initPromise = (async function () {
      const lib = await loadLibrary();
      if (!state.client) {
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
      }
      return state.client;
    })();

    try {
      return await initPromise;
    } finally {
      initPromise = null;
    }
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

  async function signUp(fullName, email, password) {
    const client = await init();
    const redirectTo = window.location.origin + window.location.pathname;
    const result = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName }
      }
    });
    if (result.error) throw result.error;
    return result.data;
  }

  async function sendPasswordReset(email) {
    const client = await init();
    const redirectTo = window.location.origin + window.location.pathname;
    const result = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo });
    if (result.error) throw result.error;
    return true;
  }

  async function updatePassword(password) {
    const client = await init();
    const result = await client.auth.updateUser({ password: password });
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


  const PRODUCT_PHOTO_BUCKET = 'vpa-product-photos';

  async function uploadProductPhoto(file, productId) {
    const client = await init();
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Nenhuma sessão autenticada encontrada.');
    if (!file) return '';
    if (!productId) throw new Error('Produto sem identificador para a foto.');
    if (file.size > 6 * 1024 * 1024) throw new Error('A foto deve ter no máximo 6 MB.');
    const extension = (file.name || '').split('.').pop()?.toLowerCase() || (file.type === 'image/png' ? 'png' : 'jpg');
    const safeExt = ['jpg','jpeg','png','webp','heic','heif'].includes(extension) ? extension : 'jpg';
    const path = `${session.user.id}/${productId}.${safeExt}`;
    const result = await client.storage.from(PRODUCT_PHOTO_BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
      cacheControl: '3600'
    });
    if (result.error) throw result.error;
    const publicResult = client.storage.from(PRODUCT_PHOTO_BUCKET).getPublicUrl(path);
    const publicUrl = publicResult?.data?.publicUrl || '';
    if (!publicUrl) throw new Error('O Supabase não retornou a URL da foto.');
    return publicUrl;
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
      photo_url: product.photoCloudUrl || null,
      corridor_id: corridorResult.data.id,
      quantity_found: Math.max(0, Number(product.quantity || product.quantityFound || 0)),
      quantity_separated: Math.max(0, Number(product.quantitySeparated || 0)),
      expiration_date: product.expiry || null,
      status: statusMap[product.status] || 'found',
      registered_by: session.user.id,
      app_metadata: {
        fefo: Boolean(product.fefo),
        promotor: Boolean(product.promotor),
        piqueConcluido: Boolean(product.piqueConcluido),
        piqueAt: product.piqueAt || null,
        piqueTipo: product.piqueTipo || null,
        batchId: product.batchId || null,
        createdAt: product.createdAt || null,
        origemCadastro: product.origemCadastro || null,
        categoriaCadastro: product.categoriaCadastro || null,
        tag: product.tag || ''
      }
    };
    if (!payload.name) throw new Error('Produto sem nome.');
    const result = await client.from('products').upsert(payload, { onConflict: 'id' }).select().single();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Supabase não retornou o produto após o upsert.');
    console.info('[VPA] Produto confirmado no Supabase:', result.data.id);
    return result.data;
  }


  async function syncTemporaryBatchItem(product) {
    const client = await init();
    const session = await getSession();
    if (!session?.user) throw new Error('Nenhuma sessão autenticada encontrada.');
    if (!product?.id || !product?.batchId) throw new Error('Item temporário sem id ou batida.');
    if (!Number.isFinite(Number(product.corridorNumber))) throw new Error('Corredor local sem número válido.');

    const corridorResult = await client
      .from('corridors')
      .select('id, corridor_number')
      .eq('corridor_number', Number(product.corridorNumber))
      .eq('active', true)
      .maybeSingle();
    if (corridorResult.error) throw corridorResult.error;
    if (!corridorResult.data) throw new Error('Corredor não encontrado no Supabase.');

    // Garante que a batida exista na nuvem antes do item temporário.
    // Isso elimina a corrida entre o cadastro da batida e o primeiro produto
    // (FK batch_id), que era a causa típica do aviso 'salvo localmente'.
    const batchResult = await client.from('batidas').upsert({
      id: product.batchId,
      corridor_id: corridorResult.data.id,
      performed_by: session.user.id,
      started_at: product.batchStartedAt || new Date().toISOString(),
      status: 'in_progress',
      notes: product.batchNotes || null,
      product_count: 0
    }, { onConflict: 'id' }).select('id').single();
    if (batchResult.error) throw batchResult.error;

    const payload = {
      id: product.id,
      batch_id: product.batchId,
      name: String(product.name || '').trim(),
      ean: product.ean ? String(product.ean).trim() : null,
      photo_url: product.photoCloudUrl || null,
      corridor_id: corridorResult.data.id,
      quantity_found: Math.max(0, Number(product.quantity || 0)),
      quantity_separated: Math.max(0, Number(product.quantitySeparated || 0)),
      expiration_date: product.expiry || null,
      status: statusMap[product.status] || 'found',
      registered_by: session.user.id,
      app_metadata: {
        fefo: Boolean(product.fefo),
        promotor: Boolean(product.promotor),
        piqueConcluido: Boolean(product.piqueConcluido),
        piqueAt: product.piqueAt || null,
        piqueTipo: product.piqueTipo || null,
        batchId: product.batchId || null,
        createdAt: product.createdAt || null,
        origemCadastro: product.origemCadastro || 'batida',
        categoriaCadastro: product.categoriaCadastro || 'general',
        tag: product.tag || ''
      }
    };
    if (!payload.name) throw new Error('Produto sem nome.');
    const result = await client.from('batida_itens_temporarios').upsert(payload, { onConflict: 'id' }).select().single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function listTemporaryBatchItems() {
    const client = await init();
    const result = await client
      .from('batida_itens_temporarios')
      .select('id, batch_id, name, ean, photo_url, corridor_id, quantity_found, quantity_separated, expiration_date, status, registered_by, created_at, updated_at, app_metadata')
      .order('created_at', { ascending: true })
      .limit(5000);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function deleteTemporaryBatchItemsByBatch(batchId) {
    if (!batchId) return { deleted: 0 };
    const client = await init();
    const result = await client.from('batida_itens_temporarios').delete().eq('batch_id', batchId).select('id');
    if (result.error) throw result.error;
    return { deleted: result.data?.length || 0 };
  }

  async function finalizeBatch(batchId) {
    if (!batchId) throw new Error('Batida sem identificador.');
    const client = await init();
    const result = await client.rpc('finalizar_batida', { p_batida_id: batchId });
    if (result.error) throw result.error;
    return result.data || {};
  }

  async function deleteProducts(ids) {
    const list = Array.from(new Set((Array.isArray(ids) ? ids : []).filter(Boolean).map(String)));
    if (!list.length) return { deleted: 0 };
    const client = await init();
    const result = await client.from('products').delete().in('id', list).select('id');
    if (result.error) throw result.error;
    console.info('[VPA] Produtos removidos do Supabase:', result.data?.length || 0);
    return { deleted: result.data?.length || 0, ids: list };
  }

  async function syncProducts(products) {
    // Proteção V45: não permitir que a sincronização geral publique
    // itens que ainda pertencem à preparação de uma batida.
    const list = (Array.isArray(products) ? products : [])
      .filter((product) => !product?.isTemporaryBatchItem);
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
      notes: batch.notes || null,
      product_count: Number(batch.productCount || 0)
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

  async function listProducts() {
    const client = await init();
    const result = await client
      .from('products')
      .select('id, name, ean, photo_url, corridor_id, quantity_found, quantity_separated, expiration_date, status, registered_by, created_at, updated_at, app_metadata')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function listPromotorProducts() {
    const client = await init();
    const result = await client
      .from('promotor_products')
      .select('id, user_id, name, ean, company, photo_url, location, expiration_date, quantity, status, tag, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (result.error) throw result.error;
    return result.data || [];
  }


  async function listRebaixaItems() {
    const client = await init();
    const result = await client
      .from('rebaixa_items')
      .select('id, loja, plu, name, quantity, expiry, value, status, created_by, created_at, completed_by, completed_at')
      .neq('status', 'completed')
      .order('expiry', { ascending: true })
      .limit(10000);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function upsertRebaixaItems(items) {
    const client = await init();
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Nenhuma sessão autenticada encontrada.');
    const list = (Array.isArray(items) ? items : []).map((item) => ({
      id: item.id,
      loja: String(item.loja || '').trim(),
      plu: String(item.plu || '').trim(),
      name: String(item.name || '').trim(),
      quantity: item.quantity ?? '',
      expiry: item.expiry || null,
      value: item.value === '' || item.value == null ? null : Number(item.value),
      status: 'pending',
      created_by: session.user.id
    })).filter((item) => item.name && item.expiry);
    if (!list.length) return [];
    const result = await client.from('rebaixa_items').upsert(list, { onConflict: 'id' }).select();
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function completeRebaixaItem(id) {
    const client = await init();
    const session = await getSession();
    if (!session?.user?.id) throw new Error('Nenhuma sessão autenticada encontrada.');
    const result = await client
      .from('rebaixa_items')
      .update({ status: 'completed', completed_by: session.user.id, completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id, status, completed_by, completed_at')
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Item já concluído ou não encontrado na lista compartilhada.');
    return result.data;
  }

  async function listBatidas() {
    const client = await init();
    const result = await client
      .from('batidas')
      .select('id, corridor_id, performed_by, started_at, completed_at, status, notes, product_count, created_at')
      .order('started_at', { ascending: false })
      .limit(200);
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function subscribeChannel(channelName, tableName, onChange, label) {
    const client = await init();
    if (typeof onChange !== 'function') throw new Error('Callback de ' + label + ' inválido.');

    const existing = activeChannels.get(channelName);
    if (existing) return existing;

    const channel = client
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, function (payload) {
        try { onChange(payload); } catch (error) { console.warn('[VPA] Falha ao processar evento de ' + label + ':', error); }
      });

    activeChannels.set(channelName, channel);
    channel.subscribe(function (subscriptionStatus, error) {
      if (subscriptionStatus === 'SUBSCRIBED') console.info('[VPA] Realtime ' + label + ' conectado.');
      else console.warn('[VPA] Realtime ' + label + ':', subscriptionStatus, error || '');
    });
    return channel;
  }

  async function subscribeBatidas(onChange) {
    return subscribeChannel('vpa-batidas-equipe', 'batidas', onChange, 'batidas');
  }

  async function subscribeProducts(onChange) {
    return subscribeChannel('vpa-produtos-equipe', 'products', onChange, 'produtos');
  }

  async function subscribeTemporaryBatchItems(onChange) {
    return subscribeChannel('vpa-batida-itens-temporarios', 'batida_itens_temporarios', onChange, 'itens temporários das batidas');
  }

  async function subscribeCorridors(onChange) {
    return subscribeChannel('vpa-corredores-equipe', 'corridors', onChange, 'corredores');
  }

  async function subscribePresence(onChange) {
    return subscribeChannel('vpa-presenca-equipe', 'vpa_user_presence', onChange, 'presença da equipe');
  }

  async function subscribeProfile(userId, onChange) {
    const client = await init();
    if (!userId) return null;
    const channelName = 'vpa-perfil-' + String(userId);
    return subscribeChannel(channelName, 'profiles', function (payload) {
      const row = payload?.new || payload?.record || payload?.old || {};
      if (!row.id || String(row.id) === String(userId)) onChange(payload);
    }, 'perfil do usuário');
  }

  async function subscribePromotorProducts(onChange) {
    return subscribeChannel('vpa-promotor-products', 'promotor_products', onChange, 'produtos do Promotor PA');
  }

  async function subscribeRebaixaItems(onChange) {
    return subscribeChannel('vpa-rebaixa-items', 'rebaixa_items', onChange, 'Rebaixa Automática');
  }

  async function deletePromotorProduct(productId) {
    const client = await init();
    const result = await client.rpc('delete_promotor_product_from_vpa', { p_product_id: productId });
    if (result.error) throw result.error;
    return result.data;
  }


  async function listCorridors() {
    const client = await init();
    const result = await client.from('corridors').select('id, corridor_number, name, active').eq('active', true).order('corridor_number', { ascending: true });
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function updateCorridorName(corridorId, name) {
    const client = await init();
    const result = await client.from('corridors').update({ name: String(name || '').trim() }).eq('id', corridorId).select('id, corridor_number, name, active').single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function heartbeatPresence() {
    const client = await init();
    const session = await getSession();
    if (!session?.user?.id) return null;
    const result = await client.from('vpa_user_presence').upsert({ user_id: session.user.id, last_seen: new Date().toISOString() }, { onConflict: 'user_id' }).select().single();
    if (result.error) throw result.error;
    return result.data;
  }

  async function listTeamMembers() {
    const client = await init();
    const result = await client.rpc('vpa_admin_list_team_members');
    if (result.error) throw result.error;
    return result.data || [];
  }

  async function updateUserRole(userId, role) {
    const client = await init();
    const result = await client.rpc('vpa_admin_update_user_role', { p_user_id: userId, p_role: role });
    if (result.error) throw result.error;
    return result.data;
  }


  async function updatePromotorProductTag(productId, tag) {
    const client = await init();
    const result = await client.rpc('tag_promotor_product_from_vpa', { p_product_id: productId, p_tag: tag });
    if (result.error) throw result.error;
    return result.data;
  }

  async function unsubscribe(channel) {
    const client = await init();
    if (channel) {
      for (const [name, registered] of activeChannels.entries()) {
        if (registered === channel) activeChannels.delete(name);
      }
      await client.removeChannel(channel);
    }
  }

  async function onAuthStateChange(callback) {
    const client = await init();
    if (typeof callback !== 'function') throw new Error('Callback de autenticação inválido.');
    const result = client.auth.onAuthStateChange(callback);
    return result?.data?.subscription || result;
  }

  window.VPASupabase = {
    state: state,
    isConfigured: function () { return state.configured; },
    getConfigStatus: status,
    init: init,
    getSession: getSession,
    onAuthStateChange: onAuthStateChange,
    signIn: signIn,
    signUp: signUp,
    sendPasswordReset: sendPasswordReset,
    updatePassword: updatePassword,
    signOut: signOut,
    getProfile: getProfile,
    uploadProductPhoto: uploadProductPhoto,
    listCorridors: listCorridors,
    updateCorridorName: updateCorridorName,
    heartbeatPresence: heartbeatPresence,
    listTeamMembers: listTeamMembers,
    updateUserRole: updateUserRole,
    syncProduct: syncProduct,
    syncProducts: syncProducts,
    syncTemporaryBatchItem: syncTemporaryBatchItem,
    listTemporaryBatchItems: listTemporaryBatchItems,
    deleteTemporaryBatchItemsByBatch: deleteTemporaryBatchItemsByBatch,
    finalizeBatch: finalizeBatch,
    deleteProducts: deleteProducts,
    syncBatch: syncBatch,
    syncBatches: syncBatches,
    listProducts: listProducts,
    listPromotorProducts: listPromotorProducts,
    listRebaixaItems: listRebaixaItems,
    upsertRebaixaItems: upsertRebaixaItems,
    completeRebaixaItem: completeRebaixaItem,
    listBatidas: listBatidas,
    subscribeBatidas: subscribeBatidas,
    subscribeProducts: subscribeProducts,
    subscribeTemporaryBatchItems: subscribeTemporaryBatchItems,
    subscribeCorridors: subscribeCorridors,
    subscribePresence: subscribePresence,
    subscribeProfile: subscribeProfile,
    subscribePromotorProducts: subscribePromotorProducts,
    subscribeRebaixaItems: subscribeRebaixaItems,
    deletePromotorProduct: deletePromotorProduct,
    updatePromotorProductTag: updatePromotorProductTag,
    unsubscribe: unsubscribe,
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
