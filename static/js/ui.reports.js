/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.reports.js
   Relatórios: visão geral, validade e por grupo.
   Dependências (escopo global): escapeHTML (ui.utils.js), api (api.js),
   state, showPage, showPageFiltered (app.js), statusLabel (ui.licenses.js).
   ═══════════════════════════════════════════════════════════════════════════ */

let reportsData          = null;
let activeReportTab      = 'overview';
let _contractsReportData = null;
let _ctrCollapsed = {};
let _ctrPage = 0;
const _CTR_PAGE_SIZE = 25;

const _RPT_STATUS_COLOR = { valid:'#10b981',expired:'#9333ea',perpetual:'#06b6d4',
                             critical:'#ef4444',warning:'#f97316',soon:'#f59e0b',unknown:'#64748b' };
const _RPT_STATUS_LABEL = { valid:'Saudáveis',expired:'Expiradas',perpetual:'Vitalícias',
                             critical:'Crítico (≤30d)',warning:'Aviso (≤60d)',soon:'Atenção (≤90d)',unknown:'Outros' };

async function loadReports() {
  _contractsReportData = null;
  _ctrPage = 0;
  [reportsData] = await Promise.all([
    api('GET', '/api/reports/data'),
    loadLicenses(),
  ]);
  renderReportTab(activeReportTab);
}

function switchReportTab(tab) {
  activeReportTab = tab;
  document.querySelectorAll('.reports-tab').forEach(t => t.classList.toggle('active', t.dataset.tab===tab));
  renderReportTab(tab);
}

function renderReportTab(tab) {
  const el = document.getElementById('reports-content');
  if (!reportsData) return;

  if (tab === 'overview')  renderReportOverview(el);
  if (tab === 'validity')  renderReportValidity(el);
  if (tab === 'contracts') renderReportContracts(el);
  if (tab === 'divisions') renderReportDivisions(el);
  if (tab === 'costs')     renderReportCosts(el);
}

function renderReportCosts(el) {
  el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:300px;flex-direction:column;gap:12px">'
    + '<div style="font-size:40px">&#128181;</div>'
    + '<div style="font-size:18px;font-weight:600">Em breve</div>'
    + '<div style="font-size:13px;color:var(--text3)">Módulo de análise de custos em desenvolvimento.</div>'
    + '</div>';
}

