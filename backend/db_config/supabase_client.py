import os

from dotenv import load_dotenv
from supabase import create_client, Client
from supabase.client import ClientOptions

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url:
    raise ValueError("SUPABASE_URL is missing.")

if not key:
    raise ValueError("SUPABASE_KEY is missing.")

supabase: Client = create_client(
    url,
    key,
    options=ClientOptions(
        postgrest_client_timeout=10,
        storage_client_timeout=10,
        schema="public",
    ),
)