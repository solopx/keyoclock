"""
database/scheduler.py
Trabalhos de agendamento periódico de e-mails automáticos.
"""
import html
import logging
from datetime import datetime, date, timezone

from database.db import cfg_get, cfg_set
from database.helpers import lic_status

_logger = logging.getLogger(__name__)


def run_scheduled_jobs():
    try:
        _check_periodic()
    except Exception as exc:
        _logger.error('[scheduler] periodic: %s', exc)
    try:
        _check_status()
    except Exception as exc:
        _logger.error('[scheduler] status: %s', exc)
    try:
        _check_expired()
    except Exception as exc:
        _logger.error('[scheduler] expired: %s', exc)


def _check_periodic():
    if cfg_get('sched_periodic_enabled') != '1':
        return

    dest      = cfg_get('sched_periodic_dest')
    days_str  = cfg_get('sched_periodic_days')
    if not dest or not days_str:
        return

    try:
        interval_days = int(days_str)
    except (ValueError, TypeError):
        return
    last_sent_str = cfg_get('sched_periodic_last_sent')
    if last_sent_str:
        last_sent = datetime.fromisoformat(last_sent_str)
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < interval_days * 86400:
            return

    from routes.api_reports import generate_pdf_bytes
    pdf_bytes, filename = generate_pdf_bytes('validity', 'all')

    from database.email_utils import send_email
    ts      = datetime.now().strftime('%d/%m/%Y %H:%M')
    subject = f"Key O'Clock \u2014 Relat\u00f3rio de Licen\u00e7as ({ts})"
    body    = (
        "<html><body style=\"font-family:sans-serif;color:#1e293b\">"
        f"<h2 style=\"color:#1e3a5f\">Relat\u00f3rio de Licen\u00e7as \u2014 Key O'Clock</h2>"
        f"<p>Segue em anexo o relat\u00f3rio completo de licen\u00e7as gerado automaticamente em {ts}.</p>"
        "<p style=\"font-size:12px;color:#888\">Este e-mail foi gerado automaticamente. N\u00e3o responda.</p>"
        "</body></html>"
    )
    send_email(dest, subject, body, attachment_bytes=pdf_bytes, attachment_name=filename)
    cfg_set('sched_periodic_last_sent', datetime.now(timezone.utc).isoformat())
    _logger.info('[scheduler] periodic report sent to %s', dest)


def _check_status():
    if cfg_get('sched_status_enabled') != '1':
        return

    dest = cfg_get('sched_status_dest')
    if not dest:
        return

    today_str = date.today().isoformat()
    if cfg_get('sched_status_last_date') == today_str:
        return

    from routes.api_reports import query_licenses_full
    lics = query_licenses_full()

    alert_statuses = {'soon', 'warning', 'critical'}
    counts   = {'critical': 0, 'warning': 0, 'soon': 0}
    affected = []

    for lic in lics:
        s, days = lic_status(lic)
        if s in alert_statuses:
            counts[s] += (lic['quantity'] or 1)
            affected.append((lic, s, days))

    if sum(counts.values()) == 0:
        return

    STATUS_PT    = {'critical': 'Cr\u00edtico', 'warning': 'Aviso', 'soon': 'Aten\u00e7\u00e3o'}
    STATUS_COLOR = {'critical': '#ef4444', 'warning': '#f97316', 'soon': '#f59e0b'}

    _DASH = '\u2014'
    rows_html = ''
    for lic, s, days in affected:
        color    = STATUS_COLOR.get(s, '#888')
        label    = STATUS_PT.get(s, s)
        days_str = f'{days}d' if days is not None else _DASH
        end_date = lic['end_date'] or _DASH
        rows_html += (
            '<tr>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{html.escape(lic["dname"])}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{html.escape(lic["iname"])}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{end_date}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;'
            f'color:{color};font-weight:600">{label}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{days_str}</td>'
            '</tr>'
        )

    ts      = datetime.now().strftime('%d/%m/%Y %H:%M')
    subject = f"Key O'Clock \u2014 Alerta de Licen\u00e7as ({ts})"
    body    = (
        "<html><body style=\"font-family:sans-serif;color:#1e293b\">"
        f"<h2 style=\"color:#1e3a5f\">Alerta de Licen\u00e7as \u2014 Key O'Clock</h2>"
        f"<p>Gerado em {ts}</p>"
        "<table style=\"border-collapse:collapse;margin-bottom:16px\">"
        "<tr>"
        f"<td style=\"padding:8px 14px;background:#fff1f2;border-radius:4px;text-align:center;margin-right:8px\">"
        f"<strong style=\"color:#ef4444;font-size:20px\">{counts['critical']}</strong><br>"
        f"<span style=\"font-size:11px;color:#64748b\">Cr\u00edtico (\u226430d)</span></td>"
        f"<td style=\"padding:8px 14px;background:#fff7ed;border-radius:4px;text-align:center;margin-right:8px\">"
        f"<strong style=\"color:#f97316;font-size:20px\">{counts['warning']}</strong><br>"
        f"<span style=\"font-size:11px;color:#64748b\">Aviso (\u226460d)</span></td>"
        f"<td style=\"padding:8px 14px;background:#fffbeb;border-radius:4px;text-align:center\">"
        f"<strong style=\"color:#f59e0b;font-size:20px\">{counts['soon']}</strong><br>"
        f"<span style=\"font-size:11px;color:#64748b\">Aten\u00e7\u00e3o (\u226490d)</span></td>"
        "</tr></table>"
        "<table style=\"width:100%;border-collapse:collapse;font-size:13px\">"
        "<thead><tr style=\"background:#1e3a5f;color:white\">"
        "<th style=\"padding:8px 10px;text-align:left\">Grupo</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Item</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Vencimento</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Status</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Dias</th>"
        "</tr></thead>"
        f"<tbody>{rows_html}</tbody></table>"
        "<p style=\"font-size:12px;color:#888;margin-top:16px\">"
        "Este e-mail foi gerado automaticamente pelo Key O'Clock. N\u00e3o responda.</p>"
        "</body></html>"
    )

    from database.email_utils import send_email
    send_email(dest, subject, body)
    cfg_set('sched_status_last_date', today_str)
    _logger.info('[scheduler] status alert sent to %s', dest)


