"""
routes/api_licenses.py
API de licenças: listagem global e CRUD por item.
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, session
from database.db import qall, qone, execute, log_audit, encrypt_val, decrypt_val, get_enc_key
from database.auth import login_required, admin_required
from database.helpers import lic_status, format_date_br, validate_input, VALID_LICENSE_TYPES

licenses_bp = Blueprint('licenses', __name__)

_NOW = "datetime('now')"


@licenses_bp.route('/api/items/<int:iid>/licenses', methods=['GET'])
@login_required
def item_licenses(iid):
    item = qone("SELECT * FROM inventory_item WHERE id = ? AND deleted_at IS NULL", (iid,))
    if not item:
        return jsonify({'error': 'Item não encontrado'}), 404

    lics = qall(
        "SELECT * FROM license WHERE item_id = ? AND deleted_at IS NULL ORDER BY end_date",
        (iid,)
    )
    key = get_enc_key()
    result = []
    for l in lics:
        l['contract'] = decrypt_val(key, l.get('contract') or '')
        status, days = lic_status(l)
        result.append({**l, 'status': status, 'days_remaining': days})

    return jsonify({'item': item, 'licenses': result})


@licenses_bp.route('/api/licenses', methods=['GET'])
@login_required
def list_licenses():
    sql = """
        SELECT l.*,
               i.name  item_name,
               i.model item_model,
               dl.name list_name,
               dv.name division_name
        FROM license l
        JOIN inventory_item i  ON l.item_id  = i.id
        JOIN device_list   dl  ON i.list_id  = dl.id
        JOIN division      dv  ON dl.division_id = dv.id
        WHERE l.deleted_at IS NULL
          AND i.deleted_at  IS NULL
          AND dl.deleted_at IS NULL
          AND dv.deleted_at IS NULL
        ORDER BY l.end_date
    """
    lics = qall(sql)
    key = get_enc_key()
    result = []
    for l in lics:
        l['contract'] = decrypt_val(key, l.get('contract') or '')
        status, days = lic_status(l)
        result.append({
            **l,
            'status':         status,
            'days_remaining': days,
            'start_date':     format_date_br(l['start_date']),
            'end_date':       format_date_br(l['end_date']),
            'start_date_iso': l['start_date'],
            'end_date_iso':   l['end_date'],
        })
    return jsonify(result)


@licenses_bp.route('/api/licenses', methods=['POST'])
@login_required
@admin_required
def create_license():
    d = request.json or {}
    if d.get('license_type') not in VALID_LICENSE_TYPES:
        return jsonify({'error': 'Tipo de licença inválido.'}), 400
    err = validate_input(
        contrato=(d.get('contract', ''), 255),
        observações=(d.get('notes', ''), 2000),
    )
    if err: return jsonify({'error': err}), 400
    try:
        item_id = int(d['item_id'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Item inválido.'}), 400
    if not qone("SELECT id FROM inventory_item WHERE id = ? AND deleted_at IS NULL", (item_id,)):
        return jsonify({'error': 'Item não encontrado.'}), 404
    try:
        qty = int(d.get('quantity') or 1)
        if not (1 <= qty <= 999999):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Quantidade inválida (1–999999).'}), 400
    is_perpetual = 1 if d.get('is_perpetual') else 0
    if not is_perpetual and (not d.get('start_date') or not d.get('end_date')):
        return jsonify({'error': 'Informe as datas de início e fim, ou marque como Licença Vitalícia.'}), 400
    if not is_perpetual:
        try:
            _sd = datetime.fromisoformat(d.get('start_date', ''))
            _ed = datetime.fromisoformat(d.get('end_date', ''))
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use AAAA-MM-DD.'}), 400
        if d['start_date'] > d['end_date']:
            return jsonify({'error': 'Data de início não pode ser posterior à data de fim.'}), 400
        if (_ed - _sd).days > 3653:
            return jsonify({'error': 'Prazo máximo de validade é 10 anos a partir da data de início.'}), 400
    contract_raw = d.get('contract', '')
    key = get_enc_key()
    contract_stored = encrypt_val(key, contract_raw) if (key and contract_raw) else contract_raw
    execute(
        "INSERT INTO license"
        " (item_id, license_type, is_perpetual, quantity, contract, start_date, end_date, notes)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            item_id,
            d['license_type'],
            is_perpetual,
            qty,
            contract_stored,
            d.get('start_date'),
            None if is_perpetual else d.get('end_date'),
            d.get('notes', ''),
        )
    )
    item = qone("SELECT name FROM inventory_item WHERE id = ?", (item_id,))
    details = f"Tipo: {d['license_type']} | Qtd: {qty}"
    if contract_raw:
        details += f" | Contrato: {contract_raw}"
    if not is_perpetual and d.get('end_date'):
        details += f" | Venc: {d['end_date']}"
    log_audit(session.get('username', '?'), 'create', 'license', None,
              item['name'] if item else str(d['item_id']), details,
              ip=request.remote_addr or '')
    return jsonify({'success': True})


@licenses_bp.route('/api/licenses/<int:lid>', methods=['PUT'])
@login_required
@admin_required
def update_license(lid):
    d = request.json or {}
    if d.get('license_type') not in VALID_LICENSE_TYPES:
        return jsonify({'error': 'Tipo de licença inválido.'}), 400
    err = validate_input(
        contrato=(d.get('contract', ''), 255),
        observações=(d.get('notes', ''), 2000),
    )
    if err: return jsonify({'error': err}), 400
    try:
        qty = int(d.get('quantity') or 1)
        if not (1 <= qty <= 999999):
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({'error': 'Quantidade inválida (1–999999).'}), 400
    is_perpetual = 1 if d.get('is_perpetual') else 0
    if not is_perpetual and (not d.get('start_date') or not d.get('end_date')):
        return jsonify({'error': 'Informe as datas de início e fim, ou marque como Licença Vitalícia.'}), 400
    if not is_perpetual:
        try:
            _sd = datetime.fromisoformat(d.get('start_date', ''))
            _ed = datetime.fromisoformat(d.get('end_date', ''))
        except ValueError:
            return jsonify({'error': 'Formato de data inválido. Use AAAA-MM-DD.'}), 400
        if d['start_date'] > d['end_date']:
            return jsonify({'error': 'Data de início não pode ser posterior à data de fim.'}), 400
        if (_ed - _sd).days > 3653:
            return jsonify({'error': 'Prazo máximo de validade é 10 anos a partir da data de início.'}), 400
    contract_raw = d.get('contract', '')
    key = get_enc_key()
    contract_stored = encrypt_val(key, contract_raw) if (key and contract_raw) else contract_raw
    execute(
        "UPDATE license"
        " SET license_type=?, is_perpetual=?, quantity=?, contract=?, start_date=?, end_date=?, notes=?"
        " WHERE id=? AND deleted_at IS NULL",
        (
            d['license_type'],
            is_perpetual,
            qty,
            contract_stored,
            d.get('start_date'),
            None if is_perpetual else d.get('end_date'),
            d.get('notes', ''),
            lid,
        )
    )
    row = qone(
        "SELECT i.name FROM license l JOIN inventory_item i ON l.item_id = i.id WHERE l.id = ?",
        (lid,)
    )
    details = f"Tipo: {d['license_type']} | Qtd: {qty}"
    log_audit(session.get('username', '?'), 'update', 'license', lid,
              row['name'] if row else str(lid), details,
              ip=request.remote_addr or '')
    return jsonify({'success': True})


@licenses_bp.route('/api/licenses/<int:lid>', methods=['DELETE'])
@login_required
@admin_required
def delete_license(lid):
    row = qone(
        "SELECT i.name FROM license l JOIN inventory_item i ON l.item_id = i.id"
        " WHERE l.id = ? AND l.deleted_at IS NULL",
        (lid,)
    )
    execute(f"UPDATE license SET deleted_at = {_NOW} WHERE id = ?", (lid,))
    log_audit(session.get('username', '?'), 'delete', 'license', lid,
              row['name'] if row else str(lid),
              ip=request.remote_addr or '')
    return jsonify({'success': True})
