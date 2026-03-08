"""
database/ratelimit.py
Rate limiting simples em memória para endpoints pesados.
"""
import time
from collections import defaultdict

_buckets: dict = defaultdict(list)


def check(key: str, max_calls: int, window: int) -> bool:
    """Retorna True se a chamada é permitida, False se o limite foi atingido."""
    now = time.time()
    fresh = [t for t in _buckets[key] if now - t < window]
    if fresh:
        _buckets[key] = fresh
    elif key in _buckets:
        del _buckets[key]
    if len(fresh) >= max_calls:
        return False
    _buckets[key].append(now)
    return True
