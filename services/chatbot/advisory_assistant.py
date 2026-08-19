"""Deterministic natural-language retrieval over the reviewed advisory corpus.

This adapter is intentionally separate from the Screenshot signal retriever.  It
shares only the validated local corpus and its official-source allowlist.
"""

from datetime import date
import re
from typing import Literal, NamedTuple
import unicodedata
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from services.screenshot.advisory_corpus import (
    ADVISORY_CORPUS,
    APPROVED_SOURCE_HOSTNAMES,
    AdvisoryEntry,
)


MAX_QUERY_CHARACTERS = 500
MAX_RESULTS = 3
ABSTENTION_THRESHOLD = 12.0

NO_MATCH_MESSAGE = (
    "I couldn’t find a sufficiently relevant advisory in the reviewed collection. "
    "This does not mean the situation is safe."
)
CLARIFICATION_MESSAGE = (
    "Which scam type, organisation, or suspicious behaviour would you like me "
    "to check for official advisories?"
)
UNAVAILABLE_MESSAGE = (
    "I couldn’t check the reviewed advisory collection right now. Please try again later."
)

_TOKEN_PATTERN = re.compile(r"[^\W_]+", flags=re.UNICODE)
_ANALYSIS_VERBS = frozenset({"analyse", "analyze", "assess", "check", "inspect", "scan"})
_SUSPICIOUS_ITEM_TERMS = frozenset(
    {
        "attachment",
        "email",
        "image",
        "link",
        "message",
        "screenshot",
        "site",
        "text",
        "url",
        "website",
    }
)
_SEARCH_MARKERS = frozenset(
    {
        "advisory",
        "alert",
        "government",
        "official",
        "published",
        "source",
        "trusted",
        "warning",
        "warned",
    }
)
_GENERIC_QUERY_TERMS = frozenset(
    {
        "a",
        "about",
        "advisory",
        "alert",
        "all",
        "an",
        "and",
        "any",
        "are",
        "anything",
        "at",
        "be",
        "current",
        "do",
        "for",
        "from",
        "government",
        "has",
        "have",
        "i",
        "in",
        "is",
        "it",
        "known",
        "latest",
        "me",
        "method",
        "of",
        "official",
        "on",
        "or",
        "pattern",
        "please",
        "police",
        "published",
        "recent",
        "scam",
        "show",
        "singapore",
        "source",
        "spf",
        "csa",
        "mas",
        "tell",
        "the",
        "there",
        "to",
        "trusted",
        "warning",
        "warned",
        "what",
        "which",
        "with",
    }
)
_INDEX_STOPWORDS = _GENERIC_QUERY_TERMS | frozenset(
    {"fake", "involving", "police", "related", "reviewed"}
)


class AdvisoryIntent(NamedTuple):
    intent: Literal["search", "needs_clarification", "ordinary"]
    normalized_query: str


class AssistantAdvisoryMatch(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    advisory_id: str
    title: str
    authorities: tuple[str, ...] = Field(min_length=1)
    publication_date: date
    summary: str
    source_url: str
    relevance: str

    @field_validator("source_url")
    @classmethod
    def validate_source_url(cls, value: str) -> str:
        parsed = urlsplit(value)
        if parsed.scheme != "https":
            raise ValueError("advisory source must use HTTPS")
        if not parsed.hostname or parsed.hostname.lower() not in APPROVED_SOURCE_HOSTNAMES:
            raise ValueError("advisory source is not on the official-domain allowlist")
        if parsed.username or parsed.password or parsed.port is not None:
            raise ValueError("advisory source must not contain credentials or a port")
        if not parsed.path or parsed.path == "/":
            raise ValueError("advisory source must be a direct advisory URL")
        return value


class AdvisorySearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    status: Literal["matches", "no_match", "needs_clarification", "unavailable"]
    message: str
    advisories: tuple[AssistantAdvisoryMatch, ...] = Field(
        default=(),
        max_length=MAX_RESULTS,
    )

    @model_validator(mode="after")
    def validate_status_and_results(self):
        if self.status == "matches" and not self.advisories:
            raise ValueError("matches status requires at least one advisory")
        if self.status != "matches" and self.advisories:
            raise ValueError("non-match status must not contain advisories")
        return self


class _ScoredEntry(NamedTuple):
    entry: AdvisoryEntry
    relevance: str
    sort_key: tuple[float | int | str, ...]


def normalize_query(query: str) -> str:
    """Normalize untrusted chat text without interpreting or executing it."""
    if not isinstance(query, str):
        raise ValueError("query must be a string")
    normalized = unicodedata.normalize("NFKC", query)
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) not in {"Cc", "Cf"}
    )
    normalized = " ".join(normalized.split())
    normalized = normalized[:MAX_QUERY_CHARACTERS].strip()
    if not normalized:
        raise ValueError("query is empty after normalization")
    return normalized


