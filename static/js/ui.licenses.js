/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.licenses.js
   Licenças: listagem, filtros, detalhe de item e modais de CRUD.
   Dependências (escopo global): escapeHTML, openModal, closeModal
   (ui.utils.js), api (api.js), state (app.js — disponível em runtime).
   Nota: statusLabel() é definida aqui e usada também por ui.reports.js
   (carregado depois — dependência de ordem garantida em app.html).
   ═══════════════════════════════════════════════════════════════════════════ */

let _licPage    = 0;
let _licLastKey = '';
const _LIC_PAGE_SIZE = 50;

async function loadLicenses() {
  state.licenses = await api('GET', '/api/licenses');
}

function renderLicenses() {
  _licPage    = 0;
  _licLastKey = '';
  _renderLicStats();
  filterLicenses();
}

function _licGoPage(page) {
  _licPage = page;
  filterLicenses();
}

function _renderLicStats() {
  const all    = state.licenses;
  const sumQty = fn => all.filter(l => fn(l)).reduce((s,l) => s+(l.quantity||1), 0);
  document.getElementById('lic-stats').innerHTML = `
    <div class="stat-card c-blue" onclick="setLicTab('all', document.querySelector('.tab'))">
      <div class="slabel">Total</div><div class="sval">${sumQty(()=>true)}</div>
      <div class="ssub">${all.length} registro${all.length!==1?'s':''}</div>
    </div>
    <div class="stat-card c-green" onclick="setLicTabByStatus('valid')">
      <div class="slabel">Saudáveis</div><div class="sval">${sumQty(l=>l.status==='valid')}</div>
    </div>
    <div class="stat-card c-cyan" onclick="setLicTabByStatus('perpetual')">
      <div class="slabel">Vitalícias</div><div class="sval">${sumQty(l=>l.status==='perpetual')}</div>
    </div>
    <div class="stat-card c-purple" onclick="setLicTabByStatus('expired')">
      <div class="slabel">Expiradas</div><div class="sval">${sumQty(l=>l.status==='expired')}</div>
    </div>
    <div class="stat-card c-red" onclick="setLicTabByStatus('critical')">
      <div class="slabel">Crítico (≤30d)</div><div class="sval">${sumQty(l=>l.status==='critical')}</div>
    </div>
    <div class="stat-card c-orange" onclick="setLicTabByStatus('warning')">
      <div class="slabel">Aviso (≤60d)</div><div class="sval">${sumQty(l=>l.status==='warning')}</div>
    </div>
    <div class="stat-card c-yellow" onclick="setLicTabByStatus('soon')">
      <div class="slabel">Atenção (≤90d)</div><div class="sval">${sumQty(l=>l.status==='soon')}</div>
    </div>`;
}

function setLicTabByStatus(status) {
  state.licFilter = status;
  document.querySelectorAll('#page-licenses .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === status);
  });
  filterLicenses();
}

