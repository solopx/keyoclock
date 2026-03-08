"""
keyoclock — Ponto de entrada da aplicação
"""
import os
import sys
import secrets

if getattr(sys, 'frozen', False):
    _ERR_FILE = os.path.join(
        os.environ.get('PROGRAMDATA', 'C:\\ProgramData'), 'Key O\'Clock', 'startup_error.txt'
    )
    import traceback as _tb
    _orig_hook = sys.excepthook
    def _excepthook(t, v, tb):
        try:
            os.makedirs(os.path.dirname(_ERR_FILE), exist_ok=True)
            with open(_ERR_FILE, 'w', encoding='utf-8') as _f:
                _tb.print_exception(t, v, tb, file=_f)
        except Exception:
            pass
        _orig_hook(t, v, tb)
    sys.excepthook = _excepthook
import logging
import logging.handlers

def _suppress_ssl_eof():
    class _Filter(logging.Filter):
        def filter(self, record):
            msg = record.getMessage()
            return 'SSLEOFError' not in msg and 'socket.error 8' not in msg
    logging.getLogger('cheroot.server').addFilter(_Filter())

from flask import Flask
from database.db import init_db, load_enc_key, _DATA_DIR
from routes.auth import auth_bp
from routes.views import views_bp
from routes.api_stats import stats_bp
from routes.api_users import users_bp
from routes.api_inventory import inventory_bp
from routes.api_licenses import licenses_bp
from routes.api_reports import reports_bp
from routes.api_audit import audit_bp
from routes.api_certificates import cert_bp
from routes.api_email import email_bp
from routes.api_database import db_info_bp
from routes.api_schedule import sched_bp
from routes.api_contracts import bp as contracts_bp

if getattr(sys, 'frozen', False):
    _APP_BASE = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    app = Flask(__name__,
                template_folder=os.path.join(_APP_BASE, 'templates'),
                static_folder=os.path.join(_APP_BASE, 'static'))
else:
    app = Flask(__name__)

# ── LOGGING ───────────────────────────────────────────────────────────────────
_log_dir = os.path.join(_DATA_DIR, 'logs')
os.makedirs(_log_dir, exist_ok=True)
_log_file = os.path.join(_log_dir, 'keyoclock.log')
_log_handler = logging.handlers.RotatingFileHandler(
    _log_file, maxBytes=5 * 1024 * 1024, backupCount=5, encoding='utf-8'
)
_log_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s %(name)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
))
logging.basicConfig(level=logging.INFO, handlers=[_log_handler])
logging.getLogger('werkzeug').setLevel(logging.WARNING)
_app_logger = logging.getLogger(__name__)

if os.environ.get('HTTPS_MODE'):
    app.config['SESSION_COOKIE_SECURE'] = True

# ── SECRET_KEY ────────────────────────────────────────────────────────────────
# Prioridade: variável de ambiente SECRET_KEY → arquivo .secret_key → gerada na hora
# Em produção: defina a variável de ambiente para persistência entre reinicializações.
#   Linux/macOS: export SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
#   Windows:     set SECRET_KEY=<valor gerado>
_key_file = os.path.join(_DATA_DIR, '.secret_key')

def _load_or_create_secret_key():
    if os.environ.get('SECRET_KEY'):
        return os.environ['SECRET_KEY']
    if os.path.exists(_key_file):
        return open(_key_file).read().strip()
    key = secrets.token_hex(32)
    os.makedirs(os.path.dirname(_key_file), exist_ok=True)
    open(_key_file, 'w').write(key)
    try:
        os.chmod(_key_file, 0o600)
    except OSError:
        pass
    return key

app.config['SECRET_KEY'] = _load_or_create_secret_key()

# ── CONFIGURAÇÕES DE SESSÃO ───────────────────────────────────────────────────
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Strict'
app.config['PERMANENT_SESSION_LIFETIME'] = 28800  # Sessão expira em 8 horas (segundos)'

# Registra todos os blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(views_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(users_bp)
app.register_blueprint(inventory_bp)
app.register_blueprint(licenses_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(audit_bp)
app.register_blueprint(cert_bp)
app.register_blueprint(email_bp)
app.register_blueprint(db_info_bp)
app.register_blueprint(sched_bp)
app.register_blueprint(contracts_bp)

init_db()
load_enc_key()

# ── AGENDADOR DE TAREFAS (APScheduler) ───────────────────────────────────────
# Inicia automaticamente a menos que DISABLE_SCHEDULER=1 esteja definido.
# Para implantações com múltiplos workers (gunicorn -w N), defina DISABLE_SCHEDULER=1
# e use um processo dedicado ou cron externo.
if os.environ.get('DISABLE_SCHEDULER') != '1':
    from datetime import datetime, timezone
    from apscheduler.schedulers.background import BackgroundScheduler
    from database.scheduler import run_scheduled_jobs
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(run_scheduled_jobs, 'interval', hours=1, id='sched_jobs',
                       next_run_time=datetime.now(timezone.utc))
    _scheduler.start()
    _app_logger.info('Scheduler iniciado.')

# ── CABEÇALHOS DE SEGURANÇA ───────────────────────────────────────────────────
@app.after_request
def set_security_headers(response):
    # Bloqueia scripts de origens externas e recursos não autorizados.
    # 'unsafe-inline' é necessário pois a app usa inline <script> e onclick="..."
    # O risco de XSS via inline já é mitigado pelo escapeHTML() no frontend.
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self' data:; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if response.content_type and (
        response.content_type.startswith('application/json') or
        response.content_type.startswith('text/html')
    ):
        response.headers['Cache-Control'] = 'no-store'
    return response

