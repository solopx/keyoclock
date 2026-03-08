/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.dashboard.js
   Dashboard: cards executivos, saúde, alertas e relógio de vencimento.
   Dependências (escopo global): escapeHTML (ui.utils.js), api (api.js),
   state, showPage, showPageFiltered (app.js — disponíveis em runtime).
   ═══════════════════════════════════════════════════════════════════════════ */

async function renderDashboard() {
  const d = await api('GET', '/api/stats');

  // ── Exec cards — 3 cards ─────────────────────────────────────────────────
  document.getElementById('dash-exec').innerHTML = `
    <div class="stat-card stat-card-exec c-blue" onclick="showPage('licenses')" title="Ver todas as licenças">
      <div class="slabel">Total de Licenças</div>
      <div class="sval">${d.total_licenses}</div>
      <div class="ssub">${d.total_entries} registro${d.total_entries !== 1 ? 's' : ''}</div>
      <span class="card-arrow">→</span>
    </div>
    <div class="stat-card stat-card-exec c-blue" onclick="showPage('inventory')" title="Ver grupos">
      <div class="slabel">Grupos Ativos</div>
      <div class="sval">${d.total_divisions}</div>
      <div class="ssub">Grupos configurados</div>
      <span class="card-arrow">→</span>
    </div>
    <div class="stat-card stat-card-exec c-cyan" onclick="showPage('inventory')" title="Ir para Inventário">
      <div class="slabel">Itens no Inventário</div>
      <div class="sval">${d.total_items}</div>
      <div class="ssub">Ativos cadastrados</div>
      <span class="card-arrow">→</span>
    </div>`;

  // ── Barra de status geral ─────────────────────────────────────────────────
  document.getElementById('dash-status-bar').innerHTML = `
    <span class="dsb-title">Status das Licenças</span>
    <div class="dsb-item c-green"  onclick="showPageFiltered('licenses','valid')"><span class="dsb-dot"></span>Saudáveis (${d.valid})</div>
    <div class="dsb-item c-cyan"   onclick="showPageFiltered('licenses','perpetual')"><span class="dsb-dot"></span>Vitalícias (${d.perpetual})</div>
    <div class="dsb-item c-yellow" onclick="showPageFiltered('licenses','soon')"><span class="dsb-dot"></span>Aviso (${d.expiring_90})</div>
    <div class="dsb-item c-orange" onclick="showPageFiltered('licenses','warning')"><span class="dsb-dot"></span>Atenção (${d.expiring_60})</div>
    <div class="dsb-item c-red"    onclick="showPageFiltered('licenses','critical')"><span class="dsb-dot"></span>Crítico (${d.expiring_30})</div>
    <div class="dsb-item c-purple" onclick="showPageFiltered('licenses','expired')"><span class="dsb-dot"></span>Expiradas (${d.expired})</div>`;

  // ── Grupos como tabela ────────────────────────────────────────────────────
  const STATUS_RANK = {expired:0,critical:1,warning:2,soon:3,valid:4,perpetual:5,unknown:6};
  const divStatus = {};
  state.licenses.forEach(l => {
    const cur = divStatus[l.division_name];
    if (cur === undefined || STATUS_RANK[l.status] < STATUS_RANK[cur]) divStatus[l.division_name] = l.status;
  });

  const divsEl   = document.getElementById('dash-divisions');
  const totalDiv = d.divisions.length;
  const shown    = d.divisions
    .slice()
    .sort((a, b) => {
      const ra = STATUS_RANK[divStatus[a.name] || 'unknown'];
      const rb = STATUS_RANK[divStatus[b.name] || 'unknown'];
      return ra !== rb ? ra - rb : a.name.localeCompare(b.name);
    })
    .slice(0, 5);

  const labelEl = document.getElementById('dash-groups-label');
  if (labelEl) labelEl.textContent = `Grupos de Licenças (${Math.min(5, totalDiv)}/${totalDiv})`;

  if (!totalDiv) {
    divsEl.innerHTML = '<p style="color:var(--text3);font-size:13px">Nenhum grupo cadastrado.</p>';
  } else {
    const rows = shown.map(div => {
      const st  = divStatus[div.name] || 'valid';
      let divLbl, divCls;
      if      (st === 'critical' || st === 'expired') { divLbl = 'Crítico';  divCls = 'badge-critical'; }
      else if (st === 'warning')                      { divLbl = 'Atenção';  divCls = 'badge-warning';  }
      else if (st === 'soon')                         { divLbl = 'Aviso';    divCls = 'badge-soon';     }
      else                                            { divLbl = 'Saudável'; divCls = 'badge-valid';    }
      return `
        <tr onclick="showPage('inventory')" title="Ver inventário">
          <td>
            <div class="dash-group-cell">
              <div class="dash-group-icon">${escapeHTML(div.icon)}</div>
              <strong>${escapeHTML(div.name)}</strong>
            </div>
          </td>
          <td style="color:var(--text3)">${div.items}</td>
          <td>${div.licenses}</td>
          <td><span class="badge badge-no-dot ${divCls}">${divLbl}</span></td>
        </tr>`;
    }).join('');
    divsEl.innerHTML = `
      <table class="dash-groups-table">
        <thead><tr>
          <th>Nome do Grupo</th>
          <th>Itens</th>
          <th>Qtd. Licenças</th>
          <th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  // ── Alertas ───────────────────────────────────────────────────────────────
  const alertsEl = document.getElementById('dash-alerts');
  const alertLics = state.licenses
    .filter(l => ['critical','warning','soon','expired'].includes(l.status))
    .sort((a,b) => (a.days_remaining ?? -9999) - (b.days_remaining ?? -9999))
    .slice(0, 6);

  const _MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const _fmtDate = iso => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d} ${_MESES[parseInt(m,10)-1]} ${y}`;
  };
  const _pillCls = { critical:'c-red', warning:'c-orange', soon:'c-yellow', expired:'c-purple' };

  if (alertLics.length === 0) {
    alertsEl.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:12px 0">Nenhum vencimento nos próximos 90 dias!</p>';
  } else {
    alertsEl.innerHTML = alertLics.map(l => {
      const cls      = l.status === 'expired' ? 'exp' : l.status === 'critical' ? 'crit' : l.status === 'warning' ? 'warn' : 'soon';
      const dateStr  = l.end_date_iso ? _fmtDate(l.end_date_iso) : '';
      const metaStr  = l.status === 'expired'
        ? `Expirado em: ${dateStr}`
        : `Vence em: ${dateStr}`;
      const pillText = l.days_remaining !== null
        ? (l.days_remaining < 0 ? `Expirou há ${Math.abs(l.days_remaining)} dias` : `${l.days_remaining} Dias`)
        : '∞';
      const pillCls  = _pillCls[l.status] || 'c-yellow';
      return `
        <div class="alert-item alert-item-bar ${cls}" onclick="showPageFiltered('licenses','${l.status}')">
          <div class="alert-name">${escapeHTML(l.item_name)}</div>
          <div class="alert-meta">${metaStr}</div>
          <div class="alert-item-footer">
            <span class="alert-days-pill ${pillCls}">${pillText}</span>
          </div>
        </div>`;
    }).join('');
  }

  renderExpiryClock();
}

