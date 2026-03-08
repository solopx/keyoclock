/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.certificates.js
   Painel de certificados TLS nas configurações: exibe status (HTTPS ativo /
   HTTP / sem cert), permite gerar cert auto-assinado ou fazer upload de par
   cert+chave próprio. Depende de: escapeHTML (ui.utils.js), showToast (api.js).
   ═══════════════════════════════════════════════════════════════════════════ */

let _certPanelLoaded = false;

function toggleCertificates() {
  const panel = document.getElementById('cert-panel');
  const card  = document.getElementById('cert-card');
  if (!panel || !card) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  card.classList.toggle('settings-entry-open', !open);
  const chevron = card.querySelector('.cert-chevron');
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
  if (!open) {
    const pp = document.getElementById('personalization-panel');
    const pc = document.getElementById('personalization-card');
    if (pp) pp.style.display = 'none';
    if (pc) pc.classList.remove('settings-entry-open');
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
    if (!_certPanelLoaded) {
      _certPanelLoaded = true;
      loadCertStatus();
    }
  }
}

function loadCertStatus() {
  fetch('/api/certificates/status')
    .then(r => r.json())
    .then(_renderCertStatus)
    .catch(() => {
      const badge = document.getElementById('cert-status-badge');
      if (badge) badge.textContent = 'Erro ao carregar';
    });
}

function _renderCertStatus(data) {
  const badge     = document.getElementById('cert-status-badge');
  const infoBlock = document.getElementById('cert-info-block');
  const noBlock   = document.getElementById('cert-no-cert-block');

  if (badge) {
    if (data.https_active) {
      badge.textContent          = 'HTTPS Ativo';
      badge.style.background     = 'rgba(16,185,129,0.15)';
      badge.style.color          = 'var(--green)';
    } else if (data.cert_info) {
      badge.textContent          = 'HTTP (cert gerado)';
      badge.style.background     = 'rgba(99,102,241,0.15)';
      badge.style.color          = 'var(--indigo, #6366f1)';
    } else {
      badge.textContent          = 'HTTP apenas';
      badge.style.background     = 'rgba(245,158,11,0.15)';
      badge.style.color          = 'var(--yellow)';
    }
  }

  if (data.cert_info) {
    const info      = data.cert_info;
    const typeLabel = document.getElementById('cert-type-label');
    const sanEl     = document.getElementById('cert-info-san');
    const expEl     = document.getElementById('cert-info-expires');
    const pathEl    = document.getElementById('cert-info-path');
    const keyEl     = document.getElementById('cert-info-key');

    const isSelfSigned = !!info.is_self_signed;

    if (typeLabel) {
      typeLabel.textContent = isSelfSigned
        ? 'Certificado auto-assinado gerado localmente'
        : 'Certificado próprio: ' + escapeHTML(info.cn || '');
    }
    if (sanEl)  sanEl.textContent  = (info.san || []).join(', ') || info.cn || 'localhost';
    if (pathEl) pathEl.textContent = info.cert_path || '';
    if (keyEl)  keyEl.textContent  = info.key_path  || '';

    if (expEl) {
      const days  = info.days_left;
      const color = days < 30 ? 'var(--red)' : days < 90 ? 'var(--yellow)' : 'var(--green)';
      expEl.innerHTML = `${escapeHTML(info.expires_at || '')} <span style="color:${color}">(${days}d)</span>`;
    }

    if (infoBlock) infoBlock.style.display = 'block';
    if (noBlock)   noBlock.style.display   = 'none';

    _selectCertMethod(isSelfSigned ? 'auto' : 'upload');
  } else {
    if (infoBlock) infoBlock.style.display = 'none';
    if (noBlock)   noBlock.style.display   = 'block';
  }
}

function _selectCertMethod(method) {
  ['auto', 'upload', 'le'].forEach(m => {
    const card = document.getElementById('cert-method-' + m);
    const form = document.getElementById('cert-form-' + m);
    const active = m === method;
    if (card) {
      card.style.borderColor = active ? 'var(--primary, #6366f1)' : 'var(--border)';
      card.style.background  = active ? 'rgba(99,102,241,0.08)'   : '';
    }
    if (form) form.style.display = active ? 'block' : 'none';
  });
}

function _toggleTechDetails(btn) {
  const el = document.getElementById('cert-tech-details');
  if (!el) return;
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'grid';
  if (btn) btn.innerHTML = open
    ? 'Detalhes técnicos &#9656;'
    : 'Detalhes técnicos &#9662;';
}

function regenerateCert() {
  if (!confirm('Gerar novo certificado auto-assinado? O anterior será substituído.')) return;
  fetch('/api/certificates/generate', { method: 'POST' })
    .then(r => r.json())
    .then(data => {
      if (data.error) { showToast(data.error, 'error'); return; }
      _certPanelLoaded = false;
      loadCertStatus();
      showToast('Certificado gerado. Reinicie a aplicação para aplicar.', 'success');
    })
    .catch(() => showToast('Erro ao gerar certificado.', 'error'));
}

function uploadCert() {
  const certInput = document.getElementById('cert-upload-cert');
  const keyInput  = document.getElementById('cert-upload-key');
  const status    = document.getElementById('cert-upload-status');

  if (!certInput.files.length || !keyInput.files.length) {
    if (status) status.textContent = 'Selecione os dois arquivos antes de enviar.';
    return;
  }

  if (status) status.textContent = 'Enviando...';

  const form = new FormData();
  form.append('cert_file', certInput.files[0]);
  form.append('key_file',  keyInput.files[0]);

  fetch('/api/certificates/upload', { method: 'POST', body: form })
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        if (status) status.textContent = data.error;
        showToast(data.error, 'error');
        return;
      }
      if (status) status.textContent = 'Enviado com sucesso.';
      certInput.value = '';
      keyInput.value  = '';
      _certPanelLoaded = false;
      loadCertStatus();
      showToast('Certificado aplicado. Reinicie a aplicação para usar.', 'success');
    })
    .catch(() => {
      if (status) status.textContent = 'Erro ao enviar.';
      showToast('Erro ao enviar certificado.', 'error');
    });
}
