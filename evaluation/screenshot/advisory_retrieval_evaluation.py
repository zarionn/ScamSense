"""Run deterministic offline evaluations for trusted-advisory retrieval."""

import json
from pathlib import Path
import sys
from typing import NamedTuple, Optional


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.screenshot.advisory_retrieval import (  # noqa: E402
    RetrievalContext,
    retrieve_advisories,
    validate_retrieval_signals,
)
from services.screenshot.advisory_corpus import ALLOWED_SIGNAL_TAGS  # noqa: E402
from services.screenshot.contracts import SignalType  # noqa: E402


SATURATED_EVALUATION_LABEL = "Saturated metadata-alignment evaluation"
SPARSE_EVALUATION_LABEL = "Realistic sparse-input evaluation"


class EvaluationCase(NamedTuple):
    case_id: str
    signal_tags: tuple[SignalType, ...]
    content_type: str
    claimed_entity: Optional[str]
    expected_advisory_id: Optional[str]
    origin: str
    reason: str


SATURATED_METADATA_ALIGNMENT_CASES = (
    EvaluationCase(
        "case-01-singpass-fake-login",
        (
            "credential_request",
            "otp_request",
            "urgent_account_threat",
            "external_verification_link",
            "impersonation_claim",
        ),
        "login_page",
        "Singpass",
        "singpass-phishing-login-2022",
        "synthetic saturated metadata alignment",
        "Singpass impersonation, credential capture, OTP capture, and account pressure are all present.",
    ),
    EvaluationCase(
        "case-02-marketplace-fake-buyer",
        (
            "credential_request",
            "otp_request",
            "personal_information_request",
            "external_verification_link",
            "impersonation_claim",
        ),
        "marketplace_listing",
        "Online marketplace",
        "marketplace-fake-buyer-phishing-2025",
        "synthetic saturated metadata alignment",
        "The marketplace context and full fake-buyer phishing signal cluster are present.",
    ),
    EvaluationCase(
        "case-03-technical-support",
        (
            "impersonation_claim",
            "remote_access_request",
            "attachment_or_download_request",
        ),
        "website",
        "Software support",
        "technical-support-remote-access-2025",
        "synthetic saturated metadata alignment",
        "Support impersonation is paired with remote-access and download requests.",
    ),
    EvaluationCase(
        "case-04-cryptocurrency-malware",
        (
            "payment_request",
            "unusual_payment_method",
            "external_verification_link",
            "impersonation_claim",
            "attachment_or_download_request",
        ),
        "website",
        "Cryptocurrency",
        "cryptocurrency-malicious-links-2026",
        "synthetic saturated metadata alignment",
        "Cryptocurrency payment, malicious-link, impersonation, and download signals align.",
    ),
    EvaluationCase(
        "case-05-investment-platform",
        (
            "personal_information_request",
            "payment_request",
            "unusual_payment_method",
            "impersonation_claim",
        ),
        "website",
        "Investment",
        "investment-scams-2025",
        "synthetic saturated metadata alignment",
        "The investment context combines personal-data, payment, crypto, and impersonation signals.",
    ),
    EvaluationCase(
        "case-06-task-job-payment",
        (
            "payment_request",
            "upfront_fee_request",
            "unusual_payment_method",
            "impersonation_claim",
        ),
        "sms_or_chat",
        "TikTok",
        "job-task-payment-scams-2024",
        "synthetic saturated metadata alignment",
        "A task job requires payment through unusual methods before earnings are released.",
    ),
    EvaluationCase(
        "case-07-lucky-draw-fee",
        ("prize_or_reward_claim", "payment_request", "upfront_fee_request"),
        "other",
        "Facebook",
        "facebook-live-lucky-draw-2026",
        "synthetic saturated metadata alignment",
        "A prize claim is conditioned on an administrative payment.",
    ),
    EvaluationCase(
        "case-08-whatsapp-takeover",
        ("otp_request", "impersonation_claim", "payment_request"),
        "sms_or_chat",
        "WhatsApp",
        "whatsapp-account-impersonation-2026",
        "synthetic saturated metadata alignment",
        "An OTP-enabled account takeover leads to contact impersonation and payment requests.",
    ),
    EvaluationCase(
        "case-09-generic-login",
        ("credential_request",),
        "login_page",
        None,
        None,
        "synthetic saturated metadata alignment",
        "A generic username and password form is not scam-specific evidence.",
    ),
    EvaluationCase(
        "case-10-weak-context",
        ("personal_information_request",),
        "website",
        None,
        None,
        "synthetic saturated metadata alignment",
        "One weak supporting signal is insufficient for advisory retrieval.",
    ),
)


