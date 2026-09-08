import hashlib

import bcrypt


def hash_password(password: str) -> str:
    """bcrypt hash of a password. bcrypt silently truncates input at 72 bytes;
    passwords that long are already implausible, so no extra handling."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # malformed / sentinel hash (e.g. backfilled rows) -> never matches
        return False


def hash_refresh_token(token: str) -> str:
    """Refresh tokens are high-entropy random strings (32 bytes from
    secrets.token_urlsafe), not passwords -- brute-forcing the raw token from
    its hash is infeasible regardless of hash speed. A plain fast digest is
    used (instead of bcrypt) specifically so lookups can filter by
    `refresh_token_hash = <this>` in auth_sessions; bcrypt's random salting
    makes that kind of equality lookup impossible."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
