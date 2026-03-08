"""
database/db.py
Conexão com SQLite, helpers de query e inicialização do schema.
"""
import sqlite3
import os
import sys
import base64
import logging
from werkzeug.security import generate_password_hash
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

_logger = logging.getLogger(__name__)

if getattr(sys, 'frozen', False):
    _DEFAULT_DATA_DIR = os.path.join(
        os.environ.get('PROGRAMDATA', 'C:\\ProgramData'), 'Key O\'Clock'
    )
else:
    _DEFAULT_DATA_DIR = os.path.normpath(
        os.path.join(os.path.dirname(__file__), '..', 'instance')
    )

_DATA_DIR = os.environ.get('KEYOCLOCK_DATA_DIR', _DEFAULT_DATA_DIR)
DB_PATH   = os.path.join(_DATA_DIR, 'keyoclock.db')
_KEY_FILE = os.path.join(_DATA_DIR, '.enc_key')

_app_enc_key: bytes | None = None


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def qall(sql, params=()):
    """Retorna lista de dicts com todos os resultados."""
    with get_db() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def qone(sql, params=()):
    """Retorna um dict com o primeiro resultado, ou None."""
    with get_db() as conn:
        r = conn.execute(sql, params).fetchone()
        return dict(r) if r else None


def execute(sql, params=()):
    """Executa um comando DML e retorna o lastrowid."""
    conn = get_db()
    cur = conn.execute(sql, params)
    conn.commit()
    last_id = cur.lastrowid
    conn.close()
    return last_id


_ENC_PREFIX = 'enc:'


def derive_enc_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=480000)
    return base64.urlsafe_b64encode(kdf.derive(password.encode()))


def encrypt_val(fernet_key: bytes, value: str) -> str:
    return _ENC_PREFIX + Fernet(fernet_key).encrypt(value.encode()).decode()


def decrypt_val(fernet_key, value: str) -> str:
    if not value or not value.startswith(_ENC_PREFIX):
        return value
    if fernet_key is None:
        return ''
    try:
        return Fernet(fernet_key).decrypt(value[len(_ENC_PREFIX):].encode()).decode()
    except InvalidToken:
        return ''


def load_enc_key() -> None:
    global _app_enc_key
    if os.path.exists(_KEY_FILE):
        with open(_KEY_FILE, 'rb') as f:
            data = f.read().strip()
        _app_enc_key = data if data else None


def get_enc_key() -> bytes | None:
    return _app_enc_key


def set_enc_key(fernet_key: bytes) -> None:
    global _app_enc_key
    os.makedirs(os.path.dirname(os.path.abspath(_KEY_FILE)), exist_ok=True)
    with open(_KEY_FILE, 'wb') as f:
        f.write(fernet_key)
    try:
        os.chmod(_KEY_FILE, 0o600)
    except OSError:
        pass
    _app_enc_key = fernet_key


def log_audit(username, action, entity, entity_id, entity_name, details='', ip=''):
    """Registra uma entrada no log de auditoria."""
    execute(
        "INSERT INTO audit_log (username, action, entity, entity_id, entity_name, details, ip_address)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (username, action, entity, entity_id, entity_name, details, ip)
    )


def cfg_get(key: str) -> str:
    row = qone("SELECT value FROM app_config WHERE key = ?", (key,))
    return row['value'] if row else ''


def cfg_set(key: str, value: str) -> None:
    execute("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)", (key, value))


