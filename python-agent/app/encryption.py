import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

# Mirrors backend/src/common/encryption/encryption.service.ts exactly:
# scrypt(N=16384, r=8, p=1, dklen=32) with the same fixed salt, AES-256-GCM,
# `iv:authTag:ciphertext` (all base64) as one string. Used for Outlook/Gmail
# access+refresh tokens (see app/memory/outlook_store.py, gmail_store.py) —
# the NestJS backend encrypts at connect time, this service decrypts to use
# them and re-encrypts after a refresh, so both sides must stay byte-for-byte
# compatible.
_SALT = b"haive-encryption-salt"
_IV_LENGTH = 12


def _derive_key() -> bytes:
    secret = settings.encryption_key or settings.jwt_secret
    return hashlib.scrypt(secret.encode(), salt=_SALT, n=16384, r=8, p=1, dklen=32, maxmem=64 * 1024 * 1024)


def encrypt(plaintext: str) -> str:
    iv = os.urandom(_IV_LENGTH)
    aesgcm = AESGCM(_derive_key())
    # cryptography's AESGCM.encrypt appends the tag to the ciphertext; split
    # it back apart here so the stored format matches Node's separate
    # ciphertext/authTag fields exactly.
    sealed = aesgcm.encrypt(iv, plaintext.encode(), None)
    ciphertext, tag = sealed[:-16], sealed[-16:]
    return f"{base64.b64encode(iv).decode()}:{base64.b64encode(tag).decode()}:{base64.b64encode(ciphertext).decode()}"


def decrypt(payload: str) -> str:
    iv_b64, tag_b64, ciphertext_b64 = payload.split(":")
    iv = base64.b64decode(iv_b64)
    tag = base64.b64decode(tag_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    aesgcm = AESGCM(_derive_key())
    # cryptography's AESGCM expects ciphertext with the tag appended, unlike
    # Node's separate getAuthTag() — this is the one format difference
    # between the two sides' APIs, reconciled here rather than in the format
    # itself (which stays identical either way).
    plaintext = aesgcm.decrypt(iv, ciphertext + tag, None)
    return plaintext.decode()


def decrypt_token(value: str) -> str:
    """Same as decrypt(), but tolerates tokens written before encryption
    existed: anything that doesn't parse/decrypt as our `iv:tag:ciphertext`
    format is assumed to be legacy plaintext and returned unchanged. Every
    OAuth access/refresh token read from outlook_connections/
    gmail_connections should go through this, never decrypt() directly,
    since both providers have pre-encryption rows still in the database.
    """
    try:
        return decrypt(value)
    except Exception:
        return value
