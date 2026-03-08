"""
database/auth.py
Decoradores de autenticação reutilizáveis.
"""
from functools import wraps
from flask import session, redirect, url_for, jsonify


def login_required(f):
    """Redireciona para /login se o usuário não estiver autenticado."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Retorna 403 se o usuário não for administrador."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        if session.get('role') != 'admin':
            return jsonify({'error': 'Acesso restrito a administradores'}), 403
        return f(*args, **kwargs)
    return decorated