def _canonical_token(token: str) -> str:
    token = token.casefold()
    if len(token) > 4 and token.endswith("ies"):
        return f"{token[:-3]}y"
    if len(token) > 3 and token.endswith("s") and not token.endswith("ss"):
        return token[:-1]
    return token


def _tokens(value: str) -> tuple[str, ...]:
    return tuple(
        dict.fromkeys(
            _canonical_token(token)
            for token in _TOKEN_PATTERN.findall(value.casefold())
        )
    )


def _significant_tokens(value: str) -> frozenset[str]:
    return frozenset(token for token in _tokens(value) if token not in _INDEX_STOPWORDS)


def _contains_analysis_request(tokens: frozenset[str]) -> bool:
    return bool(tokens & _ANALYSIS_VERBS) and bool(tokens & _SUSPICIOUS_ITEM_TERMS)


def _has_search_marker(tokens: frozenset[str]) -> bool:
    if tokens & _SEARCH_MARKERS:
        return True
    return "scam" in tokens and bool(tokens & {"current", "latest", "recent", "known"})


# Escape hatches for a pending clarification. These do not widen advisory
# intent detection — they only decide when a pending clarification must be
# abandoned so the turn keeps its normal routing.
_URL_PATTERN = re.compile(
    r"\bhttps?://\S+|\bwww\.[^\s/]+\.[^\s/]+",
    flags=re.IGNORECASE,
)
_CANCELLATION_PHRASES = frozenset(
    {"cancel", "forget it", "never mind", "nevermind", "no thanks", "nvm", "stop"}
)


_CANCELLATION_BOUNDARIES = frozenset({",", ".", ";", ":", "!", "?"})


def _is_cancellation(normalized: str) -> bool:
    """Match a whole short turn, or a cancellation followed by punctuation.

    The punctuation boundary is what separates "never mind, analyse this" from
    a genuine topic such as "cancel my card scam", which must still search.
    """
    lowered = normalized.casefold().strip(" .!?")
    if lowered in _CANCELLATION_PHRASES:
        return True
    return any(
        lowered.startswith(phrase)
        and lowered[len(phrase) : len(phrase) + 1] in _CANCELLATION_BOUNDARIES
        for phrase in _CANCELLATION_PHRASES
    )


def _clears_clarification(normalized: str, tokens: frozenset[str]) -> bool:
    return (
        _contains_analysis_request(tokens)
        or bool(_URL_PATTERN.search(normalized))
        or _is_cancellation(normalized)
    )


def detect_advisory_intent(query: str) -> AdvisoryIntent:
    normalized = normalize_query(query)
    tokens = frozenset(_tokens(normalized))

    # Requests to inspect a concrete item retain the existing Assistant path,
    # even if the message also uses general scam language.
    if _contains_analysis_request(tokens):
        return AdvisoryIntent("ordinary", normalized)

    meaningful_terms = tokens - _GENERIC_QUERY_TERMS
    if _has_search_marker(tokens):
        intent = "search" if meaningful_terms else "needs_clarification"
        return AdvisoryIntent(intent, normalized)

    vague_scam_question = "scam" in tokens and not meaningful_terms
    if vague_scam_question:
        return AdvisoryIntent("needs_clarification", normalized)

    return AdvisoryIntent("ordinary", normalized)


def _phrase_is_present(phrase: str, query_tokens: frozenset[str]) -> bool:
    phrase_tokens = _significant_tokens(phrase)
    return bool(phrase_tokens) and phrase_tokens <= query_tokens


def _plain_relevance(
    matched_categories: tuple[str, ...],
    matched_entities: tuple[str, ...],
    *,
    title_overlap: int,
) -> str:
    topics = (*matched_categories[:2], *matched_entities[:1])
    if topics:
        if len(topics) == 1:
            joined = topics[0]
        else:
            joined = f"{', '.join(topics[:-1])} and {topics[-1]}"
        return f"Mentions {joined}."
    if title_overlap:
        return "The official title closely matches your search."
    return "The stored advisory summary contains several of the requested terms."


