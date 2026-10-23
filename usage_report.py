"""Summarise logs/oracle_usage.jsonl: python usage_report.py"""
import glob
import json
from collections import Counter, defaultdict

log_entries = []
for path in sorted(glob.glob('logs/oracle_usage.jsonl*')):
    with open(path, encoding='utf-8') as f:
        log_entries += [json.loads(line) for line in f if line.strip()]

if not log_entries:
    raise SystemExit('No usage logged yet.')

by_day = defaultdict(Counter)
by_visitor = Counter()
outcomes = Counter(entry['outcome'] for entry in log_entries)
for entry in log_entries:
    day = entry['time'][:10]
    by_day[day]['requests'] += 1
    by_day[day]['tokens'] += entry['total_tokens']
    by_visitor[entry['visitor']] += entry['total_tokens']

print(f'{len(log_entries)} requests, {sum(entry["total_tokens"] for entry in log_entries)} tokens in total\n')
print('Per day:')
for day, totals in sorted(by_day.items()):
    print(f'  {day}: {totals["requests"]} requests, {totals["tokens"]} tokens')
print('\nTop visitors by tokens:')
for visitor, tokens in by_visitor.most_common(5):
    print(f'  {visitor}: {tokens}')
print('\nOutcomes:', dict(outcomes))
