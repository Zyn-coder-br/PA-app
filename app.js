const APP_VERSION = 'V40';
const DB = 'vpa-local-v4';
const STORE = 'data';
let db;
let data = { corridors: [], products: [], batches: [], activeBatchId: null, rebaixaItems: [] };
let view = localStorage.getItem('vpa-view') || 'dashboard';
let theme = localStorage.getItem('vpa-theme') || 'light';
let batchTab = localStorage.getItem('vpa-batch-tab') || 'current';
let productFilter = localStorage.getItem('vpa-product-filter') || 'all';
let promotorCompanyFilter = localStorage.getItem('vpa-promotor-company-filter') || 'all';
const activeBatch = () => data.batches.find((b) => b.id === data.activeBatchId && b.status === 'aberta');
const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#17211e' : '#f5f8f7');
}
function toggleTheme(next) {
  theme = next || (theme === 'light' ? 'dark' : 'light');
  localStorage.setItem('vpa-theme', theme);
  applyTheme();
  render();
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => { db = request.result; resolve(); };
    request.onerror = () => reject(request.error);
  });
}
function save() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(data, 'main');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function load() {
  return new Promise((resolve) => {
    const request = db.transaction(STORE).objectStore(STORE).get('main');
    request.onsuccess = () => { if (request.result) data = { ...data, ...request.result }; resolve(); };
  });
}
function seed() {
  if (!Array.isArray(data.corridors) || !data.corridors.length) {
    data.corridors = Array.from({ length: 22 }, (_, i) => ({ id: uid(), number: i + 1, name: 'Corredor ' + (i + 1), lastCheck: null }));
  }
  data.products ||= [];
  data.batches ||= [];
  data.activeBatchId ||= null;
  data.rebaixaItems ||= [];
  data.rebaixaItems = data.rebaixaItems.map((item) => ({ ...item, id: item.id || uid(), loja: item.loja || '', plu: item.plu || '', name: item.name || '', quantity: item.quantity ?? '', expiry: item.expiry || '', value: item.value ?? '' }));
  data.products = data.products.map((p) => ({ ...p, promotor: Boolean(p.promotor), status: ['corredor', 'vencimento', 'separado', 'resolvido'].includes(p.status) ? p.status : 'corredor', tag: p.tag || '', fefo: Boolean(p.fefo), piqueConcluido: Boolean(p.piqueConcluido), piquePhoto: p.piquePhoto || '', piqueAt: p.piqueAt || null, createdAt: p.createdAt || p.registeredAt || null, isTemporaryBatchItem: Boolean(p.isTemporaryBatchItem) }));
}
function syncCorridorLastChecksFromBatches() {
  const finalized = data.batches.filter((b) => b.status === 'finalizada' && b.corridorId && b.date);
  data.corridors.forEach((c) => {
    const dates = finalized.filter((b) => b.corridorId === c.id).map((b) => b.date).filter(Boolean).sort();
    const latest = dates[dates.length - 1];
    if (latest && (!c.lastCheck || latest > c.lastCheck)) c.lastCheck = latest;
  });
}
function dateOnlyDiff(fromDate, toDate = today()) {
  if (!fromDate) return null;
  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.floor((to - from) / 86400000));
}

