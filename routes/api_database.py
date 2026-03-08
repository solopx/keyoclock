"""
routes/api_database.py
Informações, exportação, importação, criptografia e purge do banco de dados SQLite (admin only).
"""
import os
import sqlite3
import shutil
import tempfile
from datetime import date
from flask import Blueprint, jsonify, request, send_file, after_this_request
from database.auth import admin_required, login_required
from database.db import (DB_PATH, qone, execute,
                         derive_enc_key, encrypt_val, decrypt_val,
                         get_enc_key, set_enc_key, _ENC_PREFIX)
from database import ratelimit
from cryptography.fernet import Fernet

db_info_bp = Blueprint('db_info', __name__)

_REQUIRED_TABLES = {'user', 'division', 'device_list', 'inventory_item', 'license', 'audit_log'}


def _size_human(size_bytes):
    if size_bytes < 1024:
        return f'{size_bytes} B'
    if size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.1f} KB'
    return f'{size_bytes / (1024 * 1024):.1f} MB'


@db_info_bp.route('/api/database/info')
@admin_required
def db_info():
    abs_path = os.path.abspath(DB_PATH)
    if os.path.exists(abs_path):
        size = os.path.getsize(abs_path)
    else:
        size = 0
    return jsonify({
        'path':       abs_path,
        'size_bytes': size,
        'size_human': _size_human(size),
    })


@db_info_bp.route('/api/database/export')
@admin_required
def db_export():
    ip = request.remote_addr or '0.0.0.0'
    if not ratelimit.check(f'db_export:{ip}', max_calls=5, window=60):
        return jsonify({'error': 'Muitas requisições. Aguarde um momento.'}), 429
    abs_path = os.path.abspath(DB_PATH)
    if not os.path.exists(abs_path):
        return jsonify({'error': 'Banco de dados não encontrado.'}), 404

    tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        src = sqlite3.connect(abs_path)
        dst = sqlite3.connect(tmp_path)
        src.backup(dst)
        dst.close()
        src.close()
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        return jsonify({'error': 'Erro ao gerar o backup. Tente novamente.'}), 500

    filename = f'key-oclock-backup-{date.today().isoformat()}.db'

    @after_this_request
    def _cleanup(response):
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        return response

    return send_file(tmp_path, as_attachment=True, download_name=filename,
                     mimetype='application/octet-stream')


@db_info_bp.route('/api/database/import', methods=['POST'])
@admin_required
def db_import():
    db_file = request.files.get('db_file')
    if not db_file:
        return jsonify({'error': 'Envie o arquivo do banco de dados.'}), 400

    MAX_SIZE = 50 * 1024 * 1024
    data = db_file.read(MAX_SIZE + 1)
    if len(data) > MAX_SIZE:
        return jsonify({'error': 'Arquivo muito grande. Máximo 50 MB.'}), 400

    if not data[:16] == b'SQLite format 3\x00':
        return jsonify({'error': 'Arquivo inválido. Envie um banco de dados SQLite (.db).'}), 400

    tmp = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    tmp_path = tmp.name
    try:
        tmp.write(data)
        tmp.close()
        conn = sqlite3.connect(tmp_path)
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        conn.close()
        if not _REQUIRED_TABLES.issubset(tables):
            os.unlink(tmp_path)
            return jsonify({'error': 'Banco incompatível com esta versão do Key O\'Clock.'}), 400
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        return jsonify({'error': 'Erro ao validar o arquivo. Tente novamente.'}), 500

    abs_path = os.path.abspath(DB_PATH)
    bak_path = abs_path + '.bak'
    try:
        if os.path.exists(abs_path):
            shutil.copy2(abs_path, bak_path)
        shutil.move(tmp_path, abs_path)
        return jsonify({'ok': True, 'message': 'Banco importado com sucesso. Backup salvo como keyoclock.db.bak.'})
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        return jsonify({'error': 'Erro ao salvar o banco. Verifique as permissões do diretório de dados.'}), 500


@db_info_bp.route('/api/database/encryption/status')
@login_required
def enc_status():
    configured = qone("SELECT value FROM app_config WHERE key='db_encrypt_salt'", ()) is not None
    active     = get_enc_key() is not None if configured else False
    return jsonify({'configured': configured, 'active': active})


