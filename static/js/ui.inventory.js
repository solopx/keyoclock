/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.inventory.js
   Inventário: árvore de grupos/listas/itens e modais de CRUD.
   Dependências (escopo global): escapeHTML, esc, openModal, closeModal
   (ui.utils.js), api (api.js), state (app.js — disponível em runtime).
   ═══════════════════════════════════════════════════════════════════════════ */

const divCollapsed  = {};
const listCollapsed = {};

async function loadDivisions() {
  state.divisions = await api('GET', '/api/divisions');
}

function renderInventory() {
  state.divisions.forEach(d => {
    divCollapsed[d.id] = true;
    d.lists.forEach(l => { listCollapsed[l.id] = true; });
  });
  renderInvTree();
}

function renderInvTree() {
  const root = document.getElementById('inv-tree-root');
  const q    = (document.getElementById('inv-search')?.value || '').toLowerCase();

  state.divisions.forEach(d => {
    if (divCollapsed[d.id] === undefined)  divCollapsed[d.id]  = true;
    d.lists.forEach(l => {
      if (listCollapsed[l.id] === undefined) listCollapsed[l.id] = true;
    });
  });

  if (!state.divisions.length) {
    root.innerHTML = `<div class="empty-state"><div class="es-icon">📁</div>
      <p>Nenhum grupo cadastrado. Clique em "+ Novo Grupo" para começar.</p></div>`;
    return;
  }

  let html = '';
  for (const div of state.divisions) {
    const matchDiv = !q || div.name.toLowerCase().includes(q) || (div.description||'').toLowerCase().includes(q);
    const filteredLists = div.lists
      .map(lst => {
        const matchList    = !q || lst.name.toLowerCase().includes(q);
        const filteredItems = lst.items.filter(it =>
          !q || it.name.toLowerCase().includes(q) ||
          (it.model||'').toLowerCase().includes(q) ||
          (it.manufacturer||'').toLowerCase().includes(q) ||
          (it.supplier||'').toLowerCase().includes(q)
        );
        return { ...lst, _items: filteredItems, _show: matchList || filteredItems.length > 0 };
      })
      .filter(l => matchDiv || l._show);

    if (!matchDiv && !filteredLists.length) continue;

    const collapsed   = divCollapsed[div.id] && !q;
    const totalItems  = div.lists.reduce((s,l) => s + l.items.length, 0);
    const totalLists  = div.lists.length;

    html += `
      <div class="inv-div ${collapsed ? 'collapsed' : ''}" id="invdiv-${div.id}">
        <div class="inv-div-header" onclick="toggleDiv(${div.id},event)">
          <span class="inv-div-chevron">▼</span>
          <span class="inv-div-icon">${escapeHTML(div.icon)}</span>
          <span class="inv-div-name">${escapeHTML(div.name)}</span>
          ${div.description ? `<span class="inv-div-meta" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(div.description)}</span>` : ''}
          <span class="inv-div-counter">${totalLists} lista${totalLists!==1?'s':''} · ${totalItems} ${totalItems===1?'item':'itens'}</span>
          <div class="inv-div-actions" onclick="event.stopPropagation()">
            <button class="icon-btn" title="Nova lista"  onclick="openListModal(${div.id})">＋</button>
            <button class="icon-btn" title="Editar"      onclick="openDivisionModal(${div.id})">✏</button>
            <button class="icon-btn del" title="Excluir" onclick="confirmDeleteDiv(${div.id})">🗑</button>
          </div>
        </div>
        <div class="inv-div-body">
          ${!filteredLists.length
            ? `<div style="padding:16px 16px 16px 52px;color:var(--text3);font-size:13px">Nenhuma lista. <span style="color:var(--accent-l);cursor:pointer" onclick="openListModal(${div.id})">+ Criar lista</span></div>`
            : filteredLists.map(lst => _renderList(lst, div, q)).join('')}
        </div>
      </div>`;
  }
  root.innerHTML = html;
}

