from flask import Flask, render_template
import pandas as pd

app = Flask(__name__)

@app.route('/')
def home():
    df = pd.read_csv('tarot_card_meanings.csv')
    
    # Converting DataFrame into a Dictionary 
    data_records = df.to_dict(orient='records')
    
    #Passing into index.html
    return render_template('index.html', tarot_cards=data_records)

if __name__ == '__main__':
    app.run(debug=True)
