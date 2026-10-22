import os
import re
import threading
import time
from collections import defaultdict, deque
from flask import Flask, jsonify, render_template, request
import pandas as pd
import httpx
from ai_oracle import read_tarot_reading, EmptyReading
from usage_log import log_oracle_request
from google.genai import errors as genai_errors

app = Flask(__name__)

cards_df = pd.read_csv('tarot_card_meanings.csv')
cards_df.columns = cards_df.columns.str.strip()

cards_directory = os.path.join(app.static_folder, "images", "cards")

# Image files use "Pents" instead of "Pentacles"
suit_prefix = {
    "Wands": "Wands", "Cups": "Cups", "Swords": "Swords", "Pentacles": "Pents"
    }

# Minor Arcana ranks map to the 01-14 numbering in the image filenames
rank_number = {
    "Ace": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5, "Six": 6, "Seven": 7,
    "Eight": 8, "Nine": 9, "Ten": 10, "Page": 11, "Knight": 12, "Queen": 13, "King": 14,
    }

card_names = set(cards_df["card_name"])

# Cards without an astrological association would otherwise show "nan"
cards_df["zodiac_sign"] = cards_df["zodiac_sign"].fillna("No Sign")


def _index_major_arcana_images():
    """Map "hanged_man" -> "12_Hanged_Man.webp" for every file in the card image folder."""
    index = {}
    if os.path.exists(cards_directory):
        for filename in os.listdir(cards_directory):
            stem = os.path.splitext(filename)[0].lower()
            # Strip the "00_" number so the stem matches the cleaned card name
            index.setdefault(re.sub(r"^\d+_", "", stem), filename)
    return index


major_arcana_images = _index_major_arcana_images()


def get_image_filename(card_name):
    match = re.fullmatch(r"(\w+) of (\w+)", card_name)
    if match and match.group(1) in rank_number and match.group(2) in suit_prefix:
        rank, suit = match.groups()
        return f"{suit_prefix[suit]}{rank_number[rank]:02d}.webp"

    name_clean = re.sub(r"^The\s+", "", card_name)
    name_clean = re.sub(r"\s+", "_", name_clean).lower()

    return major_arcana_images.get(name_clean, "Cover.webp")


data_records = cards_df.to_dict(orient='records')
for record in data_records:
    record["image_file"] = get_image_filename(record["card_name"])


@app.route('/')
def home():
    return render_template('index.html', tarot_cards = data_records)

@app.route('/reading')
def reading():
    return render_template('reading.html', tarot_cards = data_records)

@app.route('/guide')
def guide():
    return render_template('guide.html', tarot_cards = data_records)

# AI Oracle: what the visitor sees for each kind of failure.
# "sign" is the heading on the little board by the crystal ball, "aside" the joke added to the message.
ORACLE_ERRORS = {
    'quota':   dict(status=429, message="The Oracle is on a break.",
                    sign="Will be back", aside="(gone for a snack)"),
    'busy':    dict(status=503, message="The Oracle's crystal ball is fogging up.",
                    sign="Back in a minute", aside="(very popular today)"),
    'timeout': dict(status=504, message="The Oracle took too long to find her words.",
                    sign="Brain freeze", aside="(she lost her train of thought)"),
    'offline': dict(status=502, message="The Oracle can't reach the spirit realm.",
                    sign="No signal", aside="(the spirits are offline)"),
    'locked':  dict(status=502, message="The Oracle can't get into her own tower.",
                    sign="Closed", aside="(lost the key)"),
    'missing': dict(status=502, message="The Oracle has misplaced her crystal ball.",
                    sign="Gone looking", aside="(it rolled away)"),
    'silent':  dict(status=502, message="The spirits whispered nothing this time.",
                    sign="No comment", aside="(the cards are shy)"),
    'rumble':  dict(status=502, message="Something rumbled in the spirit realm.",
                    sign="Out of order", aside="(not your fault)"),
    'slowdown': dict(status=429, message="The Oracle needs a moment between readings.",
                    sign="One at a time", aside="(she only has one crystal ball)"),
    'generic': dict(status=502, message="The Oracle is silent right now. Please try again in a moment."),
}

