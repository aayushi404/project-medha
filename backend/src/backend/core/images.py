"""Profile photo storage on Cloudinary. The backend always calls Cloudinary
itself (never the client) and fixes a deterministic `public_id` per user, so
the `secure_url` handed back is trusted server output: `overwrite=True` means
a re-upload replaces the same asset rather than orphaning the old one, and
`invalidate=True` purges the CDN edge cache so the replacement is visible
without waiting out a TTL."""

import logging
import uuid
from typing import Literal

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, status

from backend.core.config import settings

logger = logging.getLogger(__name__)

_configured = False


def _ensure_configured() -> None:
    global _configured
    if _configured:
        return
    if not (settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Photo upload isn't configured."
        )
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    _configured = True


def _public_id(kind: Literal["teacher", "student"], actor_id: uuid.UUID) -> str:
    return f"avatars/{kind}_{actor_id}"


def upload_avatar(data: bytes, kind: Literal["teacher", "student"], actor_id: uuid.UUID) -> str:
    """Uploads/replaces the actor's avatar, cropped to a square face-centred
    thumbnail, and returns Cloudinary's secure_url for it."""
    _ensure_configured()
    try:
        result = cloudinary.uploader.upload(
            data,
            public_id=_public_id(kind, actor_id),
            overwrite=True,
            invalidate=True,
            resource_type="image",
            format="jpg",
            transformation=[{"width": 500, "height": 500, "crop": "fill", "gravity": "face"}],
        )
    except Exception as exc:  # cloudinary raises its own generic Error type
        logger.error("Cloudinary upload failed for %s %s: %s", kind, actor_id, exc)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, "Could not upload the photo. Please try again."
        ) from exc
    return result["secure_url"]


def delete_avatar(kind: Literal["teacher", "student"], actor_id: uuid.UUID) -> None:
    _ensure_configured()
    try:
        cloudinary.uploader.destroy(_public_id(kind, actor_id))
    except Exception as exc:
        # Best-effort: the DB column is the source of truth for whether a
        # photo is shown, so a stray orphaned Cloudinary asset isn't user-visible.
        logger.warning("Cloudinary delete failed for %s %s: %s", kind, actor_id, exc)
