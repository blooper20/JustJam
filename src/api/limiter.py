import os
from slowapi import Limiter
from slowapi.util import get_remote_address

# Disable rate limiting in development or test environment to allow E2E automated tests
app_env = os.environ.get("APP_ENV", "development").lower()
is_testing = os.environ.get("TESTING", "").lower() == "true" or app_env != "production"

limiter = Limiter(key_func=get_remote_address, enabled=not is_testing)