function setLicTab(filter, el) {
  document.querySelectorAll('#page-licenses .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  state.licFilter = filter;
  filterLicenses();
}

function filterLicenses() {
  const search = (document.getElementById('lic-search')?.value||'').toLowerCase();
  const filter = state.licFilter||'all';
  const filtered = state.licenses.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (search && !`${l.item_name} ${l.division_name} ${l.list_name} ${l.license_type} ${l.contract||''}`.toLowerCase().includes(search)) return false;
    return true;
  });

  const currentKey = `${filter}|${search}`;
  if (currentKey !== _licLastKey) { _licPage = 0; _licLastKey = currentKey; }

  const tbody = document.getElementById('lic-table-body');
  const pag   = document.getElementById('lic-pagination');

  if (!filtered.length) {
    if (pag) pag.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">Nenhuma licença encontrada</td></tr>';
    return;
  }

  const totalPages = Math.ceil(filtered.length / _LIC_PAGE_SIZE);
  _licPage = Math.min(_licPage, Math.max(0, totalPages - 1));
  const pageData = filtered.slice(_licPage * _LIC_PAGE_SIZE, (_licPage + 1) * _LIC_PAGE_SIZE);

  if (pag) {
    const hasPrev = _licPage > 0;
    const hasNext = _licPage < totalPages - 1;
    pag.innerHTML = totalPages > 1
      ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 0 4px">
           <span style="font-size:12px;color:var(--text3)">${filtered.length} licença${filtered.length!==1?'s':''}</span>
           <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
             <button class="btn btn-secondary btn-sm" onclick="_licGoPage(${_licPage-1})" ${hasPrev?'':'disabled'}>&#8592; Anterior</button>
             <span style="font-size:12px;color:var(--text3)">Página ${_licPage+1} de ${totalPages}</span>
             <button class="btn btn-secondary btn-sm" onclick="_licGoPage(${_licPage+1})" ${hasNext?'':'disabled'}>Próxima &#8594;</button>
           </div>
         </div>`
      : `<div style="font-size:12px;color:var(--text3);padding:8px 0 4px">${filtered.length} licença${filtered.length!==1?'s':''}</div>`;
  }

  tbody.innerHTML = pageData.map(l => `
    <tr>
      <td class="td-trunc"><strong>${escapeHTML(l.item_name)}</strong></td>
      <td class="td-trunc" style="color:var(--text3)">${escapeHTML(l.division_name)} › ${escapeHTML(l.list_name)}</td>
      <td style="text-transform:capitalize">${escapeHTML(l.license_type)}</td>
      <td style="text-align:center"><span class="badge badge-valid">${l.quantity||1}</span></td>
      <td>${l.contract?`<span class="badge badge-contract">${escapeHTML(l.contract)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
      <td style="font-family:monospace;font-size:12px">${escapeHTML(l.start_date||'—')}</td>
      <td style="font-family:monospace;font-size:12px">${escapeHTML(l.end_date||'—')}</td>
      <td><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></td>
      <td style="font-family:monospace">${l.days_remaining!==null?l.days_remaining+'d':'∞'}</td>
    </tr>`).join('');
}

/* ─── DETALHE DO ITEM ────────────────────────────────────────────────────── */

async function openItemDetail(itemId) {
  closeModal('modal-license');
  state.currentItem = itemId;
  const data = await api('GET', `/api/items/${itemId}/licenses`);
  document.getElementById('detail-title').textContent = `🔑 ${data.item.name}`;
  document.getElementById('detail-info').innerHTML =
    `<strong>${escapeHTML(data.item.name)}</strong>` +
    (data.item.model        ? ` · ${escapeHTML(data.item.model)}`        : '') +
    (data.item.manufacturer ? ` · ${escapeHTML(data.item.manufacturer)}` : '') +
    (data.item.supplier     ? ` · ${escapeHTML(data.item.supplier)}`     : '');
  renderItemLicenses(data.licenses);
  openModal('modal-item-detail');
}

