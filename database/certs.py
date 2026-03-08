"""
database/certs.py
Geração e leitura de certificado TLS auto-assinado usando cryptography.
"""
import os
import datetime
import ipaddress
import socket

import sys as _sys
if getattr(_sys, 'frozen', False):
    _DEFAULT_DATA_DIR = os.path.join(
        os.environ.get('PROGRAMDATA', 'C:\\ProgramData'), 'Key O\'Clock'
    )
else:
    _DEFAULT_DATA_DIR = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', 'instance')
    )
_DATA_DIR = os.environ.get('KEYOCLOCK_DATA_DIR', _DEFAULT_DATA_DIR)
_CERTS_DIR = os.path.join(_DATA_DIR, 'certs')
CERT_PEM   = os.path.normpath(os.path.join(_CERTS_DIR, 'cert.pem'))
KEY_PEM    = os.path.normpath(os.path.join(_CERTS_DIR, 'key.pem'))


def _local_ips():
    ips = [ipaddress.ip_address('127.0.0.1')]
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            try:
                ip = ipaddress.ip_address(info[4][0])
                if ip not in ips:
                    ips.append(ip)
            except (ValueError, IndexError):
                pass
    except Exception:
        pass
    return ips


def gen_cert(days=825, force=False):
    """Gera certificado auto-assinado com SAN para localhost e IPs locais.
    O prazo máximo aceito por browsers modernos é 825 dias.
    Não regenera se já existir, a menos que force=True.
    """
    if not force and os.path.exists(CERT_PEM) and os.path.exists(KEY_PEM):
        return

    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    os.makedirs(_CERTS_DIR, exist_ok=True)

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    hostname = socket.gethostname()
    san_dns  = [x509.DNSName('localhost')]
    if hostname and hostname != 'localhost':
        san_dns.append(x509.DNSName(hostname))
    san_ips  = [x509.IPAddress(ip) for ip in _local_ips()]

    now  = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, 'localhost'),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Key O'Clock"),
        ]))
        .issuer_name(x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, 'localhost'),
        ]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + datetime.timedelta(days=days))
        .add_extension(
            x509.SubjectAlternativeName(san_dns + san_ips),
            critical=False,
        )
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )

    with open(KEY_PEM, 'wb') as f:
        f.write(key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ))
    with open(CERT_PEM, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print(f"Certificado auto-assinado gerado em: {CERT_PEM}")


def get_cert_info():
    """Retorna dict com informações do certificado, ou None se não existir."""
    if not os.path.exists(CERT_PEM):
        return None
    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend
        from cryptography.x509.oid import NameOID

        with open(CERT_PEM, 'rb') as f:
            cert = x509.load_pem_x509_certificate(f.read(), default_backend())

        now      = datetime.datetime.now(datetime.timezone.utc)
        expires  = cert.not_valid_after_utc
        days_left = (expires - now).days

        try:
            cn = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
        except Exception:
            cn = 'localhost'

        try:
            san_ext = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName)
            dns_names = san_ext.value.get_values_for_type(x509.DNSName)
            ip_addrs  = [str(ip) for ip in san_ext.value.get_values_for_type(x509.IPAddress)]
            san_list  = dns_names + ip_addrs
        except Exception:
            san_list = ['localhost']

        is_self_signed = cert.issuer == cert.subject

        return {
            'cert_path':      CERT_PEM,
            'key_path':       KEY_PEM,
            'cn':             cn,
            'san':            san_list,
            'expires_at':     expires.strftime('%d/%m/%Y'),
            'days_left':      days_left,
            'is_self_signed': is_self_signed,
        }
    except Exception:
        return {
            'cert_path':  CERT_PEM,
            'key_path':   KEY_PEM,
            'cn':         'localhost',
            'san':        [],
            'expires_at': None,
            'days_left':  None,
        }
