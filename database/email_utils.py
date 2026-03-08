"""
database/email_utils.py
Função auxiliar compartilhada para envio de e-mail via SMTP.
Lê a configuração armazenada em app_config.
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formataddr
from database.db import cfg_get, decrypt_val, get_enc_key


def send_email(to_addr, subject, body_html, attachment_bytes=None, attachment_name=None):
    """
    Envia e-mail usando a configuração SMTP de app_config.
    Raises: ValueError, smtplib.SMTPException, OSError
    """
    host         = cfg_get('email_host')
    port         = int(cfg_get('email_port') or 587)
    user         = cfg_get('email_user')
    password     = decrypt_val(get_enc_key(), cfg_get('email_password'))
    from_email   = cfg_get('email_from') or (f'noreply@{host}' if host else '')
    display_name = cfg_get('email_display_name') or "Key O'Clock"

    if not host:
        raise ValueError('Servidor SMTP não configurado.')
    if not to_addr or '@' not in to_addr:
        raise ValueError('Endereço de destino inválido.')

    if attachment_bytes:
        msg = MIMEMultipart()
        msg.attach(MIMEText(body_html, 'html', 'utf-8'))
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(attachment_bytes)
        encoders.encode_base64(part)
        part.add_header('Content-Disposition',
                        f'attachment; filename="{attachment_name or "relatorio.pdf"}"')
        msg.attach(part)
    else:
        msg = MIMEMultipart('alternative')
        msg.attach(MIMEText(body_html, 'html', 'utf-8'))

    msg['Subject'] = subject
    msg['From']    = formataddr((display_name, from_email))
    msg['To']      = to_addr

    if port == 465:
        ctx = smtplib.SMTP_SSL(host, port, timeout=15)
    else:
        ctx = smtplib.SMTP(host, port, timeout=15)
        if port == 587:
            ctx.starttls()

    with ctx as smtp:
        if user and password:
            smtp.login(user, password)
        smtp.sendmail(msg['From'], [to_addr], msg.as_string())
