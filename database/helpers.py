"""
database/helpers.py
Funções utilitárias compartilhadas entre os módulos de rotas.
"""
from datetime import date

# ─── VALIDAÇÃO DE ENTRADA ──────────────────────────────────────────────────────

VALID_LICENSE_TYPES = frozenset({
    'suporte', 'manutencao', 'funcionalidade', 'oem',
    'device', 'volume', 'subscription', 'cal',
})


def validate_input(**fields) -> str | None:
    """
    Valida comprimento máximo de campos de texto.

    Uso:  validate_input(nome=(valor, 255), notas=(valor, 2000))
    Retorna mensagem de erro localizada, ou None se tudo estiver dentro dos limites.
    """
    for name, (value, max_len) in fields.items():
        if value is not None and len(str(value)) > max_len:
            return f"O campo '{name}' não pode exceder {max_len} caracteres."
    return None


def lic_status(lic: dict) -> tuple[str, int | None]:
    """
    Calcula o status de uma licença e os dias restantes.

    Retorna:
        (status, dias_restantes)
        status: 'perpetual'(Vitalícia) | 'valid'(Saudável) | 'soon'(Atenção≤90d) | 'warning'(Aviso≤60d) | 'critical'(Crítico≤30d) | 'expired' | 'unknown'
        dias_restantes: int ou None para perpétuas/sem data
    """
    if lic['is_perpetual']:
        return 'perpetual', None

    if not lic['end_date']:
        return 'unknown', None

    today = date.today()
    end = date.fromisoformat(lic['end_date'])
    days = (end - today).days

    if days < 0:   return 'expired',  days
    if days <= 30: return 'critical', days
    if days <= 60: return 'warning',  days
    if days <= 90: return 'soon',     days
    return 'valid', days


def format_date_br(iso_date: str | None) -> str | None:
    """Converte 'YYYY-MM-DD' para 'DD/MM/YYYY'."""
    if not iso_date:
        return None
    return f"{iso_date[8:10]}/{iso_date[5:7]}/{iso_date[0:4]}"
