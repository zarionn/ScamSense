"""Deterministic local retrieval over the trusted advisory corpus."""

import re
import unicodedata
from typing import Iterable, Literal, NamedTuple, Optional

from pydantic import ConfigDict, Field, field_validator

from .advisory_corpus import (
    ADVISORY_CORPUS,
    ALLOWED_CONTENT_TYPES,
    ALLOWED_SIGNAL_TAGS,
    AdvisoryEntry,
)
from .contracts import ScreenshotContract, SignalType


SIGNAL_WEIGHT = 10.0
CONTENT_TYPE_WEIGHT = 2.0
ENTITY_TAG_WEIGHT = 0.1
ABSTENTION_THRESHOLD = 10.0
MAX_RESULTS = 3
MAX_ENTITY_CHARACTERS = 128
MAX_ENTITY_TOKENS = 12
MAX_ENTITY_TOKEN_CHARACTERS = 32

APPROVED_GATE_PAIRS = {
    frozenset({"otp_request", "urgent_account_threat"}): (
        "An authentication secret is requested alongside a coercive account threat."
    ),
    frozenset({"credential_request", "external_verification_link"}): (
        "Credentials are requested through an external verification path."
    ),
    frozenset({"credential_request", "impersonation_claim"}): (
        "A claimed identity is used to solicit account credentials."
    ),
    frozenset({"remote_access_request", "attachment_or_download_request"}): (
        "Software installation is paired with a request to grant remote control."
    ),
    frozenset({"unusual_payment_method", "attachment_or_download_request"}): (
        "An unusual transfer method is paired with a software download request."
    ),
    frozenset({"payment_request", "impersonation_claim"}): (
        "A payment request is made under a claimed identity."
    ),
    frozenset({"upfront_fee_request", "unusual_payment_method"}): (
        "An advance fee is requested through an unusual payment method."
    ),
    frozenset({"prize_or_reward_claim", "upfront_fee_request"}): (
        "A promised reward is made conditional on an advance fee."
    ),
    frozenset({"otp_request", "impersonation_claim"}): (
        "An authentication secret is requested under a claimed identity."
    ),
}


class RetrievalContext(ScreenshotContract):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    signal_tags: tuple[SignalType, ...] = Field(max_length=32)
    content_type: str
    claimed_entity: Optional[str] = Field(default=None, max_length=512)
    domain_readability: Optional[
        Literal["clear", "partial", "unreadable"]
    ] = None
    domain_relationship: Optional[
        Literal["match", "mismatch", "cannot_determine"]
    ] = None

    @field_validator("signal_tags")
    @classmethod
    def validate_signal_tags(
        cls,
        values: tuple[SignalType, ...],
    ) -> tuple[SignalType, ...]:
        if len(values) != len(set(values)):
            raise ValueError("signal_tags must not contain duplicate values")
        unknown = set(values) - ALLOWED_SIGNAL_TAGS
        if unknown:
            raise ValueError(f"unknown signal tags: {sorted(unknown)}")
        return values

    @field_validator("content_type")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        if value not in ALLOWED_CONTENT_TYPES:
            raise ValueError(f"unknown content type: {value}")
        return value


class RetrievalSignalValidation(NamedTuple):
    signal_tags: tuple[SignalType, ...]
    impersonation_present: bool
    impersonation_retained: bool
    impersonation_rejection_reason: Optional[str]


def validate_retrieval_signals(
    context: RetrievalContext,
) -> RetrievalSignalValidation:
    """Fail closed on impersonation without a clear structured domain mismatch."""
    signals = context.signal_tags
    if "impersonation_claim" not in signals:
        return RetrievalSignalValidation(signals, False, False, None)

    rejection_reason = None
    if not context.claimed_entity or not context.claimed_entity.strip():
        rejection_reason = "claimed_entity_missing_or_blank"
    elif context.domain_readability is None:
        rejection_reason = "domain_readability_missing"
    elif context.domain_readability != "clear":
        rejection_reason = "domain_readability_not_clear"
    elif context.domain_relationship is None:
        rejection_reason = "domain_relationship_missing"
    elif context.domain_relationship != "mismatch":
        rejection_reason = "domain_relationship_not_mismatch"

    if rejection_reason is None:
        return RetrievalSignalValidation(signals, True, True, None)

    # Sender email, phone and handle evidence is not structured in the audit contract.
    validated = tuple(signal for signal in signals if signal != "impersonation_claim")
    return RetrievalSignalValidation(validated, True, False, rejection_reason)


