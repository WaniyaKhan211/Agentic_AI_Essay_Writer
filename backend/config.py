import os
from dotenv import load_dotenv

load_dotenv()

# API KEYS
GROQ_API_KEY=os.getenv("GROQ_API_KEY")
HF_API_KEY=os.getenv("HF_API_KEY")
EXA_API_KEY=os.getenv("EXA_API_KEY")

#Models
GROQ_MODEL= "openai/gpt-oss-120b"
HF_MODEL= "black-forest-labs/FLUX.1-Krea-dev"

TEMPERATURE =0.7
MAX_TOKENS = 2000
THRESHOLD_SCORE = 90
MAX_RETRIES = 3