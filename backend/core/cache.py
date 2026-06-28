import time
import hashlib
import json

class TTLCache:
    def __init__(self, ttl_seconds=60, max_size=128):
        self._cache = {}
        self._ttl = ttl_seconds
        self._max_size = max_size

    def _key(self, *args, **kwargs):
        raw = json.dumps((args, sorted(kwargs.items())), sort_keys=True, default=str)
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, key):
        if key in self._cache:
            entry = self._cache[key]
            if time.time() - entry["ts"] < self._ttl:
                return entry["value"]
            del self._cache[key]
        return None

    def set(self, key, value):
        if len(self._cache) >= self._max_size:
            oldest = min(self._cache.keys(), key=lambda k: self._cache[k]["ts"])
            del self._cache[oldest]
        self._cache[key] = {"value": value, "ts": time.time()}

    def clear(self):
        self._cache.clear()

    def invalidate(self, *args, **kwargs):
        k = self._key(*args, **kwargs)
        self._cache.pop(k, None)


db_cache = TTLCache(ttl_seconds=30, max_size=256)
nvd_cache = TTLCache(ttl_seconds=300, max_size=128)
groq_cache = TTLCache(ttl_seconds=600, max_size=64)