# ─── SCHEMA ────────────────────────────────────────────────────────────────────

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role         TEXT DEFAULT 'user',
    email        TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    active       INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS division (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    icon        TEXT DEFAULT '🏢',
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS device_list (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    division_id INTEGER NOT NULL REFERENCES division(id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_item (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    description  TEXT,
    model        TEXT,
    manufacturer TEXT,
    supplier     TEXT,
    list_id      INTEGER NOT NULL REFERENCES device_list(id) ON DELETE CASCADE,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id      INTEGER NOT NULL REFERENCES inventory_item(id) ON DELETE CASCADE,
    license_type TEXT NOT NULL,
    is_perpetual INTEGER DEFAULT 0,
    quantity     INTEGER DEFAULT 1,
    contract     TEXT,
    start_date   TEXT,
    end_date     TEXT,
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   INTEGER,
    entity_name TEXT,
    details     TEXT,
    ip_address  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

# ─── ÍNDICES ───────────────────────────────────────────────────────────────────
# Aplicados via executescript — CREATE INDEX IF NOT EXISTS é idempotente.

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_license_deleted    ON license(deleted_at);
CREATE INDEX IF NOT EXISTS idx_license_item       ON license(item_id);
CREATE INDEX IF NOT EXISTS idx_license_end_date   ON license(end_date);
CREATE INDEX IF NOT EXISTS idx_item_list          ON inventory_item(list_id);
CREATE INDEX IF NOT EXISTS idx_item_deleted       ON inventory_item(deleted_at);
CREATE INDEX IF NOT EXISTS idx_list_division      ON device_list(division_id);
CREATE INDEX IF NOT EXISTS idx_list_deleted       ON device_list(deleted_at);
CREATE INDEX IF NOT EXISTS idx_division_deleted   ON division(deleted_at);
CREATE INDEX IF NOT EXISTS idx_audit_created      ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_username     ON audit_log(username);
"""

# Migrações para bancos existentes
# Formato: (tabela, coluna, SQL)
MIGRATIONS = [
    ("license",        "quantity",   "ALTER TABLE license        ADD COLUMN quantity   INTEGER DEFAULT 1"),
    ("license",        "contract",   "ALTER TABLE license        ADD COLUMN contract   TEXT"),
    # Soft delete — exclusão lógica em todas as tabelas principais
    ("division",       "deleted_at", "ALTER TABLE division       ADD COLUMN deleted_at TEXT DEFAULT NULL"),
    ("device_list",    "deleted_at", "ALTER TABLE device_list    ADD COLUMN deleted_at TEXT DEFAULT NULL"),
    ("inventory_item", "deleted_at", "ALTER TABLE inventory_item ADD COLUMN deleted_at TEXT DEFAULT NULL"),
    ("license",        "deleted_at",    "ALTER TABLE license        ADD COLUMN deleted_at    TEXT DEFAULT NULL"),
    ("license",        "cost_value",    "ALTER TABLE license        ADD COLUMN cost_value    TEXT"),
    ("license",        "cost_currency", "ALTER TABLE license        ADD COLUMN cost_currency TEXT DEFAULT 'BRL'"),
    ("user",           "must_change_password", "ALTER TABLE user           ADD COLUMN must_change_password INTEGER DEFAULT 0"),
]


def init_db():
    """Cria o banco, aplica o schema e executa migrações necessárias."""
    os.makedirs(_DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    # Restringe permissões do arquivo do banco: somente o dono pode ler/escrever
    try:
        os.chmod(DB_PATH, 0o600)
    except OSError:
        pass  # Windows não suporta chmod — ignora silenciosamente
    conn.executescript(SCHEMA)
    conn.commit()

    # Migrações incrementais — adiciona colunas ausentes sem perder dados
    for table_name, col_name, alter_sql in MIGRATIONS:
        existing_cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]
        if col_name not in existing_cols:
            conn.execute(alter_sql)
            conn.commit()
            _logger.info("Migração aplicada: '%s' em '%s'", col_name, table_name)

    # Índices aplicados após migrations para garantir que as colunas existam
    conn.executescript(INDEXES)

    # Usuário admin padrão
    if not conn.execute("SELECT id FROM user WHERE username='admin'").fetchone():
        _initial_pw = os.environ.get('KEYOCLOCK_INITIAL_PASSWORD', 'admin')
        conn.execute(
            "INSERT INTO user (username, password_hash, role, email, must_change_password)"
            " VALUES (?, ?, ?, ?, 1)",
            ('admin', generate_password_hash(_initial_pw), 'admin', 'admin@local')
        )
        conn.commit()
        _logger.warning("Admin criado. Use as credenciais iniciais para fazer login e altere a senha.")

    conn.close()