function renderExpiryClock() {
  const el = document.getElementById('dash-expiry-clock');
  if (!el) return;

  const candidates = state.licenses
    .filter(l => l.status !== 'perpetual' && l.status !== 'unknown' && l.end_date_iso)
    .sort((a, b) => {
      const aExp = a.status === 'expired';
      const bExp = b.status === 'expired';
      if (aExp !== bExp) return aExp ? 1 : -1;
      return (a.days_remaining ?? -9999) - (b.days_remaining ?? -9999);
    });

  if (!candidates.length) {
    el.innerHTML = `<div class="expiry-clock-body"><div class="expiry-clock-empty">Nenhuma licença<br>com vencimento próximo</div></div>`;
    return;
  }

  const lic   = candidates[0];
  const days  = lic.days_remaining;
  const isExp = lic.status === 'expired';

  const colorMap = {
    valid: 'var(--green)', soon: 'var(--yellow)',
    warning: 'var(--orange)', critical: 'var(--red)', expired: 'var(--purple)'
  };
  const color = colorMap[lic.status] || 'var(--accent-l)';

  // pct = posição dentro da janela do status atual (critical→/30, warning→/60, soon→/90)
  // evita que 13d num contrato de 365d apareça como 3,6% no anel/barra/ampulheta
  let pct = 0;
  if (!isExp) {
    const _statusThreshold = { critical: 30, warning: 60, soon: 90 };
    const threshold = _statusThreshold[lic.status];
    if (threshold) {
      pct = Math.max(0, Math.min(1, days / threshold));
    } else {
      let totalDays = 365;
      if (lic.start_date_iso && lic.end_date_iso) {
        const diff = (new Date(lic.end_date_iso) - new Date(lic.start_date_iso)) / 86400000;
        if (diff > 0) totalDays = diff;
      }
      pct = Math.max(0, Math.min(1, days / totalDays));
    }
  }

  const daysText = isExp ? Math.abs(days) : (days === null ? '∞' : days);
  const unitText = isExp ? 'dias atrás' : 'dias';
  const params   = { lic, days, isExp, color, pct, daysText, unitText };

  const style = (typeof getClockStyle === 'function') ? getClockStyle() : 'ring';
  
  let content = '';
  if      (style === 'arc')         content = _clockArc(params);
  else if (style === 'bar')         content = _clockBar(params);
  else if (style === 'minimal')     content = _clockMinimal(params);
  else if (style === 'digital')     content = _clockDigital(params);
  else if (style === 'classic')     content = _clockClassic(params);
  else if (style === 'flip')        content = _clockFlip(params);
  else if (style === 'hourglass')   content = _clockHourglass(params);
  else if (style === 'speedometer') content = _clockSpeedometer(params);
  else                              content = _clockRing(params);

  el.innerHTML = `<div class="expiry-clock-body">${content}</div>` + _clockFooter(lic);
  el.classList.toggle('expiry-clock-urgent',     lic.status === 'critical');
  el.classList.toggle('expiry-clock-urgent-exp', lic.status === 'expired');
}