function daysTo(date) {
  if (!date) return Number.POSITIVE_INFINITY;
  const parsed = new Date(String(date).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((parsed - new Date(today() + 'T12:00:00')) / 86400000);
}
function badge(date) {
  const d = daysTo(date);
  if (!Number.isFinite(d)) return '<span class="badge">Sem validade</span>';
  return `<span class="badge ${d < 0 ? 'danger' : d <= 3 ? 'warn' : ''}">${d < 0 ? 'Vencido' : d === 0 ? 'Vence hoje' : d === 1 ? 'Amanhã' : d + ' dias'}</span>`;
}
function statusLabel(status) {
  return ({ corredor: 'Ainda no corredor', vencimento: 'Área de vencimento' }[status] || status || 'Ainda no corredor');
}
function isProductInOpenBatch(product) {
  if (!product) return false;
  const openBatches = data.batches.filter((batch) => batch.status === 'aberta');
  if (product.batchId) {
    return openBatches.some((batch) => String(batch.id) === String(product.batchId));
  }
  // Fallback de segurança: algumas respostas antigas do Supabase podem não
  // trazer app_metadata. Nesse caso, preservamos a regra da batida local
  // usando a origem, o corredor e o horário de início.
  if (product.origemCadastro !== 'batida') return false;
  return openBatches.some((batch) => {
    if (String(batch.corridorId) !== String(product.corridorId)) return false;
    if (!product.createdAt || !batch.startedAt) return true;
    return new Date(product.createdAt).getTime() >= new Date(batch.startedAt).getTime();
  });
}
function visibleProducts() {
  return data.products.filter((p) => {
    if (p.piqueConcluido) return false;
    // Itens temporários de uma batida nunca entram no catálogo geral.
    if (p.isTemporaryBatchItem) return false;
    // Compatibilidade com registros antigos que ainda usam somente o vínculo da batida.
    if (isProductInOpenBatch(p)) return false;
    return true;
  });
}
function loggedDisplayName() {
  const profile = window.VPA_PROFILE || {};
  const name = profile.full_name || profile.name || profile.email || 'Usuário';
  return String(name).trim() || 'Usuário';
}
function productImage(p) {
  if (p.photo) return `<img src="${esc(p.photo)}" alt="${esc(p.name || 'Produto')}" loading="lazy">`;
  return '📦';
}
function photoPreview(p) {
  if (!p?.photo) return '';
  return `<button type="button" class="photo-preview-btn" data-open-photo="${p.id}" aria-label="Ampliar foto de ${esc(p.name)}"><img src="${esc(p.photo)}" alt="${esc(p.name)}"></button>`;
}
function daysLabel(date) {
  const d = daysTo(date);
  if (!Number.isFinite(d)) return 'Validade não informada';
  if (d < 0) return `Vencido há ${Math.abs(d)} dia(s)`;
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  return `Faltam ${d} dias`;
}
function activityDateValue(p) {
  return p.createdAt || p.registeredAt || p.dateRegistered || null;
}
function activityDateLabel(value) {
  if (!value) return 'Data de registro não informada';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Data de registro não informada';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function sortByActivity(list) {
  return list.slice().sort((a, b) => {
    const av = activityDateValue(a) || '';
    const bv = activityDateValue(b) || '';
    return bv.localeCompare(av) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
  });
}
function groupedProductRows(list, options = {}) {
  const sorted = sortByActivity(list);
  const groups = [];
  const byKey = new Map();
  sorted.forEach((p) => {
    const raw = activityDateValue(p);
    const key = raw ? new Date(raw).toISOString().slice(0, 10) : 'unknown';
    if (!byKey.has(key)) { const group = { key, label: raw ? activityDateLabel(raw) : 'Data de registro não informada', items: [] }; byKey.set(key, group); groups.push(group); }
    byKey.get(key).items.push(p);
  });
  return groups.map((g) => `<div class="activity-group"><div class="activity-group-head">📅 ${esc(g.label)} <span>${g.items.length} produto${g.items.length === 1 ? '' : 's'}</span></div>${g.items.map((p) => productRow(p, options)).join('')}</div>`).join('');
}
function groupedPendingCards(list) {
  const sorted = sortByActivity(list);
  const groups = [];
  const byKey = new Map();
  sorted.forEach((p) => {
    const raw = activityDateValue(p);
    const key = raw ? new Date(raw).toISOString().slice(0, 10) : 'unknown';
    if (!byKey.has(key)) { const group = { key, label: raw ? activityDateLabel(raw) : 'Data de registro não informada', items: [] }; byKey.set(key, group); groups.push(group); }
    byKey.get(key).items.push(p);
  });
  return groups.map((g) => `<div class="activity-group pending-activity-group"><div class="activity-group-head">📅 ${esc(g.label)} <span>${g.items.length} produto${g.items.length === 1 ? '' : 's'}</span></div>${g.items.map(pendingProductCard).join('')}</div>`).join('');
}
function productRow(p, options = {}) {
  const c = data.corridors.find((x) => x.id === p.corridorId);
  const externalPromotor = Boolean(p.externalPromotor);
  const selected = options.selectable ? `<input class="product-check" type="checkbox" data-select-product="${p.id}" ${selectedProducts.has(p.id) ? 'checked' : ''} aria-label="Selecionar ${esc(p.name)}">` : '';
  const action = options.actions === false || externalPromotor ? '' : `<button class="row-action" data-edit-product="${p.id}" aria-label="Editar produto">›</button>`;
  const tag = p.tag ? `<span class="tag-chip">${esc(p.tag)}</span>` : '';
  const place = externalPromotor ? `Empresa: ${esc(p.company || 'Não informada')} · ${esc(p.location || 'Local não informado')}` : `${esc(c?.name || 'Sem corredor')} · ${esc(p.ean || 'EAN não informado')}`;
  return `<div class="product-row ${externalPromotor ? 'external-promotor-row' : ''}"><div class="product-main">${selected}<button type="button" class="product-thumb" data-open-photo="${p.id}" aria-label="Abrir foto de ${esc(p.name)}">${productImage(p)}</button><div><div class="product-name">${esc(p.name)} ${tag}${externalPromotor ? ' <span class="tag-chip">PROMOTOR</span>' : ''}</div><div class="meta">${place}${p.ean ? ' · '+esc(p.ean) : ''}</div><div class="meta">${statusLabel(p.status)} · Qtd.: ${Number(p.quantity || 0)}${p.fefo ? ' · FEFO' : ''}</div></div></div><div class="product-side">${badge(p.expiry)}<div class="meta">${daysLabel(p.expiry)}</div><div class="meta">${fmt(p.expiry)}</div>${action}</div></div>`;
}
function suggestedCorridor() {
  return data.corridors.slice().sort((a, b) => {
    const daysA = daysWithoutCheck(a);
    const daysB = daysWithoutCheck(b);
    const priorityA = daysA === null ? Number.POSITIVE_INFINITY : daysA;
    const priorityB = daysB === null ? Number.POSITIVE_INFINITY : daysB;
    // Maior tempo sem batida primeiro; corredores nunca conferidos têm
    // prioridade máxima. Em empate, mantém a ordem numérica.
    return priorityB - priorityA || Number(a.number || 0) - Number(b.number || 0);
  })[0] || { number: 1, name: 'Corredor 1', lastCheck: null };
}

function daysWithoutCheck(corridor) {
  if (!corridor?.lastCheck) return null;
  return dateOnlyDiff(corridor.lastCheck);
}
function corridorAlert(corridor) {
  const days = daysWithoutCheck(corridor);
  if (days === null) return { label: 'Nunca conferido', tone: 'danger', rank: 999999 };
  if (days >= 15) return { label: 'Alerta: mais de 15 dias sem supervisão', tone: 'danger', rank: days };
  if (days >= 7) return { label: 'Atenção: 7–14 dias', tone: 'warn', rank: days };
  return { label: 'Em dia', tone: 'ok', rank: days };
}
function corridorHistoryRows() {
  return data.corridors.slice().sort((a, b) => {
    const ad = daysWithoutCheck(a); const bd = daysWithoutCheck(b);
    const ar = ad === null ? 999999 : ad; const br = bd === null ? 999999 : bd;
    return ar - br || a.number - b.number;
  }).map((c) => {
    const days = daysWithoutCheck(c);
    const alert = corridorAlert(c);
    const countLabel = days === null ? '—' : `${days} dia${days === 1 ? '' : 's'}`;
    return `<div class="product-row corridor-history-row"><div><div class="product-name">${esc(c.name || `Corredor ${c.number}`)}</div><div class="meta">Corredor ${esc(c.number)} → Data: ${fmt(c.lastCheck)}</div><div class="meta">Contagem de dias: ${days === null ? 'Sem batida registrada' : countLabel}</div><div class="meta">${esc(alert.label)}</div></div><span class="badge ${alert.tone === 'danger' ? 'danger' : alert.tone === 'warn' ? 'warn' : ''}">${days === null ? 'Sem registro' : countLabel}</span></div>`;
  }).join('');
}
function batchHistoryRows() {
  return data.batches.slice().filter((b) => b.status === 'finalizada').sort((a,b) => {
    const ad = daysToDateValue(a.date); const bd = daysToDateValue(b.date);
    return ad - bd || String(a.date || '').localeCompare(String(b.date || ''));
  }).map((b) => {
    const days = daysToDateValue(b.date);
    const c = data.corridors.find((x) => x.id === b.corridorId);
    const alert = corridorAlert(c || { lastCheck: b.date });
    return `<div class="product-row"><div><div class="product-name">${esc(b.corridorName || c?.name || 'Corredor')}</div><div class="meta">Data: ${fmt(b.date)} · ${days} dia${days === 1 ? '' : 's'} desde a batida</div><div class="meta">${data.products.filter((p) => p.batchId === b.id).length} produtos registrados</div></div><span class="badge">Concluída</span></div>`;
  }).join('');
}
function daysToDateValue(date) {
  if (!date) return 999999;
  return dateOnlyDiff(date);
}
async function notifyOverdueCorridors() {
  const overdue = data.corridors.filter((c) => daysWithoutCheck(c) === null || daysWithoutCheck(c) >= 15);
  if (!overdue.length || !('Notification' in window) || Notification.permission !== 'granted') return;
  const key = `vpa-overdue-corridors-${today()}`;
  const already = JSON.parse(localStorage.getItem(key) || '[]');
  const fresh = overdue.filter((c) => !already.includes(c.id));
  if (!fresh.length) return;
  try {
    const registration = await navigator.serviceWorker?.ready;
    for (const c of fresh) {
      const days = daysWithoutCheck(c);
      const options = { body: `${c.name}: ${days === null ? 'nunca conferido' : days + ' dias sem supervisão'}. Faça uma batida de validade.`, icon: './icons/notification-small.png', badge: './icons/notification-small.png', tag: `vpa-corridor-overdue-${c.id}`, renotify: true, data: { url: './' } };
      if (registration?.showNotification) await registration.showNotification('Vencimento PA · Corredor em atraso', options);
      else new Notification('Vencimento PA · Corredor em atraso', options);
    }
    localStorage.setItem(key, JSON.stringify([...already, ...fresh.map((c) => c.id)]));
  } catch (error) { console.warn('[VPA] Não foi possível notificar corredores em atraso:', error); }
}
function dashboard() {
  const critical = data.products.filter((p) => daysTo(p.expiry) <= 7 && p.status !== 'resolvido').length;
  const attention = data.products.filter((p) => daysTo(p.expiry) > 7 && daysTo(p.expiry) <= 15 && p.status !== 'resolvido').length;
  const resolved = data.products.filter((p) => p.status === 'resolvido').length;
  const month = today().slice(0, 7);
  const checked = new Set(data.batches.filter((b) => b.date.slice(0, 7) === month && b.status === 'finalizada').map((b) => b.corridorId)).size;
  const corridorTotal = Math.max(1, data.corridors.length || 0);
  const progress = Math.min(100, Math.round((checked / corridorTotal) * 100));
  const corridor = suggestedCorridor();
  const days = corridor.lastCheck ? Math.max(0, Math.floor((new Date(today()) - new Date(corridor.lastCheck)) / 86400000)) : 'Nunca';
  const upcoming = visibleProducts().slice().sort((a, b) => a.expiry.localeCompare(b.expiry)).slice(0, 4);
  return `<div class="section-head"><div><div class="eyebrow">PAINEL OPERACIONAL</div><h2>Resumo do seu dia</h2></div><button class="text-btn" id="backupShortcut">⇩ Backup</button></div>
  <section class="dashboard-hero">
    <div class="hero-copy">
      <div class="eyebrow hero-eyebrow">VISÃO GERAL</div>
      <h1>Olá, ${esc(loggedDisplayName())}! Vamos cuidar das validades?</h1>
      <p>Organize suas batidas, acompanhe os produtos e mantenha a operação em dia.</p>
    </div>
    <div class="hero-status"><span></span> Sistema ativo</div>
  </section>
  <div class="stats"><div class="stat ok"><div class="stat-icon">▣</div><div class="num">${visibleProducts().length}</div><div class="label">Produtos</div><div class="sub">cadastrados no local</div></div><div class="stat alert"><div class="stat-icon">!</div><div class="num">${critical}</div><div class="label">Críticos</div><div class="sub">vencem em até 7 dias</div></div><div class="stat warning"><div class="stat-icon">◷</div><div class="num">${attention}</div><div class="label">Em atenção</div><div class="sub">vencem em 8–15 dias</div></div><div class="stat blue"><div class="stat-icon">✓</div><div class="num">${resolved}</div><div class="label">Resolvidos</div><div class="sub">status concluído</div></div></div>
  <div class="panel-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">▦ Batida de hoje</div><div class="panel-sub">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div></div><span>📅</span></div><button class="primary big-action" id="newBatch">▶ Iniciar Batida <span>›</span></button><button class="secondary soft-action" id="continueBatch">↻ Continuar última batida <span>›</span></button></section>
  <section class="panel"><div class="panel-head"><div class="panel-title">◎ Progresso do mês</div><span class="panel-sub">${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="progress-row"><span>${checked} de ${corridorTotal} corredores</span><strong>${progress}%</strong></div><div class="mini-grid"><div class="mini"><strong>${checked}</strong><span>Concluídos</span></div><div class="mini warning"><strong>${Math.max(0, corridorTotal - checked)}</strong><span>Pendentes</span></div><div class="mini danger"><strong>${data.corridors.filter((c) => c.lastCheck && Math.floor((new Date(today()) - new Date(c.lastCheck)) / 86400000) > 15).length}</strong><span>Atrasados</span></div></div><div class="goal">🏆 Meta: conferir todos os corredores pelo menos 1 vez a cada 15 dias.</div></section></div>
  <section class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">⌖ Próximo corredor sugerido</div><span class="priority">PRIORIDADE</span><span class="panel-sub">${corridor.lastCheck ? 'Há ' + days + ' dias sem batida' : 'Ainda não conferido'}</span></div><div class="suggested"><div class="suggested-main"><div class="corridor-icon">▥</div><div><strong>${esc(corridor.name)}</strong><small>Prioridade automática pela última conferência</small></div></div><button class="secondary" id="allCorridors">☷ Ver todos</button></div></section>
  <div class="two-panels"><section class="panel"><div class="panel-head"><div class="panel-title">◷ Vencem em breve</div><button class="text-btn" data-view="expiries">Ver todos</button></div><div class="list">${upcoming.map((p) => productRow(p)).join('') || '<div class="empty">Nenhum produto cadastrado.</div>'}</div></section><section class="panel"><div class="panel-head"><div class="panel-title">♧ Atividades da equipe</div><button class="text-btn" id="reportsShortcut">Ver todas</button></div><div class="list"><div class="team-row"><div class="team-person"><div class="team-avatar">${esc(loggedDisplayName().charAt(0).toUpperCase())}</div><div><div class="product-name">${esc(loggedDisplayName())}</div><div class="meta">${esc(window.VPA_PROFILE?.role || 'Usuário')} · atividade local</div></div></div><strong class="team-count">${data.products.length}</strong></div><div class="team-row"><div class="team-person"><div class="team-avatar blue">L</div><div><div class="product-name">Luan</div><div class="meta">Pleno 1 · sem sincronização</div></div></div><strong class="team-count">—</strong></div><div class="team-row"><div class="team-person"><div class="team-avatar gray">W</div><div><div class="product-name">Wagner</div><div class="meta">Chefe · sem sincronização</div></div></div><strong class="team-count">—</strong></div></div><button class="secondary report-button" id="reportsBtn">▥ Ver relatórios</button></section></div>`;
}
function products() {
  const filters = [['all','Todos'],['fefo','Produtos FEFO'],['promotor','Produtos Promotores'],['rebaixa','Rebaixa Automática']];
  const filter = productFilter;
  const allVisible = visibleProducts();
  // A lista geral exclui FEFO e Promotores; cada categoria aparece somente em sua própria lista.
  let list = allVisible.filter((p) => filter === 'fefo' ? Boolean(p.fefo) : filter === 'promotor' ? Boolean(p.promotor) : !p.fefo && !p.promotor);
  const searchValue = localStorage.getItem('vpa-product-search') || '';
  const promotorCompanies = Array.from(new Set(allVisible.filter((p) => p.promotor && p.company).map((p) => String(p.company).trim()).filter(Boolean))).sort((a,b) => a.localeCompare(b, 'pt-BR'));
  if (filter === 'promotor' && promotorCompanyFilter !== 'all') list = list.filter((p) => String(p.company || '') === promotorCompanyFilter);
  if (searchValue.trim()) {
    const q = searchValue.trim().toLowerCase();
    list = list.filter((p) => `${p.name || ''} ${p.ean || ''} ${p.company || ''}`.toLowerCase().includes(q));
  }
  const rebaixaMode = filter === 'rebaixa';
  const rebaixaCount = data.rebaixaItems.length;
  const statsList = rebaixaMode ? data.rebaixaItems : list;
  const critical = statsList.filter((p) => daysTo(p.expiry) <= 7 && p.status !== 'resolvido' && p.status !== 'completed').length;
  const attention = statsList.filter((p) => daysTo(p.expiry) > 7 && daysTo(p.expiry) <= 15 && p.status !== 'resolvido' && p.status !== 'completed').length;
  const resolved = rebaixaMode ? 0 : list.filter((p) => p.status === 'resolvido').length;
  const fefoCount = rebaixaMode ? 0 : list.filter((p) => p.fefo).length;
  const panelContent = rebaixaMode ? rebaixaPage() : `
      <div class="products-toolbar">
        <div class="products-search-wrap"><span>⌕</span><input class="search compact-search" id="search" placeholder="Buscar por nome, EAN ou marca..." value="${esc(searchValue)}"></div>
        ${filter === 'promotor' ? `<label class="company-filter-label" for="promotorCompanyFilter">Empresa<select id="promotorCompanyFilter" class="company-filter"><option value="all" ${promotorCompanyFilter === 'all' ? 'selected' : ''}>Todas as empresas</option>${promotorCompanies.map((company) => `<option value="${esc(company)}" ${promotorCompanyFilter === company ? 'selected' : ''}>${esc(company)}</option>`).join('')}</select></label>` : ''}
        <span class="product-count" aria-live="polite">${list.length} produto${list.length === 1 ? '' : 's'}</span>
      </div>
      <div class="list products-list" id="productList">${groupedProductRows(list,{selectable:true}) || '<div class="empty">Nenhum produto cadastrado nesta categoria.</div>'}</div>
      <div class="bulk-actions-dock" aria-label="Ações dos produtos selecionados">
        <button type="button" class="bulk-fab" id="bulkFab" aria-expanded="false" aria-controls="bulkActionsMenu" title="Ações em massa">☷</button>
        <div class="bulk-actions-menu" id="bulkActionsMenu" hidden>
          <button type="button" class="primary" id="newProduct">＋ Adicionar produto</button>
          <button type="button" class="secondary" id="floatingSelectAll">☑ Marcar/desmarcar tudo</button>
          <button type="button" class="secondary" id="floatingBulkStatus">↔ Alterar status</button>
          <button type="button" class="secondary" id="floatingQuickTag">🏷 Adicionar tag</button>
          <button type="button" class="secondary danger-btn" id="floatingDeleteSelected">🗑 Excluir selecionados</button>
        </div>
      </div>`;
  return `<section class="products-page">
    <div class="products-hero">
      <div class="products-hero-copy"><div class="hero-eyebrow">OPERAÇÃO · PRODUTOS</div><h2>Controle de produtos</h2><p>Consulte, organize e acompanhe os produtos registrados na operação.</p></div>
    </div>
    <div class="products-overview">
      <div class="product-stat-card"><div class="product-stat-icon green">▦</div><div><strong>${statsList.length}</strong><span>Produtos na lista</span></div></div>
      <div class="product-stat-card"><div class="product-stat-icon red">!</div><div><strong>${critical}</strong><span>Críticos · até 7 dias</span></div></div>
      <div class="product-stat-card"><div class="product-stat-icon amber">◷</div><div><strong>${attention}</strong><span>Em atenção</span></div></div>
      <div class="product-stat-card"><div class="product-stat-icon blue">✓</div><div><strong>${resolved}</strong><span>Resolvidos</span></div></div>
    </div>
    <div class="products-section-heading"><div><div class="eyebrow">CATÁLOGO OPERACIONAL</div><h3>${rebaixaMode ? 'Rebaixa Automática' : 'Seus produtos'}</h3><p>${rebaixaMode ? 'Lista compartilhada de produtos para rebaixa, organizada por vencimento.' : 'Filtre por categoria ou pesquise por nome, EAN e marca.'}</p></div><span class="products-mini-count">${rebaixaMode ? rebaixaCount + ' itens' : fefoCount + ' FEFO'}</span></div>
    <div class="products-filter-panel">
      <div class="subnav products-subnav" aria-label="Subseções de produtos">${filters.map(([key,label]) => `<button type="button" class="subnav-btn ${filter===key?'active':''}" data-product-filter="${key}">${label}</button>`).join('')}</div>
      ${panelContent}
    </div>
  </section>`;
}
function batches() {
  const active = activeBatch();
  const activeProducts = active ? data.products.filter((p) => String(p.batchId || '') === String(active.id) || (p.origemCadastro === 'batida' && !p.batchId && String(p.corridorId) === String(active.corridorId))) : [];
  const current = batchTab === 'current';
  const history = data.batches.slice().reverse();
  return `<div class="section-head"><div><div class="eyebrow">OPERAÇÃO</div><h2>Batidas</h2></div><button class="primary" id="newBatch">+ Registrar</button></div>
  <div class="subnav"><button class="subnav-btn ${current?'active':''}" data-batch-tab="current">Batida atual</button><button class="subnav-btn ${!current?'active':''}" data-batch-tab="history">Histórico</button></div>
  ${current ? (active ? `<div class="panel"><div class="panel-title">Batida em andamento</div><div class="panel-sub">${esc(active.corridorName)} · iniciada em ${fmt(active.date)}</div><div class="toolbar"><button class="primary" id="addBatchProduct">+ Produto desta batida</button><button class="secondary" id="cancelOpenBatch">Cancelar batida</button><button class="secondary" id="finishBatch" ${activeProducts.length ? '' : 'disabled'}>Finalizar batida</button></div><div class="meta">Produtos vinculados: ${activeProducts.length}</div><div class="batch-products"><h3>Produtos desta batida (${activeProducts.length})</h3>${groupedProductRows(activeProducts) || '<div class="empty">Nenhum produto cadastrado nesta batida.</div>'}</div></div>` : `<div class="panel empty">Nenhuma batida em andamento. Toque em + Registrar para começar.</div>`) : `<div class="panel"><p class="panel-sub">Histórico organizado pela contagem crescente de dias.</p><div class="panel-head"><div class="panel-title">Supervisão dos 22 corredores</div><span class="panel-sub">0–6 verde · 7–14 amarelo · 15+ vermelho</span></div><div class="list">${corridorHistoryRows() || '<div class="empty">Nenhum corredor cadastrado.</div>'}</div><div class="panel-head" style="margin-top:18px"><div class="panel-title">Batidas realizadas</div><span class="panel-sub">Corredor → Data</span></div><div class="list">${batchHistoryRows() || '<div class="empty">Nenhuma batida finalizada.</div>'}</div></div>`}`;
}
function expiries() {
  const tabs = [['today','Vence hoje'],['tomorrow','Vence amanhã'],['ten','2–10 dias'],['thirty','11–30 dias'],['future','31 dias+']];
  const list = visibleProducts().filter((p) => expiryGroupFor(p, expiryFilter)).sort((a,b) => a.expiry.localeCompare(b.expiry));
  return `<div class="section-head"><div><div class="eyebrow">ACOMPANHAMENTO</div><h2>Vencimentos</h2></div></div><div class="subnav expiry-tabs">${tabs.map(([key,label]) => `<button class="subnav-btn ${expiryFilter===key?'active':''}" data-expiry-filter="${key}">${label}</button>`).join('')}</div><div class="panel"><div class="list">${groupedProductRows(list) || '<div class="empty">Nenhum produto nesta categoria.</div>'}</div></div>`;
}
function expiryGroupFor(p, filter) {
  const d = daysTo(p.expiry);
  if (filter === 'today') return d === 0;
  if (filter === 'tomorrow') return d === 1;
  if (filter === 'ten') return d >= 2 && d <= 10;
  if (filter === 'thirty') return d >= 11 && d <= 30;
  if (filter === 'future') return d >= 31;
  return true;
}
let expiryFilter = localStorage.getItem('vpa-expiry-filter') || 'today';
let pendingFilter = localStorage.getItem('vpa-pending-filter') || 'pique';
let selectedProducts = new Set();
let corridorEditMode = false;
let teamRealtimeChannel = null;
let teamRealtimeActive = false;
let teamRealtimeStarting = null;
let teamRealtimeUserId = null;
let teamNotificationCount = 0;
const completedBatchNotifications = new Map();
let rebaixaInsertBuffer = new Map();
let rebaixaInsertTimer = null;
let rebaixaCompletionTimer = null;
let rebaixaCompletionNoticeShown = false;
let cloudSaveTimer = null;
function scheduleCloudSave() {
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    cloudSaveTimer = null;
    save().catch((error) => console.warn('[VPA] Falha ao persistir atualização da nuvem:', error));
  }, 350);
}
function pendingProductCard(p) {
  const d = daysTo(p.expiry);
  const label = d < 0 ? 'VENCIDO' : d === 0 ? 'VENCE HOJE' : d === 1 ? 'VENCE AMANHÃ' : `FALTAM ${d} DIAS`;
  const tag = p.tag ? `<span class="tag-chip">${esc(p.tag)}</span>` : '<span class="meta">Sem tag PLU</span>';
  const c = data.corridors.find((x) => x.id === p.corridorId);
  return `<article class="pending-card"><div class="pending-card-main"><button type="button" class="product-thumb" data-open-photo="${p.id}" aria-label="Abrir foto de ${esc(p.name)}">${productImage(p)}</button><div class="pending-product-info"><div class="pending-title">${esc(p.name)}</div><div class="meta">EAN: ${esc(p.ean || 'Não informado')}</div><div class="meta">${tag} · ${esc(c?.name || 'Sem corredor')}</div><div class="meta">Validade: ${fmt(p.expiry)} · Qtd.: ${Number(p.quantity || 0)}</div></div></div><div class="pending-card-side"><span class="pending-deadline">${label}</span><button class="primary pique-btn" data-open-pique="${p.id}">📷 RETIRADA / PIQUE</button></div></article>`;
}
function pendingSection(title, list) {
  return `<section class="pending-group"><div class="pending-group-head"><h3>${title}</h3><span class="product-count">${list.length} produto${list.length === 1 ? '' : 's'}</span></div><div class="pending-list">${groupedPendingCards(list) || '<div class="empty">Nenhum produto nesta lista.</div>'}</div></section>`;
}
function pending() {
  const dueSoon = (p) => { const d = daysTo(p.expiry); return d >= 0 && d <= 10; };
  const pendingBase = visibleProducts().filter((p) => dueSoon(p) && !p.piqueConcluido && p.status !== 'resolvido');
  const list = pendingBase.filter((p) => pendingFilter === 'fefo' ? Boolean(p.fefo) : !p.fefo).sort((a,b) => a.expiry.localeCompare(b.expiry));
  const todayList = list.filter((p) => daysTo(p.expiry) === 0);
  const tomorrowList = list.filter((p) => daysTo(p.expiry) === 1);
  const nextDaysList = list.filter((p) => daysTo(p.expiry) >= 2 && daysTo(p.expiry) <= 10);
  const title = pendingFilter === 'fefo' ? 'PIQUE FEFO' : 'PIQUE';
  return `<div class="section-head"><div><div class="eyebrow">OPERAÇÃO</div><h2>Pendências</h2><p class="panel-sub">${title}: retire e confirme com uma foto os produtos que vencem nos próximos 10 dias.</p></div></div><div class="subnav"><button class="subnav-btn ${pendingFilter==='pique'?'active':''}" data-pending-filter="pique">🔴 PIQUE</button><button class="subnav-btn ${pendingFilter==='fefo'?'active':''}" data-pending-filter="fefo">🔵 PIQUE FEFO</button></div><div class="panel pending-panel">${pendingSection('Vence Hoje', todayList)}${pendingSection('Vence Amanhã', tomorrowList)}${pendingSection('Vence em 2–10 dias', nextDaysList)}</div>`;
}

