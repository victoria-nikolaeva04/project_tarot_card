import os
from dotenv import load_dotenv
from google import genai

# 1. Load the environment variables from your .env file
load_dotenv()

# 2. Initialize the client. 
# It automatically looks for the 'GEMINI_API_KEY' environment variable.
client = genai.Client()

def read_tarot_reading(user_question, drawn_cards):
    """
    Acts as an AI Oracle to interpret the user's selected tarot cards 
    in relation to their specific question.
    """
    
    prompt = f"""
    You are an ancient, wise, and intuitive Tarot Oracle. Your goal is to interpret a tarot card reading for a user.
    Provide an insightful, digestible, and user-friendly reading that connects the meanings of the cards to their question. 

    Guidelines:
    - Keep the tone mystical, compassionate, and empowering, but completely free of technical jargon.
    - Write a short introduction addressing their situation.
    - Break down the meaning of each card individually in relation to its position.
    - Conclude with a clear, actionable summary or piece of advice based on the overall reading.

    USER'S QUESTION: 
    "{user_question}"

    CARDS DRAWN:
    {drawn_cards}
    """
    
    # Generate the interpretation
    response = client.models.generate_content(
        model='gemini-3.8-flash',
        contents=prompt,
    )
    
    return response.text

# --- Example Usage (Simulating a User's 3-Card Spread) ---
if __name__ == "__main__":
    
    # 1. Simulate the user's input from your application
    question = "Should I take the new job offer next week, or stay where I am?"
    
    # A standard 3-card spread data structure (Past, Present, Future)
    reading_data = [
        {"position": "Past (The Foundation)", "card": "The Fool", "orientation": "Upright"},
        {"position": "Present (The Current Challenge)", "card": "The Ten of Swords", "orientation": "Reversed"},
        {"position": "Future (The Potential Outcome)", "card": "The Star", "orientation": "Upright"}
    ]
    
    print("🔮 The Oracle is gazing into the cards...\n")
    
    # 2. Get the interpretation from the AI Oracle
    oracle_reading = read_tarot_reading(question, str(reading_data))
    
    print("--- 🌟 YOUR ORACLE READING 🌟 ---")
    print(oracle_reading)
