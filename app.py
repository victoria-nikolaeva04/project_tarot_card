import os
import re
from flask import Flask, jsonify, render_template, request
import pandas as pd
from ai_oracle import read_tarot_reading

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
        return f"{suit_prefix[suit]}{number_rank[rank]:02d}.jpg"

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
    return "Cover.jpg"

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

    picks = [{"name": c["name"], "reversed": bool(c.get("reversed"))} for c in cards]
    try:
        return jsonify(reading=read_tarot_reading(picks))
    except Exception:
        app.logger.exception("Oracle request failed")
        return jsonify(error="The Oracle is silent right now. Please try again in a moment."), 502

# About Page
@app.route('/about')
def about():
    return render_template('about.html')


if __name__ == '__main__':
    app.run(debug=True)
