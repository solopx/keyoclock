"""
routes/api_audit.py
API de logs de auditoria (admin only).
"""
from flask import Blueprint, jsonify, request
from database.db import qall
from database.auth import admin_required

audit_bp = Blueprint('audit', __name__)

_ENTITY_LABELS = {
    'division':       'Grupo',
    'device_list':    'Lista',
    'inventory_item': 'Item',
    'license':        'Licença',
}

_ACTION_LABELS = {
    'create': 'Criação',
    'update': 'Alteração',
    'delete': 'Exclusão',
}


@audit_bp.route('/api/audit-logs')
@admin_required
def list_audit_logs():
    from_date = request.args.get('from', '')
    to_date   = request.args.get('to', '')
    entity    = request.args.get('entity', '')
    action    = request.args.get('action', '')

    conditions = []
    params     = []

    if from_date:
        conditions.append("date(created_at) >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("date(created_at) <= ?")
        params.append(to_date)
    if entity:
        conditions.append("entity = ?")
        params.append(entity)
    if action:
        conditions.append("action = ?")
        params.append(action)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows  = qall(
        f"SELECT * FROM audit_log {where} ORDER BY created_at DESC LIMIT 500",
        tuple(params)
    )

    for r in rows:
        r['entity_label'] = _ENTITY_LABELS.get(r['entity'], r['entity'])
        r['action_label'] = _ACTION_LABELS.get(r['action'], r['action'])
        r['created_at']   = (r['created_at'] or '')[:16].replace('T', ' ')

    return jsonify(rows)