@db_info_bp.route('/api/database/encryption/setup', methods=['POST'])
@admin_required
def enc_setup():
    data         = request.get_json(silent=True) or {}
    password     = data.get('password', '')
    confirm      = data.get('confirm', '')
    old_password = data.get('old_password', '')

    if len(password) < 8:
        return jsonify({'error': 'Senha deve ter ao menos 8 caracteres.'}), 400
    if password != confirm:
        return jsonify({'error': 'As senhas não coincidem.'}), 400

    salt_row = qone("SELECT value FROM app_config WHERE key='db_encrypt_salt'", ())

    if salt_row:
        salt    = bytes.fromhex(salt_row['value'])
        old_key = derive_enc_key(old_password, salt)
        verify  = qone("SELECT value FROM app_config WHERE key='db_encrypt_verify'", ())
        try:
            Fernet(old_key).decrypt(verify['value'][len(_ENC_PREFIX):].encode())
        except Exception:
            return jsonify({'error': 'Senha atual incorreta.'}), 403
        new_key = derive_enc_key(password, salt)
        pwd_row = qone("SELECT value FROM app_config WHERE key='email_password'", ())
        if pwd_row and pwd_row['value'].startswith(_ENC_PREFIX):
            plain = decrypt_val(old_key, pwd_row['value'])
            execute("INSERT OR REPLACE INTO app_config (key, value) VALUES ('email_password', ?)",
                    (encrypt_val(new_key, plain),))
    else:
        salt    = os.urandom(32)
        new_key = derive_enc_key(password, salt)
        execute("INSERT OR REPLACE INTO app_config (key, value) VALUES ('db_encrypt_salt', ?)", (salt.hex(),))
        pwd_row = qone("SELECT value FROM app_config WHERE key='email_password'", ())
        if pwd_row and not pwd_row['value'].startswith(_ENC_PREFIX):
            execute("INSERT OR REPLACE INTO app_config (key, value) VALUES ('email_password', ?)",
                    (encrypt_val(new_key, pwd_row['value']),))

    execute("INSERT OR REPLACE INTO app_config (key, value) VALUES ('db_encrypt_verify', ?)",
            (encrypt_val(new_key, 'key-oclock-verify'),))
    set_enc_key(new_key)
    return jsonify({'ok': True})


@db_info_bp.route('/api/database/encryption/restore', methods=['POST'])
@admin_required
def enc_restore():
    data     = request.get_json(silent=True) or {}
    password = data.get('password', '')
    salt_row = qone("SELECT value FROM app_config WHERE key='db_encrypt_salt'", ())
    if not salt_row:
        return jsonify({'error': 'Criptografia não configurada.'}), 400
    salt   = bytes.fromhex(salt_row['value'])
    key    = derive_enc_key(password, salt)
    verify = qone("SELECT value FROM app_config WHERE key='db_encrypt_verify'", ())
    try:
        Fernet(key).decrypt(verify['value'][len(_ENC_PREFIX):].encode())
    except Exception:
        return jsonify({'error': 'Senha incorreta.'}), 403
    set_enc_key(key)
    return jsonify({'ok': True})


@db_info_bp.route('/api/database/purge', methods=['GET', 'POST'])
@admin_required
def db_purge():
    if request.method == 'GET':
        deleted_days = max(1, int(request.args.get('deleted_days', 30)))
        audit_days   = int(request.args.get('audit_days', 365))
        cutoff       = f'-{deleted_days} days'
        return jsonify({
            'licenses':     qone("SELECT COUNT(*) c FROM license        WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))['c'],
            'items':        qone("SELECT COUNT(*) c FROM inventory_item WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))['c'],
            'lists':        qone("SELECT COUNT(*) c FROM device_list    WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))['c'],
            'divisions':    qone("SELECT COUNT(*) c FROM division       WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))['c'],
            'audit_log':    qone("SELECT COUNT(*) c FROM audit_log WHERE created_at < datetime('now', ?)", (f'-{audit_days} days',))['c'],
            'deleted_days': deleted_days,
            'audit_days':   audit_days,
        })

    data         = request.get_json(silent=True) or {}
    deleted_days = max(1, int(data.get('deleted_days', 30)))
    audit_days   = int(data.get('audit_days', 365))
    cutoff       = f'-{deleted_days} days'

    try:
        execute("DELETE FROM license        WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))
        execute("DELETE FROM inventory_item WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))
        execute("DELETE FROM device_list    WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))
        execute("DELETE FROM division       WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)", (cutoff,))
        execute("DELETE FROM audit_log WHERE created_at < datetime('now', ?)", (f'-{audit_days} days',))
        conn = sqlite3.connect(os.path.abspath(DB_PATH))
        conn.execute("VACUUM")
        conn.close()
        return jsonify({'ok': True})
    except Exception:
        return jsonify({'error': 'Erro ao executar limpeza.'}), 500
