/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.audit.js
   Logs de auditoria: filtros por período, entidade e ação; renderização em
   tabela. Depende de: escapeHTML (ui.utils.js).
   ═══════════════════════════════════════════════════════════════════════════ */

let _auditData     = [];
let _auditPage     = 0;
const _AUDIT_PAGE_SIZE = 50;

function _setAuditDefaultDates() {
  const fromEl = document.getElementById('audit-from');
  const toEl   = document.getElementById('audit-to');
  if (fromEl.value && toEl.value) return;
  const today = new Date();
  const from  = new Date(today);
  from.setDate(from.getDate() - 30);
  toEl.value   = today.toISOString().slice(0, 10);
  fromEl.value = from.toISOString().slice(0, 10);
}

function loadAuditLogs() {
  const from   = document.getElementById('audit-from').value;
  const to     = document.getElementById('audit-to').value;
  const entity = document.getElementById('audit-entity').value;
  const action = document.getElementById('audit-action').value;

  const params = new URLSearchParams();
  if (from)   params.set('from',   from);
  if (to)     params.set('to',     to);
  if (entity) params.set('entity', entity);
  if (action) params.set('action', action);

  _auditPage = 0;

  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Carregando...</td></tr>';

  fetch('/api/audit-logs?' + params.toString())
    .then(r => r.json())
    .then(data => { _auditData = data; renderAuditTable(); })
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--red);padding:20px">Erro ao carregar logs.</td></tr>';
    });
}

function _auditGoPage(page) {
  _auditPage = page;
  renderAuditTable();
}

function renderAuditTable() {
  const rows  = _auditData;
  const tbody = document.getElementById('audit-table-body');
  const pag   = document.getElementById('audit-pagination');

  if (!rows.length) {
    if (pag) pag.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">Nenhum registro encontrado para o período selecionado.</td></tr>';
    return;
  }

  const totalPages = Math.ceil(rows.length / _AUDIT_PAGE_SIZE);
  _auditPage = Math.min(_auditPage, Math.max(0, totalPages - 1));
  const pageData = rows.slice(_auditPage * _AUDIT_PAGE_SIZE, (_auditPage + 1) * _AUDIT_PAGE_SIZE);

  if (pag) {
    const hasPrev = _auditPage > 0;
    const hasNext = _auditPage < totalPages - 1;
    pag.innerHTML = totalPages > 1
      ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 0 4px">
           <span style="font-size:12px;color:var(--text3)">${rows.length} registro${rows.length!==1?'s':''}</span>
           <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
             <button class="btn btn-secondary btn-sm" onclick="_auditGoPage(${_auditPage-1})" ${hasPrev?'':'disabled'}>&#8592; Anterior</button>
             <span style="font-size:12px;color:var(--text3)">Página ${_auditPage+1} de ${totalPages}</span>
             <button class="btn btn-secondary btn-sm" onclick="_auditGoPage(${_auditPage+1})" ${hasNext?'':'disabled'}>Próxima &#8594;</button>
           </div>
         </div>`
      : `<div style="font-size:12px;color:var(--text3);padding:8px 0 4px">${rows.length} registro${rows.length!==1?'s':''}</div>`;
  }

  tbody.innerHTML = pageData.map(r => `
    <tr>
      <td style="font-family:var(--font-mono);font-size:12px;white-space:nowrap">${escapeHTML(r.created_at)}</td>
      <td>${escapeHTML(r.username)}</td>
      <td><span class="audit-action audit-action-${escapeHTML(r.action)}">${escapeHTML(r.action_label)}</span></td>
      <td>${escapeHTML(r.entity_label)}</td>
      <td class="td-trunc">${escapeHTML(r.entity_name || '—')}</td>
      <td class="td-trunc" style="color:var(--text2);font-size:12px">${escapeHTML(r.details || '—')}</td>
      <td style="color:var(--text3);font-size:11px;font-family:var(--font-mono)">${escapeHTML(r.ip_address || '—')}</td>
    </tr>
  `).join('');
}