function showTeamToast(message, type = 'info') {
  let toast = $('teamToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'teamToast';
    toast.className = 'team-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.className = 'team-toast ' + type;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showTeamToast.timer);
  showTeamToast.timer = window.setTimeout(() => { toast.hidden = true; }, 6500);
}

async function showRealtimeNotification(title, body, tag, url = './') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = {
    body,
    icon: './icons/notification-small.png',
    badge: './icons/notification-small.png',
    tag,
    renotify: false,
    data: { url }
  };
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch (error) {
    console.warn('[VPA] Falha ao mostrar notificação em tempo real:', error);
  }
}

function notifyTeamEvent(payload) {
  const row = payload?.new || payload?.record || {};
  const eventType = payload?.eventType || payload?.event || 'UPDATE';
  if (!row.id || row.performed_by === teamRealtimeUserId) return;
  // Uma batida deve gerar somente um aviso quando for concluída.
  // INSERT/UPDATE intermediários não geram notificações para evitar spam.
  if (row.status !== 'completed' || !['INSERT', 'UPDATE'].includes(String(eventType).toUpperCase())) return;
  const notificationKey = String(row.id) + ':' + String(row.completed_at || row.updated_at || row.status);
  if (completedBatchNotifications.has(notificationKey)) return;
  completedBatchNotifications.set(notificationKey, Date.now());
  for (const [key, time] of completedBatchNotifications.entries()) {
    if (Date.now() - time > 120000) completedBatchNotifications.delete(key);
  }
  const corridor = data.corridors.find((c) => String(c.cloudId || c.number) === String(row.corridor_id));
  const corridorLabel = corridor?.name || ('corredor ' + (row.corridor_id || 'desconhecido'));
  const productCount = Number(row.product_count ?? data.products.filter((product) => String(product.batchId || '') === String(row.id)).length);
  const message = `Batida realizada · ${corridorLabel} · ${productCount} novo${productCount === 1 ? '' : 's'} produto${productCount === 1 ? '' : 's'}.`;
  teamNotificationCount += 1;
  showTeamToast('🔔 ' + message, 'team');
  showRealtimeNotification('Vencimento PA · Batida finalizada', message, 'vpa-team-completed-' + row.id);
}

const recentProductEvents = new Map();
let realtimeRenderTimer = null;
function scheduleRealtimeRender() {
  window.clearTimeout(realtimeRenderTimer);
  realtimeRenderTimer = window.setTimeout(() => { realtimeRenderTimer = null; render(); }, 250);
}
function notifyProductEvent(payload) {
  const eventType = payload?.eventType || payload?.event || 'UPDATE';
  const row = eventType === 'DELETE' ? (payload?.old || payload?.record || {}) : (payload?.new || payload?.record || {});
  if (!row.id) return;
  const eventFingerprint = [eventType, row.id, row.updated_at || row.created_at || '', row.status || '', row.name || ''].join('|');
  const now = Date.now();
  for (const [key, time] of recentProductEvents.entries()) if (now - time > 15000) recentProductEvents.delete(key);
  if (recentProductEvents.has(eventFingerprint)) return;
  recentProductEvents.set(eventFingerprint, now);
  // REGRA V26: eventos de produtos (INSERT/UPDATE/DELETE) são silenciosos.
  // Nenhum cadastro ou exclusão individual pode disparar notificação.
  mergeCloudProductEvent(payload);
}

function localProductFromCloud(row) {
  const meta = row.app_metadata && typeof row.app_metadata === 'object' ? row.app_metadata : {};
  const corridor = data.corridors.find((c) => String(c.cloudId || c.number) === String(row.corridor_id));
  const statusMap = { in_corridor: 'corredor', found: 'vencimento', separated: 'separado', resolved: 'resolvido' };
  return {
    id: row.id,
    name: row.name || 'Produto',
    ean: row.ean || '',
    company: row.company || '',
    location: row.location || '',
    photo: row.photo_url || '',
    corridorId: corridor?.id || null,
    corridorNumber: corridor?.number || null,
    expiry: row.expiration_date || '',
    quantity: Number(row.quantity_found || 0),
    quantitySeparated: Number(row.quantity_separated || 0),
    status: statusMap[row.status] || 'corredor',
    createdAt: meta.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || null,
    batchId: meta.batchId || null,
    origemCadastro: meta.origemCadastro || null,
    categoriaCadastro: meta.categoriaCadastro || null,
    tag: meta.tag || '',
    fefo: Boolean(meta.fefo),
    promotor: Boolean(meta.promotor),
    piqueConcluido: Boolean(meta.piqueConcluido),
    piqueAt: meta.piqueAt || null,
    piqueTipo: meta.piqueTipo || null,
    cloudRegisteredBy: row.registered_by || null
  };
}

function localProductFromTemporary(row) {
  const meta = row.app_metadata && typeof row.app_metadata === 'object' ? row.app_metadata : {};
  const corridor = data.corridors.find((c) => String(c.cloudId || c.number) === String(row.corridor_id));
  const statusMap = { in_corridor: 'corredor', found: 'vencimento', separated: 'separado', resolved: 'resolvido' };
  return {
    id: row.id,
    name: row.name || 'Produto',
    ean: row.ean || '',
    corridorId: corridor?.id || null,
    corridorNumber: corridor?.number || null,
    expiry: row.expiration_date || '',
    quantity: Number(row.quantity_found || 0),
    quantitySeparated: Number(row.quantity_separated || 0),
    status: statusMap[row.status] || 'corredor',
    createdAt: meta.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || null,
    batchId: row.batch_id || meta.batchId || null,
    origemCadastro: meta.origemCadastro || 'batida',
    categoriaCadastro: meta.categoriaCadastro || 'general',
    tag: meta.tag || '',
    fefo: Boolean(meta.fefo),
    promotor: Boolean(meta.promotor),
    piqueConcluido: Boolean(meta.piqueConcluido),
    piqueAt: meta.piqueAt || null,
    piqueTipo: meta.piqueTipo || null,
    isTemporaryBatchItem: true,
    syncPending: false,
    photo: ''
  };
}

async function mergeCloudTemporaryBatchItems(shouldRender = true) {
  if (!window.VPASupabase?.listTemporaryBatchItems) return;
  try {
    const rows = await window.VPASupabase.listTemporaryBatchItems();
    const remote = rows.map(localProductFromTemporary);
    const remoteIds = new Set(remote.map((p) => String(p.id)));
    const localPending = data.products.filter((p) => p.isTemporaryBatchItem && !remoteIds.has(String(p.id)));
    const official = data.products.filter((p) => !p.isTemporaryBatchItem);
    data.products = [...official, ...remote, ...localPending];
    await save();
    if (shouldRender) render();
  } catch (error) {
    console.warn('[VPA] Não foi possível carregar itens temporários das batidas:', error.message || error);
  }
}

async function mergeCloudProducts(shouldRender = true) {
  if (!window.VPASupabase?.listProducts) return;
  try {
    const rows = await window.VPASupabase.listProducts();
    // A nuvem é a fonte oficial: não reintroduzir produtos locais ausentes no Supabase.
    // Somente registros presentes na nuvem entram na lista principal após o carregamento.
    const merged = rows.map((row) => {
      const local = data.products.find((product) => String(product.id) === String(row.id));
      const cloud = localProductFromCloud(row);
      return {
        ...local,
        ...cloud,
        // A nuvem pode não devolver app_metadata; preservar o vínculo local da batida.
        batchId: cloud.batchId || local?.batchId || null,
        origemCadastro: cloud.origemCadastro || local?.origemCadastro || 'nuvem',
        categoriaCadastro: cloud.categoriaCadastro || local?.categoriaCadastro || 'general',
        syncPending: false,
        photo: local?.photo || ''
      };
    });
    // Preserva produtos externos do Promotor PA. A sincronização da tabela geral
    // não pode apagar a lista compartilhada dos promotores.
    const externalPromotor = data.products.filter((product) => product.externalPromotor);
    data.products = [...merged, ...externalPromotor];
    await save();
    if (shouldRender) render();
  } catch (error) {
    console.warn('[VPA] Não foi possível carregar produtos compartilhados:', error.message || error);
  }
}

async function mergeCloudPromotorProducts(shouldRender = true) {
  if (!window.VPASupabase?.listPromotorProducts) return;
  try {
    const rows = await window.VPASupabase.listPromotorProducts();
    const external = rows.map((row) => ({
      id: 'promotor:' + row.id,
      sourceId: row.id,
      source: 'promotor_pa',
      externalPromotor: true,
      name: row.name || 'Produto',
      ean: row.ean || '',
      company: row.company || '',
      location: row.location || '',
      photo: row.photo_url || '',
      expiry: row.expiration_date || '',
      quantity: Number(row.quantity || 0),
      quantitySeparated: 0,
      status: row.status === 'concluido' ? 'resolvido' : 'corredor',
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || null,
      batchId: null,
      origemCadastro: 'promotor_pa',
      categoriaCadastro: 'promotor',
      tag: row.tag || '',
      fefo: false,
      promotor: true,
      piqueConcluido: false,
      syncPending: false
    }));
    const externalIds = new Set(external.map((p) => String(p.id)));
    const withoutOldExternal = data.products.filter((p) => !p.externalPromotor);
    data.products = [...withoutOldExternal, ...external];
    await save();
    if (shouldRender) render();
  } catch (error) {
    console.warn('[VPA] Não foi possível carregar produtos do Promotor PA:', error.message || error);
  }
}

function mergeCloudProductEvent(payload) {
  const eventType = payload?.eventType || payload?.event || 'UPDATE';
  const row = eventType === 'DELETE' ? (payload?.old || payload?.record || {}) : (payload?.new || payload?.record || {});
  if (!row?.id) return;
  if (eventType === 'DELETE') {
    data.products = data.products.filter((product) => String(product.id) !== String(row.id));
  } else {
    const cloud = localProductFromCloud(row);
    const index = data.products.findIndex((product) => String(product.id) === String(row.id));
    if (index >= 0) {
      const previous = data.products[index];
      data.products[index] = {
        ...previous,
        ...cloud,
        // Não perder o vínculo da batida quando o evento remoto não traz app_metadata.
        batchId: cloud.batchId || previous.batchId || null,
        origemCadastro: cloud.origemCadastro || previous.origemCadastro || 'nuvem',
        categoriaCadastro: cloud.categoriaCadastro || previous.categoriaCadastro || 'general',
        syncPending: false,
        photo: previous.photo || ''
      };
    } else data.products.push({ ...cloud, syncPending: false });
  }
  scheduleCloudSave();
  scheduleRealtimeRender();
}


function localRebaixaFromCloud(row) {
  return {
    id: String(row.id),
    loja: row.loja || '',
    plu: row.plu || '',
    name: row.name || '',
    quantity: row.quantity ?? '',
    expiry: row.expiry || '',
    value: row.value ?? '',
    status: row.status || 'pending',
    createdBy: row.created_by || null,
    createdAt: row.created_at || new Date().toISOString(),
    completedBy: row.completed_by || null,
    completedAt: row.completed_at || null,
    synced: true
  };
}

async function mergeCloudRebaixaItems(shouldRender = true) {
  if (!window.VPASupabase?.listRebaixaItems) return;
  try {
    const rows = await window.VPASupabase.listRebaixaItems();
    const remote = rows.map(localRebaixaFromCloud).filter((item) => item.status !== 'completed');
    // O Supabase é a fonte oficial: quando a consulta retorna vazia,
    // a lista local também precisa ser esvaziada (inclusive após a última rebaixa).
    data.rebaixaItems = remote;
    data.rebaixaItems.sort((a, b) => String(a.expiry || '9999-12-31').localeCompare(String(b.expiry || '9999-12-31')));
    await save();
    if (shouldRender) render();
  } catch (error) {
    console.warn('[VPA] Não foi possível carregar rebaixas compartilhadas:', error.message || error);
  }
}

async function refreshRebaixaOnReturn() {
  if (document.visibilityState && document.visibilityState !== 'visible') return;
  if (!window.VPASupabase?.isConfigured?.()) return;
  try { await mergeCloudRebaixaItems(view === 'products' && productFilter === 'rebaixa'); }
  catch (error) { console.warn('[VPA] Atualização ao retornar ao aplicativo:', error.message || error); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshRebaixaOnReturn(); });
window.addEventListener('focus', refreshRebaixaOnReturn);

function flushRebaixaInsertNotifications() {
  rebaixaInsertTimer = null;
  const count = rebaixaInsertBuffer.size;
  rebaixaInsertBuffer.clear();
  if (!count) return;
  const message = `Nova lista de rebaixa - ${count} novo${count === 1 ? '' : 's'} item${count === 1 ? '' : 'ns'}`;
  teamNotificationCount += 1;
  showTeamToast('🔔 ' + message, 'team');
  showRealtimeNotification('Vencimento PA', message, 'vpa-rebaixa-new-list');
}

function scheduleRebaixaInsertNotification(row) {
  if (!row?.id) return;
  rebaixaInsertBuffer.set(String(row.id), row);
  window.clearTimeout(rebaixaInsertTimer);
  rebaixaInsertTimer = window.setTimeout(flushRebaixaInsertNotifications, 900);
}

function scheduleRebaixaCompletionNotification() {
  window.clearTimeout(rebaixaCompletionTimer);
  rebaixaCompletionTimer = window.setTimeout(async () => {
    rebaixaCompletionTimer = null;
    try {
      const rows = await window.VPASupabase?.listRebaixaItems?.();
      const remaining = Array.isArray(rows) ? rows.filter((row) => row.status !== 'completed') : [];
      if (remaining.length === 0 && !rebaixaCompletionNoticeShown) {
        rebaixaCompletionNoticeShown = true;
        const message = 'Rebaixa Automática Concluída';
        teamNotificationCount += 1;
        showTeamToast('🔔 ' + message, 'team');
        showRealtimeNotification('Vencimento PA', message, 'vpa-rebaixa-completed');
      } else if (remaining.length > 0) {
        rebaixaCompletionNoticeShown = false;
      }
    } catch (error) {
      console.warn('[VPA] Não foi possível verificar a conclusão da rebaixa:', error.message || error);
    }
  }, 900);
}

function notifyRebaixaEvent(payload) {
  const eventType = String(payload?.eventType || payload?.event || 'UPDATE').toUpperCase();
  const row = payload?.new || payload?.record || payload?.old || {};
  const actorId = row.created_by || row.completed_by || null;
  if (actorId && teamRealtimeUserId && String(actorId) === String(teamRealtimeUserId)) {
    mergeCloudRebaixaItems(true).catch(() => {});
    return;
  }
  mergeCloudRebaixaItems(true).catch((error) => console.warn('[VPA] Atualização da Rebaixa Automática:', error));
  // INSERTs de uma mesma planilha são agrupados em um único aviso.
  if (eventType === 'INSERT' && row.status !== 'completed') {
    rebaixaCompletionNoticeShown = false;
    scheduleRebaixaInsertNotification(row);
    return;
  }
  // UPDATEs individuais não geram spam. Só avisamos quando a lista inteira acabou.
  if (eventType === 'UPDATE' && row.status === 'completed') {
    scheduleRebaixaCompletionNotification();
  }
}

