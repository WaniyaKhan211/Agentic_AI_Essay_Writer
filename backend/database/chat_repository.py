from db_config.supabase_client import supabase
from datetime import datetime

def create_chat_session(session_id: str, title: str):
    response = (
        supabase
        .table("chat_sessions")
        .insert({
            "session_id": session_id,
            "title": title
        })
        .execute()
    )
    return response.data

def session_exists(session_id: str):
    response = (
        supabase
        .table("chat_sessions")
        .select("session_id")
        .eq("session_id", session_id)
        .execute()
    )
    return len(response.data) > 0

def save_message(
    session_id: str,
    role: str,
    content: str,
    status: str = "visible",
    version: int = 1,
    parent_id: str = None
):
    response = (
        supabase
        .table("chat_messages")
        .insert({
            "session_id": session_id,
            "role": role,
            "content": content,
            "status": status,
            "version": version,
            "parent_id": parent_id
        })
        .execute()
    )
    return response.data

def hide_messages_from(session_id: str, message_ids: list):

    #Flags old edited messages/responses as 'hidden' so they don't load on reload.
    if not message_ids:
        return []

    response = (
        supabase
        .table("chat_messages")
        .update({"status": "hidden"})
        .eq("session_id", session_id)
        .in_("message_id", message_ids)
        .execute()
    )
    return response.data

def get_chat_messages(session_id: str):

    #Only fetches messages with status = 'visible'
    
    response = (
        supabase
        .table("chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .eq("status", "visible")
        .order("created_at")
        .execute()
    )
    return response.data

def get_chat_sessions():
    response = (
        supabase
        .table("chat_sessions")
        .select("*")
        .order("updated_at", desc=True)
        .execute()
    )
    return response.data

def update_session_timestamp(session_id: str):
    response = (
        supabase
        .table("chat_sessions")
        .update({
            "updated_at": datetime.utcnow().isoformat()
        })
        .eq("session_id", session_id)
        .execute()
    )
    return response.data