function _renderList(lst, div, q) {
  const collapsed = listCollapsed[lst.id] && !q;
  const items     = q ? lst._items : lst.items;
  const licTotal  = items.reduce((s,i) => s + (i.license_count||0), 0);
  return `
    <div class="inv-list ${collapsed?'collapsed':''}" id="invlist-${lst.id}">
      <div class="inv-list-header" onclick="toggleList(${lst.id},event)">
        <span class="inv-list-chevron">▼</span>
        <span style="font-size:14px;flex-shrink:0">📋</span>
        <span class="inv-list-name">${escapeHTML(lst.name)}</span>
        <span class="inv-list-meta">${items.length} item${items.length!==1?'s':''} · ${licTotal} lic.</span>
        <div class="inv-list-actions" onclick="event.stopPropagation()">
          <button class="icon-btn" title="Novo item"  onclick="openItemModal(${lst.id})">＋</button>
          <button class="icon-btn" title="Editar"     onclick="openListModal(${div.id},${lst.id})">✏</button>
          <button class="icon-btn del" title="Excluir" onclick="confirmDeleteList(${lst.id})">🗑</button>
        </div>
      </div>
      <div class="inv-list-body">
        <div class="inv-items-wrap">
          ${!items.length
            ? `<div class="inv-add-item" onclick="openItemModal(${lst.id})">＋ Adicionar item à lista</div>`
            : `<table class="inv-items-table">
                 <colgroup><col class="col-name"><col class="col-model"><col class="col-mfr"><col class="col-sup"><col class="col-lic"><col class="col-act"></colgroup>
                 <thead><tr><th>Nome</th><th>Modelo</th><th>Fabricante</th><th>Fornecedor</th><th style="text-align:center">Licenças</th><th></th></tr></thead>
                 <tbody>${items.map(it => _renderItemRow(it, lst.id)).join('')}</tbody>
               </table>
               <div class="inv-add-item" onclick="openItemModal(${lst.id})" style="margin-top:8px">＋ Adicionar item</div>`}
        </div>
      </div>
    </div>`;
}

function _renderItemRow(item, listId) {
  const badge = item.license_count > 0
    ? `<span class="badge badge-valid">${item.license_count}</span>`
    : `<span class="badge badge-unknown">0</span>`;
  return `
    <tr>
      <td><strong style="font-size:13px">${escapeHTML(item.name)}</strong>${item.description?`<div style="font-size:11px;color:var(--text3)">${escapeHTML(item.description)}</div>`:''}</td>
      <td style="color:var(--text3)">${escapeHTML(item.model||'—')}</td>
      <td>${escapeHTML(item.manufacturer||'—')}</td>
      <td>${escapeHTML(item.supplier||'—')}</td>
      <td style="text-align:center">${badge}</td>
      <td>
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" onclick="openItemDetail(${item.id})">🔑 Licenças</button>
          <button class="icon-btn" onclick="openItemModal(${listId},${item.id})">✏</button>
          <button class="icon-btn del" onclick="confirmDeleteItm(${item.id})">🗑</button>
        </div>
      </td>
    </tr>`;
}

function toggleDiv(divId, e) {
  if (e.target.closest('.inv-div-actions')) return;
  divCollapsed[divId] = !divCollapsed[divId];
  document.getElementById('invdiv-'+divId)?.classList.toggle('collapsed', divCollapsed[divId]);
}
function toggleList(listId, e) {
  if (e.target.closest('.inv-list-actions')) return;
  listCollapsed[listId] = !listCollapsed[listId];
  document.getElementById('invlist-'+listId)?.classList.toggle('collapsed', listCollapsed[listId]);
}
function expandAllDivs() {
  state.divisions.forEach(d => { divCollapsed[d.id]=false; d.lists.forEach(l => listCollapsed[l.id]=false); });
  renderInvTree();
}
function collapseAllDivs() {
  state.divisions.forEach(d => { divCollapsed[d.id]=true; d.lists.forEach(l => listCollapsed[l.id]=true); });
  renderInvTree();
}
function filterInventory() { renderInvTree(); }

/* ─── MODAIS DE GRUPO ────────────────────────────────────────────────────── */