def eligibility_gate(signal_tags: Iterable[SignalType]) -> dict[str, object]:
    signals = frozenset(signal_tags)
    matching_pairs = sorted(
        (pair for pair in APPROVED_GATE_PAIRS if pair <= signals),
        key=lambda pair: sorted(pair),
    )
    if matching_pairs:
        selected_pair = matching_pairs[0]
        return {
            "eligible": True,
            "rule": "approved_supporting_signal_pair",
            "qualifying_signals": sorted(selected_pair),
            "reason": APPROVED_GATE_PAIRS[selected_pair],
        }
    supporting_signals = signals & frozenset().union(*APPROVED_GATE_PAIRS)
    return {
        "eligible": False,
        "rule": "insufficient_scam_specific_evidence",
        "qualifying_signals": sorted(supporting_signals),
        "reason": "No explicitly approved supporting signal pair is present.",
    }


def normalize_claimed_entity(value: Optional[str]) -> tuple[str, ...]:
    if value is None:
        return ()
    normalized = unicodedata.normalize("NFKC", value)
    normalized = "".join(
        character
        for character in normalized
        if unicodedata.category(character) not in {"Cc", "Cf"}
    )
    normalized = " ".join(normalized.split())[:MAX_ENTITY_CHARACTERS].strip()
    if not normalized:
        return ()
    tokens = re.findall(r"[^\W_]+", normalized.casefold(), flags=re.UNICODE)
    bounded_tokens = (
        token[:MAX_ENTITY_TOKEN_CHARACTERS]
        for token in tokens[:MAX_ENTITY_TOKENS]
    )
    return tuple(dict.fromkeys(token for token in bounded_tokens if token))


def _entry_entity_matches(
    entry: AdvisoryEntry,
    claimed_entity_tokens: tuple[str, ...],
) -> list[str]:
    claimed_tokens = frozenset(claimed_entity_tokens)
    return sorted(
        tag
        for tag in entry.entity_tags
        if frozenset(normalize_claimed_entity(tag)) <= claimed_tokens
    )


def _score_entry(
    entry: AdvisoryEntry,
    context: RetrievalContext,
    entity_tokens: tuple[str, ...],
) -> Optional[dict[str, object]]:
    matched_signals = sorted(set(context.signal_tags) & set(entry.signal_tags))
    if not matched_signals:
        return None
    matched_content_types = (
        [context.content_type] if context.content_type in entry.content_types else []
    )
    matched_entity_tags = _entry_entity_matches(entry, entity_tokens)
    signal_score = len(matched_signals) * SIGNAL_WEIGHT
    content_type_score = len(matched_content_types) * CONTENT_TYPE_WEIGHT
    entity_score = len(matched_entity_tags) * ENTITY_TAG_WEIGHT
    recency_score = entry.publication_date.toordinal() / 1_000_000_000
    total_score = signal_score + content_type_score + entity_score + recency_score
    if total_score < ABSTENTION_THRESHOLD:
        return None
    return {
        "corpus_id": entry.id,
        "authorities": list(entry.authorities),
        "official_title": entry.title,
        "official_url": entry.url,
        "publication_date": entry.publication_date.isoformat(),
        "summary": entry.summary,
        "matched_signal_tags": matched_signals,
        "matched_content_types": matched_content_types,
        "total_score": round(total_score, 6),
        "score_breakdown": {
            "signal_overlap_count": len(matched_signals),
            "signal_score": signal_score,
            "content_type_match": bool(matched_content_types),
            "content_type_score": content_type_score,
            "claimed_entity_matches": matched_entity_tags,
            "claimed_entity_score": entity_score,
            "recency_tiebreaker": round(recency_score, 6),
        },
        "_sort": (
            -total_score,
            -len(matched_signals),
            -len(matched_content_types),
            -len(matched_entity_tags),
            -entry.publication_date.toordinal(),
            entry.id,
        ),
    }


def retrieve_advisories(
    context: RetrievalContext,
    *,
    enable_entity_matching: bool = True,
    max_results: int = MAX_RESULTS,
) -> dict[str, object]:
    if not 1 <= max_results <= MAX_RESULTS:
        raise ValueError(f"max_results must be between 1 and {MAX_RESULTS}")
    validation = validate_retrieval_signals(context)
    scoring_context = context.model_copy(
        update={"signal_tags": validation.signal_tags}
    )
    gate = eligibility_gate(validation.signal_tags)
    if not gate["eligible"]:
        return {"eligibility_gate": gate, "results": []}
    entity_tokens = (
        normalize_claimed_entity(context.claimed_entity)
        if enable_entity_matching
        else ()
    )
    scored = [
        result
        for entry in ADVISORY_CORPUS
        if (
            result := _score_entry(entry, scoring_context, entity_tokens)
        ) is not None
    ]
    scored.sort(key=lambda result: result["_sort"])
    results = []
    for result in scored[:max_results]:
        result = dict(result)
        result.pop("_sort")
        results.append(result)
    return {"eligibility_gate": gate, "results": results}
