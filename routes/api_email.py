"""
routes/api_email.py
Configuração de servidor SMTP e envio de e-mail de teste (admin only).
"""
import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
from flask import Blueprint, jsonify, request
from database.auth import admin_required
from database.db import cfg_get, cfg_set, encrypt_val, decrypt_val, get_enc_key
from database import ratelimit

email_bp = Blueprint('email', __name__)

_KEYS = ('email_host', 'email_port', 'email_user', 'email_password',
         'email_from', 'email_display_name')


@email_bp.route('/api/email/config')
@admin_required
def get_email_config():
    raw_pwd = cfg_get('email_password')
    plain   = decrypt_val(get_enc_key(), raw_pwd)
    return jsonify({
        'host':         cfg_get('email_host'),
        'port':         int(cfg_get('email_port') or 587),
        'user':         cfg_get('email_user'),
        'has_password': bool(plain),
        'from_email':   cfg_get('email_from'),
        'display_name': cfg_get('email_display_name'),
    })


@email_bp.route('/api/email/config', methods=['POST'])
@admin_required
def save_email_config():
    data = request.get_json(silent=True) or {}
    host = str(data.get('host', '')).strip()
    try:
        port = int(data.get('port', 587))
        if not (1 <= port <= 65535):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Porta inválida. Use um valor entre 1 e 65535.'}), 400

    if not host:
        return jsonify({'error': 'Informe o endereço do servidor SMTP.'}), 400
    if len(host) > 253:
        return jsonify({'error': 'Endereço do servidor inválido.'}), 400

    user         = str(data.get('user', '')).strip()
    password     = str(data.get('password', ''))
    from_email   = str(data.get('from_email', '')).strip()
    display_name = str(data.get('display_name', '')).strip()

    if from_email and (len(from_email) > 254 or '@' not in from_email):
        return jsonify({'error': 'E-mail do remetente inválido.'}), 400
    if len(user) > 254 or len(display_name) > 100:
        return jsonify({'error': 'Campo com valor inválido.'}), 400

    try:
        cfg_set('email_host', host)
        cfg_set('email_port', str(port))
        cfg_set('email_user', user)
        if password:
            key = get_enc_key()
            cfg_set('email_password', encrypt_val(key, password) if key else password)
        cfg_set('email_from', from_email)
        cfg_set('email_display_name', display_name)
        return jsonify({'ok': True})
    except Exception:
        return jsonify({'error': 'Erro ao salvar configuração.'}), 500


@email_bp.route('/api/email/test', methods=['POST'])
@admin_required
def test_email():
    ip = request.remote_addr or '0.0.0.0'
    if not ratelimit.check(ip, max_calls=5, window=60):
        return jsonify({'error': 'Muitas tentativas. Aguarde 1 minuto.'}), 429
    data = request.get_json(silent=True) or {}
    host     = str(data.get('host', '')).strip()
    to_addr  = str(data.get('to', '')).strip()
    try:
        port = int(data.get('port', 587))
        if not (1 <= port <= 65535):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Porta inválida.'}), 400

    if not host:
        return jsonify({'error': 'Configure o servidor SMTP antes de enviar.'}), 400
    if not to_addr or '@' not in to_addr:
        return jsonify({'error': 'Informe um endereço de e-mail válido para o destinatário.'}), 400
    if len(to_addr) > 254:
        return jsonify({'error': 'Endereço do destinatário inválido.'}), 400

    user         = str(data.get('user', '')).strip()
    password     = str(data.get('password', '')) or decrypt_val(get_enc_key(), cfg_get('email_password'))
    from_email   = str(data.get('from_email', '')).strip() or cfg_get('email_from') or f'noreply@{host}'
    display_name = str(data.get('display_name', '')).strip() or cfg_get('email_display_name') or 'Key O\'Clock'

    msg = MIMEText('Este é um e-mail de teste enviado pelo Key O\'Clock.')
    msg['Subject'] = 'Key O\'Clock — Teste de e-mail'
    msg['From']    = formataddr((display_name, from_email))
    msg['To']      = to_addr

    try:
        if port == 465:
            ctx = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            ctx = smtplib.SMTP(host, port, timeout=10)
            if port == 587:
                ctx.starttls()

        with ctx as smtp:
            if user and password:
                smtp.login(user, password)
            smtp.sendmail(msg['From'], [to_addr], msg.as_string())
        return jsonify({'ok': True, 'message': f'E-mail enviado para {to_addr}.'})
    except smtplib.SMTPException:
        return jsonify({'error': 'Erro ao enviar e-mail. Verifique as configurações SMTP.'}), 502
    except OSError:
        return jsonify({'error': 'Não foi possível conectar ao servidor SMTP. Verifique o endereço e a porta.'}), 502
    except Exception:
        return jsonify({'error': 'Erro interno. Tente novamente.'}), 500
