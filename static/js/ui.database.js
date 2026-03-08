/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.database.js
   Painel de banco de dados nas configurações: exibe caminho e tamanho,
   exportação e importação de arquivo .db. Depende de: showToast (api.js).
   ═══════════════════════════════════════════════════════════════════════════ */

let _dbLoaded = false;

function toggleDatabase() {
  const panel = document.getElementById('db-panel');
  const card  = document.getElementById('db-card');
  if (!panel || !card) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  card.classList.toggle('settings-entry-open', !open);
  const ch = card.querySelector('.db-chevron');
  if (ch) ch.style.transform = open ? '' : 'rotate(180deg)';
  if (!open) {
    const pp = document.getElementById('personalization-panel');
    const pc = document.getElementById('personalization-card');
    if (pp) pp.style.display = 'none';
    if (pc) pc.classList.remove('settings-entry-open');
    const cp = document.getElementById('cert-panel');
    const cc = document.getElementById('cert-card');
    if (cp) cp.style.display = 'none';
    if (cc) {
      cc.classList.remove('settings-entry-open');
      const cch = cc.querySelector('.cert-chevron');
      if (cch) cch.style.transform = '';
    }
    const ep = document.getElementById('email-panel');
    const ec = document.getElementById('email-card');
    if (ep) ep.style.display = 'none';
    if (ec) {
      ec.classList.remove('settings-entry-open');
      const ech = ec.querySelector('.email-chevron');
      if (ech) ech.style.transform = '';
    }
    const sp = document.getElementById('sched-panel');
    const sc = document.getElementById('sched-card');
    if (sp) sp.style.display = 'none';
    if (sc) {
      sc.classList.remove('settings-entry-open');
      const sh = sc.querySelector('.sched-chevron');
      if (sh) sh.style.transform = '';
    }
    if (!_dbLoaded) { loadDbInfo(); _dbLoaded = true; }
    loadEncStatus();
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }
}

function loadDbInfo() {
  fetch('/api/database/info')
    .then(r => r.json())
    .then(d => {
      const pathEl = document.getElementById('db-path');
      const sizeEl = document.getElementById('db-size');
      if (pathEl) pathEl.textContent = d.path || '—';
      if (sizeEl) sizeEl.textContent = d.size_human || '—';
    });
}

function exportDb() {
  window.location = '/api/database/export';
}

let _encConfigured = false;

function loadEncStatus() {
  fetch('/api/database/encryption/status')
    .then(r => r.json())
    .then(r => {
      _encConfigured = r.configured;
      const statusEl    = document.getElementById('db-enc-status');
      const restoreForm = document.getElementById('db-enc-restore-form');
      const setupForm   = document.getElementById('db-enc-setup-form');
      const changeWrap  = document.getElementById('db-enc-change-wrap');
      if (!statusEl) return;
      if (!r.configured) {
        statusEl.textContent = 'Criptografia não configurada.';
        statusEl.style.color = 'var(--text3)';
        if (restoreForm) restoreForm.style.display = 'none';
        setupForm.style.display = 'block';
        if (changeWrap) changeWrap.style.display = 'none';
        document.getElementById('db-enc-old-inp-wrap').style.display = 'none';
      } else if (r.active) {
        statusEl.innerHTML = '<span style="color:var(--green)">&#128274; Criptografia ativa</span>';
        if (restoreForm) restoreForm.style.display = 'none';
        setupForm.style.display = 'none';
        if (changeWrap) changeWrap.style.display = 'block';
      } else {
        statusEl.innerHTML = '<span style="color:var(--yellow)">&#9888; Chave de criptografia ausente</span>';
        if (restoreForm) restoreForm.style.display = 'block';
        setupForm.style.display = 'none';
        if (changeWrap) changeWrap.style.display = 'none';
      }
    });
}

function showEncSetup() {
  const rf = document.getElementById('db-enc-restore-form');
  if (rf) rf.style.display = 'none';
  document.getElementById('db-enc-setup-form').style.display   = 'block';
  document.getElementById('db-enc-old-inp-wrap').style.display = _encConfigured ? 'block' : 'none';
  document.getElementById('db-enc-setup-status').textContent   = '';
  const cw = document.getElementById('db-enc-change-wrap');
  if (cw) cw.style.display = 'none';
}