function openDivisionModal(divId) {
  const div = divId ? state.divisions.find(d => d.id===divId) : null;
  document.getElementById('div-modal-title').textContent = div ? 'Editar Grupo' : 'Novo Grupo';
  document.getElementById('div-id').value   = divId||'';
  document.getElementById('div-name').value = div?.name||'';
  document.getElementById('div-desc').value = div?.description||'';
  document.getElementById('div-icon').value = div?.icon||'🏢';
  openModal('modal-division');
}
async function saveDivision() {
  const id   = document.getElementById('div-id').value;
  const name = document.getElementById('div-name').value.trim();
  if (!name) { document.getElementById('div-name').classList.add('field-error');
  document.getElementById('div-name').focus();
  setTimeout(() => document.getElementById('div-name').classList.remove('field-error'), 400);
  return; }
  const body = { name, description: document.getElementById('div-desc').value, icon: document.getElementById('div-icon').value };
  if (id) await api('PUT', `/api/divisions/${id}`, body);
  else    await api('POST','/api/divisions', body);
  closeModal('modal-division');
  await loadDivisions(); renderInvTree();
}

/* ─── MODAIS DE LISTA ────────────────────────────────────────────────────── */

function openListModal(divId, listId) {
  const lst = listId ? state.divisions.flatMap(d => d.lists).find(l => l.id === listId) : null;
  document.getElementById('list-modal-title').textContent = listId ? 'Editar Lista' : 'Nova Lista';
  document.getElementById('list-div-id').value = divId;
  document.getElementById('list-id').value     = listId||'';
  document.getElementById('list-name').value   = lst?.name||'';
  openModal('modal-list');
}
async function saveList() {
  const id    = document.getElementById('list-id').value;
  const name  = document.getElementById('list-name').value.trim();
  if (!name) { document.getElementById('list-name').classList.add('field-error');
  document.getElementById('list-name').focus();
  setTimeout(() => document.getElementById('list-name').classList.remove('field-error'), 400);
  return; }
  const divId = document.getElementById('list-div-id').value;
  if (id) await api('PUT', `/api/lists/${id}`, {name});
  else    await api('POST','/api/lists', {name, division_id: parseInt(divId)});
  closeModal('modal-list');
  await loadDivisions(); renderInvTree();
}

/* ─── MODAIS DE ITEM ─────────────────────────────────────────────────────── */

function openItemModal(listId, itemId) {
  const lst  = state.divisions.flatMap(d => d.lists).find(l => l.id===listId);
  const item = itemId ? lst?.items.find(i => i.id===itemId) : null;
  document.getElementById('item-modal-title').textContent = item ? 'Editar Item' : 'Novo Item';
  document.getElementById('item-list-id').value      = listId;
  document.getElementById('item-id').value           = itemId||'';
  document.getElementById('item-name').value         = item?.name||'';
  document.getElementById('item-model').value        = item?.model||'';
  document.getElementById('item-manufacturer').value = item?.manufacturer||'';
  document.getElementById('item-supplier').value     = item?.supplier||'';
  document.getElementById('item-desc').value         = item?.description||'';
  openModal('modal-item');
}
async function saveItem() {
  const id = document.getElementById('item-id').value;
  const name = document.getElementById('item-name').value.trim();
  if (!name) { document.getElementById('item-name').classList.add('field-error');
  document.getElementById('item-name').focus();
  setTimeout(() => document.getElementById('item-name').classList.remove('field-error'), 400);
  return; }
  const body = {
    name,
    model:        document.getElementById('item-model').value,
    manufacturer: document.getElementById('item-manufacturer').value,
    supplier:     document.getElementById('item-supplier').value,
    description:  document.getElementById('item-desc').value,
    list_id:      parseInt(document.getElementById('item-list-id').value),
  };
  if (id) await api('PUT', `/api/items/${id}`, body);
  else    await api('POST','/api/items', body);
  closeModal('modal-item');
  await loadDivisions(); renderInvTree();
}

function confirmDeleteDiv(divId) {
  const div = state.divisions.find(d => d.id === divId);
  confirmDelete('division', divId, `Excluir grupo <strong>${escapeHTML(div?.name || '')}</strong>?<br>Todos os dados serão perdidos.`);
}
function confirmDeleteList(listId) {
  const lst = state.divisions.flatMap(d => d.lists).find(l => l.id === listId);
  confirmDelete('list', listId, `Excluir lista <strong>${escapeHTML(lst?.name || '')}</strong>?`);
}
function confirmDeleteItm(itemId) {
  const item = state.divisions.flatMap(d => d.lists).flatMap(l => l.items).find(i => i.id === itemId);
  confirmDelete('item', itemId, `Excluir <strong>${escapeHTML(item?.name || '')}</strong>?`);
}
