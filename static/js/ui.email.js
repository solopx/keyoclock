/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.email.js
   Painel de configuração SMTP nas configurações: carrega, salva e testa
   envio de e-mail. Depende de: showToast (api.js).
   ═══════════════════════════════════════════════════════════════════════════ */

let _emailLoaded = false;

function toggleEmail() {
  const panel = document.getElementById('email-panel');
  const card  = document.getElementById('email-card');
  if (!panel || !card) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  card.classList.toggle('settings-entry-open', !open);
  const ch = card.querySelector('.email-chevron');
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
    const sp = document.getElementById('sched-panel');
    const sc = document.getElementById('sched-card');
    if (sp) sp.style.display = 'none';
    if (sc) {
      sc.classList.remove('settings-entry-open');
      const sh = sc.querySelector('.sched-chevron');
      if (sh) sh.style.transform = '';
    }
    if (!_emailLoaded) { loadEmailConfig(); _emailLoaded = true; }
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }
}

function loadEmailConfig() {
  fetch('/api/email/config')
    .then(r => r.json())
    .then(d => {
      const f = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
      f('email-host',         d.host);
      f('email-port',         d.port || 587);
      f('email-user',         d.user);
      f('email-from',         d.from_email);
      f('email-display-name', d.display_name);
      const pwd = document.getElementById('email-password');
      if (pwd) pwd.placeholder = d.has_password ? '••••••••' : 'Deixe em branco para manter';
    });
}

function saveEmailConfig() {
  const host        = document.getElementById('email-host').value.trim();
  const port        = parseInt(document.getElementById('email-port').value, 10);
  const user        = document.getElementById('email-user').value.trim();
  const password    = document.getElementById('email-password').value;
  const from_email  = document.getElementById('email-from').value.trim();
  const display_name = document.getElementById('email-display-name').value.trim();
  const status = document.getElementById('email-save-status');
  status.textContent = 'Salvando...';
  status.style.color = 'var(--text3)';
  fetch('/api/email/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, user, password, from_email, display_name })
  })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        status.style.color = 'var(--green, #10b981)';
        status.textContent = 'Salvo.';
        _emailLoaded = false;
        loadEmailConfig();
      } else {
        status.style.color = 'var(--red, #ef4444)';
        status.textContent = d.error || 'Erro ao salvar.';
      }
      setTimeout(() => { status.textContent = ''; }, 3000);
    });
}

function sendTestEmail() {
  const host         = document.getElementById('email-host').value.trim();
  const port         = parseInt(document.getElementById('email-port').value, 10);
  const user         = document.getElementById('email-user').value.trim();
  const password     = document.getElementById('email-password').value;
  const from_email   = document.getElementById('email-from').value.trim();
  const display_name = document.getElementById('email-display-name').value.trim();
  const to           = document.getElementById('email-test-to').value.trim();
  const status = document.getElementById('email-test-status');
  status.style.color = 'var(--text3)';
  status.textContent = 'Enviando...';
  fetch('/api/email/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, user, password, from_email, display_name, to })
  })
    .then(r => r.json())
    .then(d => {
      if (d.ok) {
        status.style.color = 'var(--green, #10b981)';
        status.textContent = d.message || 'Enviado.';
      } else {
        status.style.color = 'var(--red, #ef4444)';
        status.textContent = d.error || 'Erro no envio.';
      }
    });
}
