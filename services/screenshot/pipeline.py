"""Stage 1 and Stage 2 orchestration for Screenshot GenAI."""

from typing import Dict

from . import auditor, explainer, exposure, policy, recovery
from .contracts import AuditorResult, DomainAnalysis, ExposureAnswer


def analyse(classification: Dict, img_path: str) -> Dict:
    """STAGE 1. Classification is computed in app.py (TFLite) and injected here.
    Runs auditor -> policy -> exposure questions. Degrades gracefully if the
    auditor is unavailable, keeping the classifier result."""
    try:
        audit = auditor.audit_screenshot(img_path)
        audit_status = "available"
    except Exception as error:
        audit = AuditorResult(
            content_type="other",
            observations=[],
            domain_analysis=DomainAnalysis(domain_visible=False),
            unclear_elements=["The independent visual safety review was temporarily unavailable."],
        )
        audit_status = f"degraded:{type(error).__name__}"

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

    return {
        "classifier": classification,
        "audit": audit_dict,
        "audit_status": audit_status,
        "audit_signals": [o["signal_type"] for o in audit_dict["observations"]],
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

    if required_actions:
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

    else:
        # A low-risk screenshot may have no exposure questions
        # or mandatory recovery actions. It should still receive
        # a short explanation.
        try:
            response_message = (
                explainer.explain_personalised_v4(
                    analysis_context=(
                        analysis_context
                    ),
                    exposure_summary=(
                        exposure_summary
                    ),
                    required_actions=[],
                )
            )

            response = {
                "source": (
                    "explainer_v4_no_actions"
                ),
                "message": (
                    response_message
                ),
                "guard": {
                    "passed": True,
                    "misses": [],
                },
            }

        except Exception as error:
            response_message = (
                explainer.personalised_fallback_message_v4(
                    analysis_context=(
                        analysis_context
                    ),
                    exposure_summary=(
                        exposure_summary
                    ),
                    required_actions=[],
                )
            )

            response = {
                "source": (
                    "fallback_no_actions_after_error:"
                    f"{type(error).__name__}"
                ),
                "message": (
                    response_message
                ),
                "guard": {
                    "passed": None,
                    "misses": [
                        "explainer_call_failed"
                    ],
                },
            }

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
    }


def respond(analysis_context: Dict, answers: Dict[str, str]) -> Dict:
    """STAGE 2. Resolve the user's exposure answers, select the mandatory actions,
    and produce the guarded explanation (or deterministic fallback). Delegates to the
    notebook's tested complete_analysis_with_answers."""
    return complete_analysis_with_answers(analysis_context, answers)
