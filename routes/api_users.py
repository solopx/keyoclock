"""
routes/api_users.py
API de gerenciamento de usuários (CRUD).
"""
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash
from database.db import qall, qone, execute
from database.auth import admin_required
from database.helpers import validate_input

users_bp = Blueprint('users', __name__)


@users_bp.route('/api/users', methods=['GET'])
@admin_required
def list_users():
    users = qall("SELECT id, username, email, role, active, created_at FROM user")
    for u in users:
        u['created_at'] = (u['created_at'] or '')[:10]
    return jsonify(users)


@users_bp.route('/api/users', methods=['POST'])
@admin_required
def create_user():
    data = request.json or {}
    err = validate_input(
        usuário=(data.get('username', ''), 64),
        email=(data.get('email', ''), 255),
    )
    if err: return jsonify({'error': err}), 400
    pwd = data.get('password', '')
    if data.get('role', 'user') not in ('user', 'admin'):
        return jsonify({'error': 'Perfil inválido.'}), 400
    if not (8 <= len(pwd) <= 128):
        return jsonify({'error': 'A senha deve ter entre 8 e 128 caracteres.'}), 400
    if qone("SELECT id FROM user WHERE username = ?", (data.get('username'),)):
        return jsonify({'error': 'Usuário já existe'}), 400
    execute(
        "INSERT INTO user (username, password_hash, email, role) VALUES (?, ?, ?, ?)",
        (data['username'], generate_password_hash(data['password']),
         data.get('email', ''), data.get('role', 'user'))
    )
    return jsonify({'success': True})


@users_bp.route('/api/users/<int:uid>', methods=['PUT'])
@admin_required
def update_user(uid):
    data = request.json or {}
    err = validate_input(email=(data.get('email', ''), 255))
    if err: return jsonify({'error': err}), 400
    if data.get('role', 'user') not in ('user', 'admin'):
        return jsonify({'error': 'Perfil inválido.'}), 400
    if data.get('password') and not (8 <= len(data['password']) <= 128):
        return jsonify({'error': 'A senha deve ter entre 8 e 128 caracteres.'}), 400
    active = 1 if data.get('active', True) else 0
    if data.get('password'):
        execute(
            "UPDATE user SET email = ?, role = ?, active = ?, password_hash = ? WHERE id = ?",
            (data.get('email', ''), data.get('role', 'user'), active,
             generate_password_hash(data['password']), uid)
        )
        _user = qone("SELECT must_change_password FROM user WHERE id = ?", (uid,))
        if _user and _user.get('must_change_password'):
            execute("UPDATE user SET must_change_password = 0 WHERE id = ?", (uid,))
    else:
        execute(
            "UPDATE user SET email = ?, role = ?, active = ? WHERE id = ?",
            (data.get('email', ''), data.get('role', 'user'), active, uid)
        )
    return jsonify({'success': True})


@users_bp.route('/api/users/<int:uid>', methods=['DELETE'])
@admin_required
def delete_user(uid):
    if uid == session.get('user_id'):
        return jsonify({'error': 'Não é possível excluir seu próprio usuário'}), 400
    target = qone("SELECT role, active FROM user WHERE id = ?", (uid,))
    if not target:
        return jsonify({'error': 'Usuário não encontrado'}), 404
    if target['role'] == 'admin':
        remaining = qone("SELECT COUNT(*) as c FROM user WHERE role='admin' AND active=1 AND id != ?", (uid,))
        if not remaining or remaining['c'] == 0:
            return jsonify({'error': 'Não é possível excluir o único administrador ativo do sistema'}), 400
    remaining_users = qone("SELECT COUNT(*) as c FROM user WHERE active=1 AND id != ?", (uid,))
    if not remaining_users or remaining_users['c'] == 0:
        return jsonify({'error': 'Não é possível excluir o único usuário ativo do sistema'}), 400
    execute("DELETE FROM user WHERE id = ?", (uid,))
    return jsonify({'success': True})