REALISTIC_SYNTHETIC_SPARSE_CASES = (
    EvaluationCase(
        "sparse-01-singpass-threat-otp",
        ("otp_request", "urgent_account_threat"),
        "login_page",
        "Singpass",
        "singpass-phishing-login-2022",
        "realistic synthetic sparse case",
        "A fake Singpass login may expose only the OTP request and deactivation threat.",
    ),
    EvaluationCase(
        "sparse-02-marketplace-link",
        ("credential_request", "external_verification_link", "impersonation_claim"),
        "marketplace_listing",
        "Carousell",
        "marketplace-fake-buyer-phishing-2025",
        "realistic synthetic sparse case",
        "A marketplace screenshot may show a platform claim, credential form, and external link.",
    ),
    EvaluationCase(
        "sparse-03-remote-support",
        ("remote_access_request", "attachment_or_download_request"),
        "website",
        "Microsoft",
        "technical-support-remote-access-2025",
        "realistic synthetic sparse case",
        "A support pop-up may show only a remote-access instruction and software download.",
    ),
    EvaluationCase(
        "sparse-04-crypto-download",
        ("unusual_payment_method", "attachment_or_download_request"),
        "website",
        "FIFA World Cup",
        "cryptocurrency-malicious-links-2026",
        "realistic synthetic sparse case",
        "A themed crypto page may expose a cryptocurrency method and download request.",
    ),
    EvaluationCase(
        "sparse-05-investment-contact",
        (
            "personal_information_request",
            "payment_request",
            "impersonation_claim",
        ),
        "website",
        None,
        "investment-scams-2025",
        "realistic synthetic sparse case",
        "A fraudulent investment platform may request particulars and payment while claiming a broker identity.",
    ),
    EvaluationCase(
        "sparse-06-job-upfront-payment",
        ("upfront_fee_request", "unusual_payment_method"),
        "sms_or_chat",
        "TikTok",
        "job-task-payment-scams-2024",
        "realistic synthetic sparse case",
        "A task chat may show an upfront transfer using an unusual payment method.",
    ),
    EvaluationCase(
        "sparse-07-prize-fee",
        ("prize_or_reward_claim", "upfront_fee_request"),
        "other",
        "Facebook",
        "facebook-live-lucky-draw-2026",
        "realistic synthetic sparse case",
        "A livestream frame may show only a prize and the fee required to claim it.",
    ),
    EvaluationCase(
        "sparse-08-whatsapp-otp",
        ("otp_request", "impersonation_claim"),
        "sms_or_chat",
        "WhatsApp",
        "whatsapp-account-impersonation-2026",
        "realistic synthetic sparse case",
        "A chat may show an OTP request from a compromised contact without a visible payment request.",
    ),
    EvaluationCase(
        "sparse-09-generic-login",
        ("credential_request",),
        "login_page",
        None,
        None,
        "realistic synthetic sparse case",
        "A normal login form remains insufficient without another scam-specific signal.",
    ),
    EvaluationCase(
        "sparse-10-generic-form",
        ("credential_request", "personal_information_request"),
        "website",
        None,
        None,
        "realistic synthetic sparse case",
        "A generic registration form can request credentials and personal information legitimately.",
    ),
)


class GateEvaluationCase(NamedTuple):
    case_id: str
    signal_tags: tuple[SignalType, ...]
    content_type: str
    claimed_entity: Optional[str]
    reason: str


SINGLETON_SIGNAL_CASES = tuple(
    GateEvaluationCase(
        f"singleton-{signal}",
        (signal,),
        "other",
        None,
        "No individual signal is sufficient to open the corrected gate.",
    )
    for signal in sorted(ALLOWED_SIGNAL_TAGS)
)


BENIGN_NEAR_PAIR_CASES = (
    GateEvaluationCase(
        "benign-credential-otp",
        ("credential_request", "otp_request"),
        "login_page",
        None,
        "Credentials and OTPs can both appear in legitimate authentication flows.",
    ),
    GateEvaluationCase(
        "benign-credential-personal-information",
        ("credential_request", "personal_information_request"),
        "website",
        None,
        "Registration forms can legitimately request credentials and personal information.",
    ),
    GateEvaluationCase(
        "benign-personal-information-payment",
        ("personal_information_request", "payment_request"),
        "website",
        None,
        "Checkout flows can legitimately request personal details and payment.",
    ),
    GateEvaluationCase(
        "benign-external-link-download",
        ("external_verification_link", "attachment_or_download_request"),
        "website",
        None,
        "Legitimate sites can link externally to a software download.",
    ),
    GateEvaluationCase(
        "benign-urgent-threat-credential",
        ("urgent_account_threat", "credential_request"),
        "login_page",
        None,
        "An account warning and login form are insufficient without an approved pair.",
    ),
    GateEvaluationCase(
        "benign-content-entity-no-signals",
        (),
        "login_page",
        "Singpass",
        "Content type and claimed entity cannot substitute for structured signals.",
    ),
)