async function mergeCloudBatidas(shouldRender = true) {
  if (!window.VPASupabase || !window.VPASupabase.isConfigured()) return;
  try {
    const rows = await window.VPASupabase.listBatidas();
    const localById = new Map(data.batches.map((b) => [String(b.id), b]));
    const statusMap = { in_progress: 'aberta', completed: 'finalizada', cancelled: 'cancelada' };
    rows.forEach((row) => {
      const local = localById.get(String(row.id)) || {};
      const corridor = data.corridors.find((c) => String(c.cloudId || c.number) === String(row.corridor_id));
      const merged = {
        ...local,
        id: row.id,
        corridorId: local.corridorId || corridor?.id || null,
        corridorName: local.corridorName || corridor?.name || ('Corredor ' + (row.corridor_id || '')),
        date: local.date || (row.started_at || row.created_at || '').slice(0, 10),
        startedAt: row.started_at || local.startedAt,
        finishedAt: row.completed_at || local.finishedAt || null,
        status: statusMap[row.status] || local.status || 'aberta',
        cloudId: row.corridor_id,
        performedBy: row.performed_by || local.performedBy || null,
        productCount: Number(row.product_count ?? local.productCount ?? 0)
      };
      localById.set(String(row.id), merged);
    });
    data.batches = Array.from(localById.values()).sort((a, b) => String(b.startedAt || b.date || '').localeCompare(String(a.startedAt || a.date || '')));
    await save();
    if (shouldRender) render();
  } catch (error) {
    console.warn('[VPA] Não foi possível carregar batidas da equipe:', error.message || error);
  }
}

function teamNotificationPermissionLabel() {
  if (!('Notification' in window)) return 'Este navegador não oferece notificações.';
  if (Notification.permission === 'granted') return '🟢 Notificações autorizadas neste navegador.';
  if (Notification.permission === 'denied') return '🔴 Notificações bloqueadas. Clique no ícone de cadeado/configurações do site e permita Notificações.';
  return '🟡 Permissão de notificações ainda não definida neste navegador.';
}

async function testAndroidNotification() {
  if (!('Notification' in window)) {
    showTeamToast('Este navegador não oferece notificações.', 'warning');
    return;
  }
  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showTeamToast('Autorize as notificações antes de executar o teste.', 'warning');
      render();
      return;
    }
  }
  if (!('serviceWorker' in navigator)) {
    showTeamToast('Este navegador não oferece Service Worker.', 'warning');
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification('Vencimento PA · Teste Android', {
      body: 'Teste concluído: esta é uma notificação local do aplicativo.',
      icon: './icons/notification-small.png',
      badge: './icons/notification-small.png',
      tag: 'vpa-android-test-' + Date.now(),
      renotify: false,
      vibrate: [180, 80, 220],
      timestamp: Date.now(),
      data: { url: './' }
    });
    showTeamToast('✅ Notificação de teste enviada para a barra de notificações.', 'success');
  } catch (error) {
    console.warn('[VPA] Não foi possível mostrar a notificação de teste:', error);
    showTeamToast('Não foi possível mostrar a notificação. Teste pelo GitHub Pages com o PWA instalado.', 'warning');
  }
}

async function requestTeamNotifications() {
  if (!('Notification' in window)) { showTeamToast('Este navegador não oferece notificações.', 'warning'); return; }
  if (Notification.permission === 'denied') {
    showTeamToast('🔴 As notificações estão bloqueadas neste navegador. Abra as configurações do site e permita Notificações.', 'warning');
    render();
    return;
  }
  const permission = await Notification.requestPermission();
  showTeamToast(permission === 'granted' ? '✅ Notificações da equipe ativadas neste aparelho.' : 'As notificações não foram autorizadas. Verifique a permissão do site no navegador.', permission === 'granted' ? 'success' : 'warning');
  render();
}

let teamAuthListenerBound = false;
let teamAutoNotificationAttempted = false;

async function autoActivateTeamAfterLogin(session) {
  if (!session?.user) return;
  await autoSyncAllOnLogin('login').catch((error) => console.warn('[VPA] Falha na sincronização automática do login:', error));
  await initTeamRealtime();

  // A permissão é específica por navegador/perfil. Se já foi concedida,
  // não é necessário pedir novamente a cada login.
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  if (teamAutoNotificationAttempted) return;

  const alreadyPrompted = localStorage.getItem('vpa-team-notification-prompted') === '1';
  if (alreadyPrompted) return;

  teamAutoNotificationAttempted = true;
  localStorage.setItem('vpa-team-notification-prompted', '1');

  // Alguns navegadores exigem gesto do usuário para abrir o pedido.
  // Tentamos uma vez após o login; se o navegador impedir, o botão
  // manual continuará disponível em Ajustes.
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      showTeamToast('✅ Notificações da equipe ativadas automaticamente neste navegador.', 'success');
    } else {
      showTeamToast('🟡 Equipe online ativada. Para receber avisos, autorize as notificações em Ajustes.', 'warning');
    }
    render();
  } catch (error) {
    console.warn('[VPA] O navegador não permitiu solicitar notificações automaticamente:', error);
    showTeamToast('🟡 Equipe online ativada. Clique em “Ativar notificações” em Ajustes para autorizar os avisos.', 'warning');
    render();
  }
}

async function bindTeamAuthListener() {
  if (teamAuthListenerBound || !window.VPASupabase?.onAuthStateChange) return;
  teamAuthListenerBound = true;
  try {
    await window.VPASupabase.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        window.setTimeout(() => autoActivateTeamAfterLogin(session).catch((error) => {
          console.warn('[VPA] Falha ao ativar equipe após login:', error);
        }), 0);
      }
    });
  } catch (error) {
    teamAuthListenerBound = false;
    console.warn('[VPA] Não foi possível registrar o listener de login:', error);
  }
}

function notifyPromotorProductEvent(payload) {
  const eventType = payload?.eventType || payload?.event || 'UPDATE';
  const row = payload?.new || payload?.record || payload?.old || {};
  const name = row?.name || 'Produto do Promotor PA';
  mergeCloudPromotorProducts(true).catch((error) => console.warn('[VPA] Atualização Promotor PA:', error));
  showTeamToast((eventType === 'DELETE' ? '🗑 Produto removido do Promotor PA: ' : '🔄 Produto atualizado no Promotor PA: ') + name, 'success');
}

async function initTeamRealtime() {
  if (teamRealtimeActive) return teamRealtimeChannel;
  if (teamRealtimeStarting) return teamRealtimeStarting;
  if (!window.VPASupabase || !window.VPASupabase.isConfigured()) return null;
  teamRealtimeStarting = (async () => {
   try {
    const session = await window.VPASupabase.getSession();
    if (!session?.user?.id) {
      teamRealtimeUserId = null;
      return;
    }
    teamRealtimeUserId = session.user.id;
    await mergeCloudBatidas(false);
    await mergeCloudProducts(false);
    await mergeCloudTemporaryBatchItems(false);
    await mergeCloudPromotorProducts(false);
    await mergeCloudRebaixaItems(false);
    render();
    const batidasChannel = await window.VPASupabase.subscribeBatidas(notifyTeamEvent);
    const productsChannel = await window.VPASupabase.subscribeProducts(notifyProductEvent);
    const promotorChannel = await window.VPASupabase.subscribePromotorProducts(notifyPromotorProductEvent);
    const rebaixaChannel = await window.VPASupabase.subscribeRebaixaItems(notifyRebaixaEvent);
    teamRealtimeChannel = { batidas: batidasChannel, products: productsChannel, promotor: promotorChannel, rebaixa: rebaixaChannel };
    teamRealtimeActive = true;
    showTeamToast('🟢 Equipe online: batidas compartilhadas ativadas.', 'success');
   } catch (error) {
    console.warn('[VPA] Realtime da equipe não foi iniciado:', error.message || error);
    return null;
   } finally {
    teamRealtimeStarting = null;
   }
  })();
  return teamRealtimeStarting;
}


async function checkForAppUpdate() {
  const status = $('appUpdateStatus');
  const button = $('checkAppUpdate');
  if (button) button.disabled = true;
  if (status) status.textContent = 'Verificando nova versão...';
  try {
    const response = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível consultar a versão publicada.');
    const remote = await response.json();
    const remoteVersion = String(remote.version || '').trim();
    if (!remoteVersion) throw new Error('Arquivo de versão inválido.');
    if (remoteVersion === APP_VERSION) {
      if (status) status.textContent = `✅ Aplicativo atualizado (${APP_VERSION}).`;
      return;
    }
    if (status) status.textContent = `⬆ Nova versão disponível: ${remoteVersion}. Preparando atualização...`;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('vpa-pwa-')).map((key) => caches.delete(key)));
    }
    localStorage.setItem('vpa-last-update-request', remoteVersion);
    const url = new URL(window.location.href);
    url.searchParams.set('appv', remoteVersion);
    url.searchParams.set('_refresh', Date.now());
    window.location.replace(url.toString());
  } catch (error) {
    console.warn('[VPA] Falha ao verificar atualização:', error);
    if (status) status.textContent = '⚠ Não foi possível verificar a atualização: ' + (error.message || error);
  } finally {
    if (button) button.disabled = false;
  }
}