function renderItemLicenses(licenses) {
  const tbody = document.getElementById('detail-lic-body');
  if (!licenses.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Nenhuma licença cadastrada</td></tr>';
    return;
  }
  tbody.innerHTML = licenses.map(l => `
    <tr>
      <td style="text-transform:capitalize">${escapeHTML(l.license_type)}</td>
      <td style="text-align:center"><span class="badge badge-valid">${l.quantity||1}</span></td>
      <td>${l.contract?`<span class="badge badge-contract">${escapeHTML(l.contract)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
      <td>${l.is_perpetual?'<span class="badge badge-perpetual">Vitalícia</span>':'—'}</td>
      <td style="font-family:monospace;font-size:11px">${escapeHTML(l.start_date||'—')}</td>
      <td style="font-family:monospace;font-size:11px">${escapeHTML(l.end_date||'—')}</td>
      <td><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></td>
      <td style="font-family:monospace">${l.days_remaining!==null?l.days_remaining+'d':'∞'}</td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="icon-btn" onclick="openLicenseModal(${l.id})">✏</button>
          <button class="icon-btn del" onclick="confirmDeleteLicense(${l.id})">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ─── MODAL DE LICENÇA ───────────────────────────────────────────────────── */

async function openLicenseModal(licId) {
  closeModal('modal-item-detail');
  let lic = null;
  if (licId) {
    const data = await api('GET', `/api/items/${state.currentItem}/licenses`);
    lic = data.licenses.find(l => l.id===licId);
  }
  document.getElementById('lic-modal-title').textContent = lic ? 'Editar Licença' : 'Nova Licença';
  document.getElementById('lic-id').value          = licId||'';
  document.getElementById('lic-item-id').value     = state.currentItem;
  document.getElementById('lic-type').value        = lic?.license_type||'suporte';
  document.getElementById('lic-quantity').value    = lic?.quantity||1;
  document.getElementById('lic-contract').value    = lic?.contract||'';
  document.getElementById('lic-perpetual').checked = lic?.is_perpetual||false;
  document.getElementById('lic-start').value       = lic?.start_date||'';
  document.getElementById('lic-end').value         = lic?.end_date||'';
  document.getElementById('lic-notes').value       = lic?.notes||'';
  togglePerpetual();
  openModal('modal-license');
}

function togglePerpetual() {
  const p = document.getElementById('lic-perpetual').checked;
  document.getElementById('field-end').style.opacity = p ? '0.4' : '1';
  document.getElementById('lic-end').disabled = p;
}

function shake(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.classList.add('field-error');
  el.focus();
  setTimeout(() => el.classList.remove('field-error'), 400);
}

async function saveLicense() {
  const id          = document.getElementById('lic-id').value;
  const isPerpetual = document.getElementById('lic-perpetual').checked;
  const startDate   = document.getElementById('lic-start').value.trim();
  const endDate     = document.getElementById('lic-end').value.trim();

  // Regra: vitalícia OU (data início + data fim) são obrigatórios
  if (!isPerpetual) {
    let err = false;
    if (!startDate) { shake('lic-start'); err = true; }
    if (!endDate)   { shake('lic-end');   err = true; }
    if (err) return;
  }

  const body = {
    item_id:      parseInt(document.getElementById('lic-item-id').value),
    license_type: document.getElementById('lic-type').value,
    quantity:     parseInt(document.getElementById('lic-quantity').value)||1,
    contract:     document.getElementById('lic-contract').value,
    is_perpetual: document.getElementById('lic-perpetual').checked,
    start_date:   document.getElementById('lic-start').value,
    end_date:     document.getElementById('lic-perpetual').checked ? null : document.getElementById('lic-end').value,
    notes:        document.getElementById('lic-notes').value,
  };
  try {
    if (id) await api('PUT', `/api/licenses/${id}`, body);
    else    await api('POST','/api/licenses', body);
  } catch (err) {
    // Exibe o erro do backend dentro do modal sem fechá-lo
    let errEl = document.getElementById('lic-form-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = 'lic-form-error';
      errEl.style.cssText = 'margin:10px 0 0;padding:10px 14px;background:rgba(147,51,234,0.1);border:1px solid rgba(147,51,234,0.3);border-radius:8px;color:#c084fc;font-size:13px;';
      document.querySelector('#modal-license .modal-footer').before(errEl);
    }
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    return;
  }

  const errEl = document.getElementById('lic-form-error');
  if (errEl) errEl.style.display = 'none';

  closeModal('modal-license');
  await Promise.all([loadLicenses(), loadDivisions()]);
  await openItemDetail(state.currentItem);
}

async function confirmDeleteLicense(licId) {
  confirmAction('Excluir esta licença?', async () => {
    await api('DELETE', `/api/licenses/${licId}`);
    await Promise.all([loadLicenses(), loadDivisions()]);
    await openItemDetail(state.currentItem);
  });
}

/**
 * Converte código de status em label PT-BR.
 * Usado também em ui.reports.js — deve ser carregado antes dele.
 */
function statusLabel(s) {
  return {valid:'Saudável',expired:'Expirada',perpetual:'Vitalícia',critical:'Crítico (≤30d)',warning:'Aviso (≤60d)',soon:'Atenção (≤90d)',unknown:'?'}[s]||s;
}
