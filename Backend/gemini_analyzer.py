#.\venv\Scripts\activate
import os
import json
import re
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

def markdown_to_json(markdown_text):
    """
    Remove Markdown code block markers (```json and ```) from a string
    and convert the remaining JSON text into a Python dictionary.
    """
    pattern = r"```(?:json)?\s*([\s\S]*?)\s*```"
    match = re.search(pattern, markdown_text)
    if match:
        json_text = match.group(1)
    else:
        json_text = markdown_text  # Use entire text if no Markdown markers found
    try:
        json_obj = json.loads(json_text)
        return json_obj
    except json.JSONDecodeError as e:
        print("Error decoding JSON:", e)
        return None

def identify(data):
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    model = "gemini-2.0-flash"
    
    # Convert data to JSON string and handle non-serializable objects (like datetime)
    json_data = json.dumps(data, default=str)
    
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=json_data),
            ],
        ),
    ]
    generate_content_config = types.GenerateContentConfig(
        temperature=1,
        top_p=0.95,
        top_k=40,
        max_output_tokens=8192,
        response_mime_type="text/plain",
        system_instruction=[
            types.Part.from_text(text="""You are an advanced AI model designed to assess learning disabilities and emotional states in students. Based on provided assessment results, generate a structured JSON output adhering to this format:

{
  "studentProfile": {
    "userID": "<user_id>",
    "email": "<user_email>",
    "taskPerformance": {
      "numberComparison": {
        "accuracyPercentage": <float>,
        "averageResponseTime": <float>,
        "interpretation": "<interpretation_text>",
        "suggestedNextSteps": ["<step_1>", "<step_2>"]
      },
      "handwriting": {
        "characteristics": ["<characteristic_1>", "<characteristic_2>"],
        "interpretation": "<interpretation_text>",
        "suggestedNextSteps": ["<step_1>", "<step_2>"]
      },
      "letterArrangement": {
        "originalWord": "<word>",
        "userArrangement": "<arranged_word>",
        "accuracy": <boolean>,
        "interpretation": "<interpretation_text>",
        "suggestedNextSteps": ["<step_1>", "<step_2>"]
      }
    }
  },
  "learningDisabilities": {
    "Dyslexia": {
      "confidenceScore": <float>,
      "indicators": ["<symptom_1>"]
    },
    "Dysgraphia": {
      "confidenceScore": <float>,
      "indicators": ["<symptom_1>"]
    },
    "Dyscalculia": {
      "confidenceScore": <float>,
      "indicators": ["<symptom_1>"]
    }
  },
  "emotionAnalysis": {
    "dominantEmotions": ["<emotion_1>", "<emotion_2>"],
    "emotionOccurrences": {"<emotion_1>": <count>},
    "graphData": [{"emotion": "<emotion_name>", "count": <integer>}]
  }
}

### Instructions:
1. Extract performance data from tasks and summarize key strengths and weaknesses.
2. Provide actionable insights in the interpretation and suggestedNextSteps fields.
3. Assess potential learning disabilities based on observed behaviors, using confidence scores.
4. Analyze emotional state, if relevant data is present.

Ensure that all values are meaningful and backed by the given input data.
"""),
        ],
    )

    response_string = ""
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        print(chunk.text, end="")
        response_string += chunk.text

    print("\n\nData:\n", response_string)
    
    json_object = markdown_to_json(response_string)
    print("\nConverted JSON Object:")
    print(json_object)
    
    return json_object
