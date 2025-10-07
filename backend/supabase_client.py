import os
import threading
from typing import Optional

from supabase import Client, create_client

_instance_lock = threading.Lock()
_client: Optional[Client] = None


def get_supabase_client() -> Optional[Client]:
    """
    Lazily instantiate a Supabase client using the backend credentials.

    Returns:
        Client instance or None if required environment variables are missing.
    """
    global _client

    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_API_KEY")
        or os.getenv("SUPABASE_SECRET")
    )

    if not url or not key:
        return None

    with _instance_lock:
        if _client is None:
            _client = create_client(url, key)
    return _client
