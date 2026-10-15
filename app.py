import os
import re
from flask import Flask, render_template
import pandas as pd

app = Flask(__name__)

def get_image_filename(card_name):
    name_clean = card_name.lower()
    name_clean = re.sub(r"[^\w\s\-]", "", name_clean)
    name_clean = re.sub(r"[\s\-]+", "_", name_clean)

    cards_directory = os.path.join(app.static_folder, "images", "cards")

    if os.path.exists(cards_directory):
        for filename in os.listdir(cards_directory):
            if filename.lower().endswith(f"{name_clean}.jpg") or filename.lower().endswith(
                f"{name_clean}.png"
            ):
                return filename
            
    # Default fallback
    return f"{name_clean}.jpg"

@app.route('/')
def home():
    df = pd.read_csv('tarot_card_meanings.csv')
    
    # Converting DataFrame into a Dictionary 
    data_records = df.to_dict(orient='records')

    # Dynamically injecting new filename key to each dict. item
    for record in data_records:
        record["image_file"] = get_image_filename(record["card_name"])
    
    #Passing into index.html
    return render_template('index.html', tarot_cards=data_records)

if __name__ == '__main__':
    app.run(debug=True)
