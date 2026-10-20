import pandas as pd
from dotenv import load_dotenv
from google import genai

# 1. Load the environment variables from your .env file
load_dotenv()

# 2. Initialize the client.
# It automatically looks for the 'GEMINI_API_KEY' environment variable.
client = genai.Client()

# 3. Card meanings come from the same CSV the rest of the site uses
meanings = pd.read_csv('tarot_card_meanings.csv')
meanings.columns = meanings.columns.str.strip()
meanings = meanings.set_index('card_name')

POSITIONS = ['Past', 'Present', 'Future']


def describe_card(position, name, is_reversed):
    """Build the prompt lines for one drawn card using its CSV meanings."""
    row = meanings.loc[name]
    orientation = 'Reversed' if is_reversed else 'Upright'
    main_meaning = row['reversed_meaning'] if is_reversed else row['upright_meaning']

    lines = [
        f"{position}: {name} ({orientation})",
        f"  Meaning: {main_meaning}",
        f"  Love: {row['love_meaning']}",
        f"  Career: {row['career_meaning']}",
        f"  Yes or no: {row['yes_or_no']}",
    ]
    if pd.notna(row['element']):
        lines.append(f"  Element: {row['element']}")
    return '\n'.join(lines)


def read_tarot_reading(picks):
    """
    Acts as an AI Oracle to interpret the three cards the user picked.

    picks: list of {"name": "The Fool", "reversed": False}, in Past, Present, Future order.
    Returns the reading as plain text paragraphs.
    """
    if len(picks) != len(POSITIONS):
        raise ValueError(f"A reading needs exactly {len(POSITIONS)} cards.")

    drawn_cards = '\n\n'.join(
        describe_card(position, pick['name'], bool(pick['reversed']))
        for position, pick in zip(POSITIONS, picks)
    )

    prompt = f"""
    You are an ancient, wise, and intuitive Tarot Oracle. Your goal is to interpret a three-card
    (Past, Present, Future) tarot reading for a user who silently held a question in mind.
    Base your interpretation on the card meanings provided below, and connect the cards into one story.

    Guidelines:
    - Keep the tone mystical, compassionate, and empowering, but completely free of technical jargon.
    - Write a short introduction.
    - Cover each card in turn in relation to its position, using the meanings given.
    - Conclude with a clear, actionable piece of advice based on the overall reading.
    - Keep it between 200 to 300 words.
    - Write plain paragraphs separated by blank lines. Do not use markdown, bullet points, or headings.

    CARDS DRAWN:
    {drawn_cards}
    """

    response = client.models.generate_content(
        model='gemini-3.8-flash',
        contents=prompt,
    )

    return response.text