function _clockFooter(lic) {
  const sub = lic.notes
    ? `<div class="expiry-clock-date" style="font-size:11px;text-align:center;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(lic.notes)}">${escapeHTML(lic.notes)}</div>`
    : `<div class="expiry-clock-date">${escapeHTML(lic.end_date)}</div>`;
  return `
    <div class="expiry-clock-name" title="${escapeHTML(lic.item_name)}">${escapeHTML(lic.item_name)}</div>
    ${sub}`;
}

function _clockRing({ color, pct, daysText, unitText }) {
  const R    = 45;
  const circ = +(2 * Math.PI * R).toFixed(2);
  const off  = +((1 - pct) * circ).toFixed(2);
  return `
    <div class="expiry-clock-ring">
      <svg viewBox="0 0 100 100" width="96" height="96">
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--circle-track)" stroke-width="7"/>
        <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${off}"
          style="transition:stroke-dashoffset .9s ease,stroke .4s"/>
      </svg>
      <div class="expiry-clock-center">
        <div class="expiry-clock-days" style="color:${color}">${daysText}</div>
        <div class="expiry-clock-unit">${unitText}</div>
      </div>
    </div>`;
}

function _clockArc({ color, pct, daysText, unitText }) {
  const R    = 40;
  const half = +(Math.PI * R).toFixed(2);          // π·R ≈ 125.66 (semicircle arc length)
  const off  = +((1 - pct) * half).toFixed(2);
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex-shrink:0">
      <div class="expiry-clock-arc" style="position:relative;width:96px;height:56px">
        <svg viewBox="0 0 100 56" width="96" height="56">
          <circle cx="50" cy="50" r="${R}" fill="none"
            stroke="var(--circle-track)" stroke-width="7"
            stroke-dasharray="${half} ${half + 1}" transform="rotate(180 50 50)"/>
          <circle cx="50" cy="50" r="${R}" fill="none"
            stroke="${color}" stroke-width="7" stroke-linecap="round"
            stroke-dasharray="${half}" stroke-dashoffset="${off}"
            transform="rotate(180 50 50)"
            style="transition:stroke-dashoffset .9s ease,stroke .4s"/>
        </svg>
      </div>
      <div style="text-align:center">
        <div class="expiry-clock-days" style="color:${color};font-size:22px">${daysText}</div>
        <div class="expiry-clock-unit">${unitText}</div>
      </div>
    </div>`;
}

function _clockBar({ color, pct, daysText, unitText }) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%">
      <div class="expiry-clock-days" style="color:${color}">${daysText}</div>
      <div class="expiry-clock-unit">${unitText}</div>
      <div class="expiry-clock-bar-wrap">
        <div class="expiry-clock-bar-fill" style="width:${(pct * 100).toFixed(1)}%;background:${color}"></div>
      </div>
    </div>`;
}

