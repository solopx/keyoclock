/* ═══════════════════════════════════════════════════════════════════════════
   keyoclock — ui.admin.js
   Administração: listagem, criação e edição de usuários.
   Dependências (escopo global): openModal, closeModal (ui.utils.js),
   api (api.js).
   ═══════════════════════════════════════════════════════════════════════════ */

async function loadUsers() {
  const users = await api('GET', '/api/users');
  document.getElementById('users-table-body').innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--cyan));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">
            ${escapeHTML(u.username[0].toUpperCase())}
          </div>
          <strong>${escapeHTML(u.username)}</strong>
        </div>
      </td>
      <td class="td-trunc" style="color:var(--text3)">${u.email ? escapeHTML(u.email) : '—'}</td>
      <td><span class="badge ${u.role==='admin'?'badge-valid':'badge-unknown'}">${u.role==='admin'?'Admin':'Usuário'}</span></td>
      <td><span class="badge ${u.active?'badge-valid':'badge-expired'}">${u.active?'Ativo':'Inativo'}</span></td>
      <td style="color:var(--text3);font-family:monospace;font-size:12px">${escapeHTML(u.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="icon-btn" data-uid="${u.id}" onclick="openUserModal(+this.dataset.uid)">✏</button>
          <button class="icon-btn del" data-uid="${u.id}" data-uname="${escapeHTML(u.username)}" onclick="_confirmDeleteUser(this)">🗑</button>
        </div>
      </td>
    </tr>`).join('');
}

function openUserModal(userId) {
  ['u-username','u-email','u-password'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('u-role').value  = 'user';
  document.getElementById('user-id').value = userId||'';
  document.getElementById('user-modal-title').textContent = userId ? 'Editar Usuário' : 'Novo Usuário';
  document.getElementById('pwd-hint').textContent = userId ? '(deixe em branco para manter)' : '(obrigatória para novo usuário)';

  if (userId) {
    api('GET', '/api/users').then(users => {
      const u = users.find(x => x.id===userId);
      if (!u) return;
      document.getElementById('u-username').value = u.username;
      document.getElementById('u-email').value    = u.email||'';
      document.getElementById('u-role').value     = u.role;
    });
  }
  openModal('modal-user');
}

function _confirmDeleteUser(btn) {
  confirmDelete('user', +btn.dataset.uid, `Excluir usuário <strong>${escapeHTML(btn.dataset.uname)}</strong>?`);
}

async function saveUser() {
  const id = document.getElementById('user-id').value;
  const body = {
    username: document.getElementById('u-username').value,
    email:    document.getElementById('u-email').value,
    password: document.getElementById('u-password').value,
    role:     document.getElementById('u-role').value,
    active:   true,
  };
  if (id) await api('PUT', `/api/users/${id}`, body);
  else    await api('POST','/api/users', body);
  document.getElementById('u-password').value = '';
  closeModal('modal-user');
  loadUsers();
}
