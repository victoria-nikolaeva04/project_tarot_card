"""Summarise logs/oracle_usage.jsonl: python usage_report.py"""
import glob
import json
from collections import Counter, defaultdict

rows = []
for path in sorted(glob.glob('logs/oracle_usage.jsonl*')):
    with open(path, encoding='utf-8') as f:
        rows += [json.loads(line) for line in f if line.strip()]

if not rows:
    raise SystemExit('No usage logged yet.')

by_day = defaultdict(lambda: Counter())
by_visitor = Counter()
outcomes = Counter(r['outcome'] for r in rows)
for r in rows:
    day = r['time'][:10]
    by_day[day]['requests'] += 1
    by_day[day]['tokens'] += r['total_tokens']
    by_visitor[r['visitor']] += r['total_tokens']

print(f'{len(rows)} requests, {sum(r["total_tokens"] for r in rows)} tokens in total\n')
print('Per day:')
for day, c in sorted(by_day.items()):
    print(f'  {day}: {c["requests"]} requests, {c["tokens"]} tokens')
print('\nTop visitors by tokens:')
for visitor, tokens in by_visitor.most_common(5):
    print(f'  {visitor}: {tokens}')
print('\nOutcomes:', dict(outcomes))