def evaluate_cases(
    label: str,
    cases: tuple[EvaluationCase, ...],
    *,
    enable_entity_matching: bool,
) -> dict[str, object]:
    rows = []
    for case in cases:
        context = RetrievalContext(
            signal_tags=case.signal_tags,
            content_type=case.content_type,
            claimed_entity=case.claimed_entity,
        )
        validation = validate_retrieval_signals(context)
        response = retrieve_advisories(
            context,
            enable_entity_matching=enable_entity_matching,
        )
        top = response["results"][0] if response["results"] else None
        actual = top["corpus_id"] if top else None
        rows.append(
            {
                "case_id": case.case_id,
                "signals": list(case.signal_tags),
                "retrieval_validated_signals": list(validation.signal_tags),
                "impersonation_retained": validation.impersonation_retained,
                "impersonation_rejection_reason": (
                    validation.impersonation_rejection_reason
                ),
                "content_type": case.content_type,
                "claimed_entity": case.claimed_entity,
                "expected": case.expected_advisory_id or "no-match",
                "actual_top_result": actual or "no-match",
                "passed": actual == case.expected_advisory_id,
                "origin": case.origin,
                "justification": case.reason,
                "eligibility_gate": response["eligibility_gate"],
                "total_score": top["total_score"] if top else 0.0,
                "matched_signals": top["matched_signal_tags"] if top else [],
                "matched_content_types": top["matched_content_types"] if top else [],
                "score_breakdown": top["score_breakdown"] if top else None,
                "genuinely_helpful": (
                    actual is not None and actual == case.expected_advisory_id
                ),
            }
        )
    covered = rows[:8]
    abstentions = rows[8:]
    covered_correct = sum(row["passed"] for row in covered)
    return {
        "label": label,
        "limitations": (
            "Cases 1-8 deliberately contain most or all target identifying signals; "
            "this checks deterministic metadata mapping and regression stability, not "
            "real-world accuracy."
            if label == SATURATED_EVALUATION_LABEL
            else "All cases are realistic synthetic sparse contexts, not recorded screenshot outputs."
        ),
        "entity_matching_enabled": enable_entity_matching,
        "cases": rows,
        "covered_correct": covered_correct,
        "covered_total": 8,
        "covered_percentage": covered_correct / 8 * 100,
        "incorrect_top_matches": [
            {
                "case_id": row["case_id"],
                "actual_top_result": row["actual_top_result"],
            }
            for row in covered
            if not row["passed"]
        ],
        "false_positive_count": sum(
            row["actual_top_result"] != "no-match" for row in abstentions
        ),
        "correct_abstentions": sum(row["passed"] for row in abstentions),
        "abstention_total": 2,
    }


def evaluate_gate_cases(
    cases: tuple[GateEvaluationCase, ...],
) -> list[dict[str, object]]:
    rows = []
    for case in cases:
        context = RetrievalContext(
            signal_tags=case.signal_tags,
            content_type=case.content_type,
            claimed_entity=case.claimed_entity,
        )
        validation = validate_retrieval_signals(context)
        response = retrieve_advisories(
            context
        )
        top = response["results"][0] if response["results"] else None
        returned = top is not None
        rows.append(
            {
                "case_id": case.case_id,
                "signals": list(case.signal_tags),
                "retrieval_validated_signals": list(validation.signal_tags),
                "impersonation_retained": validation.impersonation_retained,
                "impersonation_rejection_reason": (
                    validation.impersonation_rejection_reason
                ),
                "content_type": case.content_type,
                "claimed_entity": case.claimed_entity,
                "gate_opened": response["eligibility_gate"]["eligible"],
                "advisory_returned": returned,
                "advisory_id": top["corpus_id"] if top else "no-match",
                "score": top["total_score"] if top else 0.0,
                "reason": case.reason,
                "could_mislead_on_legitimate_screenshot": returned,
                "passed": not response["eligibility_gate"]["eligible"] and not returned,
            }
        )
    return rows


def run_all_evaluations() -> dict[str, object]:
    return {
        "saturated_without_entity": evaluate_cases(
            SATURATED_EVALUATION_LABEL,
            SATURATED_METADATA_ALIGNMENT_CASES,
            enable_entity_matching=False,
        ),
        "saturated_with_entity": evaluate_cases(
            SATURATED_EVALUATION_LABEL,
            SATURATED_METADATA_ALIGNMENT_CASES,
            enable_entity_matching=True,
        ),
        "sparse_without_entity": evaluate_cases(
            SPARSE_EVALUATION_LABEL,
            REALISTIC_SYNTHETIC_SPARSE_CASES,
            enable_entity_matching=False,
        ),
        "sparse_with_entity": evaluate_cases(
            SPARSE_EVALUATION_LABEL,
            REALISTIC_SYNTHETIC_SPARSE_CASES,
            enable_entity_matching=True,
        ),
        "singleton_signals": evaluate_gate_cases(SINGLETON_SIGNAL_CASES),
        "benign_near_pairs": evaluate_gate_cases(BENIGN_NEAR_PAIR_CASES),
    }


if __name__ == "__main__":
    print(json.dumps(run_all_evaluations(), indent=2, sort_keys=True))
