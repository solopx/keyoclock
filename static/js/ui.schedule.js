/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.schedule.js
   Painel de agendamentos automáticos: envio por período e por status.
   ═══════════════════════════════════════════════════════════════════════════ */

let _schedLoaded = false;

function toggleSchedule() {
  const panel = document.getElementById('sched-panel');
  const card  = document.getElementById('sched-card');
  if (!panel || !card) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  card.classList.toggle('settings-entry-open', !open);
  const ch = card.querySelector('.sched-chevron');
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
    const dp = document.getElementById('db-panel');
    const dc = document.getElementById('db-card');
    if (dp) dp.style.display = 'none';
    if (dc) {
      dc.classList.remove('settings-entry-open');
      const dh = dc.querySelector('.db-chevron');
      if (dh) dh.style.transform = '';
    }
    const ep = document.getElementById('email-panel');
    const ec = document.getElementById('email-card');
    if (ep) ep.style.display = 'none';
    if (ec) {
      ec.classList.remove('settings-entry-open');
      const eh = ec.querySelector('.email-chevron');
      if (eh) eh.style.transform = '';
    }
    if (!_schedLoaded) { loadSchedConfig(); _schedLoaded = true; }
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }
}

function loadSchedConfig() {
  fetch('/api/schedule/config')
    .then(r => r.json())
    .then(d => {
      const pe = document.getElementById('sched-periodic-enabled');
      const se = document.getElementById('sched-status-enabled');
      if (pe) pe.checked = !!d.periodic_enabled;
      if (se) se.checked = !!d.status_enabled;

      const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      f('sched-periodic-dest', d.periodic_dest);
      f('sched-status-dest',   d.status_dest);

      const dsel = document.getElementById('sched-periodic-days');
      if (dsel) dsel.value = d.periodic_days || 30;

      const ee = document.getElementById('sched-expired-enabled');
      if (ee) ee.checked = !!d.expired_enabled;

      f('sched-expired-dest', d.expired_dest);

      const edsel = document.getElementById('sched-expired-days');
      if (edsel) edsel.value = d.expired_days || 30;

      const pl = document.getElementById('sched-periodic-last');
      if (pl) pl.textContent = d.periodic_last
        ? 'Último envio: ' + _fmtTs(d.periodic_last)
        : 'Nenhum envio registrado.';

      const sl = document.getElementById('sched-status-last');
      if (sl) sl.textContent = d.status_last
        ? 'Último alerta: ' + _fmtDate(d.status_last)
        : 'Nenhum alerta enviado.';

      const el = document.getElementById('sched-expired-last');
      if (el) el.textContent = d.expired_last
        ? 'Último envio: ' + _fmtTs(d.expired_last)
        : 'Nenhum envio registrado.';

      _syncPeriodicBody();
      _syncStatusBody();
      _syncExpiredBody();
    });
}

function onSchedPeriodicToggle() { _syncPeriodicBody(); }
function onSchedStatusToggle()   { _syncStatusBody(); }
function onSchedExpiredToggle()  { _syncExpiredBody(); }

function _syncPeriodicBody() {
  const cb   = document.getElementById('sched-periodic-enabled');
  const body = document.getElementById('sched-periodic-body');
  if (cb && body) body.style.display = cb.checked ? 'block' : 'none';
}

function _syncStatusBody() {
  const cb   = document.getElementById('sched-status-enabled');
  const body = document.getElementById('sched-status-body');
  if (cb && body) body.style.display = cb.checked ? 'block' : 'none';
}

function _syncExpiredBody() {
  const cb   = document.getElementById('sched-expired-enabled');
  const body = document.getElementById('sched-expired-body');
  if (cb && body) body.style.display = cb.checked ? 'block' : 'none';
}

function saveSchedConfig() {
  const periodic_enabled = document.getElementById('sched-periodic-enabled')?.checked || false;
  const status_enabled   = document.getElementById('sched-status-enabled')?.checked   || false;
  const expired_enabled  = document.getElementById('sched-expired-enabled')?.checked  || false;
  const periodic_dest    = document.getElementById('sched-periodic-dest')?.value.trim() || '';
  const status_dest      = document.getElementById('sched-status-dest')?.value.trim()   || '';
  const expired_dest     = document.getElementById('sched-expired-dest')?.value.trim()  || '';
  const periodic_days    = parseInt(document.getElementById('sched-periodic-days')?.value, 10) || 30;
  const expired_days     = parseInt(document.getElementById('sched-expired-days')?.value, 10)  || 30;
  const status = document.getElementById('sched-save-status');
  status.textContent = 'Salvando...';
  status.style.color = 'var(--text3)';
  fetch('/api/schedule/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodic_enabled, periodic_days, periodic_dest, status_enabled, status_dest, expired_enabled, expired_days, expired_dest })
  })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        status.style.color = 'var(--green, #10b981)';
        status.textContent = 'Salvo.';
        _schedLoaded = false;
        loadSchedConfig();
      } else {
        status.style.color = 'var(--red, #ef4444)';
        status.textContent = d.error || 'Erro ao salvar.';
      }
      setTimeout(() => { status.textContent = ''; }, 3000);
    });
}

function _fmtTs(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit' });
  } catch { return iso; }
}

function _fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
