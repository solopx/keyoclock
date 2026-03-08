/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.contracts.js
   Contratos: agrupamento de licenças por número/nome de contrato,
   com visão expansível por item/divisão.
   Dependências (escopo global): escapeHTML (ui.utils.js), api (api.js).
   ═══════════════════════════════════════════════════════════════════════════ */

let _contractsData = [];

async function loadContracts() {
  _contractsData = await api('GET', '/api/contracts') || [];
  filterContracts();
}

function filterContracts() {
  const q = (document.getElementById('contracts-search')?.value || '').toLowerCase();
  const filtered = q
    ? _contractsData.filter(c => c.name.toLowerCase().includes(q))
    : _contractsData;
  _renderContracts(filtered);
}

function _toggleContractRow(idx) {
  const chevron = document.getElementById(`contract-chevron-${idx}`);
  const open    = chevron && chevron.textContent === '▼';
  document.querySelectorAll(`.contract-sub-${idx}`).forEach(tr => {
    tr.style.display = open ? 'none' : '';
  });
  if (chevron) chevron.textContent = open ? '▶' : '▼';
}

function _renderContracts(data) {
  const tbody = document.getElementById('contracts-table-body');
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:32px">Nenhum contrato encontrado.</td></tr>';
    return;
  }
  tbody.innerHTML = data.map((c, idx) => {
    const subRows = c.items.map(it => `
      <tr class="contract-sub-${idx}" style="display:none;background:var(--surface2,rgba(128,128,128,0.04))">
        <td></td>
        <td style="padding-left:32px;color:var(--text3);font-size:0.92em">
          ${escapeHTML(it.item_name)}<span style="color:var(--text3);opacity:0.6"> — ${escapeHTML(it.division_name)}</span>
        </td>
        <td style="text-align:center;color:var(--text3);font-size:0.92em">${it.license_count}</td>
        <td style="text-align:center;color:var(--text3);font-size:0.92em">${it.total_qty}</td>
      </tr>
    `).join('');
    return `
      <tr style="cursor:pointer" onclick="_toggleContractRow(${idx})">
        <td style="width:28px;text-align:center;color:var(--text3)"><span id="contract-chevron-${idx}">▶</span></td>
        <td class="td-trunc"><strong>${escapeHTML(c.name)}</strong></td>
        <td style="text-align:center">${c.license_count}</td>
        <td style="text-align:center">${c.total_qty}</td>
      </tr>
      ${subRows}
    `;
  }).join('');
}
