import base64
import hashlib
import hmac
import os
import secrets
from typing import Optional


PASSWORD_HASH_SCHEME = os.getenv("AUTH_PASSWORD_SCHEME", "pbkdf2_sha256")
PASSWORD_HASH_ITERATIONS = int(os.getenv("AUTH_PBKDF2_ITERATIONS", "260000"))


def hash_password(password: str) -> str:
    """
    Hashes a password with PBKDF2-HMAC-SHA256 using a random salt.
    """
    if not password:
        raise ValueError("password must not be empty")

    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"{PASSWORD_HASH_SCHEME}${PASSWORD_HASH_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}$"
        f"{base64.b64encode(derived).decode()}"
    )


def verify_password(password: str, encoded: Optional[str]) -> bool:
    """
    Verifies a plain password against the stored PBKDF2 hash.
    """
    if not password or not encoded:
        return False

    try:
        scheme, iter_str, salt_b64, hash_b64 = encoded.split("$", 3)
        if scheme != PASSWORD_HASH_SCHEME:
            return False
        iterations = int(iter_str)
        salt = base64.b64decode(salt_b64.encode())
        expected = base64.b64decode(hash_b64.encode())
        candidate = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(candidate, expected)
    except Exception:  # noqa: BLE001
        return False
