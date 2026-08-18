"""Stage 1 and Stage 2 orchestration for Screenshot GenAI."""

import logging
from typing import Dict

from . import auditor, explainer, exposure, policy, recovery
from .contracts import AuditorResult, DomainAnalysis, ExposureAnswer


logger = logging.getLogger(__name__)


def _safe_auditor_error_summary(error: Exception) -> str:
    """Return a bounded category without copying request or screenshot content."""
    message = str(error).lower()
    if "invalid argument" in message:
        return "Request contains an invalid argument."
    if "timeout" in message or "timed out" in message:
        return "Gemini request timed out."
    if "connection" in message:
        return "Gemini connection failed."
    return "Unexpected auditor failure."


def analyse(classification: Dict, img_path: str) -> Dict:
    """STAGE 1. Classification is computed in app.py (TFLite) and injected here.
    Runs auditor -> policy -> exposure questions. Degrades gracefully if the
    auditor is unavailable, keeping the classifier result."""
    try:
        audit = auditor.audit_screenshot(img_path)
        audit_status = "available"
    except auditor.MalformedAuditError:
        audit = AuditorResult(
            content_type="other",
            observations=[],
            domain_analysis=DomainAnalysis(domain_visible=False),
            unclear_elements=["Audit response could not be parsed; treated as no signals found."],
        )
        audit_status = "malformed"
    except Exception as error:
        logger.warning(
            "Visual auditor unavailable (%s): %s",
            type(error).__name__,
            _safe_auditor_error_summary(error),
        )
        audit = AuditorResult(
            content_type="other",
            observations=[],
            domain_analysis=DomainAnalysis(domain_visible=False),
            unclear_elements=["The independent visual safety review was temporarily unavailable."],
        )
        audit_status = "unavailable"

    caution = policy.evaluate_caution(audit)
    risky = policy.is_risky_verdict(
        classifier_label=classification["label"],
        caution_decision=caution,
    )
    effective = policy.effective_caution(
        classifier_label=classification["label"],
        caution_decision=caution,
    )
    probes = exposure.derive_exposure_probes(audit=audit, is_risky=risky)
    audit_dict = audit.model_dump()
    display_observations = explainer.observations_for_explanation(
        audit=audit_dict,
        caution=caution,
    )

    return {
        "classifier": classification,
        "audit": audit_dict,
        "audit_status": audit_status,
        "audit_signals": [o["signal_type"] for o in audit_dict["observations"]],
        "display_observations": display_observations,
        "caution": caution,
        "effective_caution_level": effective["caution_level"],
        "risky": risky,
        "exposure_questions": exposure.exposure_question_payload(probes),
    }


def complete_analysis_with_answers(
    analysis_context: Dict,
    exposure_answers: Dict[
        str,
        ExposureAnswer,
    ],
) -> Dict:
    """Complete the response after the user answers exposure questions."""

    exposure_summary = (
        exposure.resolve_exposure_answers(
            exposure_questions=(
                analysis_context[
                    "exposure_questions"
                ]
            ),
            answers=exposure_answers,
            risky=analysis_context[
                "risky"
            ],
        )
    )

    action_result = (
        recovery.actions_for_dimensions(
            exposure_summary[
                "selected_dimensions"
            ]
        )
    )

    required_actions = (
        action_result[
            "required_actions"
        ]
    )

    response = (
        explainer.build_guarded_personalised_response_v4(
            analysis_context=(
                analysis_context
            ),
            exposure_summary=(
                exposure_summary
            ),
            required_actions=(
                required_actions
            ),
        )
    )

    return {
        **analysis_context,
        "exposure_answers": (
            exposure_answers
        ),
        "confirmed_exposures": (
            exposure_summary[
                "confirmed_dimensions"
            ]
        ),
        "uncertain_exposures": (
            exposure_summary[
                "uncertain_dimensions"
            ]
        ),
        "defaulted_exposures": (
            exposure_summary[
                "defaulted_dimensions"
            ]
        ),
        "selected_exposures": (
            exposure_summary[
                "selected_dimensions"
            ]
        ),
        "required_actions": [
            action.model_dump()
            for action
            in required_actions
        ],
        "response_source": response[
            "source"
        ],
        "response_message": response[
            "message"
        ],
        "response_guard": response[
            "guard"
        ],
        "fallback_guard": response.get(
            "fallback_guard"
        ),
        "related_official_advisories": [],
    }


def respond(analysis_context: Dict, answers: Dict[str, str]) -> Dict:
    """STAGE 2. Resolve the user's exposure answers, select the mandatory actions,
    and produce the guarded explanation (or deterministic fallback). Delegates to the
    notebook's tested complete_analysis_with_answers."""
    return complete_analysis_with_answers(analysis_context, answers)
