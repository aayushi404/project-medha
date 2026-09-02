"""Validated, clamped slide-spec models.

`parse_deck` is the guard between a free-form LLM JSON blob and the renderer:
it drops junk, clamps counts and string lengths, and raises `DeckParseError`
when there is nothing usable to render.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_SLIDES = 15
MAX_BULLETS_PER_SLIDE = 8
MAX_TITLE_LEN = 160
MAX_HEADING_LEN = 160
MAX_BULLET_LEN = 200
MAX_NOTES_LEN = 800

_LAYOUTS = {"bullets", "two_column", "summary"}


class DeckParseError(ValueError):
    """Raised when a stored spec cannot be turned into a deck."""


def _clean_str(value: object, limit: int) -> str:
    if value is None:
        return ""
    return str(value).strip()[:limit]


class SlideSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")

    layout: str = "bullets"
    heading: str = ""
    bullets: list[str] = Field(default_factory=list)
    notes: str = ""

    @field_validator("layout", mode="before")
    @classmethod
    def _v_layout(cls, v: object) -> str:
        s = str(v).strip() if v else "bullets"
        return s if s in _LAYOUTS else "bullets"

    @field_validator("heading", mode="before")
    @classmethod
    def _v_heading(cls, v: object) -> str:
        return _clean_str(v, MAX_HEADING_LEN)

    @field_validator("notes", mode="before")
    @classmethod
    def _v_notes(cls, v: object) -> str:
        return _clean_str(v, MAX_NOTES_LEN)

    @field_validator("bullets", mode="before")
    @classmethod
    def _v_bullets(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        out: list[str] = []
        for item in v:
            s = _clean_str(item, MAX_BULLET_LEN)
            if s:
                out.append(s)
        return out[:MAX_BULLETS_PER_SLIDE]

    @property
    def is_empty(self) -> bool:
        return not self.heading and not self.bullets


class DeckSpec(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = "Untitled"
    subtitle: str = ""
    slides: list[SlideSpec] = Field(default_factory=list)

    @field_validator("title", mode="before")
    @classmethod
    def _v_title(cls, v: object) -> str:
        return _clean_str(v, MAX_TITLE_LEN) or "Untitled"

    @field_validator("subtitle", mode="before")
    @classmethod
    def _v_subtitle(cls, v: object) -> str:
        return _clean_str(v, MAX_TITLE_LEN)

    @field_validator("slides", mode="before")
    @classmethod
    def _v_slides(cls, v: object) -> list:
        if not isinstance(v, list):
            return []
        return v[:MAX_SLIDES]


def parse_deck(content_json: object) -> DeckSpec:
    """Validate + clamp a stored spec into a renderable `DeckSpec`.

    Raises `DeckParseError` on a structurally invalid blob or one with no
    usable slides."""
    if not isinstance(content_json, dict):
        raise DeckParseError("slide spec must be a JSON object")
    try:
        deck = DeckSpec.model_validate(content_json)
    except Exception as exc:  # pydantic ValidationError or anything odd
        raise DeckParseError(f"invalid slide spec: {exc}") from exc

    deck.slides = [s for s in deck.slides if not s.is_empty]
    if not deck.slides:
        raise DeckParseError("slide spec has no usable slides")
    return deck
