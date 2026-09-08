"""Slide-deck rendering.

The LLM produces a slide *spec* (JSON) that is stored verbatim in
`module_artifacts.content_json` -- exactly like quiz / activity. The `.pptx`
binary is rendered from that spec on demand (in memory, no disk, no network)
by `render_pptx`, so nothing needs object storage while decks are text-only.
"""

from backend.ppt.builder import (
    PPTX_MEDIA_TYPE,
    RENDER_VERSION,
    render_pptx,
    slugify_filename,
)
from backend.ppt.schema import DeckParseError, DeckSpec, SlideSpec, parse_deck

__all__ = [
    "RENDER_VERSION",
    "PPTX_MEDIA_TYPE",
    "render_pptx",
    "slugify_filename",
    "DeckSpec",
    "SlideSpec",
    "DeckParseError",
    "parse_deck",
]