function setupEncryption() {
  const statusEl = document.getElementById('db-enc-setup-status');
  const body = {
    password:     document.getElementById('db-enc-new-inp').value,
    confirm:      document.getElementById('db-enc-confirm-inp').value,
    old_password: document.getElementById('db-enc-old-inp').value,
  };
  statusEl.textContent = 'Aguarde...';
  statusEl.style.color = 'var(--text3)';
  fetch('/api/database/encryption/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
    .then(r => r.json())
    .then(r => {
      if (r.error) {
        statusEl.textContent = r.error;
        statusEl.style.color = 'var(--red)';
      } else {
        statusEl.textContent = 'Senha salva com sucesso.';
        statusEl.style.color = 'var(--green)';
        document.getElementById('db-enc-old-inp').value     = '';
        document.getElementById('db-enc-new-inp').value     = '';
        document.getElementById('db-enc-confirm-inp').value = '';
        loadEncStatus();
      }
    });
}

function restoreEncKey() {
  const statusEl = document.getElementById('db-enc-restore-status');
  fetch('/api/database/encryption/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: document.getElementById('db-enc-restore-inp').value }),
  })
    .then(r => r.json())
    .then(r => {
      if (r.error) {
        statusEl.textContent = r.error;
        statusEl.style.color = 'var(--red)';
      } else {
        document.getElementById('db-enc-restore-inp').value = '';
        loadEncStatus();
      }
    });
}

function previewPurge() {
  const deletedDays = document.getElementById('db-purge-deleted-days').value;
  const auditDays   = document.getElementById('db-purge-audit-days').value;
  fetch(`/api/database/purge?deleted_days=${deletedDays}&audit_days=${auditDays}`)
    .then(r => r.json())
    .then(r => {
      const total     = r.licenses + r.items + r.lists + r.divisions;
      const previewEl = document.getElementById('db-purge-preview');
      previewEl.style.display = 'block';
      previewEl.innerHTML =
        `Registros exclu\u00eddos h\u00e1 +${r.deleted_days}d: <strong>${total}</strong> ` +
        `(${r.licenses} licen\u00e7as, ${r.items} itens, ${r.lists} listas, ${r.divisions} grupos)<br>` +
        `Auditoria a remover: <strong>${r.audit_log}</strong> (anteriores a ${r.audit_days} dias)`;
      document.getElementById('db-purge-btn').style.display =
        (total + r.audit_log) > 0 ? 'inline-flex' : 'none';
    });
}

function executePurge() {
  const statusEl = document.getElementById('db-purge-status');
  statusEl.textContent = 'Aguarde...';
  statusEl.style.color = 'var(--text3)';
  fetch('/api/database/purge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deleted_days: parseInt(document.getElementById('db-purge-deleted-days').value),
      audit_days:   parseInt(document.getElementById('db-purge-audit-days').value),
    }),
  })
    .then(r => r.json())
    .then(r => {
      if (r.error) {
        statusEl.textContent = r.error;
        statusEl.style.color = 'var(--red)';
      } else {
        statusEl.textContent = 'Limpeza conclu\u00edda.';
        statusEl.style.color = 'var(--green)';
        document.getElementById('db-purge-preview').style.display = 'none';
        document.getElementById('db-purge-btn').style.display = 'none';
        _dbLoaded = false;
        loadDbInfo();
      }
    });
}

function importDb() {
  const input  = document.getElementById('db-import-file');
  const status = document.getElementById('db-import-status');
  if (!input || !input.files || !input.files[0]) {
    status.style.color = 'var(--red, #ef4444)';
    status.textContent = 'Selecione um arquivo .db antes de importar.';
    return;
  }
  status.style.color = 'var(--text3)';
  status.textContent = 'Importando...';
  const form = new FormData();
  form.append('db_file', input.files[0]);
  fetch('/api/database/import', { method: 'POST', body: form })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        status.style.color = 'var(--green, #10b981)';
        status.textContent = d.message || 'Importado com sucesso.';
        _dbLoaded = false;
        loadDbInfo();
      } else {
        status.style.color = 'var(--red, #ef4444)';
        status.textContent = d.error || 'Erro na importação.';
      }
    });
}
