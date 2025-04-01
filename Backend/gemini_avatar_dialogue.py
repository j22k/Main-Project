from google.genai import types
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

def generate_dialgoue_client_sdk(action, state, user_context=None):
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    model = "gemini-2.0-flash"
    
    # System instruction as a single Content with role "system"
    system_content = types.Content(
        role="system",
        parts=[types.Part.from_text("You are an AI assistant helping students with learning disabilities. Your task is to generate a short, encouraging sentence for an avatar to say based on the student's emotional state and the recommended action. Respond with only the sentence, no additional text or explanations.")]
    )
    
    # User prompt
    prompt = f"Emotional state: {state}\n"
    prompt += f"Recommended action: {action}\n\n"
    if user_context:
        prompt += f"Additional context: {user_context}\n\n"
    
    contents = [
        system_content,
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ]
    
    config = types.GenerateContentConfig(
        temperature=0.7,
        top_p=0.9,
        top_k=40,
        max_output_tokens=100,
        response_mime_type="text/plain",
    )
    
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config
    )
    print("\n\n", response.text.strip())
    return response.text.strip()