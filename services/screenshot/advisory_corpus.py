"""Load and validate the local trusted-advisory corpus."""

from datetime import date
import json
from pathlib import Path
import re
from typing import Iterable, Mapping, Sequence, get_args
import unicodedata
from urllib.parse import urlsplit

from pydantic import ConfigDict, Field, field_validator

from .contracts import AuditorResult, ScreenshotContract, SignalType


CORPUS_PATH = Path(__file__).resolve().with_name("advisory_corpus.json")
APPROVED_SOURCE_DOMAINS = frozenset(
    {
        "scamshield.gov.sg",
        "police.gov.sg",
        "csa.gov.sg",
        "mas.gov.sg",
        "gov.sg",
    }
)
APPROVED_SOURCE_HOSTNAMES = frozenset(
    hostname
    for domain in APPROVED_SOURCE_DOMAINS
    for hostname in (domain, f"www.{domain}")
)
ALLOWED_SIGNAL_TAGS = frozenset(get_args(SignalType))
ALLOWED_CONTENT_TYPES = frozenset(
    get_args(AuditorResult.model_fields["content_type"].annotation)
)
_STABLE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_LIST_FIELDS = frozenset(
    {"authorities", "categories", "signal_tags", "content_types", "entity_tags"}
)
_MAX_ENTITY_TAG_CHARACTERS = 128


def _validate_unique_nonempty_strings(
    values: Sequence[str],
    field_name: str,
) -> tuple[str, ...]:
    if not values:
        raise ValueError(f"{field_name} must not be empty")
    if any(not isinstance(value, str) or not value.strip() for value in values):
        raise ValueError(f"{field_name} values must be non-empty strings")
    normalized = tuple(value.strip() for value in values)
    if len(normalized) != len(set(normalized)):
        raise ValueError(f"{field_name} must not contain duplicate values")
    return normalized


def _normalize_entity_tag(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    if any(unicodedata.category(character) in {"Cc", "Cf"} for character in normalized):
        raise ValueError("entity_tags must not contain control or format characters")
    normalized = " ".join(normalized.split())
    if not normalized:
        raise ValueError("entity_tags values must be non-empty strings")
    if not re.search(r"[^\W_]", normalized, flags=re.UNICODE):
        raise ValueError("entity_tags values must contain a matchable Unicode token")
    if len(normalized) > _MAX_ENTITY_TAG_CHARACTERS:
        raise ValueError(
            f"entity_tags values must not exceed {_MAX_ENTITY_TAG_CHARACTERS} characters"
        )
    return normalized


class AdvisoryEntry(ScreenshotContract):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    id: str
    authorities: tuple[str, ...] = Field(min_length=1)
    title: str
    url: str
    publication_date: date
    summary: str
    categories: tuple[str, ...] = Field(min_length=1)
    signal_tags: tuple[SignalType, ...] = Field(min_length=1)
    content_types: tuple[str, ...] = Field(min_length=1)
    entity_tags: tuple[str, ...]

    @field_validator(*_LIST_FIELDS, mode="before")
    @classmethod
    def require_json_arrays(cls, values: object, info) -> tuple[object, ...]:
        if not isinstance(values, list):
            raise ValueError(f"{info.field_name} must be a JSON array")
        return tuple(values)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("id must not be empty")
        if not _STABLE_ID_PATTERN.fullmatch(value):
            raise ValueError("id must be a lowercase hyphenated stable identifier")
        return value

    @field_validator("title", "summary")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value must not be empty")
        return value

    @field_validator("publication_date", mode="before")
    @classmethod
    def validate_publication_date(cls, value: object) -> date:
        if isinstance(value, date):
            return value
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("publication_date must use ISO YYYY-MM-DD")
        try:
            return date.fromisoformat(value)
        except ValueError as error:
            raise ValueError("publication_date must be a real calendar date") from error

    @field_validator("url")
    @classmethod
    def validate_official_url(cls, value: str) -> str:
        value = value.strip()
        parsed = urlsplit(value)
        if parsed.scheme != "https":
            raise ValueError("url must use HTTPS")
        if not parsed.hostname or parsed.hostname.lower() not in APPROVED_SOURCE_HOSTNAMES:
            raise ValueError("url hostname is not on the official-domain allowlist")
        if parsed.username or parsed.password or parsed.port is not None:
            raise ValueError("url must not contain user information or an explicit port")
        if not parsed.path or parsed.path == "/":
            raise ValueError("url must be a direct advisory URL")
        return value

    @field_validator("authorities", "categories")
    @classmethod
    def validate_text_lists(
        cls,
        values: tuple[str, ...],
        info,
    ) -> tuple[str, ...]:
        return _validate_unique_nonempty_strings(values, info.field_name)

    @field_validator("signal_tags")
    @classmethod
    def validate_signal_tags(
        cls,
        values: tuple[SignalType, ...],
    ) -> tuple[SignalType, ...]:
        validated = _validate_unique_nonempty_strings(values, "signal_tags")
        unknown = set(validated) - ALLOWED_SIGNAL_TAGS
        if unknown:
            raise ValueError(f"unknown signal tags: {sorted(unknown)}")
        return validated

    @field_validator("content_types")
    @classmethod
    def validate_content_types(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        validated = _validate_unique_nonempty_strings(values, "content_types")
        unknown = set(validated) - ALLOWED_CONTENT_TYPES
        if unknown:
            raise ValueError(f"unknown content types: {sorted(unknown)}")
        return validated

    @field_validator("entity_tags")
    @classmethod
    def validate_entity_tags(cls, values: tuple[str, ...]) -> tuple[str, ...]:
        normalized = tuple(_normalize_entity_tag(value) for value in values)
        normalized_keys = tuple(value.casefold() for value in normalized)
        if len(normalized_keys) != len(set(normalized_keys)):
            raise ValueError("entity_tags must not contain duplicate normalized values")
        return normalized


def load_advisory_corpus(
    raw_entries: Iterable[Mapping[str, object]],
) -> tuple[AdvisoryEntry, ...]:
    entries = tuple(AdvisoryEntry.model_validate(entry) for entry in raw_entries)
    ids = [entry.id for entry in entries]
    if len(ids) != len(set(ids)):
        raise ValueError("advisory corpus contains duplicate IDs")
    return entries


def load_advisory_corpus_file(path: Path = CORPUS_PATH) -> tuple[AdvisoryEntry, ...]:
    try:
        raw_entries = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"could not load advisory corpus from {path}") from error
    if not isinstance(raw_entries, list):
        raise ValueError("advisory corpus root must be a JSON array")
    return load_advisory_corpus(raw_entries)


ADVISORY_CORPUS = load_advisory_corpus_file()