function renderReportOverview(el) {
  const d = reportsData;

  const TYPE_COLOR   = { suporte:'#3b82f6',manutencao:'#06b6d4',funcionalidade:'#10b981',
                         oem:'#8b5cf6',device:'#f59e0b',volume:'#f97316',subscription:'#ec4899',cal:'#64748b' };
  const TYPE_LABEL   = { suporte:'Suporte',manutencao:'Manutenção',funcionalidade:'Funcionalidade',
                         oem:'OEM',device:'Device-Based',volume:'Vol. Licenciamento',subscription:'Assinatura',cal:'CAL' };

  const STATUS_ORDER = { expired:0,critical:1,warning:2,soon:3,valid:4,perpetual:5,unknown:6 };
  const totalQty     = Object.values(d.by_status).reduce((s,v)=>s+v,0) || 1;

  const timelineMonths = _buildTimeline();

  const typeEntries = Object.entries(d.by_type).filter(([,v])=>v>0)
                            .sort(([,a],[,b])=>b-a);
  const typeTotal   = typeEntries.reduce((s,[,v])=>s+v,0)||1;

  el.innerHTML = `
    <div class="ov-grid">

      <!-- ① GRÁFICO DE STATUS -->
      <div class="report-card ov-status">
        <h3>Por Status <span style="font-size:11px;color:var(--text3);font-weight:400">(ordenado por prioridade)</span></h3>
        <div id="chart-status-v2"></div>
      </div>

      <!-- ② RESUMO GERAL -->
      <div class="report-card ov-summary">
        <h3>Resumo Geral</h3>
        <div class="summary-grid">
          <div class="summary-tile" onclick="showPage('inventory')" title="Ir para Inventário">
            <div class="summary-tile-val" style="color:var(--accent-l)">${d.total_divisions}</div>
            <div class="summary-tile-label">Grupos</div>
            <div class="summary-tile-sub">&#128230; Ver inventário</div>
          </div>
          <div class="summary-tile" onclick="showPage('inventory')" title="Ir para Inventário">
            <div class="summary-tile-val" style="color:var(--cyan)">${d.total_lists}</div>
            <div class="summary-tile-label">Listas</div>
            <div class="summary-tile-sub">&#128230; Ver inventário</div>
          </div>
          <div class="summary-tile" onclick="showPage('inventory')" title="Ir para Inventário">
            <div class="summary-tile-val" style="color:var(--text2)">${d.total_items}</div>
            <div class="summary-tile-label">Itens</div>
            <div class="summary-tile-sub">&#128230; Ver inventário</div>
          </div>
          <div class="summary-tile" onclick="showPage('licenses')" title="Ir para Licenças">
            <div class="summary-tile-val" style="color:var(--green)">${d.total_licenses}</div>
            <div class="summary-tile-label">Licenças</div>
            <div class="summary-tile-sub">&#128273; Ver licenças</div>
          </div>
          <div class="summary-tile" onclick="showPageFiltered('licenses','critical')" title="Ver críticas"
               style="${d.by_status.critical>0?'border-color:rgba(239,68,68,0.4)':''}">
            <div class="summary-tile-val" style="color:var(--red)">${d.by_status.critical||0}</div>
            <div class="summary-tile-label">Crítico</div>
            <div class="summary-tile-sub" style="color:var(--red)">&#9888; ≤30 dias</div>
          </div>
          <div class="summary-tile" onclick="showPageFiltered('licenses','expired')" title="Ver expiradas"
               style="${d.by_status.expired>0?'border-color:rgba(147,51,234,0.4)':''}">
            <div class="summary-tile-val" style="color:var(--purple)">${d.by_status.expired||0}</div>
            <div class="summary-tile-label">Expiradas</div>
            <div class="summary-tile-sub" style="color:var(--purple)">&#9888; Requer ação</div>
          </div>
        </div>
      </div>

      <!-- ③ DONUT POR TIPO -->
      <div class="report-card ov-donut">
        <h3>Por Tipo</h3>
        <div class="donut-wrap">
          <svg class="donut-svg" viewBox="0 0 120 120">
            ${_buildDonutPaths(typeEntries, typeTotal, TYPE_COLOR)}
            <text x="60" y="55" text-anchor="middle" font-size="18" font-weight="700" fill="#e2e8f0">${typeTotal}</text>
            <text x="60" y="70" text-anchor="middle" font-size="9" fill="#64748b">licenças</text>
          </svg>
          <div class="donut-legend">
            ${typeEntries.map(([k,v]) => {
              const pct = Math.round(v/typeTotal*100);
              return `<div class="donut-leg-item">
                <span class="donut-dot" style="background:${TYPE_COLOR[k]||'#64748b'}"></span>
                <span class="donut-leg-label">${TYPE_LABEL[k]||k}</span>
                <span class="donut-leg-val">${v}</span>
                <span class="donut-leg-pct">${pct}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- ④ TIMELINE -->
      <div class="report-card ov-timeline">
        <h3>Vencimentos nos Próximos 12 Meses</h3>
        <div id="timeline-chart"></div>
      </div>

      <!-- ⑤ POR GRUPO -->
      <div class="report-card ov-group">
        <h3>Por Grupo</h3>
        <div id="chart-division-v2"></div>
      </div>

    </div>`;

  _renderStatusChart('chart-status-v2', d.by_status, _RPT_STATUS_COLOR, _RPT_STATUS_LABEL, STATUS_ORDER, totalQty);

  const divEntries = Object.entries(d.by_division).sort(([,a],[,b])=>b-a);
  const divMax     = Math.max(...divEntries.map(([,v])=>v), 1);
  const divTotal   = divEntries.reduce((s,[,v])=>s+v,0)||1;
  const paleta     = ['#3b82f6','#06b6d4','#10b981','#f59e0b','#f97316','#9333ea','#8b5cf6','#ec4899'];
  document.getElementById('chart-division-v2').innerHTML = divEntries.length
    ? divEntries.map(([name,qty],i) => {
        const pct    = Math.round(qty/divMax*100);
        const pctTot = Math.round(qty/divTotal*100);
        const color  = paleta[i%paleta.length];
        return `<div class="chart-bar-item">
          <div class="chart-bar-label">${escapeHTML(name)}</div>
          <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="chart-bar-val">${qty} <span style="color:var(--text3);font-size:10px">${pctTot}%</span></div>
        </div>`;
      }).join('')
    : '<p style="color:var(--text3);font-size:13px">Sem dados</p>';

  _renderTimeline('timeline-chart', timelineMonths);
}

/* ── Gráfico de status com criticidade + badges + CTA ────────────────────── */
function _renderStatusChart(containerId, byStatus, colorMap, labelMap, orderMap, totalQty) {
  const el      = document.getElementById(containerId);
  const entries = Object.entries(byStatus)
    .filter(([,v]) => v > 0)
    .sort(([a],[b]) => (orderMap[a]??9) - (orderMap[b]??9));
  const max = Math.max(...entries.map(([,v])=>v), 1);

  const ALERT_STATUSES = new Set(['expired','critical']);

  el.innerHTML = entries.map(([key, val]) => {
    const color   = colorMap[key] || '#64748b';
    const label   = labelMap[key] || key;
    const pct     = Math.round(val/max*100);
    const pctTot  = Math.round(val/totalQty*100);
    const isAlert = ALERT_STATUSES.has(key) && val > 0;
    const badge   = isAlert
      ? `<span class="status-alert-badge" title="Requer ação imediata">!</span>`
      : '';
    const cta     = isAlert
      ? `<button class="chart-cta" onclick="showPageFiltered('licenses','${key}')">Ver detalhes →</button>`
      : '';

    return `<div class="chart-bar-item ${isAlert ? 'chart-bar-alert' : ''}">
      <div class="chart-bar-label">${label}${badge}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width:${pct}%;background:${color}">
          <span class="chart-bar-pct-inline">${pctTot}%</span>
        </div>
      </div>
      <div class="chart-bar-val">${val}${cta}</div>
    </div>`;
  }).join('') || '<p style="color:var(--text3);font-size:13px">Sem dados</p>';
}

/* ── Donut SVG ───────────────────────────────────────────────────────────── */
function _buildDonutPaths(entries, total, colorMap) {
  const R = 46, CX = 60, CY = 60, strokeW = 18;
  const circ = 2 * Math.PI * R;
  let offset = 0;
  return entries.map(([k, v]) => {
    const dash  = (v / total) * circ;
    const gap   = circ - dash;
    const color = colorMap[k] || '#64748b';
    const path  = `<circle cx="${CX}" cy="${CY}" r="${R}"
      fill="none" stroke="${color}" stroke-width="${strokeW}"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 ${CX} ${CY})" opacity="0.9"/>`;
    offset += dash;
    return path;
  }).join('');
}

