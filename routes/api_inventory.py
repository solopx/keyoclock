"""
routes/api_inventory.py
API de inventário: divisões, listas e itens.
"""
from flask import Blueprint, request, jsonify, session
from database.db import qall, qone, execute, log_audit
from database.auth import login_required, admin_required
from database.helpers import validate_input

inventory_bp = Blueprint('inventory', __name__)

_NOW = "datetime('now')"


# ─── DIVISÕES ──────────────────────────────────────────────────────────────────

@inventory_bp.route('/api/divisions', methods=['GET'])
@login_required
def list_divisions():
    # 3 queries planas substituem o loop aninhado 1 + D + D×L
    divs      = qall("SELECT * FROM division WHERE deleted_at IS NULL ORDER BY name")
    all_lists = qall("SELECT * FROM device_list WHERE deleted_at IS NULL ORDER BY name")
    all_items = qall(
        """SELECT i.*,
                  COALESCE(SUM(l.quantity), 0) license_count
           FROM inventory_item i
           LEFT JOIN license l ON l.item_id = i.id AND l.deleted_at IS NULL
           WHERE i.deleted_at IS NULL
           GROUP BY i.id
           ORDER BY i.name"""
    )

    # Indexar itens por list_id
    items_by_list = {}
    for item in all_items:
        items_by_list.setdefault(item['list_id'], []).append(dict(item))

    # Indexar listas por division_id e injetar seus itens
    lists_by_div = {}
    for lst in all_lists:
        lst = dict(lst)
        lst['items'] = items_by_list.get(lst['id'], [])
        lists_by_div.setdefault(lst['division_id'], []).append(lst)

    result = []
    for div in divs:
        div = dict(div)
        div['lists'] = lists_by_div.get(div['id'], [])
        result.append(div)

    return jsonify(result)


@inventory_bp.route('/api/divisions', methods=['POST'])
@login_required
@admin_required
def create_division():
    data = request.json or {}
    err = validate_input(
        nome=(data.get('name', ''), 255),
        descrição=(data.get('description', ''), 1000),
        ícone=(data.get('icon', ''), 10),
    )
    if err: return jsonify({'error': err}), 400
    rid = execute(
        "INSERT INTO division (name, description, icon) VALUES (?, ?, ?)",
        (data['name'], data.get('description', ''), data.get('icon', '🏢'))
    )
    log_audit(session.get('username', '?'), 'create', 'division', rid, data['name'],
              ip=request.remote_addr or '')
    return jsonify({'success': True, 'id': rid})


@inventory_bp.route('/api/divisions/<int:did>', methods=['PUT'])
@login_required
@admin_required
def update_division(did):
    data = request.json or {}
    err = validate_input(
        nome=(data.get('name', ''), 255),
        descrição=(data.get('description', ''), 1000),
        ícone=(data.get('icon', ''), 10),
    )
    if err: return jsonify({'error': err}), 400
    execute(
        "UPDATE division SET name = ?, description = ?, icon = ? WHERE id = ?",
        (data['name'], data.get('description', ''), data.get('icon', '🏢'), did)
    )
    log_audit(session.get('username', '?'), 'update', 'division', did, data['name'],
              ip=request.remote_addr or '')
    return jsonify({'success': True})


@inventory_bp.route('/api/divisions/<int:did>', methods=['DELETE'])
@login_required
@admin_required
def delete_division(did):
    row = qone("SELECT name FROM division WHERE id = ?", (did,))
    name = row['name'] if row else str(did)
    # Soft delete em cascata: licenças → itens → listas → divisão
    execute(
        f"""UPDATE license SET deleted_at = {_NOW}
            WHERE deleted_at IS NULL
              AND item_id IN (
                  SELECT i.id FROM inventory_item i
                  JOIN device_list dl ON i.list_id = dl.id
                  WHERE dl.division_id = ?
              )""",
        (did,)
    )
    execute(
        f"""UPDATE inventory_item SET deleted_at = {_NOW}
            WHERE deleted_at IS NULL
              AND list_id IN (SELECT id FROM device_list WHERE division_id = ?)""",
        (did,)
    )
    execute(
        f"UPDATE device_list SET deleted_at = {_NOW} WHERE division_id = ? AND deleted_at IS NULL",
        (did,)
    )
    execute(f"UPDATE division SET deleted_at = {_NOW} WHERE id = ?", (did,))
    log_audit(session.get('username', '?'), 'delete', 'division', did, name,
              ip=request.remote_addr or '')
    return jsonify({'success': True})


# ─── LISTAS ────────────────────────────────────────────────────────────────────