function _clockMinimal({ color, daysText, unitText }) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div class="expiry-clock-minimal-num" style="color:${color}">${daysText}</div>
      <div class="expiry-clock-minimal-unit">${unitText}</div>
    </div>`;
}

function _clockDigital({ daysText, unitText }) {
  // Pad para 3 dígitos para manter o alinhamento com o fundo "888"
  const displayDays = daysText.toString().padStart(3, '0');
  
  return `
    <div class="expiry-clock-digital-container" style="
      background: #a4ad8d;
      padding: 12px;
      border-radius: 4px;
      border: 3px solid #333;
      box-shadow: inset 3px 3px 10px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-width: 130px;
    ">
      <div style="display: grid; place-items: center; position: relative;">
        <div style="
          grid-area: 1 / 1;
          font-family: 'Digital 7 Mono', monospace;
          font-weight: 400;
          font-size: 48px;
          line-height: 1;
          color: rgba(0,0,0,0.06);
          letter-spacing: 2px;
        ">888</div>
        <div class="expiry-clock-days" style="
          grid-area: 1 / 1;
          font-family: 'Digital 7 Mono', monospace;
          font-weight: 400;
          font-size: 48px;
          line-height: 1;
          color: #1a1a1a;
          letter-spacing: 2px;
          text-shadow: 1px 1px 0px rgba(255,255,255,0.2);
          z-index: 2;
        ">${displayDays}</div>
      </div>
      <div class="expiry-clock-unit" style="
        color: #1a1a1a;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        margin-top: 6px;
        letter-spacing: 1px;
        opacity: 0.8;
      ">${unitText}</div>
    </div>`;
}

function _clockClassic({ color, pct, daysText }) {
  const angle = (pct * 360).toFixed(2);
  return `
    <div class="expiry-clock-classic" style="position:relative; width:96px; height:96px;">
      <svg viewBox="0 0 100 100" width="96" height="96">
        <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" stroke-width="2"/>
        ${[0, 90, 180, 270].map(deg => `
          <line x1="50" y1="10" x2="50" y2="15" stroke="var(--text3)" stroke-width="2" transform="rotate(${deg} 50 50)"/>
        `).join('')}
        
        <line x1="50" y1="50" x2="50" y2="15" stroke="var(--circle-track)" stroke-width="3" stroke-linecap="round" />
        
        <line x1="50" y1="50" x2="50" y2="15" 
          stroke="${color}" stroke-width="4" stroke-linecap="round" 
          style="transform: rotate(${angle}deg); transform-origin: 50px 50px; transition: transform 1s cubic-bezier(0.4, 2.08, 0.55, 1.44);" />
        
        <circle cx="50" cy="50" r="3" fill="var(--text)" />
      </svg>
      <div style="position:absolute; top:60%; left:0; right:0; text-align:center;">
        <div style="font-size:10px; font-weight:700; color:${color}; font-family:var(--font-mono)">${daysText}d</div>
      </div>
    </div>`;
}

function _clockHourglass({ color, pct, daysText, unitText }) {
  const p    = Math.max(0.02, Math.min(0.98, pct));
  const fill = 1 - p;                              // fill=0 → topo cheio; fill=1 → base cheia
  const y_top  = (7  + fill * 15).toFixed(1);
  const topH   = (22 - parseFloat(y_top)).toFixed(1);
  const y_bot  = (37 - fill * 15).toFixed(1);
  const botH   = (37 - parseFloat(y_bot)).toFixed(1);
  const dripEnd  = Math.max(24, Math.min(35, parseFloat(y_bot) - 1)).toFixed(1);
  const showDrip = p > 0.05;
  return `
    <div class="expiry-clock-hourglass" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:80px;height:95px;flex-shrink:0">
      <svg viewBox="0 0 44 44" width="60" height="60" style="margin-bottom:4px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">
        <defs>
          <clipPath id="hg-clip">
            <path d="M12 7 Q22 22 12 37 H32 Q22 22 32 7 Z"/>
          </clipPath>
        </defs>
        <rect x="10" y="4" width="24" height="3" rx="1.5" fill="var(--text3)"/>
        <rect x="10" y="37" width="24" height="3" rx="1.5" fill="var(--text3)"/>
        <path d="M12 7 Q22 22 12 37 H32 Q22 22 32 7 Z" fill="var(--circle-track)" opacity="0.15" stroke="var(--text3)" stroke-width="1.2"/>
        <g clip-path="url(#hg-clip)">
          <rect x="0" y="${y_top}" width="44" height="${topH}" fill="${color}" opacity="0.75" style="transition:all 0.9s ease"/>
          <rect x="0" y="${y_bot}" width="44" height="${botH}" fill="${color}" style="transition:all 0.9s ease"/>
        </g>
        ${showDrip ? `
          <line x1="22" y1="23" x2="22" y2="${dripEnd}" stroke="${color}" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.6">
            <animate attributeName="stroke-dashoffset" from="4" to="0" dur="0.8s" repeatCount="indefinite"/>
          </line>` : ''}
      </svg>
      <div style="text-align:center;line-height:1.2">
        <div style="color:${color};font-size:24px;font-weight:900;font-family:var(--font-mono)">${daysText}</div>
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text3);letter-spacing:1px">${unitText}</div>
      </div>
    </div>`;
}

function _clockSpeedometer({ color, daysText, unitText, days, isExp }) {
  const cx = 50, cy = 56, R = 38;
  const maxDays = 90;
  // Garante que o percentual fique entre 0 e 1
  const fuelPct = isExp ? 0 : Math.max(0, Math.min(1, days / maxDays));
  
  const arcLen = Math.PI * R;
  const fillOff = (1 - fuelPct) * arcLen;
  
  // Cálculo do ponteiro (needle)
  const angle = (1 - fuelPct) * Math.PI;
  const nx = cx + R * Math.cos(angle);
  const ny = cy - R * Math.sin(angle);

  // Gerar ticks de forma mais declarativa
  const ticks = [0.25, 0.5, 0.75].map(t => {
    const a = (1 - t) * Math.PI;
    const x1 = cx + (R - 4) * Math.cos(a);
    const y1 = cy - (R - 4) * Math.sin(a);
    const x2 = cx + (R + 2) * Math.cos(a);
    const y2 = cy - (R + 2) * Math.sin(a);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1" opacity="0.5"/>`;
  }).join('');

  return `
    <div class="speedo-container" style="--accent-color: ${color}; font-family: var(--font-mono, monospace); color: var(--text3, #888);">
      <svg viewBox="0 14 100 51" width="140" role="img" aria-label="Indicador de tempo: ${daysText} ${unitText}">

        <g transform="translate(45, 32) scale(0.12)" fill="currentColor" opacity="0.2">
          <path d="M99.06,20.2c0.27,0.13,0.51,0.3,0.74,0.52c0.06,0.06,0.11,0.12,
          0.16,0.18c2.89,2.29,5.78,4.88,7.88,8 c2.32,3.45,3.61,7.44,2.83,12.17c-0.33,
          1.98-1.08,3.71-2.22,5.24c-0.82,1.09-1.82,2.05-3,2.89c-0.06,1.53-0.08,3.03-0.08,
          4.52 c0.01,1.91,0.07,3.88,0.18,5.9c0.25,4.74,0.96,9.52,1.67,14.26c0.76,5.1,1.52,
          10.16,1.72,15.43c0.27,6.75-0.53,12.3-2.76,16.22 c-2.48,4.38-6.51,6.72-12.45,
          6.51v0c-7.09-0.13-11.45-4.11-13.42-11.46c-1.72-6.43-1.46-15.61,
          0.49-27.16 c-0.06-9.15-1.25-16.08-3.61-20.75c-1.54-3.05-3.63-5.07-6.27-6.03v59.91c0.86,
          0.41,1.64,0.97,2.3,1.64 c1.52,1.52,2.47,3.63,2.47,5.95v5.98c0,1.51-1.23,2.74-2.74,2.74H2.74c-1.51,
          0-2.74-1.23-2.74-2.74v-5.98 c0-2.32,0.95-4.42,2.47-5.95c0.47-0.47,1-0.89,1.57-1.24V14.52c0-4,1.63-7.63,
          4.26-10.26C10.93,1.63,14.56,0,18.56,0h37.78 C60.35,0,64,1.64,66.64,4.28c2.64,2.64,4.28,6.29,4.28,
          10.31v26.36c4.86,1.06,8.57,4.17,11.15,9.27 c2.77,5.47,4.15,13.31,4.19,23.46c0,0.16-0.01,0.32-0.04,
          0.47l0.01,0c-1.85,10.87-2.15,19.35-0.63,25.02 c1.27,4.77,3.95,7.35,8.24,7.41l0.05,0v0c3.66,0.12,
          6.09-1.22,7.52-3.75c1.69-2.98,2.28-7.55,
          2.05-13.31 c-0.19-4.88-0.94-9.85-1.68-14.85c-0.72-4.82-1.44-9.68-1.71-14.78c-0.11-2.01-0.17-4.06-0.18-6.18c-0.01-1.68,
          0.02-3.34,0.09-4.97 c-5.11-4.48-8.22-8.96-9.18-13.42c-0.91-4.23,0.05-8.29,
          3-12.17c-2.25-1.54-4.54-2.8-6.86-3.81c-3.17-1.38-6.43-2.31-9.75-2.85 c-1.49-0.24-2.5-1.65-2.26-3.14c0.24-1.49,
          1.65-2.5,3.14-2.26c3.76,0.61,7.45,1.66,11.06,3.23C92.54,15.82,95.85,17.75,99.06,20.2 L99.06,20.2z M65.44,
          44.23c-0.12-0.34-0.18-0.7-0.15-1.08c0.02-0.27,0.07-0.52,0.15-0.76v-27.8c0-2.5-1.03-4.78-2.68-6.43 c-1.65-1.65-3.93-2.68-6.43-2.68H18.56c-2.48,
          0-4.74,1.02-6.38,2.66c-1.64,1.64-2.66,3.9-2.66,6.38v91.22h55.92V44.23L65.44,44.23z M68.42,111.46c-0.08,0.01-0.15,0.01-0.23,
          0.01H7.26c-0.34,0.15-0.65,0.36-0.91,0.62c-0.53,0.53-0.86,1.26-0.86,2.07v3.24h64.73 v-3.24c0-0.8-0.33-1.53-0.86-2.07C69.09,
          111.82,68.77,111.61,68.42,111.46L68.42,111.46z M23.04,13.74h29.44 c1.53,0,2.92,0.62,3.92,1.63c0.07,0.07,0.14,0.14,0.2,
          0.22c0.89,0.99,1.43,2.29,1.43,3.7v18.78c0,1.53-0.62,2.92-1.63,3.92 c-1,1-2.39,1.63-3.92,1.63H23.04c-1.52,0-2.9-0.63-3.91-1.63l-0.01,
          0.01c-1-1-1.63-2.39-1.63-3.92V19.29 c0-1.53,0.62-2.92,1.63-3.92c0.07-0.07,0.14-0.14,0.22-0.2C20.33,14.28,21.63,13.74,23.04,
          13.74L23.04,13.74z M52.48,19.22H23.04 c-0.01,0-0.02,0-0.02,0L23,19.24c-0.01,0.01-0.02,0.03-0.02,0.04v18.78c0,0.01,0.01,0.03,0.02,
          0.04L23,38.12L23,38.12 c0.01,0.01,0.02,0.01,0.04,0.01h29.44c0.01,0,0.03-0.01,0.04-0.02c0.01-0.01,0.02-0.03,0.02-0.04V19.29c0-0.01,
          0-0.02,0-0.02 l-0.02-0.02C52.51,19.23,52.5,19.22,52.48,19.22L52.48,19.22z M98.15,26.5c-1.91,2.56-2.55,5.12-1.99,
          7.7 c0.67,3.12,3,6.44,6.88,9.95c0.39-0.35,0.74-0.72,1.03-1.11c0.61-0.81,1.02-1.76,1.19-2.84c0.52-3.16-0.37-5.87-1.97-8.25 C101.97,29.97,100.13,28.16,98.15,26.5L98.15,26.5z"/>
        </g>

        <path d="M 12 56 A 38 38 0 0 1 88 56" fill="none" stroke="currentColor" stroke-width="6" opacity="0.1" stroke-linecap="round"/>
        
        <path d="M 12 56 A 38 38 0 0 1 88 56" 
              fill="none" 
              stroke="${color}" 
              stroke-width="6" 
              stroke-linecap="round" 
              stroke-dasharray="${arcLen}" 
              stroke-dashoffset="${fillOff}" 
              style="transition: stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s;"/>
        
        ${ticks}

        <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" 
              stroke="${color}" stroke-width="2.5" stroke-linecap="round" 
              style="transition: all 1.2s cubic-bezier(0.4, 0, 0.2, 1)"/>
        
        <circle cx="${cx}" cy="${cy}" r="3" fill="white" stroke="${color}" stroke-width="1.5"/>
        
        <text x="10" y="64" font-size="6" font-weight="bold" fill="currentColor">E</text>
        <text x="87" y="64" font-size="6" font-weight="bold" fill="currentColor">F</text>
      </svg>

      <div style="margin-top: -10px; text-align: center;">
        <div style="color: ${color}; font-size: 28px; font-weight: 900; letter-spacing: -1px;">${daysText}</div>
        <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; opacity: 0.8;">${unitText}</div>
      </div>
    </div>
  `;
}

function _clockFlip({ color, daysText, unitText }) {
  const digits = String(daysText).split('');

  const digitHtml = digits.map(d => `
    <div style="position:relative; width:32px; height:46px; background:#0a0a0a; border-radius:4px; border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 8px rgba(0,0,0,0.4); overflow:hidden">
      <div style="position:absolute; top:50%; left:0; right:0; height:1px; background:rgba(0,0,0,0.8); z-index:2"></div>
      <div style="font-family:var(--font-mono); font-size:30px; font-weight:800; color:${color}; line-height:1; z-index:1">
        ${d}
      </div>
    </div>
  `).join('');

  return `
    <div class="expiry-clock-flip" style="display:flex; flex-direction:column; align-items:center; gap:6px; flex-shrink:0">
      <div style="display:flex; gap:3px">
        ${digitHtml}
      </div>
      <div class="expiry-clock-unit" style="font-size:10px; font-weight:800; text-transform:uppercase; color:var(--text2); letter-spacing:1px">${unitText}</div>
    </div>`;
}