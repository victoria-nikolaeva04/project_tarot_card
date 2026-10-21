import os
import re
import time
from collections import defaultdict, deque
from flask import Flask, jsonify, render_template, request
import pandas as pd
import httpx
from ai_oracle import read_tarot_reading, EmptyReading
from usage_log import log_oracle_request
from google.genai import errors as genai_errors

app = Flask(__name__)

# Global Variable
df = pd.read_csv('tarot_card_meanings.csv')
df.columns = df.columns.str.strip()

cards_directory = os.path.join(app.static_folder, "images", "cards")

# Image files use "Pents" instead of "Pentacles"
suit_prefix = {
    "Wands": "Wands", "Cups": "Cups", "Swords": "Swords", "Pentacles": "Pents"
    }

# Minor Arcana ranks map to the 01-14 numbering in the image filenames
number_rank = {
    "Ace": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5, "Six": 6, "Seven": 7,
    "Eight": 8, "Nine": 9, "Ten": 10, "Page": 11, "Knight": 12, "Queen": 13, "King": 14,
    }

card_names = set(df["card_name"])

# Cards without an astrological association would otherwise show "nan"
df["zodiac_sign"] = df["zodiac_sign"].fillna("No Sign")


def get_image_filename(card_name):
    # Minor Arcana: "Ace of Cups" -> "Cups01.jpg"
    match = re.fullmatch(r"(\w+) of (\w+)", card_name)
    if match and match.group(1) in number_rank and match.group(2) in suit_prefix:
        rank, suit = match.groups()
        return f"{suit_prefix[suit]}{number_rank[rank]:02d}.webp"

    # Major Arcana: "The Hanged Man" -> "12_Hanged_Man.jpg"
    name_clean = re.sub(r"^The\s+", "", card_name)
    name_clean = re.sub(r"\s+", "_", name_clean).lower()

    if os.path.exists(cards_directory):
        for filename in os.listdir(cards_directory):
            stem = os.path.splitext(filename)[0].lower()
            # Strip the "00_" number before comparison
            if re.sub(r"^\d+_", "", stem) == name_clean:
                return filename

    # Default fallback
    return "Cover.webp"

# Convert dataset into records and pre-calculate all image filenames
data_records = df.to_dict(orient='records')
for record in data_records:
    record["image_file"] = get_image_filename(record["card_name"])


# --- Website Navigation ---
# Landing Page
@app.route('/')
def home():
    return render_template('index.html', tarot_cards = data_records)

# Readings
@app.route('/reading')
def reading():
    return render_template('reading.html', tarot_cards = data_records)

# Guide/Card Dictionary
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
RATE_LIMIT = 4        # readings
RATE_WINDOW = 60      # seconds
recent_readings = defaultdict(deque)

def too_many_readings(visitor):
    now = time.monotonic()
    history = recent_readings[visitor]
    while history and now - history[0] > RATE_WINDOW:
        history.popleft()
    if len(history) >= RATE_LIMIT:
        return int(RATE_WINDOW - (now - history[0])) + 1
    history.append(now)
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

# AI Oracle: interprets the three cards picked on the reading page
@app.route('/oracle', methods=['POST'])
def oracle():
    cards = (request.get_json(silent=True) or {}).get('cards')
    valid = (
        isinstance(cards, list) and len(cards) == 3
        and all(isinstance(c, dict) and c.get('name') in card_names for c in cards)
    )
    if not valid:
        return jsonify(error="Pick exactly three valid cards."), 400

    retry_after = too_many_readings(request.remote_addr)
    if retry_after:
        log_oracle_request(request.remote_addr, cards, 'slowdown', time.time())
        info = ORACLE_ERRORS['slowdown']
        response = jsonify(error=info["message"], sign=info["sign"], aside=info["aside"])
        response.headers['Retry-After'] = str(retry_after)
        return response, info["status"]

    picks = [{"name": c["name"], "reversed": bool(c.get("reversed"))} for c in cards]
    stats = {}
    started = time.time()
    try:
        reading = read_tarot_reading(picks, stats)
        log_oracle_request(request.remote_addr, picks, 'ok', started, stats)
        return jsonify(reading=reading)
    except Exception as error:
        kind = classify_oracle_error(error)
        log_oracle_request(request.remote_addr, picks, kind, started, stats, error)
        info = ORACLE_ERRORS[kind]
        app.logger.warning("Oracle failed (%s): %s", kind, error, exc_info=kind in ('generic', 'rumble', 'locked', 'missing'))
        body = {"error": info["message"]}
        if "sign" in info:
            body.update(sign=info["sign"], aside=info["aside"])
        return jsonify(body), info["status"]

# About Page
@app.route('/about')
def about():
    return render_template('about.html')


if __name__ == '__main__':
    app.run(debug=True)
