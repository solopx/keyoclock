/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.utils.js
   Utilitários compartilhados: sanitização HTML, modais e confirmações.
   Deve ser carregado ANTES de todos os outros arquivos ui.*.js
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── SANITIZAÇÃO ────────────────────────────────────────────────────────── */

/**
 * Escapa caracteres HTML especiais em valores fornecidos pelo usuário.
 * Deve ser usada em TODOS os dados de usuário interpolados em innerHTML.
 */
function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Alias curto — mantido para compatibilidade com templates de inventário. */
function esc(s) { return escapeHTML(s); }

/* ─── MODAIS ─────────────────────────────────────────────────────────────── */

function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });
});

function confirmAction(msg, fn) {
  document.getElementById('confirm-msg').innerHTML = msg;
  document.getElementById('confirm-btn').onclick = async () => {
    closeModal('modal-confirm');
    await fn();
  };
  openModal('modal-confirm');
}

/**
 * Confirmação de exclusão genérica.
 * Nota: loadUsers, loadDivisions e renderInvTree são definidas em arquivos
 * carregados posteriormente — as chamadas ocorrem apenas em runtime (click),
 * quando todos os scripts já estão disponíveis no escopo global.
 */
function confirmDelete(type, id, msg) {
  const endpoints = {
    division: `/api/divisions/${id}`,
    list:     `/api/lists/${id}`,
    item:     `/api/items/${id}`,
    user:     `/api/users/${id}`,
  };
  confirmAction(msg, async () => {
    await api('DELETE', endpoints[type]);
    if (type === 'user') {
      loadUsers();
    } else {
      await loadDivisions();
      renderInvTree();
    }
  });
}
