"""Structured logging configuration with sensitive data redaction.

Protects against leaking passwords, tokens, authorization headers,
refresh tokens, and sensitive query parameters in application logs.
"""

import logging
import re
from typing import Any, Dict

# Keywords that must be masked if found in log dictionaries or query strings
SENSITIVE_FIELD_NAMES = {
    "password",
    "password_hash",
    "token",
    "token_hash",
    "access_token",
    "refresh_token",
    "authorization",
    "secret",
    "jwt",
    "cookie",
    "api_key",
    "otp",
}

# Regex to detect and mask Authorization: Bearer <token>
BEARER_PATTERN = re.compile(r"(Bearer\s+)[A-Za-z0-9\-_\.]+", re.IGNORECASE)

# Regex to detect key=val pairs for sensitive fields
KEY_VAL_PATTERN = re.compile(
    r"(\b(?:password|token|secret|refresh_token|access_token|key)\b\s*[:=]\s*['\"]?)([^'\"\s,\&]+)(['\"]?)",
    re.IGNORECASE,
)


def mask_sensitive_string(text: str) -> str:
    """Masks authorization tokens and sensitive key-value pairs in strings."""
    if not isinstance(text, str):
        return text
    text = BEARER_PATTERN.sub(r"\1[REDACTED]", text)
    text = KEY_VAL_PATTERN.sub(r"\1[REDACTED]\3", text)
    return text


def mask_sensitive_data(data: Any) -> Any:
    """Recursively traverses dictionaries/lists and replaces sensitive keys with [REDACTED]."""
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_FIELD_NAMES:
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = mask_sensitive_data(v)
        return sanitized
    elif isinstance(data, list):
        return [mask_sensitive_data(item) for item in data]
    elif isinstance(data, str):
        return mask_sensitive_string(data)
    return data


class SensitiveDataFilter(logging.Filter):
    """Logging filter that scrubs sensitive credentials from record messages and arguments."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            formatted_msg = record.getMessage()
            record.msg = mask_sensitive_string(formatted_msg)
            record.args = ()
        except Exception:
            if isinstance(record.msg, str):
                record.msg = mask_sensitive_string(record.msg)
            if record.args:
                record.args = mask_sensitive_data(record.args)
        return True


def setup_logging(level: int = logging.INFO) -> None:
    """Applies sensitive data redaction filter to taskflow loggers."""
    root_logger = logging.getLogger()
    sensitive_filter = SensitiveDataFilter()

    for handler in root_logger.handlers:
        handler.addFilter(sensitive_filter)

    taskflow_logger = logging.getLogger("taskflow")
    taskflow_logger.setLevel(level)
    taskflow_logger.addFilter(sensitive_filter)
