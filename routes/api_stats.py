"""
routes/api_stats.py
API de estatísticas globais para o dashboard.
"""
from flask import Blueprint, jsonify
from datetime import date, timedelta
from database.db import qall, qone
from database.auth import login_required

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/api/stats')
@login_required
def api_stats():
    today = date.today().isoformat()
    d30   = (date.today() + timedelta(30)).isoformat()
    d60   = (date.today() + timedelta(60)).isoformat()
    d90   = (date.today() + timedelta(90)).isoformat()

    # ── Contadores de licenças — tudo em uma única query de agregação ─────────
    # Evita carregar todos os registros na memória para calcular em Python.
    agg = qone("""
        SELECT
          COALESCE(SUM(COALESCE(quantity, 1)), 0)  total_qty,
          COUNT(*)                                  total_entries,
          COALESCE(SUM(CASE WHEN is_perpetual = 1
                            THEN COALESCE(quantity,1) ELSE 0 END), 0) perpetual,
          COALESCE(SUM(CASE WHEN is_perpetual = 0 AND end_date IS NOT NULL
                             AND end_date < ?
                            THEN COALESCE(quantity,1) ELSE 0 END), 0) expired,
          COALESCE(SUM(CASE WHEN is_perpetual = 0 AND end_date IS NOT NULL
                             AND end_date > ?
                            THEN COALESCE(quantity,1) ELSE 0 END), 0) valid,
          COALESCE(SUM(CASE WHEN is_perpetual = 0 AND end_date IS NOT NULL
                             AND end_date >= ? AND end_date <= ?
                            THEN COALESCE(quantity,1) ELSE 0 END), 0) expiring_30,
          COALESCE(SUM(CASE WHEN is_perpetual = 0 AND end_date IS NOT NULL
                             AND end_date >  ? AND end_date <= ?
                            THEN COALESCE(quantity,1) ELSE 0 END), 0) expiring_60,
          COALESCE(SUM(CASE WHEN is_perpetual = 0 AND end_date IS NOT NULL
                             AND end_date >  ? AND end_date <= ?
                            THEN COALESCE(quantity,1) ELSE 0 END), 0) expiring_90
        FROM license
        WHERE deleted_at IS NULL
    """, (today, d90, today, d30, d30, d60, d60, d90))

    # ── Divisões com contadores agregados (3 queries em vez de N×3) ───────────
    divs = qall("SELECT * FROM division WHERE deleted_at IS NULL")

    # Listas por divisão
    lists_by_div = {
        r['division_id']: r['cnt']
        for r in qall(
            "SELECT division_id, COUNT(*) cnt"
            " FROM device_list"
            " WHERE deleted_at IS NULL"
            " GROUP BY division_id"
        )
    }

    # Itens por divisão (via JOIN com device_list)
    items_by_div = {
        r['division_id']: r['cnt']
        for r in qall(
            "SELECT dl.division_id, COUNT(*) cnt"
            " FROM inventory_item ii"
            " JOIN device_list dl ON ii.list_id = dl.id"
            " WHERE ii.deleted_at IS NULL AND dl.deleted_at IS NULL"
            " GROUP BY dl.division_id"
        )
    }

    # Soma de licenças por divisão (via JOIN duplo)
    lic_by_div = {
        r['division_id']: r['qty']
        for r in qall(
            "SELECT dl.division_id, COALESCE(SUM(l.quantity), 0) qty"
            " FROM license l"
            " JOIN inventory_item i  ON l.item_id  = i.id"
            " JOIN device_list   dl ON i.list_id   = dl.id"
            " WHERE l.deleted_at IS NULL"
            "   AND i.deleted_at IS NULL"
            "   AND dl.deleted_at IS NULL"
            " GROUP BY dl.division_id"
        )
    }

    divs_data = [
        {
            **div,
            'items':    items_by_div.get(div['id'], 0),
            'licenses': lic_by_div.get(div['id'], 0),
            'lists':    lists_by_div.get(div['id'], 0),
        }
        for div in divs
    ]

    agg = agg or {}
    return jsonify({
        'total_divisions': len(divs),
        'total_items':     (qone("SELECT COUNT(*) c FROM inventory_item WHERE deleted_at IS NULL") or {}).get('c', 0),
        'total_licenses':  agg.get('total_qty', 0),
        'total_entries':   agg.get('total_entries', 0),
        'valid':           agg.get('valid', 0),
        'expired':         agg.get('expired', 0),
        'perpetual':       agg.get('perpetual', 0),
        'expiring_30':     agg.get('expiring_30', 0),
        'expiring_60':     agg.get('expiring_60', 0),
        'expiring_90':     agg.get('expiring_90', 0),
        'divisions':       divs_data,
    })
