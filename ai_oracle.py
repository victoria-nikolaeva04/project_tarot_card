import os
from dotenv import load_dotenv
from google import genai

# 1. Load the environment variables from your .env file
load_dotenv()

# 2. Initialize the client. 
# It automatically looks for the 'GEMINI_API_KEY' environment variable.
client = genai.Client()

print("Gemini Client successfully initialized!")

# 3. Ask the AI a question using the recommended model
response = client.models.generate_content(
    model='gemini-3.8-flash',
    contents='Give me a 3-step tip for learning to code in Python.',
)

# 4. Print the result
print("\nGemini Response:")
print(response.text)