def _check_expired():
    if cfg_get('sched_expired_enabled') != '1':
        return

    dest     = cfg_get('sched_expired_dest')
    days_str = cfg_get('sched_expired_days')
    if not dest or not days_str:
        return

    try:
        interval_days = int(days_str)
    except (ValueError, TypeError):
        return
    last_sent_str = cfg_get('sched_expired_last_sent')
    if last_sent_str:
        last_sent = datetime.fromisoformat(last_sent_str)
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
        if elapsed < interval_days * 86400:
            return

    from routes.api_reports import query_licenses_full
    lics = query_licenses_full()

    expired_lics = []
    for lic in lics:
        s, days = lic_status(lic)
        if s == 'expired':
            expired_lics.append((lic, days))

    if not expired_lics:
        return

    _DASH = '\u2014'
    rows_html = ''
    for lic, days in expired_lics:
        days_str_val = f'{abs(days)}d' if days is not None else _DASH
        end_date = lic['end_date'] or _DASH
        rows_html += (
            '<tr>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{html.escape(lic["dname"])}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{html.escape(lic["iname"])}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">{end_date}</td>'
            f'<td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;color:#6b7280">{days_str_val} atr\u00e1s</td>'
            '</tr>'
        )

    ts      = datetime.now().strftime('%d/%m/%Y %H:%M')
    subject = f"Key O'Clock \u2014 Licen\u00e7as Expiradas ({ts})"
    body    = (
        "<html><body style=\"font-family:sans-serif;color:#1e293b\">"
        f"<h2 style=\"color:#1e3a5f\">Licen\u00e7as Expiradas \u2014 Key O'Clock</h2>"
        f"<p>Gerado em {ts}</p>"
        f"<p><strong style=\"color:#6b7280;font-size:18px\">{len(expired_lics)}</strong> "
        f"licen\u00e7a(s) expirada(s) encontrada(s).</p>"
        "<table style=\"width:100%;border-collapse:collapse;font-size:13px\">"
        "<thead><tr style=\"background:#1e3a5f;color:white\">"
        "<th style=\"padding:8px 10px;text-align:left\">Grupo</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Item</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Vencimento</th>"
        "<th style=\"padding:8px 10px;text-align:left\">Expirado h\u00e1</th>"
        "</tr></thead>"
        f"<tbody>{rows_html}</tbody></table>"
        "<p style=\"font-size:12px;color:#888;margin-top:16px\">"
        "Este e-mail foi gerado automaticamente pelo Key O'Clock. N\u00e3o responda.</p>"
        "</body></html>"
    )

    from database.email_utils import send_email
    send_email(dest, subject, body)
    cfg_set('sched_expired_last_sent', datetime.now(timezone.utc).isoformat())
    _logger.info('[scheduler] expired alert sent to %s', dest)
