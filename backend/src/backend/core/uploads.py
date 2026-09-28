"""Safe handling of user-uploaded files: read in bounded chunks (never buffer
an oversized upload), and identify the type from the file's own bytes rather
than trusting its name or declared content type."""

from fastapi import HTTPException, UploadFile, status

_CHUNK = 64 * 1024

_SIGNATURES = {
    "pdf": (b"%PDF-",),
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpeg": (b"\xff\xd8\xff",),
    # audio containers the browser recorders produce
    "wav": (b"RIFF",),
    "webp": (b"RIFF",),  # RIFF....WEBP -- disambiguated from wav below
    "webm": (b"\x1a\x45\xdf\xa3",),
    "ogg": (b"OggS",),
    "mp3": (b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"),
    "mp4": (b"\x00\x00\x00",),  # ....ftyp -- checked further below
}


async def read_limited(file: UploadFile, max_bytes: int) -> bytes:
    """Read the whole upload, stopping with 413 as soon as it exceeds max_bytes."""
    buf = bytearray()
    while chunk := await file.read(_CHUNK):
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is too large.")
    if not buf:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The file is empty.")
    return bytes(buf)


def sniff(data: bytes) -> str | None:
    """Detected file kind from magic bytes, or None if it isn't a known type."""
    for kind, prefixes in _SIGNATURES.items():
        if any(data.startswith(p) for p in prefixes):
            if kind == "mp4" and data[4:8] != b"ftyp":
                continue
            # RIFF is shared by wav and webp; the real type is at offset 8.
            if kind == "wav" and data[8:12] == b"WEBP":
                continue
            if kind == "webp" and data[8:12] != b"WEBP":
                continue
            return kind
    return None


def require_kind(data: bytes, allowed: set[str], message: str) -> str:
    kind = sniff(data)
    if kind not in allowed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, message)
    return kind