/* ── Timeline: conta licenças que vencem por mês ─────────────────────────── */
function _buildTimeline() {
  const months = [];
  const now    = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      year:  d.getFullYear(),
      month: d.getMonth(),
      qty:   0,
    });
  }
  state.licenses.forEach(l => {
    if (!l.end_date_iso || l.is_perpetual) return;
    const ed = new Date(l.end_date_iso + 'T00:00:00');
    months.forEach(m => {
      if (ed.getFullYear() === m.year && ed.getMonth() === m.month) {
        m.qty += (l.quantity || 1);
      }
    });
  });
  return months;
}

function _renderTimeline(containerId, months) {
  const el  = document.getElementById(containerId);
  const max = Math.max(...months.map(m=>m.qty), 1);
  const now = new Date();

  el.innerHTML = `
    <div class="timeline-wrap">
      ${months.map((m) => {
        const h       = Math.round((m.qty / max) * 80);
        const isPast  = (m.year < now.getFullYear()) || (m.year === now.getFullYear() && m.month < now.getMonth());
        const isCur   = m.year === now.getFullYear() && m.month === now.getMonth();
        const color   = m.qty === 0 ? 'rgba(255,255,255,0.06)'
                      : isPast      ? '#64748b'
                      : isCur       ? '#06b6d4'
                      : m.qty >= max * 0.7 ? '#ef4444'
                      : m.qty >= max * 0.4 ? '#f97316'
                      : '#10b981';
        return `<div class="tl-col" title="${m.qty} licença(s) vencendo em ${m.label}">
          <div class="tl-bar-wrap">
            <div class="tl-bar" style="height:${h || 3}px;background:${color}"></div>
          </div>
          ${m.qty > 0 ? `<div class="tl-val">${m.qty}</div>` : '<div class="tl-val" style="opacity:0">0</div>'}
          <div class="tl-label ${isCur?'tl-label-cur':''}">${m.label}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-top:10px;font-size:11px;color:var(--text3)">
      Barras representam quantidade de licenças com vencimento em cada mês.
      <span style="color:#ef4444">■</span> Alto volume &nbsp;
      <span style="color:#f97316">■</span> Médio &nbsp;
      <span style="color:#10b981">■</span> Baixo &nbsp;
      <span style="color:#06b6d4">■</span> Mês atual
    </div>`;
}

/* ─── RELATÓRIO POR CONTRATO ─────────────────────────────────────────────── */

async function renderReportContracts(el) {
  if (!_contractsReportData) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Carregando...</div>';
    try {
      _contractsReportData = await api('GET', '/api/reports/contracts');
    } catch (_) {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--red)">Erro ao carregar dados de contratos.</div>';
      return;
    }
  }
  _renderContractsReport(el, _contractsReportData);
}

function _ctrGoPage(page) {
  _ctrPage = page;
  _renderContractsReport(document.getElementById('reports-content'), _contractsReportData);
}

function _expandAllContracts() {
  Object.keys(_ctrCollapsed).forEach(k => { _ctrCollapsed[k] = false; });
  _applyContractCollapse();
}
function _collapseAllContracts() {
  Object.keys(_ctrCollapsed).forEach(k => { _ctrCollapsed[k] = true; });
  _applyContractCollapse();
}
function _toggleContractCard(idx) {
  _ctrCollapsed[idx] = !_ctrCollapsed[idx];
  _applyContractCollapse();
}
function _applyContractCollapse() {
  document.querySelectorAll('[data-ctr-idx]').forEach(card => {
    const idx = card.dataset.ctrIdx;
    const body = card.querySelector('.ctr-body');
    if (body) body.style.display = _ctrCollapsed[idx] ? 'none' : '';
    const chevron = card.querySelector('.ctr-chevron');
    if (chevron) chevron.textContent = _ctrCollapsed[idx] ? '\u25B6' : '\u25BC';
  });
}

function _renderContractsReport(el, data) {
  const STATUS_LABEL = { valid:'Saudável',expired:'Expirada',perpetual:'Vitalícia',
                         critical:'Crítico',warning:'Aviso',soon:'Atenção',unknown:'?' };
  const STATUS_ORDER = ['expired','critical','warning','soon','valid','perpetual','unknown'];

  if (!data || !data.length) {
    el.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text3)">Nenhum contrato encontrado.</div>';
    return;
  }

  const totalPages = Math.ceil(data.length / _CTR_PAGE_SIZE);
  _ctrPage = Math.min(_ctrPage, Math.max(0, totalPages - 1));
  const pageData = data.slice(_ctrPage * _CTR_PAGE_SIZE, (_ctrPage + 1) * _CTR_PAGE_SIZE);

  _ctrCollapsed = {};
  pageData.forEach((_, i) => { _ctrCollapsed[i] = true; });

  const totalItens = data.reduce((s,c)=>s+c.license_count,0);
  const totalQty   = data.reduce((s,c)=>s+c.total_qty,0);

  const today = new Date(); today.setHours(0,0,0,0);
  const expiringIn90 = data.filter(c => {
    if (!c.earliest_end || c.name === '(Sem contrato)') return false;
    const diff = Math.ceil((new Date(c.earliest_end) - today) / 86400000);
    return diff >= 0 && diff <= 90;
  }).length;
  const semContrato = data.find(c => c.name === '(Sem contrato)');
  const itensSemContrato = semContrato ? semContrato.license_count : 0;

  const _isoToBr = iso => { if (!iso) return null; const [y,m,d] = iso.split('-'); return `${d}-${m}-${y}`; };

  const cards = pageData.map((c, idx) => {
    const isSemContrato = c.name === '(Sem contrato)';
    const worstColor    = _RPT_STATUS_COLOR[c.worst_status] || '#64748b';
    const worstLabel    = STATUS_LABEL[c.worst_status] || '?';

    const byStatus = {};
    c.items.forEach(i => { byStatus[i.status] = (byStatus[i.status]||0) + i.quantity; });

    const statusCards = STATUS_ORDER
      .filter(s => byStatus[s] > 0)
      .map(s => `
        <div class="dv-status-card">
          <div class="dv-status-val" style="color:${_RPT_STATUS_COLOR[s]}">${byStatus[s]}</div>
          <div class="dv-status-label">${STATUS_LABEL[s]}</div>
        </div>`).join('');

    const tableRows = c.items.map(i => {
      const dcolor = i.is_perpetual ? 'var(--cyan)'
                   : i.days === null ? 'var(--text3)'
                   : _daysColor(i.days);
      const daysStr  = i.is_perpetual ? '∞' : (i.days !== null ? i.days + 'd' : '—');
      const endStr   = i.is_perpetual ? 'Vitalícia' : (i.end_date || '—');
      return `<tr>
        <td class="td-trunc"><strong>${escapeHTML(i.item_name)}</strong></td>
        <td class="td-trunc" style="color:var(--text3);font-size:12px">${escapeHTML(i.division_name)} › ${escapeHTML(i.list_name)}</td>
        <td style="text-transform:capitalize">${escapeHTML(i.license_type)}</td>
        <td style="text-align:center"><span class="badge badge-valid">${i.quantity}</span></td>
        <td style="font-family:monospace;font-size:12px">${i.start_date || '—'}</td>
        <td style="font-family:monospace;font-size:12px">${endStr}</td>
        <td><span class="badge badge-${i.status}">${STATUS_LABEL[i.status] || '?'}</span></td>
        <td style="font-family:monospace;font-weight:600;color:${dcolor}">${daysStr}</td>
      </tr>`;
    }).join('');

    const headerName = isSemContrato
      ? `<span style="color:var(--text3);font-style:italic;font-size:13px">${escapeHTML(c.name)}</span>`
      : `<span class="badge badge-contract" style="font-size:13px">${escapeHTML(c.name)}</span>`;

    const brDate = _isoToBr(c.earliest_end);
    const meta = `${c.license_count} ${c.license_count!==1?'Itens':'Item'} no contrato`
      + (brDate ? ` &nbsp;–&nbsp; Vencimento mais próximo: ${brDate}` : '');

    return `
      <div class="report-card" data-ctr-idx="${idx}" style="margin-bottom:16px">
        <div class="dv-group-header" style="margin-bottom:0;cursor:pointer" onclick="_toggleContractCard(${idx})">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${headerName}
              <span style="font-size:12px;color:var(--text3)">${meta}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge badge-${c.worst_status}" style="color:${worstColor}">${worstLabel}</span>
            <span class="ctr-chevron" style="font-size:11px;color:var(--text3)">\u25B6</span>
          </div>
        </div>
        <div class="ctr-body" style="margin-top:12px">
          <div class="dv-status-cards" style="margin-bottom:12px">${statusCards}</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th><th>Localização</th><th>Tipo</th>
                  <th style="text-align:center">Qtd</th><th>Início</th><th>Vencimento</th>
                  <th>Status</th><th>Dias</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }).join('');

  const hasPrev = _ctrPage > 0;
  const hasNext = _ctrPage < totalPages - 1;
  const paginationHTML = totalPages > 1 ? `
    <div style="display:flex;align-items:center;gap:8px">
      <button class="btn btn-secondary btn-sm" onclick="_ctrGoPage(${_ctrPage-1})" ${hasPrev?'':'disabled'}>&#8592; Anterior</button>
      <span style="font-size:12px;color:var(--text3)">Página ${_ctrPage+1} de ${totalPages}</span>
      <button class="btn btn-secondary btn-sm" onclick="_ctrGoPage(${_ctrPage+1})" ${hasNext?'':'disabled'}>Próxima &#8594;</button>
    </div>` : '';

  el.innerHTML = `
    <div class="report-card" style="margin-bottom:20px">
      <div class="dv-status-cards" style="margin-bottom:16px">
        <div class="dv-status-card">
          <div class="dv-status-val">${data.length}</div>
          <div class="dv-status-label">Total de contratos</div>
        </div>
        <div class="dv-status-card">
          <div class="dv-status-val">${totalItens}</div>
          <div class="dv-status-label">Total de Itens cadastrados</div>
        </div>
        <div class="dv-status-card">
          <div class="dv-status-val">${totalQty}</div>
          <div class="dv-status-label">Total de Licenças</div>
        </div>
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px;color:var(--text3);padding:10px 0;border-top:1px solid var(--border,rgba(128,128,128,0.12));border-bottom:1px solid var(--border,rgba(128,128,128,0.12));margin-bottom:14px">
        <span>Contratos a expirar nos próximos 90 dias: <strong style="color:var(--text)">${expiringIn90}</strong></span>
        <span>Itens cadastrados sem contrato: <strong style="color:var(--text)">${itensSemContrato}</strong></span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:600;color:var(--text)">Todos os contratos</span>
        ${paginationHTML}
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="_collapseAllContracts()">Recolher todos</button>
          <button class="btn btn-secondary btn-sm" onclick="_expandAllContracts()">Expandir todos</button>
        </div>
      </div>
    </div>
    ${cards}`;
  _applyContractCollapse();
}

