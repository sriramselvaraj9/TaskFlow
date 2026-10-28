"""Cryptographic security utilities: password hashing (Argon2id/bcrypt) and JWT token lifecycle."""

from datetime import datetime, timedelta, timezone
import hashlib
import logging
from typing import Any, Dict, Optional, Tuple
import uuid

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings
from app.core.exceptions import AuthenticationException

logger = logging.getLogger("taskflow.security")

# Initialize password hasher with Argon2id primary and Bcrypt backward-compatibility
password_hasher = PasswordHash((
    Argon2Hasher(),
    BcryptHasher(),
))


def hash_password(password: str) -> str:
    """Hashes a plaintext password using Argon2id.
    
    Never logs passwords or returns raw passwords.
    """
    return password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """Securely verifies a plaintext password attempt against stored hash.
    
    Supports Argon2id and historical Bcrypt hashes without leaking algorithm details.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        return password_hasher.verify(plain_password, hashed_password)
    except Exception as exc:
        logger.warning("Password verification failed unexpectedly: %s", type(exc).__name__)
        return False


def hash_token(token_val: str) -> str:
    """Computes a deterministic SHA-256 digest of a token or JTI.
    
    Prevents storage of plaintext tokens in Redis session storage.
    """
    return hashlib.sha256(token_val.encode("utf-8")).hexdigest()


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generates a cryptographically signed, short-lived JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "type": "access",
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    })
    
    if "sub" not in to_encode:
        raise ValueError("JWT access token must contain a subject ('sub') claim")
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def create_refresh_token(
    user_id: str,
    session_id: str,
    expires_delta: Optional[timedelta] = None,
) -> Tuple[str, str]:
    """Generates a cryptographically signed, long-lived JWT refresh token.
    
    Returns tuple of (encoded_token_string, token_jti).
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        
    token_jti = uuid.uuid4().hex
    claims = {
        "sub": user_id,
        "sid": session_id,
        "type": "refresh",
        "jti": token_jti,
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    
    encoded_jwt = jwt.encode(
        claims,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt, token_jti


def decode_token(
    token: str,
    expected_type: str = "access",
) -> Dict[str, Any]:
    """Decodes, verifies signature, and checks expiration and claims of a JWT.
    
    Raises consistent AuthenticationException (HTTP 401) on invalid, missing, or expired tokens.
    """
    if not token or not isinstance(token, str):
        raise AuthenticationException("Unauthorized: Missing authentication token")
        
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationException("Unauthorized: Token has expired")
    except jwt.InvalidAlgorithmError:
        raise AuthenticationException("Unauthorized: Invalid token signing algorithm")
    except jwt.InvalidTokenError:
        raise AuthenticationException("Unauthorized: Invalid or malformed authentication token")
        
    # Verify token use / type claim
    token_type = payload.get("type")
    if token_type != expected_type:
        raise AuthenticationException(
            f"Unauthorized: Expected {expected_type} token, but received {token_type or 'unknown'} token"
        )
        
    # Verify subject presence
    if not payload.get("sub"):
        raise AuthenticationException("Unauthorized: Token missing subject identifier")
        
    return payload
