"""
routes/api_schedule.py
Configuração de agendamentos automáticos de e-mail (admin only).
"""
from flask import Blueprint, jsonify, request
from database.auth import admin_required
from database.db import cfg_get, cfg_set

sched_bp = Blueprint('schedule', __name__)

_KEYS = (
    'sched_periodic_enabled', 'sched_periodic_days', 'sched_periodic_dest',
    'sched_periodic_last_sent',
    'sched_status_enabled', 'sched_status_dest', 'sched_status_last_date',
    'sched_expired_enabled', 'sched_expired_days', 'sched_expired_dest',
    'sched_expired_last_sent',
)


@sched_bp.route('/api/schedule/config')
@admin_required
def get_sched_config():
    return jsonify({
        'periodic_enabled': cfg_get('sched_periodic_enabled') == '1',
        'periodic_days':    int(cfg_get('sched_periodic_days') or 30),
        'periodic_dest':    cfg_get('sched_periodic_dest'),
        'periodic_last':    cfg_get('sched_periodic_last_sent'),
        'status_enabled':   cfg_get('sched_status_enabled') == '1',
        'status_dest':      cfg_get('sched_status_dest'),
        'status_last':      cfg_get('sched_status_last_date'),
        'expired_enabled':  cfg_get('sched_expired_enabled') == '1',
        'expired_days':     int(cfg_get('sched_expired_days') or 30),
        'expired_dest':     cfg_get('sched_expired_dest'),
        'expired_last':     cfg_get('sched_expired_last_sent'),
    })


@sched_bp.route('/api/schedule/config', methods=['POST'])
@admin_required
def save_sched_config():
    data = request.get_json(silent=True) or {}
    periodic_enabled = bool(data.get('periodic_enabled'))
    status_enabled   = bool(data.get('status_enabled'))
    expired_enabled  = bool(data.get('expired_enabled'))

    try:
        days = int(data.get('periodic_days', 30))
        if not (1 <= days <= 365):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Intervalo de dias inválido (1–365).'}), 400

    try:
        expired_days = int(data.get('expired_days', 30))
        if not (1 <= expired_days <= 365):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Intervalo de dias (expiradas) inválido (1–365).'}), 400

    periodic_dest = str(data.get('periodic_dest', '')).strip()
    status_dest   = str(data.get('status_dest', '')).strip()
    expired_dest  = str(data.get('expired_dest', '')).strip()

    if periodic_enabled:
        if not periodic_dest or '@' not in periodic_dest or len(periodic_dest) > 254:
            return jsonify({'error': 'E-mail de destino (período) inválido.'}), 400
    if status_enabled:
        if not status_dest or '@' not in status_dest or len(status_dest) > 254:
            return jsonify({'error': 'E-mail de destino (status) inválido.'}), 400
    if expired_enabled:
        if not expired_dest or '@' not in expired_dest or len(expired_dest) > 254:
            return jsonify({'error': 'E-mail de destino (expiradas) inválido.'}), 400

    try:
        cfg_set('sched_periodic_enabled', '1' if periodic_enabled else '0')
        cfg_set('sched_periodic_days',    str(days))
        cfg_set('sched_periodic_dest',    periodic_dest)
        cfg_set('sched_status_enabled',   '1' if status_enabled else '0')
        cfg_set('sched_status_dest',      status_dest)
        cfg_set('sched_expired_enabled',  '1' if expired_enabled else '0')
        cfg_set('sched_expired_days',     str(expired_days))
        cfg_set('sched_expired_dest',     expired_dest)
        return jsonify({'ok': True})
    except Exception:
        return jsonify({'error': 'Erro ao salvar configuração.'}), 500
