"""
Rate limiter configuration using slowapi
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize the limiter
limiter = Limiter(key_func=get_remote_address)
