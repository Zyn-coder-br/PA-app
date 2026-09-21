const DB = 'vpa-local-v4';
const STORE = 'data';
let db;
let data = { corridors: [], products: [], batches: [], activeBatchId: null };
let view = 'dashboard';
const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random());
const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
}
function daysTo(date) {
  return Math.ceil((new Date(date + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 86400000);
}
function badge(date) {
  const d = daysTo(date);
  return `<span class="badge ${d < 0 ? 'danger' : d <= 3 ? 'warn' : ''}">${d < 0 ? 'Vencido' : d === 0 ? 'Vence hoje' : d === 1 ? 'Amanhã' : d + ' dias'}</span>`;
}
function statusLabel(status) {
  return ({ encontrado: 'Encontrado', corredor: 'No corredor', separado: 'Separado', oferta: 'Aguardando oferta', oferta_solicitada: 'Oferta solicitada', resolvido: 'Resolvido' }[status] || status || 'Sem status');
}
function productRow(p, options = {}) {
  const c = data.corridors.find((x) => x.id === p.corridorId);
  const action = options.actions === false ? '' : `<button class="row-action" data-edit-product="${p.id}" aria-label="Editar produto">›</button>`;
  return `<div class="product-row"><div class="product-main"><div class="product-thumb">📦</div><div><div class="product-name">${esc(p.name)}</div><div class="meta">${esc(c?.name || 'Sem corredor')} · ${esc(p.ean || 'EAN não informado')}</div><div class="meta">${statusLabel(p.status)} · Qtd.: ${Number(p.quantity || 0)}</div></div></div><div class="product-side">${badge(p.expiry)}<div class="meta">${fmt(p.expiry)}</div>${action}</div></div>`;
}
function suggestedCorridor() {
  return data.corridors.slice().sort((a, b) => {
    if (!a.lastCheck && !b.lastCheck) return a.number - b.number;
    if (!a.lastCheck) return -1;
    if (!b.lastCheck) return 1;
    return a.lastCheck.localeCompare(b.lastCheck);
  })[0] || { number: 1, name: 'Corredor 1', lastCheck: null };
}
function dashboard() {
  const critical = data.products.filter((p) => daysTo(p.expiry) <= 7 && p.status !== 'resolvido').length;
  const attention = data.products.filter((p) => daysTo(p.expiry) > 7 && daysTo(p.expiry) <= 15 && p.status !== 'resolvido').length;
  const resolved = data.products.filter((p) => p.status === 'resolvido').length;
  const month = today().slice(0, 7);
  const checked = new Set(data.batches.filter((b) => b.date.slice(0, 7) === month && b.status === 'finalizada').map((b) => b.corridorId)).size;
  const progress = Math.min(100, Math.round((checked / 22) * 100));
  const corridor = suggestedCorridor();
  const days = corridor.lastCheck ? Math.max(0, Math.floor((new Date(today()) - new Date(corridor.lastCheck)) / 86400000)) : 'Nunca';
  const upcoming = data.products.slice().sort((a, b) => a.expiry.localeCompare(b.expiry)).slice(0, 4);
  return `<div class="section-head"><div><div class="eyebrow">PAINEL OPERACIONAL</div><h2>Resumo do seu dia</h2></div><button class="text-btn" id="backupShortcut">⇩ Backup</button></div>
  <div class="stats"><div class="stat ok"><div class="stat-icon">▣</div><div class="num">${data.products.length}</div><div class="label">Produtos</div><div class="sub">cadastrados no local</div></div><div class="stat alert"><div class="stat-icon">!</div><div class="num">${critical}</div><div class="label">Críticos</div><div class="sub">vencem em até 7 dias</div></div><div class="stat warning"><div class="stat-icon">◷</div><div class="num">${attention}</div><div class="label">Em atenção</div><div class="sub">vencem em 8–15 dias</div></div><div class="stat blue"><div class="stat-icon">✓</div><div class="num">${resolved}</div><div class="label">Resolvidos</div><div class="sub">status concluído</div></div></div>
  <div class="panel-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">▦ Batida de hoje</div><div class="panel-sub">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div></div><span>📅</span></div><button class="primary big-action" id="newBatch">▶ Iniciar Batida <span>›</span></button><button class="secondary soft-action" id="continueBatch">↻ Continuar última batida <span>›</span></button></section>
  <section class="panel"><div class="panel-head"><div class="panel-title">◎ Progresso do mês</div><span class="panel-sub">${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><div class="progress-row"><span>${checked} de 22 corredores</span><strong>${progress}%</strong></div><div class="mini-grid"><div class="mini"><strong>${checked}</strong><span>Concluídos</span></div><div class="mini warning"><strong>${Math.max(0, 22 - checked)}</strong><span>Pendentes</span></div><div class="mini danger"><strong>${data.corridors.filter((c) => c.lastCheck && Math.floor((new Date(today()) - new Date(c.lastCheck)) / 86400000) > 15).length}</strong><span>Atrasados</span></div></div><div class="goal">🏆 Meta: conferir todos os corredores pelo menos 1 vez a cada 15 dias.</div></section></div>
  <section class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">⌖ Próximo corredor sugerido</div><span class="priority">PRIORIDADE</span><span class="panel-sub">${corridor.lastCheck ? 'Há ' + days + ' dias sem batida' : 'Ainda não conferido'}</span></div><div class="suggested"><div class="suggested-main"><div class="corridor-icon">▥</div><div><strong>${esc(corridor.name)}</strong><small>Prioridade automática pela última conferência</small></div></div><button class="secondary" id="allCorridors">☷ Ver todos</button></div></section>
  <div class="two-panels"><section class="panel"><div class="panel-head"><div class="panel-title">◷ Vencem em breve</div><button class="text-btn" data-view="expiries">Ver todos</button></div><div class="list">${upcoming.map((p) => productRow(p)).join('') || '<div class="empty">Nenhum produto cadastrado.</div>'}</div></section><section class="panel"><div class="panel-head"><div class="panel-title">♧ Atividades da equipe</div><button class="text-btn" id="reportsShortcut">Ver todas</button></div><div class="list"><div class="team-row"><div class="team-person"><div class="team-avatar">R</div><div><div class="product-name">Ramon</div><div class="meta">Pleno 2 · atividade local</div></div></div><strong class="team-count">${data.products.length}</strong></div><div class="team-row"><div class="team-person"><div class="team-avatar blue">L</div><div><div class="product-name">Luan</div><div class="meta">Pleno 1 · sem sincronização</div></div></div><strong class="team-count">—</strong></div><div class="team-row"><div class="team-person"><div class="team-avatar gray">W</div><div><div class="product-name">Wagner</div><div class="meta">Chefe · sem sincronização</div></div></div><strong class="team-count">—</strong></div></div><button class="secondary report-button" id="reportsBtn">▥ Ver relatórios</button></section></div>`;
}
function products() {
  return `<div class="section-head"><h2>Produtos</h2><button class="primary" id="newProduct">+ Adicionar</button></div><input class="search" id="search" placeholder="Buscar por nome, EAN ou marca..."><div class="toolbar"><button class="secondary filter" data-filter="all">Todos</button><button class="secondary filter" data-filter="critical">Críticos</button><button class="secondary filter" data-filter="today">Hoje</button></div><div class="panel"><div class="list" id="productList">${data.products.slice().sort((a, b) => a.expiry.localeCompare(b.expiry)).map((p) => productRow(p)).join('') || '<div class="empty">Nenhum produto cadastrado.</div>'}</div></div>`;
}
function batches() {
  const active = data.batches.find((b) => b.id === data.activeBatchId && b.status === 'aberta');
  return `<div class="section-head"><h2>Batidas</h2><button class="primary" id="newBatch">+ Registrar</button></div>${active ? `<div class="panel"><div class="panel-title">Batida em andamento</div><div class="panel-sub">${esc(active.corridorName)} · iniciada em ${fmt(active.date)}</div><div class="toolbar"><button class="primary" id="addBatchProduct">+ Produto</button><button class="secondary" id="finishBatch">Finalizar batida</button></div><div class="meta">Produtos vinculados: ${data.products.filter((p) => p.batchId === active.id).length}</div></div>` : ''}<div class="panel" style="margin-top:14px"><p class="panel-sub">Histórico de batidas salvo neste dispositivo.</p><div class="list">${data.batches.slice().reverse().map((b) => `<div class="product-row"><div><div class="product-name">${esc(b.corridorName)}</div><div class="meta">${fmt(b.date)} · ${b.status === 'aberta' ? 'Em andamento' : 'Finalizada'} · ${data.products.filter((p) => p.batchId === b.id).length} produtos</div></div><span class="badge ${b.status === 'aberta' ? 'warn' : ''}">${b.status === 'aberta' ? 'Aberta' : 'Concluída'}</span></div>`).join('') || '<div class="empty">Nenhuma batida registrada.</div>'}</div></div>`;
}
function expiries() { return `<div class="section-head"><h2>Vencimentos</h2></div><div class="panel"><div class="list">${data.products.slice().sort((a, b) => a.expiry.localeCompare(b.expiry)).map((p) => productRow(p)).join('') || '<div class="empty">Nenhum vencimento cadastrado.</div>'}</div></div>`; }
function pending() {
  const list = data.products.filter((p) => !['resolvido', 'separado'].includes(p.status));
  return `<div class="section-head"><h2>Pendências</h2></div><div class="panel"><div class="list">${list.map((p) => `${productRow(p)}<div class="pending-actions"><button class="secondary" data-status="separado" data-product-id="${p.id}">Marcar separado</button><button class="primary" data-status="resolvido" data-product-id="${p.id}">Resolver</button></div>`).join('') || '<div class="empty">Nenhuma pendência encontrada.</div>'}</div></div>`;
}
function settings() { return `<div class="section-head"><h2>Ajustes</h2></div><div class="panel"><div class="product-name">Armazenamento local</div><p class="panel-sub">Seus registros ficam neste navegador. Faça backups regularmente.</p><div class="toolbar"><button class="primary" id="backupBtn">⇩ Exportar backup</button><button class="secondary" id="restoreBtn">⇧ Restaurar backup</button></div></div><div class="panel" style="margin-top:14px"><div class="product-name">Estrutura</div><p class="panel-sub">${data.corridors.length} corredores cadastrados · ${data.products.length} produtos · ${data.batches.length} batidas.</p><button class="secondary" id="corridorsBtn">Ver corredores</button></div>`; }

function render() {
  $('view').innerHTML = view === 'dashboard' ? dashboard() : view === 'products' ? products() : view === 'batches' ? batches() : view === 'expiries' ? expiries() : view === 'pending' ? pending() : settings();
  document.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { view = b.dataset.view; document.querySelectorAll('.bottom-nav button').forEach((x) => x.classList.toggle('active', x.dataset.view === view)); render(); });
  bind();
}
function openProduct(productId = null) {
  const p = data.products.find((x) => x.id === productId);
  $('corridor').innerHTML = data.corridors.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('productForm').reset();
  $('productId').value = p?.id || '';
  $('expiry').value = p?.expiry || today();
  $('quantity').value = p?.quantity || 1;
  $('name').value = p?.name || '';
  $('ean').value = p?.ean || '';
  $('corridor').value = p?.corridorId || data.corridors[0]?.id || '';
  $('status').value = p?.status || 'encontrado';
  $('productDialog').showModal();
}
function openBatch() {
  $('batchCorridor').innerHTML = data.corridors.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const suggested = suggestedCorridor();
  $('batchCorridor').value = suggested.id;
  $('batchDialog').showModal();
}
async function startBatch() {
  const corridor = data.corridors.find((c) => c.id === $('batchCorridor').value);
  if (!corridor) return;
  const batch = { id: uid(), corridorId: corridor.id, corridorName: corridor.name, date: today(), status: 'aberta' };
  data.batches.push(batch); data.activeBatchId = batch.id;
  await save(); $('batchDialog').close(); view = 'batches'; render();
}
async function finishBatch() {
  const batch = data.batches.find((b) => b.id === data.activeBatchId && b.status === 'aberta');
  if (!batch) return;
  batch.status = 'finalizada';
  const c = data.corridors.find((x) => x.id === batch.corridorId); if (c) c.lastCheck = today();
  data.activeBatchId = null; await save(); render();
}
function doBackup() { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = 'backup-vencimento-pa-' + today() + '.json'; a.click(); URL.revokeObjectURL(a.href); }
function restoreBackup() { $('restoreInput').click(); }
function showCorridors() { alert(data.corridors.map((c) => `${c.number}. ${c.name} — ${c.lastCheck ? 'Última: ' + fmt(c.lastCheck) : 'Nunca conferido'}`).join('\n')); }
function bind() {
  $('newProduct')?.addEventListener('click', () => openProduct());
  $('newBatch')?.addEventListener('click', openBatch);
  $('continueBatch')?.addEventListener('click', () => { view = 'batches'; render(); });
  $('backupShortcut')?.addEventListener('click', doBackup);
  $('backupBtn')?.addEventListener('click', doBackup);
  $('restoreBtn')?.addEventListener('click', restoreBackup);
  $('corridorsBtn')?.addEventListener('click', showCorridors);
  $('allCorridors')?.addEventListener('click', showCorridors);
  $('reportsShortcut')?.addEventListener('click', () => alert('Relatórios detalhados serão adicionados em uma próxima etapa.'));
  $('reportsBtn')?.addEventListener('click', () => alert('Relatórios detalhados serão adicionados em uma próxima etapa.'));
  $('settingsShortcut')?.addEventListener('click', () => { view = 'settings'; render(); });
  $('addBatchProduct')?.addEventListener('click', () => openProduct());
  $('finishBatch')?.addEventListener('click', finishBatch);
  $('startBatch')?.addEventListener('click', startBatch);
  $('search')?.addEventListener('input', (e) => filterProducts(e.target.value, 'all'));
  document.querySelectorAll('.filter').forEach((b) => b.onclick = () => filterProducts($('search')?.value || '', b.dataset.filter));
  document.querySelectorAll('[data-edit-product]').forEach((b) => b.onclick = () => openProduct(b.dataset.editProduct));
  document.querySelectorAll('[data-status]').forEach((b) => b.onclick = async () => { const p = data.products.find((x) => x.id === b.dataset.productId); if (p) { p.status = b.dataset.status; await save(); render(); } });
}
function filterProducts(query, filter) {
  const q = (query || '').toLowerCase();
  let list = data.products.filter((p) => (p.name + ' ' + (p.ean || '')).toLowerCase().includes(q));
  if (filter === 'critical') list = list.filter((p) => daysTo(p.expiry) <= 7);
  if (filter === 'today') list = list.filter((p) => daysTo(p.expiry) === 0);
  $('productList').innerHTML = list.sort((a, b) => a.expiry.localeCompare(b.expiry)).map((p) => productRow(p)).join('') || '<div class="empty">Nenhum resultado.</div>';
  document.querySelectorAll('[data-edit-product]').forEach((b) => b.onclick = () => openProduct(b.dataset.editProduct));
}
$('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('productId').value || uid();
  const existing = data.products.find((p) => p.id === id);
  const activeBatch = data.batches.find((b) => b.id === data.activeBatchId && b.status === 'aberta');
  const product = { id, name: $('name').value.trim(), ean: $('ean').value.trim(), corridorId: $('corridor').value, expiry: $('expiry').value, quantity: Number($('quantity').value), status: $('status').value, createdAt: existing?.createdAt || new Date().toISOString(), batchId: existing?.batchId || activeBatch?.id || null };
  if (existing) Object.assign(existing, product); else data.products.push(product);
  await save(); $('productDialog').close(); render();
});
$('restoreInput').onchange = (e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { data = JSON.parse(reader.result); seed(); await save(); render(); alert('Backup restaurado com sucesso.'); } catch { alert('Backup inválido.'); } }; reader.readAsText(file); };
(async () => { await openDB(); await load(); seed(); await save(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}); render(); })();