def _score_entry(entry: AdvisoryEntry, query_tokens: frozenset[str]) -> _ScoredEntry | None:
    category_token_matches: set[str] = set()
    matched_categories = []
    for category in entry.categories:
        overlap = _significant_tokens(category) & query_tokens
        if overlap:
            category_token_matches.update(overlap)
            matched_categories.append(category)

    matched_entities = tuple(
        entity for entity in entry.entity_tags if _phrase_is_present(entity, query_tokens)
    )
    title_overlap = len(_significant_tokens(entry.title) & query_tokens)
    summary_overlap = len(_significant_tokens(entry.summary) & query_tokens)

    category_score = len(category_token_matches) * 12.0
    entity_score = len(matched_entities) * 8.0
    title_score = min(title_overlap, 3) * 4.0
    summary_score = min(summary_overlap, 4) * 1.0
    recency_tiebreaker = entry.publication_date.toordinal() / 1_000_000_000
    total_score = (
        category_score
        + entity_score
        + title_score
        + summary_score
        + recency_tiebreaker
    )
    if total_score < ABSTENTION_THRESHOLD:
        return None

    relevance = _plain_relevance(
        tuple(matched_categories),
        matched_entities,
        title_overlap=title_overlap,
    )
    return _ScoredEntry(
        entry=entry,
        relevance=relevance,
        sort_key=(
            -total_score,
            -category_score,
            -entity_score,
            -title_score,
            -summary_score,
            -entry.publication_date.toordinal(),
            entry.id,
        ),
    )


def serialize_advisory_match(
    entry: AdvisoryEntry,
    *,
    relevance: str,
) -> AssistantAdvisoryMatch:
    """Expose only exact reviewed fields plus deterministic neutral relevance."""
    return AssistantAdvisoryMatch(
        advisory_id=entry.id,
        title=entry.title,
        authorities=entry.authorities,
        publication_date=entry.publication_date,
        summary=entry.summary,
        source_url=entry.url,
        relevance=relevance,
    )


def search_advisories(query: str) -> AdvisorySearchResponse:
    normalized = normalize_query(query)
    query_tokens = _significant_tokens(normalized)
    ranked = [
        scored
        for entry in ADVISORY_CORPUS
        if (scored := _score_entry(entry, query_tokens)) is not None
    ]
    ranked.sort(key=lambda scored: scored.sort_key)
    advisories = tuple(
        serialize_advisory_match(scored.entry, relevance=scored.relevance)
        for scored in ranked[:MAX_RESULTS]
    )
    if not advisories:
        return AdvisorySearchResponse(status="no_match", message=NO_MATCH_MESSAGE)

    noun = "advisory" if len(advisories) == 1 else "advisories"
    return AdvisorySearchResponse(
        status="matches",
        message=(
            f"I found {len(advisories)} related official {noun} in the reviewed collection."
        ),
        advisories=advisories,
    )


def handle_advisory_query(
    query: str,
    *,
    awaiting_topic: bool = False,
) -> AdvisorySearchResponse | None:
    """Route one Assistant turn.

    `awaiting_topic` is true only when the immediately preceding assistant turn
    asked the clarification question. It makes that single turn supply the
    search topic, and is consumed by that turn whatever the outcome. A turn
    carrying a competing intent (an explicit analysis request, a pasted URL, or
    a cancellation) abandons the clarification and routes normally instead.
    """
    intent = detect_advisory_intent(query)
    if awaiting_topic and intent.intent == "ordinary":
        tokens = frozenset(_tokens(intent.normalized_query))
        if _clears_clarification(intent.normalized_query, tokens):
            return None
        return search_advisories(intent.normalized_query)
    if intent.intent == "ordinary":
        return None
    if intent.intent == "needs_clarification":
        return AdvisorySearchResponse(
            status="needs_clarification",
            message=CLARIFICATION_MESSAGE,
        )
    return search_advisories(intent.normalized_query)


def unavailable_response() -> AdvisorySearchResponse:
    return AdvisorySearchResponse(status="unavailable", message=UNAVAILABLE_MESSAGE)


def format_readable_reply(response: AdvisorySearchResponse) -> str:
    """Build the text persisted by the existing string-only history contract."""
    if response.status != "matches":
        return response.message

    blocks = [response.message]
    for advisory in response.advisories:
        authority_label = "Authority" if len(advisory.authorities) == 1 else "Authorities"
        blocks.append(
            "\n".join(
                (
                    advisory.title,
                    f"{authority_label}: {', '.join(advisory.authorities)}",
                    f"Publication date: {advisory.publication_date.isoformat()}",
                    f"Summary: {advisory.summary}",
                    f"Why it may be relevant: {advisory.relevance}",
                    f"Official source: {advisory.source_url}",
                )
            )
        )
    return "\n\n".join(blocks)


def build_assistant_response(response: AdvisorySearchResponse) -> dict[str, object]:
    return {
        "reply": format_readable_reply(response),
        "source": "trusted_advisory" if response.status != "unavailable" else "fallback",
        "advisory_search": response.model_dump(mode="json"),
    }
