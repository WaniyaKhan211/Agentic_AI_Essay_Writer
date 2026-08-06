import base64
import uuid
import traceback
from db_config.supabase_client import supabase

BUCKET_NAME = "essay_writer_images"


def ensure_bucket_exists(bucket_name: str = BUCKET_NAME):
    
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = [b.name if hasattr(b, "name") else b.get("name") for b in buckets]
        if bucket_name not in bucket_names:
            supabase.storage.create_bucket(
                bucket_name,
                options={"public": True}
            )
            print(f"[Supabase Storage] Created bucket '{bucket_name}' with public access.")
    except Exception as e:
        print(f"[Supabase Storage] Bucket check/creation note: {e}")


def upload_image_data_uri(
    data_uri: str,
    session_id: str,
    message_id: str,
    index: int,
    bucket_name: str = BUCKET_NAME
) -> str:
    """
    Decodes a base64 data URI image and uploads it to Supabase Storage.
    Returns the object path (storage key) on success, or None on failure.
    
    Folder structure: {session_id}/{message_id}/image_{index+1}_{uuid}.png
    """
    try:
        ensure_bucket_exists(bucket_name)

        if "," in data_uri:
            header, base64_data = data_uri.split(",", 1)
        else:
            base64_data = data_uri

        image_bytes = base64.b64decode(base64_data)
        unique_id = uuid.uuid4().hex[:8]
        file_path = f"{session_id}/{message_id}/image_{index + 1}_{unique_id}.png"

        response = supabase.storage.from_(bucket_name).upload(
            file_path,
            image_bytes,
            file_options={"content-type": "image/png"}
        )

        print(f"[Supabase Storage] Successfully uploaded image to '{file_path}'")
        return file_path
    except Exception as e:
        print(f"[Supabase Storage] Failed to upload image for session {session_id}, msg {message_id}: {e}")
        traceback.print_exc()
        return None


def get_accessible_url(path: str, bucket_name: str = BUCKET_NAME) -> str:
    """
    Converts a storage object path key into an accessible public/signed URL.
    """
    if not path:
        return ""
    
    # If path is already a full http(s) URL or data URI, return as-is
    if path.startswith("http://") or path.startswith("https://") or path.startswith("data:"):
        return path

    try:
        res = supabase.storage.from_(bucket_name).get_public_url(path)
        if hasattr(res, "public_url"):
            return res.public_url
        if isinstance(res, dict) and "publicUrl" in res:
            return res["publicUrl"]
        return str(res)
    except Exception as e:
        print(f"[Supabase Storage] Error getting public URL for path '{path}': {e}")
        return path