@inventory_bp.route('/api/lists', methods=['POST'])
@login_required
@admin_required
def create_list():
    data = request.json or {}
    err = validate_input(nome=(data.get('name', ''), 255))
    if err: return jsonify({'error': err}), 400
    try:
        division_id = int(data['division_id'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Divisão inválida.'}), 400
    if not qone("SELECT id FROM division WHERE id = ? AND deleted_at IS NULL", (division_id,)):
        return jsonify({'error': 'Divisão não encontrada.'}), 404
    rid = execute(
        "INSERT INTO device_list (name, division_id) VALUES (?, ?)",
        (data['name'], division_id)
    )
    log_audit(session.get('username', '?'), 'create', 'device_list', rid, data['name'],
              ip=request.remote_addr or '')
    return jsonify({'success': True, 'id': rid})


@inventory_bp.route('/api/lists/<int:lid>', methods=['PUT'])
@login_required
@admin_required
def update_list(lid):
    data = request.json or {}
    err = validate_input(nome=(data.get('name', ''), 255))
    if err: return jsonify({'error': err}), 400
    execute("UPDATE device_list SET name = ? WHERE id = ?", (data['name'], lid))
    log_audit(session.get('username', '?'), 'update', 'device_list', lid, data['name'],
              ip=request.remote_addr or '')
    return jsonify({'success': True})


@inventory_bp.route('/api/lists/<int:lid>', methods=['DELETE'])
@login_required
@admin_required
def delete_list(lid):
    row = qone("SELECT name FROM device_list WHERE id = ?", (lid,))
    name = row['name'] if row else str(lid)
    execute(
        f"""UPDATE license SET deleted_at = {_NOW}
            WHERE deleted_at IS NULL
              AND item_id IN (SELECT id FROM inventory_item WHERE list_id = ?)""",
        (lid,)
    )
    execute(
        f"UPDATE inventory_item SET deleted_at = {_NOW} WHERE list_id = ? AND deleted_at IS NULL",
        (lid,)
    )
    execute(f"UPDATE device_list SET deleted_at = {_NOW} WHERE id = ?", (lid,))
    log_audit(session.get('username', '?'), 'delete', 'device_list', lid, name,
              ip=request.remote_addr or '')
    return jsonify({'success': True})


# ─── ITENS ─────────────────────────────────────────────────────────────────────

@inventory_bp.route('/api/items', methods=['POST'])
@login_required
@admin_required
def create_item():
    d = request.json or {}
    err = validate_input(
        nome=(d.get('name', ''), 255),
        modelo=(d.get('model', ''), 255),
        fabricante=(d.get('manufacturer', ''), 255),
        fornecedor=(d.get('supplier', ''), 255),
        descrição=(d.get('description', ''), 1000),
    )
    if err: return jsonify({'error': err}), 400
    try:
        list_id = int(d['list_id'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Lista inválida.'}), 400
    if not qone("SELECT id FROM device_list WHERE id = ? AND deleted_at IS NULL", (list_id,)):
        return jsonify({'error': 'Lista não encontrada.'}), 404
    rid = execute(
        "INSERT INTO inventory_item (name, description, model, manufacturer, supplier, list_id)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (d['name'], d.get('description', ''), d.get('model', ''),
         d.get('manufacturer', ''), d.get('supplier', ''), list_id)
    )
    log_audit(session.get('username', '?'), 'create', 'inventory_item', rid, d['name'],
              ip=request.remote_addr or '')
    return jsonify({'success': True, 'id': rid})


@inventory_bp.route('/api/items/<int:iid>', methods=['PUT'])
@login_required
@admin_required
def update_item(iid):
    d = request.json or {}
    err = validate_input(
        nome=(d.get('name', ''), 255),
        modelo=(d.get('model', ''), 255),
        fabricante=(d.get('manufacturer', ''), 255),
        fornecedor=(d.get('supplier', ''), 255),
        descrição=(d.get('description', ''), 1000),
    )
    if err: return jsonify({'error': err}), 400
    execute(
        "UPDATE inventory_item SET name=?, description=?, model=?, manufacturer=?, supplier=? WHERE id=?",
        (d['name'], d.get('description', ''), d.get('model', ''),
         d.get('manufacturer', ''), d.get('supplier', ''), iid)
    )
    log_audit(session.get('username', '?'), 'update', 'inventory_item', iid, d['name'],
              ip=request.remote_addr or '')
    return jsonify({'success': True})


@inventory_bp.route('/api/items/<int:iid>', methods=['DELETE'])
@login_required
@admin_required
def delete_item(iid):
    row = qone("SELECT name FROM inventory_item WHERE id = ?", (iid,))
    name = row['name'] if row else str(iid)
    execute(
        f"UPDATE license SET deleted_at = {_NOW} WHERE item_id = ? AND deleted_at IS NULL",
        (iid,)
    )
    execute(f"UPDATE inventory_item SET deleted_at = {_NOW} WHERE id = ?", (iid,))
    log_audit(session.get('username', '?'), 'delete', 'inventory_item', iid, name,
              ip=request.remote_addr or '')
    return jsonify({'success': True})