/* ─── RELATÓRIO POR VALIDADE ─────────────────────────────────────────────── */

function renderReportValidity(el) {
  const groups = [
    { label: 'Expiradas',       status: 'expired',   color: 'var(--red)'    },
    { label: 'Crítico (≤30d)',  status: 'critical',  color: 'var(--red)'    },
    { label: 'Aviso (≤60d)',    status: 'warning',   color: 'var(--orange)' },
    { label: 'Atenção (≤90d)', status: 'soon',      color: 'var(--yellow)' },
    { label: 'Saudáveis',       status: 'valid',     color: 'var(--green)'  },
    { label: 'Vitalícias',      status: 'perpetual', color: 'var(--cyan)'   },
  ];

  const all = state.licenses;

  el.innerHTML = `
    <div class="validity-filters" id="validity-filter-bar">
      <button class="validity-filter active" data-status="all"      onclick="filterValidityReport('all',this)">Todas</button>
      ${groups.map(g => `<button class="validity-filter" data-status="${g.status}" onclick="filterValidityReport('${g.status}',this)">${g.label}</button>`).join('')}
    </div>
    <div class="report-card" style="margin-bottom:20px">
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        ${groups.map(g => {
          const qty = all.filter(l=>l.status===g.status).reduce((s,l)=>s+(l.quantity||1),0);
          return `<div style="text-align:center;padding:8px 16px;background:rgba(0,0,0,0.2);border-radius:8px;min-width:90px">
            <div style="font-size:22px;font-weight:700;font-family:var(--font-mono);color:${g.color}">${qty}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">${g.label}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="table-wrap" id="validity-table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Localização</th><th>Tipo</th><th style="text-align:center">Qtd</th><th>Contrato</th><th>Início</th><th>Vencimento</th><th>Status</th><th>Dias</th></tr></thead>
        <tbody id="validity-table-body"></tbody>
      </table>
    </div>`;

  filterValidityReport('all', document.querySelector('[data-status="all"]'));
}

function filterValidityReport(status, btn) {
  document.querySelectorAll('.validity-filter').forEach(b => b.classList.remove('active'));
  btn?.classList.add('active');

  const filtered = (status === 'all')
    ? state.licenses
    : state.licenses.filter(l => l.status === status);

  const sorted = [...filtered].sort((a,b) => {
    const order = {expired:-2,critical:-1,warning:0,soon:1,valid:2,perpetual:3,unknown:4};
    return (order[a.status]??5) - (order[b.status]??5) || (a.days_remaining??9999) - (b.days_remaining??9999);
  });

  const tbody = document.getElementById('validity-table-body');
  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">Nenhuma licença encontrada</td></tr>';
    return;
  }
  tbody.innerHTML = sorted.map(l => `
    <tr>
      <td><strong>${escapeHTML(l.item_name)}</strong>${l.item_model?`<br><span style="font-size:11px;color:var(--text3)">${escapeHTML(l.item_model)}</span>`:''}</td>
      <td class="td-trunc" style="color:var(--text3)">${escapeHTML(l.division_name)} › ${escapeHTML(l.list_name)}</td>
      <td style="text-transform:capitalize">${escapeHTML(l.license_type)}</td>
      <td style="text-align:center"><span class="badge badge-valid">${l.quantity||1}</span></td>
      <td>${l.contract?`<span class="badge badge-contract">${escapeHTML(l.contract)}</span>`:'—'}</td>
      <td style="font-family:monospace;font-size:12px">${l.start_date||'—'}</td>
      <td style="font-family:monospace;font-size:12px">${l.end_date||'—'}</td>
      <td><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></td>
      <td style="font-family:monospace;font-weight:600;color:${_daysColor(l.days_remaining)}">${l.days_remaining!==null?l.days_remaining+'d':'∞'}</td>
    </tr>`).join('');
}

/* ─── RELATÓRIO POR GRUPO ────────────────────────────────────────────────── */

// Estado da aba Por Grupo
let _divSortCol  = 'qty';
let _divSortAsc  = false;
let _divView     = 'all';     // 'all' | 'group'
let _divSelected = null;      // nome do grupo selecionado
let _divPeriod   = 0;         // 0 = todos | 30 | 60 | 90

function renderReportDivisions(el) {
  if (_divView === 'group') {
    if (_divSelected) {
      _renderDivGroupDetail(el);
    } else {
      _renderDivSelectPrompt(el);
    }
  } else {
    _renderDivOverview(el);
  }
}

function _renderDivSelectPrompt(el) {
  const d          = reportsData;
  const groupNames = Object.keys(d.by_division).sort((a, b) => a.localeCompare(b));

  el.innerHTML = `
    <div class="dv-mode-bar">
      <div class="dv-mode-group">
        <button class="dv-mode-btn" onclick="_setDivView('all',this)">&#127760; Visão Geral</button>
        <button class="dv-mode-btn active" onclick="_setDivView('group',this)">&#128269; Por Grupo</button>
      </div>
      <div class="dv-mode-group">
        <select class="dv-select" id="dv-group-select" onchange="_selectDivGroup(this.value)">
          <option value="">Selecione um grupo…</option>
          ${groupNames.map(n => `<option value="${n}">${n}</option>`).join('')}
        </select>
        <div class="dv-period-btns">
          <button class="dv-period-btn ${_divPeriod===0?'active':''}"  onclick="_setDivPeriod(0,this)">Todos</button>
          <button class="dv-period-btn ${_divPeriod===30?'active':''}" onclick="_setDivPeriod(30,this)">30 dias</button>
          <button class="dv-period-btn ${_divPeriod===60?'active':''}" onclick="_setDivPeriod(60,this)">60 dias</button>
          <button class="dv-period-btn ${_divPeriod===90?'active':''}" onclick="_setDivPeriod(90,this)">90 dias</button>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;
                min-height:220px;color:var(--text3);font-size:14px;flex-direction:column;gap:12px">
      <div style="font-size:32px">&#128269;</div>
      <div>Selecione um grupo no seletor acima para visualizar suas licenças.</div>
    </div>`;
}

function _renderDivOverview(el) {
  const d      = reportsData;
  const byDs   = d.by_division_status || {};
  const total  = Object.values(d.by_division).reduce((s,v)=>s+v,0) || 1;
  const paleta = ['#3b82f6','#06b6d4','#10b981','#f59e0b','#f97316','#9333ea','#8b5cf6','#ec4899'];

  const HEALTH_ORDER = ['expired','critical','warning','soon','valid','perpetual','unknown'];
  const HEALTH_LABEL = { expired:'Expiradas',critical:'Crítico',warning:'Aviso',
                         soon:'Atenção',valid:'Saudável',perpetual:'Vitalícia',unknown:'—' };
  const HEALTH_BADGE = { expired:'badge-expired',critical:'badge-critical',warning:'badge-warning',
                         soon:'badge-soon',valid:'badge-valid',perpetual:'badge-perpetual',unknown:'badge-unknown' };

  function groupHealth(name) {
    const st = byDs[name] || {};
    for (const s of HEALTH_ORDER) { if (st[s] > 0) return s; }
    return 'unknown';
  }

  let rows = Object.entries(d.by_division).map(([name, qty], i) => ({
    name, qty,
    pctTot: Math.round(qty/total*100),
    color:  paleta[i%paleta.length],
    health: groupHealth(name),
    status: byDs[name] || {},
  }));
  rows = _sortDivRows(rows);

  const groupNames = Object.keys(d.by_division).sort((a, b) => a.localeCompare(b));

  el.innerHTML = `
    <div class="dv-mode-bar">
      <div class="dv-mode-group">
        <button class="dv-mode-btn active" onclick="_setDivView('all',this)">&#127760; Visão Geral</button>
        <button class="dv-mode-btn" onclick="_setDivView('group',this)">&#128269; Por Grupo</button>
      </div>
    </div>

    <div class="dv-grid">
      <!-- ① SPARKLINES -->
      <div class="report-card dv-sparklines">
        <h3>Composição por Status <span style="font-size:11px;color:var(--text3);font-weight:400">(sparkline de validade)</span></h3>
        <div class="spark-list">
          ${rows.map(r => {
            const st    = r.status;
            const stTot = Object.values(st).reduce((s,v)=>s+v,0) || 1;
            const SPARK_SEGS = [
              { s:'expired',c:'#9333ea'},{ s:'critical',c:'#ef4444'},
              { s:'warning',c:'#f97316'},{ s:'soon',c:'#f59e0b'},
              { s:'valid',c:'#10b981'}, { s:'perpetual',c:'#06b6d4'},
            ];
            const segs  = SPARK_SEGS.filter(sg => st[sg.s] > 0);
            const bar = segs.map(sg => {
              const w = Math.round((st[sg.s]/stTot)*100);
              return `<div class="spark-seg" style="width:${w}%;background:${sg.c}"
                title="${HEALTH_LABEL[sg.s]}: ${st[sg.s]}"></div>`;
            }).join('');
            return `<div class="spark-row" style="cursor:pointer" data-group="${escapeHTML(r.name)}" onclick="_jumpToGroup(this.dataset.group)">
              <div class="spark-name" title="Ver detalhes do grupo">${escapeHTML(r.name)}</div>
              <div class="spark-bar">${bar}</div>
              <div class="spark-qty">${r.qty}</div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
          ${[{s:'expired',c:'#9333ea'},{s:'critical',c:'#ef4444'},{s:'warning',c:'#f97316'},
             {s:'soon',c:'#f59e0b'},{s:'valid',c:'#10b981'},{s:'perpetual',c:'#06b6d4'}]
            .map(({s,c}) => `<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text3);white-space:nowrap">
              <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0"></span>${HEALTH_LABEL[s]}</span>`).join('')}
        </div>
      </div>

      <!-- ② TABELA com ordenação -->
      <div class="report-card dv-table">
        <h3>Detalhamento por Grupo</h3>
        <div class="table-wrap" id="div-detail-table"></div>
      </div>

      <!-- ③ PRÓXIMOS VENCIMENTOS -->
      <div class="report-card dv-upcoming">
        <h3>&#9200; Próximos Vencimentos</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Item</th><th>Grupo</th><th>Tipo</th><th style="text-align:center">Qtd</th>
              <th>Vencimento</th><th>Status</th><th>Dias</th></tr></thead>
            <tbody>
              ${(d.upcoming_expiry||[]).length
                ? (d.upcoming_expiry||[]).map(l => `<tr>
                    <td class="td-trunc"><strong>${l.item_name||'—'}</strong></td>
                    <td class="td-trunc" style="color:var(--text3)">${l.div_name}</td>
                    <td style="text-transform:capitalize">${l.license_type}</td>
                    <td style="text-align:center"><span class="badge badge-valid">${l.quantity}</span></td>
                    <td style="font-family:monospace;font-size:12px">${l.end_date}</td>
                    <td><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></td>
                    <td style="font-family:monospace;font-weight:600;color:${_daysColor(l.days)}">${l.days!==null?l.days+'d':'∞'}</td>
                  </tr>`).join('')
                : `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Nenhum vencimento próximo</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  _renderDivTable('div-detail-table', rows, total, HEALTH_BADGE, HEALTH_LABEL);
}

function _renderDivGroupDetail(el) {
  const d         = reportsData;
  const groupName = _divSelected;
  const period    = _divPeriod;
  const groupNames = Object.keys(d.by_division).sort((a, b) => a.localeCompare(b));

  let lics = state.licenses.filter(l => l.division_name === groupName);

  let periodoLabel = 'Todas as licenças';
  if (period > 0) {
    lics = lics.filter(l => {
      if (l.is_perpetual || !l.days_remaining) return false;
      return l.days_remaining >= 0 && l.days_remaining <= period;
    });
    periodoLabel = `Licenças vencendo em até ${period} dias`;
  }

  const byStatus = {};
  lics.forEach(l => { byStatus[l.status] = (byStatus[l.status]||0) + (l.quantity||1); });

  const STATUS_ORDER = ['expired','critical','warning','soon','valid','perpetual','unknown'];

  const totalGrupo = lics.reduce((s,l)=>s+(l.quantity||1),0);

  el.innerHTML = `
    <div class="dv-mode-bar">
      <div class="dv-mode-group">
        <button class="dv-mode-btn" onclick="_setDivView('all',this)">&#127760; Visão Geral</button>
        <button class="dv-mode-btn active" onclick="_setDivView('group',this)">&#128269; Por Grupo</button>
      </div>
      <div class="dv-mode-group">
        <select class="dv-select" id="dv-group-select" onchange="_selectDivGroup(this.value)">
          <option value="">Selecione um grupo…</option>
          ${groupNames.map(n => `<option value="${n}" ${n===groupName?'selected':''}>${n}</option>`).join('')}
        </select>
        <div class="dv-period-btns">
          <button class="dv-period-btn ${period===0?'active':''}"  onclick="_setDivPeriod(0,this)">Todos</button>
          <button class="dv-period-btn ${period===30?'active':''}" onclick="_setDivPeriod(30,this)">30 dias</button>
          <button class="dv-period-btn ${period===60?'active':''}" onclick="_setDivPeriod(60,this)">60 dias</button>
          <button class="dv-period-btn ${period===90?'active':''}" onclick="_setDivPeriod(90,this)">90 dias</button>
        </div>
      </div>
    </div>

    <div class="dv-group-header">
      <div>
        <div class="dv-group-title">${groupName}</div>
        <div class="dv-group-sub">${periodoLabel} &nbsp;·&nbsp; ${totalGrupo} licença${totalGrupo!==1?'s':''} encontrada${totalGrupo!==1?'s':''}</div>
      </div>
    </div>

    <div class="dv-status-cards">
      ${STATUS_ORDER.filter(s => byStatus[s] > 0).map(s => `
        <div class="dv-status-card">
          <div class="dv-status-val" style="color:${_RPT_STATUS_COLOR[s]}">${byStatus[s]}</div>
          <div class="dv-status-label">${_RPT_STATUS_LABEL[s]}</div>
        </div>`).join('')}
      ${!Object.keys(byStatus).length ? `<div style="color:var(--text3);font-size:13px;padding:8px 0">Nenhuma licença para este filtro.</div>` : ''}
    </div>

    <div class="report-card" style="margin-top:16px">
      <h3>Licenças do grupo &nbsp;<span style="color:var(--cyan)">${groupName}</span></h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th><th>Tipo</th><th style="text-align:center">Qtd</th>
              <th>Contrato</th><th>Início</th><th>Vencimento</th><th>Status</th><th>Dias</th>
            </tr>
          </thead>
          <tbody>
            ${lics.length
              ? [...lics].sort((a,b)=>{
                  const o={expired:0,critical:1,warning:2,soon:3,valid:4,perpetual:5,unknown:6};
                  return (o[a.status]??7)-(o[b.status]??7)||(a.days_remaining??9999)-(b.days_remaining??9999);
                }).map(l => `<tr>
                  <td><strong>${escapeHTML(l.item_name)}</strong>${l.item_model?`<br><span style="font-size:11px;color:var(--text3)">${escapeHTML(l.item_model)}</span>`:''}</td>
                  <td style="text-transform:capitalize">${escapeHTML(l.license_type)}</td>
                  <td style="text-align:center"><span class="badge badge-valid">${l.quantity||1}</span></td>
                  <td>${l.contract?`<span class="badge badge-contract">${escapeHTML(l.contract)}</span>`:'—'}</td>
                  <td style="font-family:monospace;font-size:12px">${l.start_date||'—'}</td>
                  <td style="font-family:monospace;font-size:12px">${l.end_date||'—'}</td>
                  <td><span class="badge badge-${l.status}">${statusLabel(l.status)}</span></td>
                  <td style="font-family:monospace;font-weight:600;color:${_daysColor(l.days_remaining)}">${l.days_remaining!==null?l.days_remaining+'d':'∞'}</td>
                </tr>`).join('')
              : `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:24px">
                  Nenhuma licença encontrada${period>0?' para este período':''}.
                 </td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ── Controles de estado ─────────────────────────────────────────────────── */
function _setDivView(view) {
  _divView = view;
  if (view === 'all') _divSelected = null;
  renderReportTab('divisions');
}

function _selectDivGroup(name) {
  _divSelected = name || null;
  if (name) _divView = 'group';
  renderReportTab('divisions');
}

function _setDivPeriod(p) {
  _divPeriod = p;
  renderReportTab('divisions');
}

function _jumpToGroup(name) {
  _divSelected = name;
  _divView     = 'group';
  renderReportTab('divisions');
}


/* ── Ordenação da tabela ─────────────────────────────────────────────────── */
function _sortDivRows(rows) {
  return [...rows].sort((a,b) => {
    let va, vb;
    if (_divSortCol === 'name')      { va = a.name;   vb = b.name; }
    else if (_divSortCol === 'pct')  { va = a.pctTot; vb = b.pctTot; }
    else                             { va = a.qty;    vb = b.qty; }
    if (typeof va === 'string') return _divSortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _divSortAsc ? va-vb : vb-va;
  });
}

function _divSort(col) {
  if (_divSortCol === col) _divSortAsc = !_divSortAsc;
  else { _divSortCol = col; _divSortAsc = false; }
  renderReportTab('divisions');
}

function _renderDivTable(containerId, rows, total, HEALTH_BADGE, HEALTH_LABEL) {
  const el   = document.getElementById(containerId);
  if (!el) return;
  const icon = col => {
    if (_divSortCol !== col) return '<span style="opacity:0.3">⇅</span>';
    return _divSortAsc ? '↑' : '↓';
  };
  el.innerHTML = `<table>
    <thead>
      <tr>
        <th style="cursor:pointer" onclick="_divSort('name')">Grupo ${icon('name')}</th>
        <th style="text-align:right;cursor:pointer" onclick="_divSort('qty')">Licenças ${icon('qty')}</th>
        <th style="text-align:right;cursor:pointer" onclick="_divSort('pct')">% Total ${icon('pct')}</th>
        <th style="text-align:center">Saúde</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => {
        const h     = r.health;
        const badge = HEALTH_BADGE[h] || 'badge-unknown';
        const label = HEALTH_LABEL[h] || '—';
        return `<tr>
          <td><strong>${r.name}</strong></td>
          <td style="text-align:right;font-family:var(--font-mono)">${r.qty}</td>
          <td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">${r.pctTot}%</td>
          <td style="text-align:center"><span class="badge ${badge}">${label}</span></td>
          <td style="text-align:right">
            <button class="chart-cta" data-group="${escapeHTML(r.name)}" onclick="_jumpToGroup(this.dataset.group)">Ver grupo →</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function _daysColor(days) {
  if (days === null) return 'var(--cyan)';
  if (days < 0)   return 'var(--purple)';
  if (days <= 30) return 'var(--red)';
  if (days <= 60) return 'var(--orange)';
  if (days <= 90) return 'var(--yellow)';
  return 'var(--green)';
}

function exportReport(type) {
  const tab    = document.querySelector('.reports-tab.active')?.dataset.tab || 'overview';
  const filter = document.querySelector('.validity-filter.active')?.dataset.status || 'all';
  const params = `?tab=${tab}&filter=${filter}`;
  window.open(`/api/reports/export/${type}${params}`, '_blank');
}
