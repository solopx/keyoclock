"""
routes/api_certificates.py
Informações do certificado TLS auto-assinado (admin only).
O certificado é gerado em database/certs.py e usado via ssl_context no app.py.
"""
import os
from flask import Blueprint, jsonify, request
from database.auth import admin_required
from database.certs import gen_cert, get_cert_info, CERT_PEM, KEY_PEM
from database import ratelimit

cert_bp = Blueprint('certificates', __name__)


@cert_bp.route('/api/certificates/status')
@admin_required
def cert_status():
    https_active = request.is_secure or request.headers.get('X-Forwarded-Proto') == 'https'
    info = get_cert_info()
    return jsonify({
        'https_active': https_active,
        'cert_info':    info,
    })


@cert_bp.route('/api/certificates/generate', methods=['POST'])
@admin_required
def regenerate_cert():
    ip = request.remote_addr or '0.0.0.0'
    if not ratelimit.check(f'cert_gen:{ip}', max_calls=3, window=60):
        return jsonify({'error': 'Muitas requisições. Aguarde um momento.'}), 429
    try:
        gen_cert(force=True)
        info = get_cert_info()
        return jsonify({'ok': True, 'cert_info': info})
    except Exception:
        return jsonify({'error': 'Erro ao gerar certificado.'}), 500


@cert_bp.route('/api/certificates/upload', methods=['POST'])
@admin_required
def upload_cert():
    cert_file = request.files.get('cert_file')
    key_file  = request.files.get('key_file')

    if not cert_file or not key_file:
        return jsonify({'error': 'Envie os dois arquivos: cert_file e key_file.'}), 400

    MAX_SIZE = 64 * 1024
    cert_data = cert_file.read(MAX_SIZE + 1)
    key_data  = key_file.read(MAX_SIZE + 1)

    if len(cert_data) > MAX_SIZE or len(key_data) > MAX_SIZE:
        return jsonify({'error': 'Arquivo muito grande. Máximo 64 KB por arquivo.'}), 400

    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
        x509.load_pem_x509_certificate(cert_data, default_backend())
    except Exception:
        return jsonify({'error': 'Certificado inválido. Envie um arquivo PEM válido.'}), 400

    try:
        load_pem_private_key(key_data, password=None)
    except Exception:
        return jsonify({'error': 'Chave privada inválida. Envie um arquivo PEM válido (sem senha).'}), 400

    try:
        os.makedirs(os.path.dirname(CERT_PEM), exist_ok=True)
        with open(CERT_PEM, 'wb') as f:
            f.write(cert_data)
        with open(KEY_PEM, 'wb') as f:
            f.write(key_data)
        info = get_cert_info()
        return jsonify({'ok': True, 'cert_info': info})
    except Exception:
        return jsonify({'error': 'Erro ao salvar arquivos. Verifique as permissões do diretório de dados.'}), 500