function settings() {
  return `<div class="section-head"><div><div class="eyebrow">PERSONALIZAÇÃO</div><h2>Ajustes</h2></div></div>
  <div class="panel"><div class="product-name">Tema do aplicativo</div><p class="panel-sub">Escolha uma aparência confortável para seu turno. A preferência fica salva neste dispositivo.</p><div class="theme-switcher"><button class="${theme === 'light' ? 'primary' : 'secondary'}" id="themeLight">☀ Claro</button><button class="${theme === 'dark' ? 'primary' : 'secondary'}" id="themeDark">☾ Escuro</button></div></div>
  <div class="panel" style="margin-top:14px"><div class="product-name">Atualização do aplicativo <span class="tag-chip">${APP_VERSION}</span></div><p class="panel-sub">Consulta a versão publicada no GitHub Pages e força a atualização dos arquivos sem precisar limpar o cache manualmente.</p><div class="toolbar"><button class="primary" id="checkAppUpdate">↻ Verificar atualização</button></div><p class="panel-sub" id="appUpdateStatus">Versão instalada: ${APP_VERSION}</p></div>
  <div class="panel" style="margin-top:14px"><div class="product-name">Armazenamento local</div><p class="panel-sub">Seus registros ficam neste navegador. Faça backups regularmente.</p><div class="toolbar"><button class="primary" id="backupBtn">⇩ Exportar backup</button><button class="secondary" id="restoreBtn">⇧ Restaurar backup</button></div></div><div class="panel compact-notification-panel" style="margin-top:14px"><div class="product-name">Notificações <span class="tag-chip">V17</span></div><p class="panel-sub">A conexão da equipe é iniciada automaticamente após o login. Produtos e batidas locais são sincronizados automaticamente após o login quando o banco está configurado. Notificações em segundo plano exigem permissão e Web Push ativo neste aparelho.</p><div class="toolbar"><button class="primary" id="enableTeamNotifications">🔔 Autorizar notificações</button><button class="secondary" id="testAndroidNotification">📱 Testar barra Android</button></div><p class="panel-sub" id="teamNotificationStatus">${teamNotificationPermissionLabel()}</p><p class="panel-sub">${teamRealtimeActive ? "🟢 Equipe conectada" : "🟡 Conexão aguardando"} · ${teamNotificationCount} aviso(s) nesta sessão.</p></div><div class="panel" style="margin-top:14px"><div class="product-name">Sincronização com Supabase</div><p class="panel-sub">Envia os produtos locais para a nuvem usando o usuário autenticado. O registro local não é apagado se algum item falhar.</p><div class="toolbar"><button class="primary" id="syncProductsBtn">☁ Sincronizar produtos</button><button class="secondary" id="syncBatchesBtn">☁ Sincronizar batidas</button></div><p class="panel-sub" id="syncProductsStatus" aria-live="polite">Nenhuma sincronização executada nesta sessão.</p><p class="panel-sub" id="syncBatchesStatus" aria-live="polite">Nenhuma sincronização de batidas executada nesta sessão.</p></div><div class="panel" style="margin-top:14px"><div class="product-name">Estrutura</div><p class="panel-sub">${data.corridors.length} corredores cadastrados · ${data.products.length} produtos · ${data.batches.length} batidas.</p><div class="toolbar"><button class="secondary" id="corridorsBtn">Ver corredores</button><button class="secondary" id="manageCorridorsBtn">Editar corredores e sessões</button></div></div>`;
}
function floatingItems() {
  const main = [
    ['dashboard','⌂','Início'],
    ['products','▣','Produtos'],
    ['batches','⌗','Batidas'],
    ['expiries','▦','Vencimentos'],
    ['pending','▤','Pendências'],
    ['reports','▥','Acompanhamento'],
    ['settings','⚙','Ajustes']
  ];
  const submenus = {
    products: [['all','Todos'],['fefo','Produtos FEFO'],['promotor','Produtos Promotores'],['rebaixa','Rebaixa Automática']],
    batches: [['current','Batida atual'],['history','Histórico']],
    expiries: [['today','Vence hoje'],['tomorrow','Vence amanhã'],['10','Vence em 2–10 dias'],['30','Vence em 11–30 dias'],['31','Vence em 31+ dias']],
    pending: [['pique','🔴 PIQUE'],['fefo','🔵 PIQUE FEFO']]
  };
  const mainMarkup = main.map(([key,icon,label]) => `<button class="nav-main-item${view === key ? ' active' : ''}" data-view="${key}"><span>${icon}</span><strong>${label}</strong></button>`).join('');
  const submenuMarkup = (submenus[view] || []).length
    ? `<div class="floating-nav-divider">Opções desta tela</div>${submenus[view].map(([key,label]) => `<button class="nav-sub-item" data-submenu="${key}">${label}</button>`).join('')}`
    : '';
  return `<div class="floating-nav-heading">Navegação do sistema</div>${mainMarkup}${submenuMarkup}<div class="floating-nav-footer"><button class="nav-profile-photo" id="navProfilePhotoButton"><span>◉</span><strong>Alterar foto do perfil</strong></button><button class="nav-logout-item" id="navLogoutButton"><span>↪</span><strong>Sair da conta</strong></button></div>`;
}
function formatRebaixaValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  const raw = String(value).trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/^R\$\s*/i, '');
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && raw !== '') return numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return raw;
}
function rebaixaPage() {
  const searchValue = localStorage.getItem('vpa-rebaixa-search') || '';
  const q = searchValue.trim().toLowerCase();
  const items = data.rebaixaItems.slice().sort((a, b) => String(a.expiry || '9999-12-31').localeCompare(String(b.expiry || '9999-12-31'))).filter((item) => !q || `${item.loja} ${item.plu} ${item.name} ${item.quantity} ${item.expiry} ${item.value}`.toLowerCase().includes(q));
  const empty = !data.rebaixaItems.length;
  return `<div class="rebaixa-toolbar"><button class="primary" id="openRebaixaImport">📊 Importar lista Excel</button><button class="secondary" id="exportRebaixaExcel" ${data.rebaixaItems.length ? '' : 'disabled'}>⇩ Exportar Excel</button></div><div class="products-toolbar"><div class="products-search-wrap"><span>⌕</span><input class="search compact-search" id="rebaixaSearch" placeholder="Buscar loja, PLU ou descrição..." value="${esc(searchValue)}"></div><span class="product-count">${items.length} item${items.length === 1 ? '' : 'ns'}</span></div><div class="rebaixa-list">${items.length ? items.map((item) => `<div class="rebaixa-row"><div class="rebaixa-main"><div class="product-name">${esc(item.name || 'Produto sem descrição')}</div><div class="meta">Loja: ${esc(item.loja || '—')} · PLU: ${esc(item.plu || '—')}</div><div class="meta">Estoque: ${esc(item.quantity || '—')} · Valor: ${esc(formatRebaixaValue(item.value))}</div></div><div class="rebaixa-date"><strong>Vencimento: ${esc(fmt(item.expiry))}</strong><button class="rebaixa-done-btn" data-rebaixa-done="${esc(item.id)}">Preço alterado ✓</button></div></div>`).join('') : `<div class="rebaixa-empty"><strong>${empty ? 'Tudo em dia' : 'Nenhum resultado encontrado'}</strong><span>${empty ? 'Aguardando nova lista de Rebaixas' : 'Tente outra busca ou importe uma nova lista.'}</span></div>`}</div>`;
}
function reports() {
  const monthKey = today().slice(0, 7);
  const monthBatches = data.batches.filter((b) => (b.date || '').slice(0, 7) === monthKey && b.status === 'finalizada');
  const monthProducts = data.products.filter((p) => (p.createdAt || '').slice(0, 7) === monthKey);
  const checked = data.corridors.filter((c) => c.lastCheck && (c.lastCheck || '').slice(0, 7) === monthKey).length;
  const overdue = data.corridors.filter((c) => !c.lastCheck || Math.floor((new Date(today()) - new Date(c.lastCheck)) / 86400000) > 15).length;
  const separated = data.products.filter((p) => ['separado','resolvido'].includes(p.status)).length;
  const critical = visibleProducts().filter((p) => daysTo(p.expiry) <= 7).length;
  const recentBatches = data.batches.slice().sort((a,b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
  const pct = data.corridors.length ? Math.round((checked / data.corridors.length) * 100) : 0;
  return `<div class="section-head"><div><div class="eyebrow">GESTÃO E RESULTADOS</div><h2>Relatórios / Acompanhamento</h2><div class="panel-sub">Visão consolidada do trabalho registrado neste dispositivo.</div></div><button class="secondary" id="reportsBack">← Voltar</button></div>
  <div class="stats">
    <div class="stat ok"><div class="stat-top"><div class="stat-icon">✓</div><span class="label">Batidas no mês</span></div><div class="num">${monthBatches.length}</div><div class="sub">Conferências finalizadas</div></div>
    <div class="stat blue"><div class="stat-top"><div class="stat-icon">▣</div><span class="label">Produtos no mês</span></div><div class="num">${monthProducts.length}</div><div class="sub">Cadastros registrados</div></div>
    <div class="stat warning"><div class="stat-top"><div class="stat-icon">!</div><span class="label">Críticos</span></div><div class="num">${critical}</div><div class="sub">Vencem em até 7 dias</div></div>
    <div class="stat alert"><div class="stat-top"><div class="stat-icon">◷</div><span class="label">Corredores pendentes</span></div><div class="num">${overdue}</div><div class="sub">Sem batida há mais de 15 dias</div></div>
  </div>
  <div class="panel" style="margin-top:14px"><div class="panel-head"><div><div class="panel-title">Progresso do mês</div><div class="panel-sub">${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div></div><strong>${pct}%</strong></div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-row"><span>${checked} de ${data.corridors.length} corredores conferidos no mês</span><strong>${data.corridors.length-checked}</strong></div>
    <div class="mini-grid"><div class="mini"><strong>${checked}</strong><span>Conferidos</span></div><div class="mini warning"><strong>${data.corridors.length-checked}</strong><span>Restantes</span></div><div class="mini danger"><strong>${separated}</strong><span>Separados/resolvidos</span></div></div>
  </div>
  <div class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">Histórico recente de batidas</div><span class="panel-sub">${recentBatches.length} registros</span></div>
    <div class="list">${recentBatches.map(b=>`<div class="product-row"><div><div class="product-name">${esc(b.corridorName || 'Corredor')}</div><div class="meta">${fmt(b.date)} · ${data.products.filter(p=>p.batchId===b.id).length} produtos</div></div><span class="badge ${b.status==='finalizada'?'':'warn'}">${b.status==='finalizada'?'Finalizada':b.status==='cancelada'?'Cancelada':'Aberta'}</span></div>`).join('') || '<div class="empty">Nenhuma batida registrada.</div>'}</div>
  </div>
  <div class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">Resumo operacional</div></div>
    <div class="list"><div class="team-row"><span>Produtos cadastrados</span><strong>${data.products.length}</strong></div><div class="team-row"><span>Produtos separados ou resolvidos</span><strong>${separated}</strong></div><div class="team-row"><span>Produtos ainda no corredor</span><strong>${data.products.filter(p=>p.status==='corredor'&&!p.piqueConcluido).length}</strong></div><div class="team-row"><span>Produtos na área de vencimento</span><strong>${data.products.filter(p=>p.status==='vencimento'&&!p.piqueConcluido).length}</strong></div></div>
  </div>`;
}
function render() {
  localStorage.setItem('vpa-view', view);
  const pageContent = view === 'dashboard' ? dashboard() : view === 'products' ? products() : view === 'batches' ? batches() : view === 'expiries' ? expiries() : view === 'pending' ? pending() : view === 'reports' ? reports() : settings();
  const standardViews = new Set(['batches', 'expiries', 'pending', 'reports', 'settings']);
  $('view').innerHTML = standardViews.has(view) ? `<div class="standard-page">${pageContent}</div>` : pageContent;
  $('floatingNavPanel').innerHTML = floatingItems();
  // O botão de cadastro é recriado a cada renderização; vincular diretamente aqui evita que ele fique sem evento.
  const newProductButton = $('newProduct');
  if (newProductButton) newProductButton.onclick = (event) => { event.preventDefault(); openProduct(null, true); };
  $('floatingNavTrigger').style.display = 'inline-grid';
  $('floatingNavTrigger').setAttribute('aria-expanded', $('floatingNavPanel')?.classList.contains('open') ? 'true' : 'false');
  document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { view = b.dataset.view; $('floatingNavPanel')?.classList.remove('open'); render(); });
  document.querySelectorAll('[data-submenu]').forEach((b) => b.onclick = () => { const key = b.dataset.submenu; if (view === 'products') { productFilter = key; localStorage.setItem('vpa-product-filter', productFilter); } if (view === 'expiries') { expiryFilter = key; localStorage.setItem('vpa-expiry-filter', expiryFilter); } if (view === 'pending') { pendingFilter = key; localStorage.setItem('vpa-pending-filter', pendingFilter); selectedProducts.clear(); } if (view === 'batches') { batchTab = key; localStorage.setItem('vpa-batch-tab', batchTab); } $('floatingNavPanel')?.classList.remove('open'); render(); });
  bind();
}
function openProduct(productId = null, forceManual = false) {
  const p = data.products.find((x) => x.id === productId);
  const currentBatch = activeBatch();
  const batch = p?.batchId ? data.batches.find((b) => String(b.id) === String(p.batchId) && b.status === 'aberta') : (forceManual ? null : currentBatch);
  $('corridor').innerHTML = data.corridors.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('productForm').reset();
  $('productId').value = p?.id || '';
  $('productBatchId').value = batch?.id || '';
  $('expiry').value = p?.expiry || today();
  $('quantity').value = p?.quantity || 1;
  $('name').value = p?.name || '';
  $('ean').value = p?.ean || '';
  $('status').value = p?.status || 'corredor';
  // Define a lista de destino do produto. Ao editar, preserva a categoria atual.
  const productType = p?.fefo ? 'fefo' : p?.promotor ? 'promotor' : 'general';
  document.querySelectorAll('input[name=productType]').forEach((radio) => {
    radio.checked = radio.value === productType;
  });
  $('photoData').value = p?.photo || '';
  $('photoInput').value = '';
  $('photoPreview').innerHTML = p?.photo ? `<img src="${esc(p.photo)}" alt="Prévia do produto">` : '<span>Sem foto adicionada</span>';
  $('scanMessage').textContent = '';
  $('lookupMessage').textContent = '';
  const corridorId = p?.corridorId || (batch ? batch.corridorId : data.corridors[0]?.id || '');
  $('corridor').value = corridorId;
  $('corridor').disabled = Boolean(batch && !p);
  $('batchContext').textContent = batch && !p ? `Vinculado automaticamente à ${batch.corridorName} · batida em andamento.` : p?.batchId ? 'Produto vinculado a uma batida existente.' : 'Cadastro manual: não será vinculado a uma batida.';
  $('productDialog').showModal();
}
function updateBatchPreview() {
  const corridor = data.corridors.find((c) => c.id === $('batchCorridor').value);
  $('batchPreviewName').textContent = corridor ? corridor.name : 'Corredor selecionado';
}
function openBatch() {
  const active = data.batches.find((b) => b.id === data.activeBatchId && b.status === 'aberta');
  if (active) {
    view = 'batches';
    render();
    return;
  }
  $('batchCorridor').innerHTML = data.corridors.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const suggested = suggestedCorridor();
  $('batchCorridor').value = suggested.id;
  updateBatchPreview();
  $('batchDialog').showModal();
}
async function startBatch(event) {
  if (event) event.preventDefault();
  const corridor = data.corridors.find((c) => c.id === $('batchCorridor').value);
  if (!corridor) return;
  const alreadyOpen = data.batches.find((b) => b.status === 'aberta');
  if (alreadyOpen) {
    data.activeBatchId = alreadyOpen.id;
    $('batchDialog').close();
    view = 'batches';
    render();
    return;
  }
  const batch = { id: uid(), corridorId: corridor.id, corridorName: corridor.name, date: today(), startedAt: new Date().toISOString(), status: 'aberta', finishedAt: null, syncPending: true };
  data.batches.push(batch);
  data.activeBatchId = batch.id;
  await save();
  window.VPASupabase?.syncBatches?.([batch], data.corridors).then((result) => { if (result?.synced) { batch.syncPending = false; return save(); } }).catch((error) => console.warn('[VPA] Sincronização automática da batida falhou:', error.message || error));
  $('batchDialog').close();
  view = 'batches';
  render();
}
async function askConfirm(title, message) {
  return new Promise((resolve) => {
    const dialog = $('confirmDialog');
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = message;
    const yes = $('confirmYes');
    const no = $('confirmNo');
    const cancel = $('confirmCancel');
    const finish = (value) => { dialog.close(); yes.onclick = null; no.onclick = null; cancel.onclick = null; resolve(value); };
    yes.onclick = () => finish(true);
    no.onclick = () => finish(false);
    cancel.onclick = () => finish(false);
    dialog.showModal();
  });
}
async function cancelOpenBatch() {
  const batch = activeBatch();
  if (!batch) return;
  if (!(await askConfirm('Cancelar esta batida?', 'Os produtos registrados nela serão removidos e o corredor não será marcado como conferido.'))) return;
  try {
    if (window.VPASupabase?.deleteTemporaryBatchItemsByBatch) {
      await window.VPASupabase.deleteTemporaryBatchItemsByBatch(batch.id);
    }
  } catch (error) {
    showTeamToast('Não foi possível cancelar os itens temporários no banco. A batida não foi cancelada.', 'warning');
    console.warn('[VPA] Falha ao excluir itens temporários:', error);
    return;
  }
  data.products = data.products.filter((p) => p.batchId !== batch.id);
  batch.status = 'cancelada';
  batch.finishedAt = new Date().toISOString();
  data.activeBatchId = null;
  await save();
  window.VPASupabase?.syncBatches?.([batch], data.corridors).then((result) => { if (result?.synced) { batch.syncPending = false; return save(); } }).catch((error) => console.warn('[VPA] Sincronização automática da batida falhou:', error.message || error));
  render();
}
async function finishBatch() {
  const batch = data.batches.find((b) => b.id === data.activeBatchId && b.status === 'aberta');
  if (!batch) return;
  const batchProducts = data.products.filter((p) => String(p.batchId || '') === String(batch.id));
  const count = batchProducts.length;
  if (!count) { alert('Cadastre pelo menos um produto antes de finalizar a batida.'); return; }

  batch.productCount = count;
  batch.finishedAt = new Date().toISOString();

  if (window.VPASupabase?.isConfigured?.() && window.VPASupabase?.finalizeBatch) {
    try {
      const result = await window.VPASupabase.finalizeBatch(batch.id);
      batch.productCount = Number(result?.product_count ?? count);
      batchProducts.forEach((product) => {
        product.isTemporaryBatchItem = false;
        product.syncPending = false;
      });
    } catch (error) {
      showTeamToast('⚠️ A batida não foi finalizada: os itens temporários não foram publicados.', 'warning');
      console.error('[VPA] Falha na finalização transacional da batida:', error);
      return;
    }
  } else {
    batchProducts.forEach((product) => {
      product.isTemporaryBatchItem = false;
      product.syncPending = true;
    });
  }

  batch.status = 'finalizada';
  const c = data.corridors.find((x) => x.id === batch.corridorId);
  if (c) c.lastCheck = today();
  data.activeBatchId = null;
  batch.syncPending = !window.VPASupabase?.isConfigured?.();
  await save();

  if (!window.VPASupabase?.isConfigured?.()) {
    window.VPASupabase?.syncBatches?.([batch], data.corridors).then((result) => {
      if (result?.synced) { batch.syncPending = false; return save(); }
    }).catch((error) => console.warn('[VPA] Sincronização automática da batida falhou:', error.message || error));
  }
  render();
}
async function lookupEAN(ean) {
  const code = String(ean || '').replace(/\D/g, '');
  if (!code) return;
  $('lookupMessage').textContent = 'Consultando produto na internet…';
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`, { headers: { Accept: 'application/json' } });
    const result = await response.json();
    const product = result.status === 1 ? result.product : null;
    if (!product) { $('lookupMessage').textContent = 'Produto não encontrado na base online. Preencha manualmente.'; return; }
    if (!$('name').value.trim()) $('name').value = product.product_name_pt || product.product_name || product.generic_name_pt || product.generic_name || '';
    const image = product.image_front_url || product.image_url || '';
    if (image && !$('photoData').value) { $('photoData').value = image; $('photoPreview').innerHTML = `<img src="${esc(image)}" alt="Prévia do produto">`; }
    $('lookupMessage').textContent = 'Dados encontrados na Open Food Facts.';
  } catch { $('lookupMessage').textContent = 'Não foi possível consultar a internet. Você pode continuar manualmente.'; }
}
let scanStream = null;
async function startScanner() {
  const dialog = $('scannerDialog');
  $('scanMessage').textContent = '';
  dialog.showModal();
  const video = $('scannerVideo');
  try {
    if (!('BarcodeDetector' in window)) throw new Error('Seu navegador não disponibiliza leitor automático.');
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = scanStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
    const scan = async () => {
      if (!dialog.open) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length && codes[0].rawValue) {
          $('ean').value = codes[0].rawValue;
          await lookupEAN(codes[0].rawValue);
          closeScanner();
          return;
        }
      } catch {}
      requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  } catch (error) {
    $('scanMessage').textContent = error.message || 'Não foi possível abrir a câmera. Confira a permissão e use HTTPS/GitHub Pages.';
  }
}
function closeScanner() {
  if (scanStream) scanStream.getTracks().forEach((track) => track.stop());
  scanStream = null;
  $('scannerVideo').srcObject = null;
  if ($('scannerDialog').open) $('scannerDialog').close();
}
function openPhoto(productId) {
  const product = data.products.find((p) => p.id === productId);
  if (!product?.photo) { alert('Este produto ainda não possui foto.'); return; }
  $('fullPhoto').src = product.photo;
  $('fullPhoto').alt = product.name || 'Foto do produto';
  $('photoDialog').showModal();
}

function doBackup() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'backup-vencimento-pa-' + today() + '.json'; a.click(); URL.revokeObjectURL(a.href); }
function restoreBackup() { $('restoreInput').click(); }
function showCorridors() {
  const dialog = $('corridorsDialog');
  $('corridorsList').innerHTML = data.corridors.slice().sort((a,b) => a.number-b.number).map((c) => `<div class="corridor-view-row"><div><strong>${c.number}. ${esc(c.name || 'Sem identificação')}</strong><small>${c.lastCheck ? 'Última: ' + fmt(c.lastCheck) : 'Nunca conferido'}</small></div></div>`).join('');
  dialog.showModal();
}
function openCorridorManager() {
  $('corridorEditList').innerHTML = data.corridors.slice().sort((a,b) => a.number-b.number).map((c) => `<div class="corridor-edit-row"><strong>Corredor ${c.number}</strong><label>Nome do corredor<input data-corridor-name="${c.id}" value="${esc(c.name || '')}" maxlength="80"></label></div>`).join('');
  $('corridorManagerDialog').showModal();
}
function currentProductSelection() {
  return Array.from(selectedProducts).filter((id) => data.products.some((p) => p.id === id));
}
function visibleProductIdsForCurrentFilter() {
  const filter = productFilter;
  return visibleProducts().filter((p) => filter === 'fefo' ? p.fefo : filter === 'promotor' ? p.promotor : true).map((p) => p.id);
}
function openBulkStatusDialog() {
  const ids = currentProductSelection();
  if (!ids.length) { alert('Selecione pelo menos um produto.'); return; }
  $('bulkActionType').value = 'status';
  $('bulkStatusWrap').hidden = false;
  $('bulkTagWrap').hidden = true;
  $('bulkDialog').showModal();
}
async function quickAddTag() {
  const ids = currentProductSelection();
  if (!ids.length) { alert('Selecione pelo menos um produto.'); return; }
  for (const p of data.products) {
    if (!ids.includes(p.id)) continue;
    p.tag = 'PLU/ETIQUETA';
    if (p.externalPromotor && p.sourceId && window.VPASupabase?.updatePromotorProductTag) {
      try { await window.VPASupabase.updatePromotorProductTag(p.sourceId, p.tag); } catch (error) { console.warn('[VPA] Tag do Promotor não foi salva:', error); }
    }
  }
  await save();
  selectedProducts.clear();
  render();
}
async function deleteSelectedProducts() {
  const ids = currentProductSelection();
  if (!ids.length) { alert('Selecione pelo menos um produto.'); return; }
  if (!(await askConfirm('Excluir produtos?', `Serão excluídos ${ids.length} produto(s) selecionado(s) de todos os dispositivos conectados. Essa ação não pode ser desfeita.`))) return;
  const status = $('syncProductsStatus');
  try {
    if (window.VPASupabase?.isConfigured?.()) {
      if (status) status.textContent = 'Removendo produtos do banco compartilhado...';
      const selected = data.products.filter((p) => ids.includes(p.id));
      for (const p of selected) {
        if (p.externalPromotor && p.sourceId && window.VPASupabase.deletePromotorProduct) await window.VPASupabase.deletePromotorProduct(p.sourceId);
        else if (!p.externalPromotor && window.VPASupabase.deleteProducts) await window.VPASupabase.deleteProducts([p.id]);
      }
    }
    data.products = data.products.filter((p) => !ids.includes(p.id));
    selectedProducts.clear();
    await save();
    render();
    showTeamToast('✅ Produto(s) removido(s) do banco compartilhado e deste dispositivo.', 'success');
  } catch (error) {
    console.error('[VPA] Falha ao excluir produtos compartilhados:', error);
    showTeamToast('❌ Não foi possível excluir no banco compartilhado: ' + (error.message || 'erro desconhecido'), 'error');
    if (status) status.textContent = 'Falha ao excluir no Supabase: ' + (error.message || 'erro desconhecido');
  }
}
async function applyBulkStatus() {
  const ids = currentProductSelection();
  const action = $('bulkActionType').value;
  if (!ids.length) { $('bulkDialog').close(); alert('Selecione pelo menos um produto.'); return; }
  if (action === 'status') {
    const status = $('bulkStatusValue').value;
    data.products.forEach((p) => { if (ids.includes(p.id)) p.status = status; });
  } else {
    const tag = $('bulkTagValue').value.trim();
    data.products.forEach((p) => { if (ids.includes(p.id)) p.tag = tag; });
  }
  await save();
  selectedProducts.clear();
  $('bulkDialog').close();
  render();
}

let fefoOcrItems = [];
function openFefoScanner() {
  $('fefoImageInput').value = ''; $('fefoOcrStatus').textContent = '';
  fefoOcrItems = []; $('fefoOcrResults').innerHTML = '<div class="empty">Nenhuma lista processada.</div>'; $('importFefoItems').disabled = true;
  $('fefoScannerDialog').showModal();
}
function parseFefoOcr(text) {
  const dateRe = /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/;
  return text.split(/\r?\n/).map((raw) => raw.replace(/\s+/g,' ').trim()).filter(Boolean).map((line) => {
    const dm = line.match(dateRe); if (!dm) return null;
    let y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
    const year = Number(y);
    if (year < 2020 || year > 2100) return null;
    const expiry = `${y}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`;
    const beforeDate = line.slice(0, dm.index).trim();
    // Nesta etapa ignoramos PLU, número da loja e quantidade. Removemos apenas
    // códigos numéricos no início da linha para preservar números da descrição.
    const name = beforeDate
      .replace(/^(?:[A-ZÀ-Ú]*\s*)?(?:\d{1,10}\s*[|;:-]?\s*)+/i, '')
      .replace(/^[-|;:\s]+|[-|;:\s]+$/g,'')
      .trim() || 'Produto para conferir';
    return { name, expiry, quantity: 1, raw: line };
  }).filter(Boolean);
}
function renderFefoOcrItems() {
  $('fefoOcrResults').innerHTML = fefoOcrItems.length ? `<div class="fefo-ocr-note">Confira e corrija somente a descrição e a data de validade. Nenhum item será cadastrado até sua confirmação.</div>${fefoOcrItems.map((it,i)=>`<div class="fefo-ocr-row"><label>Descrição<input data-fefo-field="name" data-fefo-index="${i}" value="${esc(it.name)}" placeholder="Descrição do produto"></label><label>Validade<input type="date" data-fefo-field="expiry" data-fefo-index="${i}" value="${esc(it.expiry)}"></label></div>`).join('')}` : '<div class="empty">Nenhuma linha com data de vencimento foi identificada.</div>';
  $('importFefoItems').disabled = !fefoOcrItems.length;
  document.querySelectorAll('[data-fefo-field]').forEach((el) => el.addEventListener('input', () => { const i=Number(el.dataset.fefoIndex); fefoOcrItems[i][el.dataset.fefoField] = el.value; }));
}
async function runFefoOcr() {
  const file = $('fefoImageInput').files[0]; if (!file) { $('fefoOcrStatus').textContent = 'Escolha uma foto primeiro.'; return; }
  if (!window.Tesseract) { $('fefoOcrStatus').textContent = 'Leitor OCR não carregado. Verifique a internet e tente novamente.'; return; }
  $('runFefoOcr').disabled = true; $('importFefoItems').disabled = true; $('fefoOcrStatus').textContent = 'Lendo lista... isso pode levar alguns segundos.';
  try { const result = await Tesseract.recognize(file, 'por+eng', { logger: m => { if (m.status === 'recognizing text') $('fefoOcrStatus').textContent = `Lendo lista: ${Math.round((m.progress||0)*100)}%`; } }); fefoOcrItems = parseFefoOcr(result.data.text); renderFefoOcrItems(); $('fefoOcrStatus').textContent = `${fefoOcrItems.length} linha(s) identificada(s).`; } catch (err) { console.error(err); $('fefoOcrStatus').textContent = 'Não foi possível ler a imagem. Tente uma foto mais nítida.'; } finally { $('runFefoOcr').disabled = false; }
}
async function importFefoItems() {
  if (!fefoOcrItems.length) { alert('Leia uma lista e confira pelo menos um item antes de confirmar.'); return; }
  const corridorId = data.corridors[0]?.id || '';
  const imported = fefoOcrItems.filter(it => it.name && it.expiry).map((it) => ({ id: uid(), name: it.name, ean: '', plu: '', storeNumber: '', corridorId, expiry: it.expiry, quantity: 1, status:'corredor', createdAt:new Date().toISOString(), batchId:null, origemCadastro:'lista-fefo', photo:'', tag:'', fefo:true, promotor:false, syncPending:true }));
  imported.forEach((product) => data.products.push(product));
  await save();
  const corridor = data.corridors.find((c) => c.id === corridorId);
  try {
    const result = await window.VPASupabase?.syncProducts?.(imported.map((p) => ({ ...p, corridorNumber: corridor?.number })));
    if (result && result.failed) showTeamToast(`⚠️ FEFO salvo localmente, mas ${result.failed} item(ns) não foram enviados ao Supabase.`, 'warning');
    else if (result?.synced) { imported.forEach((product) => { product.syncPending = false; }); await save(); showTeamToast(`☁️ ${result.synced} item(ns) FEFO enviado(s) ao banco compartilhado.`, 'success'); }
  } catch (error) {
    console.warn('[VPA] Sincronização automática do FEFO falhou:', error.message || error);
    showTeamToast('⚠️ FEFO salvo localmente, mas não foi enviado ao banco compartilhado.', 'warning');
  }
  $('fefoScannerDialog').close(); $('productDialog').close(); render();
}

let excelFefoItems = [];
function openExcelFefoImport() {
  excelFefoItems = [];
  $('excelFefoInput').value = '';
  $('excelFefoStatus').textContent = '';
  $('excelFefoResults').innerHTML = '<div class="empty">Selecione uma planilha para visualizar os produtos.</div>';
  $('confirmExcelFefo').disabled = true;
  $('excelFefoDialog').showModal();
}
function normalizeExcelDate(value) {
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0,10);
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) { let y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
  if (/^\d+(\.\d+)?$/.test(raw) && window.XLSX?.SSF) {
    const parsed = XLSX.SSF.parse_date_code(Number(raw));
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
  }
  return raw;
}
function renderExcelFefoItems() {
  const valid = excelFefoItems.filter(x => x.selected);
  $('excelFefoResults').innerHTML = excelFefoItems.length
    ? `<div class="fefo-ocr-note">${excelFefoItems.length} produto(s) encontrado(s). Confira os dados e desmarque o que não deseja importar.</div>
      <div class="excel-import-table"><div class="excel-import-head"><span>Importar</span><span>PLU</span><span>Produto</span><span>Estoque</span><span>Vencimento</span></div>
      ${excelFefoItems.map((it,i)=>`<label class="excel-import-row"><input type="checkbox" data-excel-index="${i}" ${it.selected?'checked':''}><span>${esc(it.plu)}</span><span>${esc(it.name)}</span><span>${esc(it.quantity)}</span><span>${esc(it.expiry)}</span></label>`).join('')}</div>`
    : '<div class="empty">Nenhum produto válido foi encontrado na planilha.</div>';
  $('confirmExcelFefo').disabled = !valid.length;
  document.querySelectorAll('[data-excel-index]').forEach(el => el.addEventListener('change', () => {
    excelFefoItems[Number(el.dataset.excelIndex)].selected = el.checked;
    $('confirmExcelFefo').disabled = !excelFefoItems.some(x => x.selected);
  }));
}
async function readExcelFefoFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.XLSX) { $('excelFefoStatus').textContent = 'Leitor Excel não carregado. Verifique a internet.'; return; }
  $('excelFefoStatus').textContent = 'Lendo planilha...';
  $('confirmExcelFefo').disabled = true;
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type:'array', cellDates:true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval:'', raw:true });
    excelFefoItems = rows.map((row, index) => {
      const keys = Object.keys(row);
      const get = (name) => row[keys.find(k => String(k).trim().toUpperCase() === name)] ?? '';
      const name = String(get('DESCRICAO') || get('DESCRIÇÃO') || get('PRODUTO') || '').trim();
      const plu = String(get('PLU') || '').trim();
      const quantity = String(get('ESTOQUE') || get('QUANTIDADE') || '1').trim();
      const expiry = normalizeExcelDate(get('DATA VENCIMENTO') || get('VENCIMENTO') || get('VALIDADE'));
      return { id:uid(), plu, name, quantity, expiry, selected:Boolean(name && expiry), row:index+2 };
    }).filter(x => x.name && x.expiry);
    renderExcelFefoItems();
    $('excelFefoStatus').textContent = `${excelFefoItems.length} produto(s) encontrado(s). Nenhum item foi salvo ainda.`;
  } catch (error) {
    console.error('[VPA] Falha ao ler Excel:', error);
    $('excelFefoStatus').textContent = 'Não foi possível ler a planilha. Confira o formato do arquivo.';
    excelFefoItems = [];
    renderExcelFefoItems();
  }
}
async function confirmExcelFefoImport() {
  const selected = excelFefoItems.filter(x => x.selected && x.name && x.expiry);
  if (!selected.length) { alert('Selecione pelo menos um produto.'); return; }
  const corridorId = data.corridors[0]?.id || '';
  const corridor = data.corridors.find(c => c.id === corridorId);
  const imported = selected.map(it => ({ id:uid(), name:it.name, ean:'', plu:it.plu, storeNumber:'', corridorId, expiry:it.expiry, quantity:Number(it.quantity)||1, status:'corredor', createdAt:new Date().toISOString(), batchId:null, origemCadastro:'planilha-fefo', photo:'', tag:'', fefo:true, promotor:false, syncPending:true }));
  imported.forEach(p => data.products.push(p));
  await save();
  try {
    const result = await window.VPASupabase?.syncProducts?.(imported.map(p => ({...p, corridorNumber:corridor?.number})));
    if (result?.failed) showTeamToast(`⚠️ ${result.failed} item(ns) ficaram salvos localmente e não foram enviados.`, 'warning');
    else if (result?.synced) { imported.forEach(p => p.syncPending=false); await save(); showTeamToast(`☁️ ${result.synced} produto(s) importado(s) para o banco compartilhado.`, 'success'); }
    else showTeamToast('✅ Produtos importados localmente.', 'success');
  } catch (error) {
    console.warn('[VPA] Sincronização da planilha falhou:', error);
    showTeamToast('⚠️ Produtos salvos localmente, mas não enviados ao Supabase.', 'warning');
  }
  $('excelFefoDialog').close();
  render();
}

let rebaixaExcelItems = [];
function openRebaixaImport() {
  rebaixaExcelItems = [];
  $('rebaixaExcelInput').value = '';
  $('rebaixaExcelStatus').textContent = '';
  $('rebaixaExcelResults').innerHTML = '<div class="empty">Selecione uma planilha para visualizar os itens.</div>';
  $('confirmRebaixaExcel').disabled = true;
  $('rebaixaExcelDialog').showModal();
}
function renderRebaixaExcelItems() {
  const selected = rebaixaExcelItems.filter((item) => item.selected);
  $('rebaixaExcelResults').innerHTML = rebaixaExcelItems.length ? `<div class="fefo-ocr-note">${rebaixaExcelItems.length} item(ns) encontrado(s). Confira os dados e desmarque o que não deseja importar.</div><div class="excel-import-table rebaixa-import-table"><div class="excel-import-head"><span>Importar</span><span>Loja</span><span>PLU</span><span>Descrição</span><span>Estoque</span><span>Vencimento</span><span>Valor</span></div>${rebaixaExcelItems.map((item, index) => `<label class="excel-import-row"><input type="checkbox" data-rebaixa-index="${index}" ${item.selected ? 'checked' : ''}><span>${esc(item.loja)}</span><span>${esc(item.plu)}</span><span>${esc(item.name)}</span><span>${esc(item.quantity)}</span><span>${esc(item.expiry)}</span><span>${esc(item.value)}</span></label>`).join('')}</div>` : '<div class="empty">Nenhum item válido foi encontrado na planilha.</div>';
  $('confirmRebaixaExcel').disabled = !selected.length;
  document.querySelectorAll('[data-rebaixa-index]').forEach((el) => el.addEventListener('change', () => { rebaixaExcelItems[Number(el.dataset.rebaixaIndex)].selected = el.checked; $('confirmRebaixaExcel').disabled = !rebaixaExcelItems.some((item) => item.selected); }));
}
async function readRebaixaExcelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!window.XLSX) { $('rebaixaExcelStatus').textContent = 'Leitor Excel não carregado. Verifique a internet.'; return; }
  $('rebaixaExcelStatus').textContent = 'Lendo planilha...';
  $('confirmRebaixaExcel').disabled = true;
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
    rebaixaExcelItems = rows.map((row, index) => {
      const keys = Object.keys(row);
      const get = (...names) => { const key = keys.find((k) => names.includes(String(k).trim().toUpperCase())); return key === undefined ? '' : row[key]; };
      const loja = String(get('LOJA', 'Nº LOJA', 'NUMERO LOJA', 'NÚMERO DA LOJA')).trim();
      const plu = String(get('PLU', 'CÓDIGO', 'CODIGO')).trim();
      const name = String(get('DESCRICAO', 'DESCRIÇÃO', 'PRODUTO', 'NOME')).trim();
      const quantity = String(get('ESTOQUE', 'QUANTIDADE', 'QTD')).trim();
      const expiry = normalizeExcelDate(get('DATA VENCIMENTO', 'VENCIMENTO', 'VALIDADE', 'DATA DE VENCIMENTO'));
      const value = String(get('VALOR', 'PREÇO', 'PRECO', 'VALOR VENDA')).trim();
      return { id: uid(), loja, plu, name, quantity, expiry, value, selected: Boolean(name && expiry), row: index + 2 };
    }).filter((item) => item.name && item.expiry);
    renderRebaixaExcelItems();
    $('rebaixaExcelStatus').textContent = `${rebaixaExcelItems.length} item(ns) encontrado(s). Nenhum item foi salvo ainda.`;
  } catch (error) { console.error('[VPA] Falha ao ler lista de rebaixas:', error); $('rebaixaExcelStatus').textContent = 'Não foi possível ler a planilha. Confira os cabeçalhos e o formato do arquivo.'; rebaixaExcelItems = []; renderRebaixaExcelItems(); }
}
async function confirmRebaixaExcelImport() {
  const selected = rebaixaExcelItems.filter((item) => item.selected && item.name && item.expiry);
  if (!selected.length) { alert('Selecione pelo menos um item.'); return; }
  const imported = selected.map((item) => ({ id: uid(), loja: item.loja, plu: item.plu, name: item.name, quantity: item.quantity, expiry: item.expiry, value: item.value, status: 'pending', createdAt: new Date().toISOString() }));
  const existingKeys = new Set(data.rebaixaItems.map((item) => `${item.loja}|${item.plu}|${item.name}|${item.expiry}`));
  const uniqueImported = imported.filter((item) => {
    const key = `${item.loja}|${item.plu}|${item.name}|${item.expiry}`;
    if (existingKeys.has(key)) return false;
    existingKeys.add(key);
    return true;
  });
  if (!uniqueImported.length) {
    showTeamToast('ℹ️ Nenhum item novo para importar. Os itens selecionados já estão na lista.', 'warning');
    return;
  }
  try {
    if (window.VPASupabase?.upsertRebaixaItems && window.VPASupabase.isConfigured()) {
      const savedRows = await window.VPASupabase.upsertRebaixaItems(uniqueImported);
      if (!Array.isArray(savedRows) || savedRows.length !== uniqueImported.length) {
        throw new Error('O Supabase não confirmou todos os itens enviados.');
      }
      await mergeCloudRebaixaItems(false);
      const savedIds = new Set(data.rebaixaItems.map((item) => String(item.id)));
      const missing = uniqueImported.filter((item) => !savedIds.has(String(item.id)));
      if (missing.length) throw new Error(`${missing.length} item(ns) não foram encontrados após a confirmação no Supabase.`);
    } else {
      data.rebaixaItems.push(...uniqueImported);
    }
    data.rebaixaItems.sort((a, b) => String(a.expiry || '9999-12-31').localeCompare(String(b.expiry || '9999-12-31')));
    await save();
    $('rebaixaExcelDialog').close();
    showTeamToast(`✅ ${uniqueImported.length} item(ns) confirmados no banco compartilhado de Rebaixa Automática.`, 'success');
    render();
  } catch (error) {
    console.error('[VPA] Falha ao compartilhar lista de rebaixas:', error);
    showTeamToast('⚠️ Não foi possível compartilhar a lista. Verifique a tabela rebaixa_items no Supabase.', 'warning');
  }
}
function exportRebaixaExcel() {
  if (!data.rebaixaItems.length) return;
  if (!window.XLSX) { alert('Exportador Excel não carregado.'); return; }
  const rows = data.rebaixaItems.slice().sort((a, b) => String(a.expiry || '9999-12-31').localeCompare(String(b.expiry || '9999-12-31'))).map((item) => ({ Loja: item.loja, PLU: item.plu, Descrição: item.name, Estoque: item.quantity, 'Data de Vencimento': item.expiry, Valor: item.value }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Rebaixas');
  XLSX.writeFile(workbook, `rebaixas-${today()}.xlsx`);
}
async function markRebaixaDone(id) {
  const item = data.rebaixaItems.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  try {
    if (window.VPASupabase?.completeRebaixaItem && window.VPASupabase.isConfigured()) {
      await window.VPASupabase.completeRebaixaItem(id);
      await mergeCloudRebaixaItems(false);
    } else {
      data.rebaixaItems = data.rebaixaItems.filter((entry) => String(entry.id) !== String(id));
    }
    await save();
    if (!data.rebaixaItems.length) {
      rebaixaCompletionNoticeShown = true;
      showTeamToast('📣 Rebaixa Automática Concluída.', 'success');
    }
    render();
  } catch (error) {
    console.error('[VPA] Falha ao concluir rebaixa:', error);
    showTeamToast('⚠️ Não foi possível atualizar a rebaixa compartilhada.', 'warning');
  }
}

let piquePhotoData = '';
let piqueProductId = null;
function openPiqueDialog(productId) {
  const p = data.products.find((x) => x.id === productId);
  if (!p) return;
  piqueProductId = productId;
  piquePhotoData = '';
  $('piquePhotoInput').value = '';
  $('piquePhotoPreview').innerHTML = '<span>Foto obrigatória para confirmar a retirada.</span>';
  $('confirmPiqueBtn').disabled = true;
  $('piqueProductReference').innerHTML = `<div class="pique-reference">${productImage(p)}<div><strong>${esc(p.name)}</strong><div class="meta">EAN: ${esc(p.ean || 'Não informado')}</div><div class="meta">${p.tag ? 'Tag PLU: ' + esc(p.tag) : 'Sem tag PLU'} · Validade: ${fmt(p.expiry)}</div></div></div>`;
  $('piqueDialog').showModal();
}
function bindPiquePhoto(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    piquePhotoData = reader.result;
    $('piquePhotoPreview').innerHTML = `<img src="${esc(piquePhotoData)}" alt="Foto de confirmação da retirada">`;
    $('confirmPiqueBtn').disabled = false;
  };
  reader.readAsDataURL(file);
}
async function confirmPique() {
  const p = data.products.find((x) => x.id === piqueProductId);
  if (!p || !piquePhotoData) return;
  p.piqueConcluido = true;
  p.piquePhoto = piquePhotoData;
  p.piqueAt = new Date().toISOString();
  p.status = 'resolvido';
  p.piqueTipo = p.fefo ? 'pique-fefo' : 'pique';
  if (p.externalPromotor && p.sourceId && window.VPASupabase?.deletePromotorProduct) {
    try {
      await window.VPASupabase.deletePromotorProduct(p.sourceId);
      data.products = data.products.filter((item) => String(item.id) !== String(p.id));
    } catch (error) {
      p.piqueConcluido = false;
      p.status = 'corredor';
      showTeamToast('⚠️ Retirada registrada localmente, mas não foi possível excluir o produto do Promotor PA.', 'warning');
      console.warn('[VPA] Falha ao excluir produto do Promotor PA:', error);
    }
  }
  await save();
  $('piqueDialog').close();
  piqueProductId = null;
  piquePhotoData = '';
  render();
}
async function syncLocalProductsToCloud() {
  const status = $('syncProductsStatus');
  const button = $('syncProductsBtn');
  if (!window.VPASupabase || !window.VPASupabase.isConfigured()) {
    if (status) status.textContent = 'Supabase não configurado nesta versão.';
    return;
  }
  if (!data.products.length) {
    if (status) status.textContent = 'Nenhum produto local para sincronizar.';
    return;
  }
  if (button) button.disabled = true;
  if (status) status.textContent = 'Sincronizando produtos...';
  const productsWithNumbers = data.products.map((product) => {
    const corridor = data.corridors.find((item) => item.id === product.corridorId);
    return { ...product, corridorNumber: corridor?.number };
  });
  try {
    const result = await window.VPASupabase.syncProducts(productsWithNumbers);
    result.errors.forEach((item) => console.warn('[VPA] Falha ao sincronizar produto:', item));
    if (status) status.textContent = `Sincronização concluída: ${result.synced} enviados, ${result.failed} com falha de ${result.total}.`;
  } catch (error) {
    console.error('[VPA] Falha na sincronização:', error);
    if (status) status.textContent = 'Falha na sincronização: ' + (error.message || 'erro desconhecido');
  } finally {
    if (button) button.disabled = false;
  }
}


let autoSyncInProgress = null;

async function autoSyncAllOnLogin(reason = 'login') {
  if (!window.VPASupabase?.isConfigured?.()) return { skipped: true, reason: 'supabase-not-configured' };
  if (autoSyncInProgress) return autoSyncInProgress;
  autoSyncInProgress = (async () => {
    const result = { products: null, batches: null, cloudLoaded: false };
    try {
      console.info('[VPA] Sincronização automática iniciada:', reason);
      // Não reenviar automaticamente registros locais antigos no login.
      // O carregamento seguinte consulta o Supabase como fonte oficial.
      result.products = { total: 0, synced: 0, failed: 0, errors: [] };
      const pendingBatches = data.batches.filter((batch) => batch.syncPending === true);
      if (pendingBatches.length && window.VPASupabase.syncBatches) {
        result.batches = await window.VPASupabase.syncBatches(pendingBatches, data.corridors);
        const successfulBatchIds = new Set(pendingBatches.filter((batch) => !result.batches.errors.some((error) => String(error.id) === String(batch.id))).map((batch) => String(batch.id)));
        data.batches.forEach((batch) => { if (successfulBatchIds.has(String(batch.id))) batch.syncPending = false; });
        await save();
        result.batches.errors?.forEach((item) => console.warn('[VPA] Falha na sincronização automática da batida:', item));
      }
      await mergeCloudProducts();
      await mergeCloudBatidas();
      await mergeCloudTemporaryBatchItems();
      await mergeCloudPromotorProducts(false);
      await mergeCloudRebaixaItems(false);
      result.cloudLoaded = true;
      console.info('[VPA] Sincronização automática concluída:', result);
      return result;
    } catch (error) {
      console.warn('[VPA] Sincronização automática após login falhou:', error.message || error);
      return { ...result, error: error.message || String(error) };
    } finally {
      autoSyncInProgress = null;
    }
  })();
  return autoSyncInProgress;
}

async function syncLocalBatchesToCloud() {
  const status = $('syncBatchesStatus');
  const button = $('syncBatchesBtn');
  if (!window.VPASupabase || !window.VPASupabase.isConfigured()) {
    if (status) status.textContent = 'Supabase não configurado nesta versão.';
    return;
  }
  if (!data.batches.length) {
    if (status) status.textContent = 'Nenhuma batida local para sincronizar.';
    return;
  }
  if (button) button.disabled = true;
  if (status) status.textContent = 'Sincronizando batidas...';
  try {
    const result = await window.VPASupabase.syncBatches(data.batches, data.corridors);
    result.errors.forEach((item) => console.warn('[VPA] Falha ao sincronizar batida:', item));
    if (status) status.textContent = `Sincronização concluída: ${result.synced} enviadas, ${result.failed} com falha de ${result.total}.`;
  } catch (error) {
    console.error('[VPA] Falha na sincronização de batidas:', error);
    if (status) status.textContent = 'Falha na sincronização: ' + (error.message || 'erro desconhecido');
  } finally {
    if (button) button.disabled = false;
  }
}

function applyProfileAvatar(dataUrl) {
  const avatar = $('vpaHeaderAvatar');
  if (!avatar) return;
  if (dataUrl) {
    avatar.innerHTML = `<img src="${esc(dataUrl)}" alt="Foto do perfil">`;
    avatar.classList.add('has-photo');
  } else {
    const profile = window.VPA_PROFILE || {};
    const display = profile.full_name || profile.email || 'Usuário';
    avatar.textContent = display.trim().charAt(0).toUpperCase() || 'U';
    avatar.classList.remove('has-photo');
  }
}
function openProfilePhotoPicker() {
  $('profilePhotoInput')?.click();
}
function bindProfilePhoto() {
  const input = $('profilePhotoInput');
  const avatar = $('vpaHeaderAvatar');
  if (avatar) avatar.onclick = openProfilePhotoPicker;
  if (input && !input.dataset.bound) {
    input.dataset.bound = '1';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > 4 * 1024 * 1024) { showTeamToast('A foto deve ter no máximo 4 MB.', 'warning'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || '');
        try { localStorage.setItem('vpa-profile-avatar', value); } catch (error) { console.warn('[VPA] Não foi possível salvar a foto:', error); }
        applyProfileAvatar(value);
        showTeamToast('✅ Foto do perfil atualizada neste aparelho.', 'success');
      };
      reader.readAsDataURL(file);
    });
  }
  applyProfileAvatar(localStorage.getItem('vpa-profile-avatar') || '');
}
function bind() {
  document.querySelectorAll('[data-open-pique]').forEach((b) => b.addEventListener('click', () => openPiqueDialog(b.dataset.openPique)));
  $('closePiqueDialog')?.addEventListener('click', () => $('piqueDialog').close());
  $('cancelPiqueBtn')?.addEventListener('click', () => $('piqueDialog').close());
  $('piquePhotoInput')?.addEventListener('change', bindPiquePhoto);
  $('confirmPiqueBtn')?.addEventListener('click', confirmPique);
  $('openFefoScanner')?.addEventListener('click', openFefoScanner);
  $('openExcelFefoImport')?.addEventListener('click', openExcelFefoImport);
  $('closeExcelFefo')?.addEventListener('click', () => $('excelFefoDialog').close());
  $('cancelExcelFefo')?.addEventListener('click', () => $('excelFefoDialog').close());
  $('excelFefoInput')?.addEventListener('change', readExcelFefoFile);
  $('confirmExcelFefo')?.addEventListener('click', confirmExcelFefoImport);
  $('openRebaixaImport')?.addEventListener('click', openRebaixaImport);
  $('exportRebaixaExcel')?.addEventListener('click', exportRebaixaExcel);
  $('closeRebaixaExcel')?.addEventListener('click', () => $('rebaixaExcelDialog').close());
  $('cancelRebaixaExcel')?.addEventListener('click', () => $('rebaixaExcelDialog').close());
  $('rebaixaExcelInput')?.addEventListener('change', readRebaixaExcelFile);
  $('confirmRebaixaExcel')?.addEventListener('click', confirmRebaixaExcelImport);
  $('rebaixaSearch')?.addEventListener('input', (event) => { localStorage.setItem('vpa-rebaixa-search', event.target.value); render(); });
  document.querySelectorAll('[data-rebaixa-done]').forEach((button) => button.addEventListener('click', () => markRebaixaDone(button.dataset.rebaixaDone)));
  $('closeFefoScanner')?.addEventListener('click', () => $('fefoScannerDialog').close());
  $('cancelFefoImport')?.addEventListener('click', () => $('fefoScannerDialog').close());
  $('runFefoOcr')?.addEventListener('click', runFefoOcr);
  $('importFefoItems')?.addEventListener('click', importFefoItems);
  // Usa atribuição direta para evitar listeners duplicados após cada render().
  // O problema anterior fazia o menu abrir e fechar imediatamente depois de trocar de painel.
  const navTrigger = $('floatingNavTrigger');
  if (navTrigger) navTrigger.onclick = () => {
    const panel = $('floatingNavPanel');
    const willOpen = !panel?.classList.contains('open');
    panel?.classList.toggle('open', willOpen);
    navTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  };
  bindProfilePhoto();
  $('navProfilePhotoButton')?.addEventListener('click', () => { openProfilePhotoPicker(); });
  $('navLogoutButton')?.addEventListener('click', () => { if (window.VPA_LOGOUT) window.VPA_LOGOUT($('navLogoutButton')); });
  $('closeProductDialog')?.addEventListener('click', () => $('productDialog').close());
  $('scanEan')?.addEventListener('click', startScanner);
  $('lookupEan')?.addEventListener('click', () => lookupEAN($('ean').value));
  $('closeScanner')?.addEventListener('click', closeScanner);
  $('closePhotoDialog')?.addEventListener('click', () => $('photoDialog').close());
  document.querySelectorAll('[data-open-photo]').forEach((b) => b.addEventListener('click', () => openPhoto(b.dataset.openPhoto)));
  $('photoInput')?.addEventListener('change', (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { $('photoData').value = reader.result; $('photoPreview').innerHTML = `<img src="${esc(reader.result)}" alt="Prévia do produto">`; }; reader.readAsDataURL(file); });
  $('themeLight')?.addEventListener('click', () => toggleTheme('light'));
  $('themeDark')?.addEventListener('click', () => toggleTheme('dark'));
  $('checkAppUpdate')?.addEventListener('click', checkForAppUpdate);
  $('enableTeamNotifications')?.addEventListener('click', requestTeamNotifications);
  $('testAndroidNotification')?.addEventListener('click', testAndroidNotification);
  $('reloadTeamBatches')?.addEventListener('click', async () => { await mergeCloudBatidas(false); await mergeCloudTemporaryBatchItems(); showTeamToast('↻ Batidas da equipe atualizadas.', 'success'); });
  $('syncProductsBtn')?.addEventListener('click', syncLocalProductsToCloud);
  $('syncBatchesBtn')?.addEventListener('click', syncLocalBatchesToCloud);
  document.querySelectorAll('[data-quick-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.quickView; render(); }));
  document.querySelectorAll('[data-subnav]').forEach((b) => b.addEventListener('click', () => {
    const filter = b.dataset.subnav;
    if (filter === 'critical' || filter === 'today') filterProducts($('search')?.value || '', filter);
  }));
  document.querySelectorAll('[data-product-filter]').forEach((b) => b.addEventListener('click', () => { productFilter = b.dataset.productFilter; localStorage.setItem('vpa-product-filter', productFilter); render(); }));
  $('promotorCompanyFilter')?.addEventListener('change', (e) => { promotorCompanyFilter = e.target.value; localStorage.setItem('vpa-promotor-company-filter', promotorCompanyFilter); render(); });
  document.querySelectorAll('[data-batch-tab]').forEach((b) => b.addEventListener('click', () => { batchTab = b.dataset.batchTab; localStorage.setItem('vpa-batch-tab', batchTab); render(); }));

  const toggleAllProducts = () => { const ids = visibleProductIdsForCurrentFilter(); const allSelected = ids.length > 0 && ids.every((id) => selectedProducts.has(id)); ids.forEach((id) => allSelected ? selectedProducts.delete(id) : selectedProducts.add(id)); render(); };
  const bindBulkAction = (id, action) => { $(id)?.addEventListener('click', action); };
  bindBulkAction('selectAllProducts', toggleAllProducts);
  bindBulkAction('bulkStatusBtn', openBulkStatusDialog);
  bindBulkAction('quickTagBtn', quickAddTag);
  bindBulkAction('deleteSelectedBtn', deleteSelectedProducts);
  bindBulkAction('floatingSelectAll', toggleAllProducts);
  bindBulkAction('floatingBulkStatus', openBulkStatusDialog);
  bindBulkAction('floatingQuickTag', quickAddTag);
  bindBulkAction('floatingDeleteSelected', deleteSelectedProducts);
  const bulkFab = $('bulkFab');
  const bulkActionsMenu = $('bulkActionsMenu');
  if (bulkFab && bulkActionsMenu) {
    bulkFab.addEventListener('click', () => {
      const willOpen = bulkActionsMenu.hidden;
      bulkActionsMenu.hidden = !willOpen;
      bulkFab.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  }
  $('closeBulkDialog')?.addEventListener('click', () => $('bulkDialog').close());
  $('cancelBulkDialog')?.addEventListener('click', () => $('bulkDialog').close());
  $('bulkActionType')?.addEventListener('change', () => { const isTag = $('bulkActionType').value === 'tag'; $('bulkStatusWrap').hidden = isTag; $('bulkTagWrap').hidden = !isTag; });
  $('bulkForm')?.addEventListener('submit', async (e) => { e.preventDefault(); await applyBulkStatus(); });
  $('newBatch')?.addEventListener('click', openBatch);
  $('continueBatch')?.addEventListener('click', () => { view = 'batches'; render(); });
  $('backupShortcut')?.addEventListener('click', doBackup);
  $('backupBtn')?.addEventListener('click', doBackup);
  $('restoreBtn')?.addEventListener('click', restoreBackup);
  $('corridorsBtn')?.addEventListener('click', showCorridors);
  $('manageCorridorsBtn')?.addEventListener('click', openCorridorManager);
  $('closeCorridorsDialog')?.addEventListener('click', () => $('corridorsDialog').close());
  $('closeCorridorsDialogBottom')?.addEventListener('click', () => $('corridorsDialog').close());
  $('closeCorridorManagerDialog')?.addEventListener('click', () => $('corridorManagerDialog').close());
  $('cancelCorridorManager')?.addEventListener('click', () => $('corridorManagerDialog').close());
  $('corridorManagerForm')?.addEventListener('submit', async (e) => { e.preventDefault(); data.corridors.forEach((c) => { const name = document.querySelector(`[data-corridor-name="${c.id}"]`); if (name) c.name = name.value.trim() || `Corredor ${c.number}`; }); await save(); $('corridorManagerDialog').close(); render(); });
  $('allCorridors')?.addEventListener('click', showCorridors);
  $('reportsShortcut')?.addEventListener('click', () => { view = 'reports'; render(); });
  $('reportsBtn')?.addEventListener('click', () => { view = 'reports'; render(); });
  $('reportsBack')?.addEventListener('click', () => { view = 'dashboard'; render(); });
  $('addBatchProduct')?.addEventListener('click', () => openProduct(null, false));
  $('finishBatch')?.addEventListener('click', finishBatch);
  $('cancelOpenBatch')?.addEventListener('click', cancelOpenBatch);
  $('batchForm')?.addEventListener('submit', startBatch);
  $('batchCorridor')?.addEventListener('change', updateBatchPreview);
  $('closeBatchDialog')?.addEventListener('click', () => $('batchDialog').close());
  $('cancelBatch')?.addEventListener('click', () => $('batchDialog').close());
  $('search')?.addEventListener('input', (e) => { localStorage.setItem('vpa-product-search', e.target.value); refreshProductsSearchResults(); });
  document.querySelectorAll('.filter').forEach((b) => b.onclick = () => filterProducts($('search')?.value || '', b.dataset.filter));
  document.querySelectorAll('[data-edit-product]').forEach((b) => b.onclick = () => openProduct(b.dataset.editProduct));
  document.querySelectorAll('[data-status]').forEach((b) => b.onclick = async () => { const p = data.products.find((x) => x.id === b.dataset.productId); if (p) { p.status = b.dataset.status; await save(); render(); } });
  document.querySelectorAll('[data-expiry-filter]').forEach((b) => b.onclick = () => { expiryFilter = b.dataset.expiryFilter; localStorage.setItem('vpa-expiry-filter', expiryFilter); render(); });
  document.querySelectorAll('[data-pending-filter]').forEach((b) => b.onclick = () => { pendingFilter = b.dataset.pendingFilter; localStorage.setItem('vpa-pending-filter', pendingFilter); selectedProducts.clear(); render(); });
  document.querySelectorAll('[data-select-product]').forEach((b) => b.onchange = () => { if (b.checked) selectedProducts.add(b.dataset.selectProduct); else selectedProducts.delete(b.dataset.selectProduct); });
}
function refreshProductsSearchResults() {
  const listEl = $('productList');
  if (!listEl) return;
  const searchValue = localStorage.getItem('vpa-product-search') || '';
  const q = searchValue.trim().toLowerCase();
  const allVisible = visibleProducts();
  let list = allVisible.filter((p) => productFilter === 'fefo' ? Boolean(p.fefo) : productFilter === 'promotor' ? Boolean(p.promotor) : !p.fefo && !p.promotor);
  if (productFilter === 'promotor' && promotorCompanyFilter !== 'all') {
    list = list.filter((p) => String(p.company || '') === promotorCompanyFilter);
  }
  if (q) {
    list = list.filter((p) => `${p.name || ''} ${p.ean || ''} ${p.company || ''}`.toLowerCase().includes(q));
  }
  listEl.innerHTML = groupedProductRows(list, {selectable: true}) || '<div class="empty">Nenhum produto cadastrado nesta categoria.</div>';
  const count = document.querySelector('.product-count');
  if (count) count.textContent = `${list.length} produto${list.length === 1 ? '' : 's'}`;
  document.querySelectorAll('[data-select-product]').forEach((b) => {
    b.onchange = () => {
      if (b.checked) selectedProducts.add(b.dataset.selectProduct);
      else selectedProducts.delete(b.dataset.selectProduct);
    };
  });
}
function filterProducts(query, filter) {
  const q = (query || '').toLowerCase();
  let list = visibleProducts().filter((p) => (p.name + ' ' + (p.ean || '')).toLowerCase().includes(q));
  if (filter === 'critical') list = list.filter((p) => daysTo(p.expiry) <= 7);
  if (filter === 'today') list = list.filter((p) => daysTo(p.expiry) === 0);
  $('productList').innerHTML = list.sort((a, b) => a.expiry.localeCompare(b.expiry)).map((p) => productRow(p)).join('') || '<div class="empty">Nenhum resultado.</div>';
  document.querySelectorAll('[data-edit-product]').forEach((b) => b.onclick = () => openProduct(b.dataset.editProduct));
}
$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('productId').value || uid();
  const existing = data.products.find((p) => p.id === id);
  const formBatchId = $('productBatchId')?.value || '';
  const batch = formBatchId
    ? data.batches.find((b) => String(b.id) === String(formBatchId) && b.status === 'aberta')
    : (!existing ? activeBatch() : null);
  const isNew = !existing;
  const isBatchProduct = Boolean(batch && batch.status === 'aberta' && (isNew || existing?.isTemporaryBatchItem || String(existing?.batchId || '') === String(batch.id)));
  const product = {
    id,
    name: $('name').value.trim(),
    ean: $('ean').value.trim(),
    corridorId: isNew && batch ? batch.corridorId : $('corridor').value,
    expiry: $('expiry').value,
    quantity: Number($('quantity').value),
    status: $('status').value,
    createdAt: existing?.createdAt || new Date().toISOString(),
    batchId: existing?.batchId ?? (isBatchProduct ? batch.id : null),
    origemCadastro: existing?.origemCadastro || (isBatchProduct ? 'batida' : 'manual'),
    categoriaCadastro: document.querySelector('input[name=productType]:checked')?.value || 'general',
    photo: $('photoData').value || existing?.photo || '',
    tag: existing?.tag || '',
    // Regra definitiva: qualquer produto salvo dentro de uma batida aberta
    // vai exclusivamente para a tabela temporária, nunca para products.
    isTemporaryBatchItem: isBatchProduct,
    // Cada opção envia o produto somente para sua lista correspondente.
    fefo: document.querySelector('input[name=productType]:checked')?.value === 'fefo',
    promotor: document.querySelector('input[name=productType]:checked')?.value === 'promotor',
    syncPending: true
  };
  if (existing) Object.assign(existing, product); else data.products.push(product);
  await save();
  const corridor = data.corridors.find((c) => c.id === product.corridorId);
  try {
    // Nunca use syncProducts para itens vinculados a uma batida aberta.
    // Se a rotina temporária não estiver disponível, interrompemos o envio
    // em vez de publicar acidentalmente no catálogo geral.
    let result;
    if (product.isTemporaryBatchItem) {
      if (typeof window.VPASupabase?.syncTemporaryBatchItem !== 'function') {
        throw new Error('Rotina de salvamento temporário não disponível.');
      }
      result = await window.VPASupabase.syncTemporaryBatchItem({ ...product, corridorNumber: corridor?.number });
    } else {
      result = await window.VPASupabase?.syncProducts?.([{ ...product, corridorNumber: corridor?.number }]);
    }
    const successful = product.isTemporaryBatchItem
      ? Boolean(result?.id || result?.synced || result?.success)
      : Boolean(result && !result.failed && result.synced === 1);
    if (!successful) {
      const detail = result?.errors?.[0]?.message ? ` Detalhe: ${result.errors[0].message}` : '';
      showTeamToast('⚠️ Produto salvo localmente, mas não foi confirmado no banco compartilhado.' + detail, 'warning');
    } else {
      product.syncPending = false;
      await save();
      console.info('[VPA] Registro confirmado no Supabase:', product.id);
      showTeamToast(product.isTemporaryBatchItem ? '☁️ Produto mantido na preparação da batida.' : '☁️ Produto confirmado no banco compartilhado.', 'success');
    }
  } catch (error) {
    console.error('[VPA] Sincronização automática do produto falhou:', error);
    showTeamToast('⚠️ Produto salvo localmente, mas não foi enviado ao banco compartilhado.', 'warning');
  }
  $('productDialog').close();
  $('corridor').disabled = false;
  render();
});
$('restoreInput').onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { data = JSON.parse(reader.result); seed(); data.corridors.forEach((c) => { if (!c.name) c.name = `Corredor ${c.number}`; }); await save(); render(); alert('Backup restaurado com sucesso.'); } catch { alert('Backup inválido.'); } }; reader.readAsText(file); };
function installHeaderBehavior() {
  const header = document.querySelector('.app-header');
  if (!header || header.dataset.scrollReady === 'true') return;
  header.dataset.scrollReady = 'true';
  let lastY = window.scrollY || 0;
  const updateHeader = () => {
    const y = window.scrollY || 0;
    header.classList.toggle('header-hidden', y > 8);
    if (y > 8) {
      $('floatingNavPanel')?.classList.remove('open');
      $('floatingNavTrigger')?.setAttribute('aria-expanded', 'false');
    }
    lastY = y;
  };
  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();
}
(async () => { applyTheme(); await openDB(); await load(); seed(); await save(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}); render();
  setTimeout(() => {
    bindTeamAuthListener().catch(() => {});
    initTeamRealtime().then(() => {
      window.VPASupabase?.getSession?.().then((session) => autoActivateTeamAfterLogin(session)).catch(() => {});
    }).catch(() => {});
  }, 900);
  setTimeout(() => notifyOverdueCorridors().catch(() => {}), 1600);
})();
