/**
 * static/js/api.js
 * Wrapper centralizado para chamadas à API REST.
 */

/* ─── TOAST ──────────────────────────────────────────────────────────────── */

function showToast(msg, type = 'error') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'forbidden' ? '🔒' : '⚠';
  const label = type === 'forbidden' ? 'Acesso Negado' : 'Erro';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><div class="toast-body"><strong>${label}</strong><span>${escapeHTML(msg)}</span></div>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 4500);
}

/* ─── API WRAPPER ────────────────────────────────────────────────────────── */

async function api(method, url, body) {
  const res  = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body:    body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data.error || `Erro ${res.status}`;
    showToast(err, res.status === 403 ? 'forbidden' : 'error');
    throw new Error(err);
  }
  return data;
}
