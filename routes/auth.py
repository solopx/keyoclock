"""
routes/auth.py
Rotas de autenticação: login, logout e proteção contra brute-force.
"""
import time
from collections import defaultdict
from flask import Blueprint, request, jsonify, redirect, url_for, session, render_template
from werkzeug.security import check_password_hash
from database.db import qone
from database.auth import login_required

auth_bp = Blueprint('auth', __name__)

# ── Rate limiting simples em memória ─────────────────────────────────────────
# Estrutura: { ip: [timestamp, timestamp, ...] }
_login_attempts: dict = defaultdict(list)
MAX_ATTEMPTS    = 10        # tentativas por janela
WINDOW_SECONDS  = 300       # janela de 5 minutos
LOCKOUT_SECONDS = 600       # bloqueio de 10 minutos após exceder


def _check_rate_limit(ip: str) -> tuple[bool, int]:
    """Retorna (permitido, segundos_restantes)."""
    now   = time.time()

    # Mantém apenas tentativas dentro da janela; remove a chave se ficou vazia
    fresh = [t for t in _login_attempts.get(ip, []) if now - t < WINDOW_SECONDS]
    if fresh:
        _login_attempts[ip] = fresh
    elif ip in _login_attempts:
        del _login_attempts[ip]   # evita crescimento indefinido do dict

    if len(fresh) >= MAX_ATTEMPTS:
        oldest = fresh[0]
        wait   = int(LOCKOUT_SECONDS - (now - oldest))
        return False, max(wait, 0)

    return True, 0


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        ip      = request.remote_addr or '0.0.0.0'
        allowed, wait = _check_rate_limit(ip)

        if not allowed:
            return jsonify({
                'error': f'Muitas tentativas. Aguarde {wait} segundos.'
            }), 429

        data = request.json or {}
        user = qone("SELECT * FROM user WHERE username = ?", (data.get('username'),))

        if user and check_password_hash(user['password_hash'], data.get('password', '')) and user['active']:
            # Login bem-sucedido: remove entrada do dict, marca sessão como permanente
            _login_attempts.pop(ip, None)
            session.permanent = True           # respeita PERMANENT_SESSION_LIFETIME
            session['user_id']  = user['id']
            session['username'] = user['username']
            session['role']     = user['role']

            return jsonify({
                'success': True,
                'must_change_password': bool(user.get('must_change_password')),
                'user_id': user['id'],
            })

        # Login falhou: registra tentativa
        _login_attempts[ip].append(time.time())
        return jsonify({'success': False, 'error': 'Credenciais inválidas.'})

    return render_template('login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    session.clear()
    return redirect(url_for('auth.login'))
