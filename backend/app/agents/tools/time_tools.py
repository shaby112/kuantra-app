from datetime import datetime


def get_current_time() -> str:
    """Return the current UTC time in ISO format."""
    return datetime.utcnow().isoformat()
