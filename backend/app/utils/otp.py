import random
import string
from datetime import datetime, timedelta
from app.core.config import settings


def generate_otp(length: int = 6) -> str:
    """
    Generate a random OTP code.
    
    Args:
        length: Length of the OTP code (default: 6)
    
    Returns:
        Random OTP string
    """
    return ''.join(random.choices(string.digits, k=length))


def get_otp_expiry() -> datetime:
    """
    Get the expiry datetime for an OTP.
    
    Returns:
        Datetime object representing when the OTP expires
    """
    otp_expire_minutes = int(getattr(settings, "OTP_EXPIRE_MINUTES", 10))
    return datetime.utcnow() + timedelta(minutes=otp_expire_minutes)


def is_otp_expired(expires_at: datetime) -> bool:
    """
    Check if an OTP has expired.
    
    Args:
        expires_at: The expiry datetime of the OTP
    
    Returns:
        True if expired, False otherwise
    """
    return datetime.utcnow() > expires_at