if __name__ == '__main__':
    _PORT = int(os.environ.get('PORT', 5000))
    _HOST = os.environ.get('HOST', '0.0.0.0')

    if getattr(sys, 'frozen', False):
        import win32serviceutil
        import win32service
        import win32event
        import servicemanager

        class _KeyOClockService(win32serviceutil.ServiceFramework):
            _svc_name_ = 'KeyOClock'
            _svc_display_name_ = "Key O'Clock"
            _svc_description_ = "Gerenciamento de licenças de software Key O'Clock"

            def __init__(self, args):
                win32serviceutil.ServiceFramework.__init__(self, args)
                self._stop_event = win32event.CreateEvent(None, 0, 0, None)
                self._server = None

            def SvcStop(self):
                self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
                win32event.SetEvent(self._stop_event)

            def SvcDoRun(self):
                servicemanager.LogMsg(
                    servicemanager.EVENTLOG_INFORMATION_TYPE,
                    servicemanager.PYS_SERVICE_STARTED,
                    (self._svc_name_, '')
                )
                import sys as _sys_svc
                _devnull = open(os.devnull, 'w', encoding='utf-8')
                if _sys_svc.stderr is None:
                    _sys_svc.stderr = _devnull
                if _sys_svc.stdout is None:
                    _sys_svc.stdout = _devnull
                import threading
                if os.environ.get('HTTPS_MODE'):
                    import ssl as _ssl
                    from database.certs import gen_cert, CERT_PEM, KEY_PEM
                    from cheroot.wsgi import Server as CherootServer
                    from cheroot.ssl.builtin import BuiltinSSLAdapter
                    gen_cert()
                    self._server = CherootServer((_HOST, _PORT), app, numthreads=10)
                    adapter = BuiltinSSLAdapter(CERT_PEM, KEY_PEM)
                    adapter.context.set_alpn_protocols(['http/1.1'])
                    adapter.context.minimum_version = _ssl.TLSVersion.TLSv1_2
                    self._server.ssl_adapter = adapter
                    _suppress_ssl_eof()
                    def _run_https():
                        try:
                            self._server.start()
                        except Exception as _exc:
                            _app_logger.error('HTTPS server thread falhou: %s', _exc, exc_info=True)
                    threading.Thread(target=_run_https, daemon=True).start()
                else:
                    from waitress.server import create_server
                    self._server = create_server(app, host=_HOST, port=_PORT, threads=10)
                    def _run_http():
                        try:
                            self._server.run()
                        except Exception as _exc:
                            _app_logger.error('HTTP server thread falhou: %s', _exc, exc_info=True)
                    threading.Thread(target=_run_http, daemon=True).start()
                _app_logger.info("Key O'Clock service iniciado na porta %d", _PORT)
                win32event.WaitForSingleObject(self._stop_event, win32event.INFINITE)
                if self._server:
                    try:
                        self._server.close()
                    except Exception:
                        pass

        if len(sys.argv) == 1:
            servicemanager.Initialize()
            servicemanager.PrepareToHostSingle(_KeyOClockService)
            servicemanager.StartServiceCtrlDispatcher()
        else:
            win32serviceutil.HandleCommandLine(_KeyOClockService)
    else:
        # ── Modo desenvolvimento: Werkzeug + browser ───────────────────────
        import ssl
        import subprocess
        import importlib
        import webbrowser
        import time
        import threading

        REQUIRED = ['flask', 'werkzeug', 'openpyxl', 'reportlab', 'waitress', 'cryptography', 'cheroot', 'apscheduler']
        missing = [pkg for pkg in REQUIRED if not importlib.util.find_spec(pkg)]
        if missing:
            print(f"Instalando pacotes: {', '.join(missing)}")
            subprocess.check_call(
                [sys.executable, '-m', 'pip', 'install', '-r',
                os.path.join(os.path.dirname(__file__), 'requirements.txt')]
            )
            print("Dependencias instaladas!")

        if os.environ.get('HTTPS_MODE'):
            from database.certs import gen_cert, CERT_PEM, KEY_PEM
            from cheroot.wsgi import Server as CherootServer
            from cheroot.ssl.builtin import BuiltinSSLAdapter
            gen_cert()

            def _open_browser():
                time.sleep(2.0)
                webbrowser.open(f'https://localhost:{_PORT}')
            threading.Thread(target=_open_browser, daemon=True).start()

            print("\n" + "=" * 50)
            print("  Key O'Clock v1.0")
            print(f"  https://localhost:{_PORT}")
            print("  admin / admin")
            print("  Ctrl+C para encerrar")
            print("=" * 50 + "\n")

            server = CherootServer((_HOST, _PORT), app, numthreads=10)
            adapter = BuiltinSSLAdapter(CERT_PEM, KEY_PEM)
            adapter.context.set_alpn_protocols(['http/1.1'])
            adapter.context.minimum_version = ssl.TLSVersion.TLSv1_2
            server.ssl_adapter = adapter
            _suppress_ssl_eof()
            try:
                server.start()
            except KeyboardInterrupt:
                server.stop()
        else:
            def _open_browser():
                time.sleep(1.5)
                webbrowser.open(f'http://localhost:{_PORT}')
            threading.Thread(target=_open_browser, daemon=True).start()

            print("\n" + "=" * 50)
            print("  Key O'Clock v1.0")
            print(f"  http://localhost:{_PORT}")
            print("  admin / admin")
            print("  Ctrl+C para encerrar")
            print("=" * 50 + "\n")

            app.run(
                debug=False,
                host=_HOST,
                port=_PORT,
                threaded=True,
                use_reloader=False,
            )