# Guardrail: each visitor gets a few readings per window, so one browser can't burn through the quota.
# Kept in memory per server process; behind a proxy, make sure request.remote_addr is the visitor's address.
RATE_LIMIT = 4
RATE_WINDOW = 60
reading_times_by_visitor = defaultdict(deque)
_reading_times_lock = threading.Lock()
_SWEEP_THRESHOLD = 1000   # tracked visitors before idle ones are dropped, so memory stays bounded

def rate_limit_wait_seconds(visitor):
    """Return 0 and record the reading if allowed, else the seconds until the visitor may retry."""
    now = time.monotonic()
    with _reading_times_lock:
        if len(reading_times_by_visitor) > _SWEEP_THRESHOLD:
            idle_visitors = [other for other, times in reading_times_by_visitor.items()
                             if not times or now - times[-1] > RATE_WINDOW]
            for other in idle_visitors:
                del reading_times_by_visitor[other]
        visitor_times = reading_times_by_visitor[visitor]
        while visitor_times and now - visitor_times[0] > RATE_WINDOW:
            visitor_times.popleft()
        if len(visitor_times) >= RATE_LIMIT:
            return int(RATE_WINDOW - (now - visitor_times[0])) + 1
        visitor_times.append(now)
        return 0

def classify_oracle_error(error):
    if isinstance(error, EmptyReading):
        return 'silent'
    if isinstance(error, httpx.TimeoutException):
        return 'timeout'
    if isinstance(error, httpx.TransportError):
        return 'offline'
    if isinstance(error, genai_errors.APIError):
        return {
            429: 'quota', 503: 'busy', 504: 'timeout',
            401: 'locked', 403: 'locked', 404: 'missing', 500: 'rumble',
        }.get(error.code, 'generic')
    return 'generic'

# Errors worth a full traceback in the logs (the rest are expected, user-facing conditions)
UNEXPECTED_ORACLE_ERRORS = frozenset({'generic', 'rumble', 'locked', 'missing'})

def are_valid_picks(cards):
    return (
        isinstance(cards, list) and len(cards) == 3
        and all(
            isinstance(c, dict) and isinstance(c.get('name'), str) and c['name'] in card_names
            for c in cards
        )
    )

def oracle_error_body(error_info):
    body = {"error": error_info["message"]}
    if "sign" in error_info:
        body.update(sign=error_info["sign"], aside=error_info["aside"])
    return body

@app.route('/oracle', methods=['POST'])
def oracle():
    payload = request.get_json(silent=True)
    cards = payload.get('cards') if isinstance(payload, dict) else None
    if not are_valid_picks(cards):
        return jsonify(error="Pick exactly three valid cards."), 400

    visitor = request.remote_addr
    retry_after = rate_limit_wait_seconds(visitor)
    if retry_after:
        log_oracle_request(visitor, cards, 'slowdown', time.time())
        error_info = ORACLE_ERRORS['slowdown']
        response = jsonify(oracle_error_body(error_info))
        response.headers['Retry-After'] = str(retry_after)
        return response, error_info["status"]

    picks = [{"name": c["name"], "reversed": bool(c.get("reversed"))} for c in cards]
    stats = {}
    started = time.time()
    try:
        reading = read_tarot_reading(picks, stats)
        log_oracle_request(visitor, picks, 'ok', started, stats)
        return jsonify(reading=reading)
    except Exception as error:
        kind = classify_oracle_error(error)
        log_oracle_request(visitor, picks, kind, started, stats, error)
        app.logger.warning("Oracle failed (%s): %s", kind, error, exc_info=kind in UNEXPECTED_ORACLE_ERRORS)
        error_info = ORACLE_ERRORS[kind]
        return jsonify(oracle_error_body(error_info)), error_info["status"]

@app.route('/about')
def about():
    return render_template('about.html')


if __name__ == '__main__':
    app.run(debug=True)
