# Standalone OpenRouter connectivity check; makes a real external API request.

import os
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
        "Content-Type": "application/json"
    },
    json={
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
        "messages": [
            {
                "role": "user",
                "content": "My fasting glucose is 140 mg/dL. What does it mean?"
            }
        ]
    }
)

print(response.json())
