"""Usage tracking for the AI Oracle: one JSON line per request, plus per-visitor token budgets."""
import hashlib
import json
import logging
import os
import time
from collections import defaultdict
from logging.handlers import RotatingFileHandler

LOG_DIR = 'logs'
DAILY_TOKEN_WARNING = 20000   # log a warning when one visitor passes this many tokens in a day
HOURLY_REQUEST_WARNING = 30   # ...or this many requests in an hour

os.makedirs(LOG_DIR, exist_ok=True)
usage_logger = logging.getLogger('oracle_usage')
usage_logger.setLevel(logging.INFO)
usage_logger.propagate = False
if not usage_logger.handlers:
    handler = RotatingFileHandler(os.path.join(LOG_DIR, 'oracle_usage.jsonl'),
                                  maxBytes=1_000_000, backupCount=5, encoding='utf-8')
    handler.setFormatter(logging.Formatter('%(message)s'))
    usage_logger.addHandler(handler)

_tokens_today = defaultdict(int)     # (visitor, day) -> tokens
_requests_hour = defaultdict(list)   # visitor -> request timestamps


def visitor_id(ip):
    """A short hash of the address, so usage can be grouped without storing the IP itself."""
    return hashlib.sha256((ip or 'unknown').encode()).hexdigest()[:12]


def log_oracle_request(ip, cards, outcome, started, stats=None, error=None):
    """Write one line: who (hashed), which cards, tokens used, how long, and how it ended."""
    stats = stats or {}
    visitor = visitor_id(ip)
    now = time.time()
    record = {
        'time': time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(now)),
        'visitor': visitor,
        'cards': [f"{c['name']}{' (R)' if c.get('reversed') else ''}" for c in cards],
        'outcome': outcome,   # "ok" or the error kind, e.g. "quota", "busy", "silent"
        'seconds': round(now - started, 2),
        'attempts': stats.get('attempts', 0),
        'prompt_tokens': stats.get('prompt_tokens', 0),
        'output_tokens': stats.get('output_tokens', 0),
        'thinking_tokens': stats.get('thinking_tokens', 0),
        'total_tokens': stats.get('total_tokens', 0),
    }
    if error is not None:
        record['error'] = f'{type(error).__name__}: {error}'[:300]
    usage_logger.info(json.dumps(record))
    _warn_on_unusual_usage(visitor, now, record['total_tokens'])


def _warn_on_unusual_usage(visitor, now, tokens_used):
    """Log a warning when one visitor spends far more tokens or makes far more requests than a normal person would."""
    day = time.strftime('%Y-%m-%d', time.localtime(now))
    _tokens_today[(visitor, day)] += tokens_used
    requests_this_hour = [t for t in _requests_hour[visitor] if now - t < 3600] + [now]
    _requests_hour[visitor] = requests_this_hour

    tokens_today = _tokens_today[(visitor, day)]
    if tokens_today > DAILY_TOKEN_WARNING:
        logging.getLogger(__name__).warning(
            'Oracle usage anomaly: visitor %s has used %d tokens today', visitor, tokens_today)
    if len(requests_this_hour) > HOURLY_REQUEST_WARNING:
        logging.getLogger(__name__).warning(
            'Oracle usage anomaly: visitor %s made %d requests in the last hour', visitor, len(requests_this_hour))
