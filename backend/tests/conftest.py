import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# --- 1. Make sure backend/ is importable -----------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# --- 2. Load the REAL .env file first, before anything sets dummy values ---
load_dotenv(BACKEND_DIR / ".env")

# --- 3. Dummy fallback credentials (only used if a real key wasn't found) --
os.environ.setdefault("GROQ_API_KEY", "test-dummy-groq-key")
os.environ.setdefault("EXA_API_KEY", "test-dummy-exa-key")
os.environ.setdefault("HF_API_KEY", "test-dummy-hf-key")