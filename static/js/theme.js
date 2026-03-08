/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — theme.js
   Sistema de temas persistido via localStorage + data-theme em <html>.
   Nota: a aplicação inicial do tema (para evitar flash) é feita por um
   <script> inline no <head> de app.html, antes do carregamento do CSS.
   As chaves de localStorage são prefixadas pelo nome do usuário logado para
   garantir preferências independentes por usuário.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Namespace por usuário ──────────────────────────────────────────────── */
const _USER = (document.querySelector('meta[name="session-user"]')?.content || '').trim();
function _key(name) {
  return _USER ? `keyoclock-${name}-${_USER}` : `keyoclock-${name}`;
}

/* ── Tema ───────────────────────────────────────────────────────────────── */
function getTheme() {
  return localStorage.getItem(_key('theme')) || 'dark';
}

function setTheme(name) {
  localStorage.setItem(_key('theme'), name);
  if (name === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', name);
  }
  _syncThemeControls(name);
}

function _syncThemeControls(name) {
  document.querySelectorAll('.theme-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.theme === name)
  );
}

/* ── Estilo de relógio ──────────────────────────────────────────────────── */
function getClockStyle() {
  return localStorage.getItem(_key('clock')) || 'ring';
}

function setClockStyle(name) {
  localStorage.setItem(_key('clock'), name);
  _syncClockControls(name);
  renderExpiryClock();
}

function _syncClockControls(name) {
  document.querySelectorAll('.clock-style-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.clock === name)
  );
}

/* ── Tamanho de fonte ───────────────────────────────────────────────────── */
const _FONT_STEPS = ['sm', 'md', 'lg'];
const _FONT_LABELS = { sm: 'Pequeno', md: 'Normal', lg: 'Grande' };

function getFontSize() {
  return localStorage.getItem(_key('fontsize')) || 'md';
}

function setFontSize(delta) {
  const cur  = _FONT_STEPS.indexOf(getFontSize());
  const next = Math.max(0, Math.min(_FONT_STEPS.length - 1, cur + delta));
  const val  = _FONT_STEPS[next];
  localStorage.setItem(_key('fontsize'), val);
  if (val === 'md') document.documentElement.removeAttribute('data-fontsize');
  else              document.documentElement.setAttribute('data-fontsize', val);
  _syncFontControls(val);
}

function _syncFontControls(val) {
  const el   = document.getElementById('font-size-label');
  const btnM = document.getElementById('font-btn-minus');
  const btnP = document.getElementById('font-btn-plus');
  if (el)   el.textContent = _FONT_LABELS[val] || 'Normal';
  if (btnM) btnM.disabled  = (val === 'sm');
  if (btnP) btnP.disabled  = (val === 'lg');
}

/* ── Sincronização global ───────────────────────────────────────────────── */
function syncSettings() {
  _syncThemeControls(getTheme());
  _syncClockControls(getClockStyle());
  _syncFontControls(getFontSize());
  const panel = document.getElementById('personalization-panel');
  const card  = document.getElementById('personalization-card');
  if (panel) panel.style.display = 'none';
  if (card)  card.classList.remove('settings-entry-open');
  const certPanel = document.getElementById('cert-panel');
  const certCard  = document.getElementById('cert-card');
  if (certPanel) certPanel.style.display = 'none';
  if (certCard)  certCard.classList.remove('settings-entry-open');
  const emailPanel = document.getElementById('email-panel');
  const emailCard  = document.getElementById('email-card');
  if (emailPanel) emailPanel.style.display = 'none';
  if (emailCard)  emailCard.classList.remove('settings-entry-open');
  const dbPanel = document.getElementById('db-panel');
  const dbCard  = document.getElementById('db-card');
  if (dbPanel) dbPanel.style.display = 'none';
  if (dbCard)  dbCard.classList.remove('settings-entry-open');
  const schedPanel = document.getElementById('sched-panel');
  const schedCard  = document.getElementById('sched-card');
  if (schedPanel) schedPanel.style.display = 'none';
  if (schedCard)  schedCard.classList.remove('settings-entry-open');
}

function togglePersonalization() {
  const panel = document.getElementById('personalization-panel');
  const card  = document.getElementById('personalization-card');
  if (!panel || !card) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  card.classList.toggle('settings-entry-open', !open);
  if (!open) {
    const cp = document.getElementById('cert-panel');
    const cc = document.getElementById('cert-card');
    if (cp) cp.style.display = 'none';
    if (cc) {
      cc.classList.remove('settings-entry-open');
      const ch = cc.querySelector('.cert-chevron');
      if (ch) ch.style.transform = '';
    }
    const ep = document.getElementById('email-panel');
    const ec = document.getElementById('email-card');
    if (ep) ep.style.display = 'none';
    if (ec) {
      ec.classList.remove('settings-entry-open');
      const eh = ec.querySelector('.email-chevron');
      if (eh) eh.style.transform = '';
    }
    const dp = document.getElementById('db-panel');
    const dc = document.getElementById('db-card');
    if (dp) dp.style.display = 'none';
    if (dc) {
      dc.classList.remove('settings-entry-open');
      const dh = dc.querySelector('.db-chevron');
      if (dh) dh.style.transform = '';
    }
    const sp = document.getElementById('sched-panel');
    const sc = document.getElementById('sched-card');
    if (sp) sp.style.display = 'none';
    if (sc) {
      sc.classList.remove('settings-entry-open');
      const sh = sc.querySelector('.sched-chevron');
      if (sh) sh.style.transform = '';
    }
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    _syncThemeControls(getTheme());
    _syncClockControls(getClockStyle());
    _syncFontControls(getFontSize());
  }
}
