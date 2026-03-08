/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — app.js
   Estado global, navegação e inicialização.
   Carregado por último — depende de api.js e ui.js.
   ═══════════════════════════════════════════════════════════════════════════ */

const state = {
  divisions:   [],
  licenses:    [],
  licFilter:   'all',
  currentItem: null,
  userRole:    null,
  username:    null,
};

/* ─── NAVEGAÇÃO ──────────────────────────────────────────────────────────── */

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
  const handlers = { dashboard: renderDashboard, inventory: async () => { await loadDivisions(); renderInventory(); }, licenses: async () => { await loadLicenses(); renderLicenses(); }, contracts: loadContracts, reports: loadReports, admin: loadUsers, settings: () => syncSettings(), audit: () => { _setAuditDefaultDates(); loadAuditLogs(); } };
  handlers[name]?.();
}

/**
 * Navega para uma página já aplicando um filtro de status.
 * Usado pelos cards clicáveis do dashboard.
 */
function showPageFiltered(page, status) {
  state.licFilter = status;
  showPage(page);
  if (page === 'licenses') {
    document.querySelectorAll('#page-licenses .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === status);
    });
  }
}

/* ─── INICIALIZAÇÃO ──────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  // Usa /api/divisions para verificar autenticação e já pré-carrega o estado,
  // evitando uma segunda requisição separada de loadDivisions().
  const res = await fetch('/api/divisions');
  if (res.status === 401 || res.redirected) { window.location = '/login'; return; }
  state.divisions = await res.json();

  const metaUser = document.querySelector('meta[name="session-user"]');
  const metaRole = document.querySelector('meta[name="session-role"]');
  state.username = metaUser?.content || 'admin';
  state.userRole = metaRole?.content || 'user';

  document.getElementById('user-avatar').textContent = state.username[0].toUpperCase();
  document.getElementById('user-name').textContent   = state.username;
  document.getElementById('user-role').textContent   = state.userRole === 'admin' ? 'Administrador' : 'Usuário';

  if (state.userRole === 'admin') {
    document.getElementById('admin-nav').style.display = 'block';
    const certCard = document.getElementById('cert-card');
    if (certCard) certCard.style.display = 'block';
    const emailCard = document.getElementById('email-card');
    if (emailCard) emailCard.style.display = 'block';
    const dbCard = document.getElementById('db-card');
    if (dbCard) dbCard.style.display = 'block';
    const schedCard = document.getElementById('sched-card');
    if (schedCard) schedCard.style.display = 'block';
  }

  await loadLicenses();
  showPage('dashboard');
});
