"""
routes/views.py
Rotas que servem as páginas HTML da aplicação.
"""
import os
import sys
from flask import Blueprint, redirect, url_for, session, render_template
from database.auth import login_required

views_bp = Blueprint('views', __name__)

def _js_version():
    """Retorna o maior mtime dos arquivos JS — força cache bust quando qualquer JS muda."""
    if getattr(sys, 'frozen', False):
        base = os.path.join(
            getattr(sys, '_MEIPASS', os.path.dirname(sys.executable)),
            'static', 'js'
        )
    else:
        base = os.path.join(os.path.dirname(__file__), '..', 'static', 'js')
    try:
        mtimes = [os.path.getmtime(os.path.join(base, f))
                  for f in os.listdir(base) if f.endswith('.js')]
        return str(int(max(mtimes)))
    except Exception:
        import time
        return str(int(time.time()))


@views_bp.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('views.dashboard'))
    return redirect(url_for('auth.login'))


@views_bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('app.html', js_version=_js_version())
