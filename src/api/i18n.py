import contextvars
import gettext
import os

localedir = os.path.join(os.path.abspath(os.path.dirname(__file__)), "../../locales")

# Store compiled translation objects
translations = {}
try:
    translations["ko"] = gettext.translation("messages", localedir, languages=["ko"], fallback=True)
except Exception:
    translations["ko"] = None

try:
    translations["en"] = gettext.translation("messages", localedir, languages=["en"], fallback=True)
except Exception:
    translations["en"] = None

# ContextVar for thread-safe per-request locale
_active_locale = contextvars.ContextVar("active_locale", default="en")


def set_locale(locale: str):
    if locale not in ["ko", "en"]:
        locale = "ko"
    _active_locale.set(locale)


def get_locale() -> str:
    return _active_locale.get()


def _(message: str) -> str:
    locale = _active_locale.get()
    trans = translations.get(locale)
    if trans is not None:
        return trans.gettext(message)
    return message
