"""
routes/api_contracts.py
API de contratos: agrupamento de licenças por número de contrato com suporte a criptografia.
"""
from flask import Blueprint, jsonify
from database.auth import login_required
from database.db import qall, get_enc_key, decrypt_val

bp = Blueprint('contracts', __name__)


@bp.route('/api/contracts')
@login_required
def get_contracts():
    rows = qall(
        """SELECT l.contract, l.quantity,
                  i.name  AS item_name,
                  d.name  AS division_name
           FROM   license l
           JOIN   inventory_item i ON l.item_id      = i.id
           JOIN   device_list   dl ON i.list_id      = dl.id
           JOIN   division       d ON dl.division_id = d.id
           WHERE  l.deleted_at  IS NULL
             AND  i.deleted_at  IS NULL
             AND  dl.deleted_at IS NULL
             AND  d.deleted_at  IS NULL
             AND  l.contract IS NOT NULL
             AND  l.contract != ''""",
        ()
    )
    key = get_enc_key()
    contracts = {}
    for row in rows:
        name = decrypt_val(key, row['contract'])
        if not name:
            continue
        if name not in contracts:
            contracts[name] = {'name': name, 'license_count': 0, 'total_qty': 0, 'items': {}}
        contracts[name]['license_count'] += 1
        contracts[name]['total_qty']     += (row['quantity'] or 1)
        item_key = (row['item_name'], row['division_name'])
        if item_key not in contracts[name]['items']:
            contracts[name]['items'][item_key] = {
                'item_name':      row['item_name'],
                'division_name':  row['division_name'],
                'license_count':  0,
                'total_qty':      0,
            }
        contracts[name]['items'][item_key]['license_count'] += 1
        contracts[name]['items'][item_key]['total_qty']     += (row['quantity'] or 1)

    result = []
    for c in sorted(contracts.values(), key=lambda x: x['name'].lower()):
        c['items'] = sorted(c['items'].values(), key=lambda x: (x['division_name'], x['item_name']))
        result.append(c)
    return jsonify(result)
