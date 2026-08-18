"""Personalised explanation generation and guarding for Screenshot GenAI."""

import json
import re
from typing import Dict, List, Optional, Set

from . import gemini_client
from .contracts import RecoveryAction


RECONCILIATION_GUIDANCE = {
    ("legitimate", "none"): (
        "The official classifier rated the screenshot as legitimate and the independent "
        "visual review did not trigger additional caution. Give a brief low-risk explanation, "
        "but do not promise that the screenshot is definitely safe."
    ),

    ("legitimate", "medium"): (
        "The official classifier rated the screenshot as legitimate, but the independent "
        "visual review identified some concerning evidence. Keep the official label unchanged "
        "and clearly explain that additional verification is recommended."
    ),

    ("legitimate", "high"): (
        "The official classifier rated the screenshot as legitimate, but the independent "
        "visual review identified strong warning signs. Keep the official label unchanged and "
        "display a prominent additional caution."
    ),

    ("suspicious", "none"): (
        "The official classifier rated the screenshot as suspicious. The independent visual "
        "review did not identify clear additional warning signs. Preserve the uncertainty and "
        "recommend independent verification without inventing red flags."
    ),

    ("suspicious", "medium"): (
        "The official classifier rated the screenshot as suspicious and the independent "
        "visual review identified some concerning evidence. Explain only the supplied visible "
        "evidence and recommend verification through an official channel."
    ),

    ("suspicious", "high"): (
        "The official classifier rated the screenshot as suspicious and the independent "
        "visual review identified strong warning signs. Give a strong caution, but do not "
        "change the official label to scam."
    ),

    ("scam", "none"): (
        "The official classifier rated the screenshot as scam, but the independent visual "
        "review could not identify clear readable warning signs. Preserve the scam label, "
        "state that the specific visible reason could not be confirmed, and do not invent "
        "supporting red flags."
    ),

    ("scam", "medium"): (
        "The official classifier rated the screenshot as scam and the independent visual "
        "review identified some concerning evidence. Preserve the scam label and explain only "
        "the supplied visible evidence."
    ),

    ("scam", "high"): (
        "The official classifier rated the screenshot as scam and the independent visual "
        "review identified strong supporting evidence. Preserve the scam label and explain "
        "the supplied warning signs clearly."
    ),
}


def reconciliation_context(
    classifier_label: str,
    auditor_caution_level: str,
) -> dict:
    """Return the fixed reconciliation branch for the explainer.

    The function does not change either result. It only provides the
    explanation rule for the relevant classifier and auditor combination.
    """

    key = (
        classifier_label.strip().lower(),
        auditor_caution_level.strip().lower(),
    )

    if key not in RECONCILIATION_GUIDANCE:
        raise ValueError(
            "Unsupported reconciliation state: "
            f"classifier={classifier_label}, "
            f"auditor_caution={auditor_caution_level}"
        )

    return {
        "branch": f"{key[0]}_{key[1]}",
        "classifier_label": key[0],
        "auditor_caution_level": key[1],
        "instruction": RECONCILIATION_GUIDANCE[key],
    }


PERSONALISED_EXPLAINER_V4_SYSTEM = """
You are the safety response explainer for ScamSense, a scam screenshot analysis tool.

The supervised classifier result is the official model label.
You must preserve that label exactly and must not replace or override it.

A separate visual auditor has supplied observations from the screenshot.
You may discuss only the supplied observations, domain analysis and unclear elements.
Do not invent any additional warning sign, URL, domain, organisation, statistic or fact.

The user has already answered the exposure questions.
Do not ask those questions again.

The application context may contain defaulted exposure dimensions.
These were selected automatically by Python and were not confirmed by the user.

When general_contact appears under defaulted_dimensions:
- Do not claim that the user confirmed general contact.
- Do not claim that the user replied, clicked or otherwise interacted.
- State that preventive guidance is being provided because the screenshot remains risky,
  even though the user did not confirm interacting with it.

You MUST:
- Use calm, clear and non-judgemental language.
- Use simple English and short sentences.
- Clearly distinguish the official classifier result from the additional visual safety review.
- Follow the supplied reconciliation instruction.
- Explain only evidence supplied by the visual auditor.
- State when information could not be read or verified.
- Reflect confirmed, uncertain and defaulted exposure accurately.
- Copy every quoted recovery action exactly as written.
- Keep all hotline numbers, URLs and punctuation unchanged.
- Present actions in the supplied urgency order.
- Copy the supplied official classifier statement exactly as the first sentence.
- Describe domain relationships only as visual-review assessments.
- State that domain ownership was not independently verified when discussing a domain.

You MUST NOT:
- Change the official classifier label.
- Claim that the classifier was overridden.
- Invent or infer red flags that were not supplied.
- State that the screenshot is definitely safe.
- Add new safety actions.
- Remove, shorten, merge, paraphrase or rewrite a recovery action.
- Ask follow-up exposure questions.
- Use markdown headings, bullet symbols or asterisks.

Output structure:
1. Two to four short sentences explaining the official result and visible evidence.
2. One short sentence describing the user's exposure when applicable.
3. Every quoted recovery action exactly as supplied.
4. A short uncertainty sentence when unclear elements were supplied.
""".strip()


MAX_EXPLANATION_CHARS = 12_000
DOMAIN_IDENTIFIER_PATTERN = re.compile(
    r"\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b",
    re.IGNORECASE,
)
URL_IDENTIFIER_PATTERN = re.compile(
    r"\bhttps?://[^\s<>\"']+",
    re.IGNORECASE,
)
NUMBER_IDENTIFIER_PATTERN = re.compile(r"(?<![\w])\d+(?:[.,]\d+)?%?(?![\w])")


def official_classifier_statement(analysis_context: Dict) -> str:
    """Build the exact classifier sentence required in every explanation."""
    classifier = analysis_context["classifier"]
    return (
        "The official image classifier rated this screenshot as "
        f"{classifier['label']}. The predicted scam probability was "
        f"{classifier['scam_probability']:.1%}."
    )


def _bounded_identifiers(text: str) -> Set[str]:
    """Extract only domain-like and number-like identifiers checked by the guard."""
    return {
        match.group(0).lower()
        for pattern in (
            URL_IDENTIFIER_PATTERN,
            DOMAIN_IDENTIFIER_PATTERN,
            NUMBER_IDENTIFIER_PATTERN,
        )
        for match in pattern.finditer(text)
    }


def _approved_identifier_text(
    analysis_context: Dict,
    required_actions: List[RecoveryAction],
) -> str:
    audit = analysis_context["audit"]
    caution = analysis_context["caution"]
    selected_domain = domain_analysis_for_explanation(audit, caution)
    return "\n".join(
        [official_classifier_statement(analysis_context)]
        + [
            observation["evidence"]
            for observation in observations_for_explanation(audit, caution)
        ]
        + list(audit.get("unclear_elements", []))
        + ([json.dumps(selected_domain, ensure_ascii=False)] if selected_domain else [])
        + [action.text for action in required_actions]
    )


def guard_message(
    message: str,
    required_actions: List[RecoveryAction],
    analysis_context: Dict,
) -> Dict:
    """Check the bounded classifier, action and identifier response contract."""
    misses = []
    classifier_statement = official_classifier_statement(analysis_context)
    classifier_statement_passed = (
        message.startswith(classifier_statement)
        and message.count(classifier_statement) == 1
    )
    if not classifier_statement_passed:
        misses.append("classifier_statement")

    action_positions = []
    actions_exact_once = True
    for action in required_actions:
        if message.count(action.text) != 1:
            actions_exact_once = False
            misses.append(action.theme or action.text[:24])
        else:
            action_positions.append(message.index(action.text))

    actions_in_order = actions_exact_once and action_positions == sorted(action_positions)
    if not actions_in_order and required_actions:
        misses.append("action_order")

    approved_identifiers = _bounded_identifiers(
        _approved_identifier_text(analysis_context, required_actions)
    )
    generated_identifiers = _bounded_identifiers(message)
    unexpected_identifiers = sorted(generated_identifiers - approved_identifiers)
    identifiers_passed = not unexpected_identifiers
    if not identifiers_passed:
        misses.append("unexpected_identifiers")

    length_passed = len(message) <= MAX_EXPLANATION_CHARS
    if not length_passed:
        misses.append("message_too_long")

    selected_domain = domain_analysis_for_explanation(
        analysis_context["audit"],
        analysis_context["caution"],
    )
    relationship = selected_domain.get("domain_relationship") if selected_domain else None
    domain_qualification_passed = True
    if relationship in {"match", "mismatch"}:
        lowered_message = message.lower()
        domain_qualification_passed = (
            "domain ownership was not independently verified" in lowered_message
            and "does not match the claimed organisation" not in lowered_message
            and "matches the claimed organisation" not in lowered_message
        )
        if not domain_qualification_passed:
            misses.append("domain_qualification")

    checks = {
        "classifier_statement_exact_once": classifier_statement_passed,
        "required_actions_exact_once": actions_exact_once,
        "required_actions_in_order": actions_in_order,
        "identifiers_within_context": identifiers_passed,
        "message_length_within_limit": length_passed,
        "domain_assessment_qualified": domain_qualification_passed,
    }
    return {
        "passed": all(checks.values()),
        "misses": sorted(set(misses)),
        "scope": (
            "classifier_statement_required_actions_order_identifiers_"
            "and_domain_qualification"
        ),
        "checks": checks,
    }


def explain_personalised_v4(
    analysis_context: Dict,
    exposure_summary: Dict,
    required_actions: List[RecoveryAction],
    model_id=gemini_client.MODEL_ID,
) -> str:
    """Generate a personalised response after exposure answers are known."""

    user_prompt = (
        build_personalised_prompt_v4(
            analysis_context=analysis_context,
            exposure_summary=exposure_summary,
            required_actions=required_actions,
        )
    )

    interaction = (
        gemini_client.get_client().interactions.create(
            model=model_id,
            input=[
                {
                    "type": "text",
                    "text": user_prompt,
                }
            ],
            system_instruction=(
                PERSONALISED_EXPLAINER_V4_SYSTEM
            ),
            generation_config={
                "thinking_level": "minimal",
                "max_output_tokens": gemini_client.EXPLAINER_MAX_TOKENS,
                "temperature": 0.0,
            },
        )
    )

    return interaction.output_text.strip()


def build_guarded_personalised_response_v4(
    analysis_context: Dict,
    exposure_summary: Dict,
    required_actions: List[RecoveryAction],
) -> Dict:
    """Generate, validate and safely fall back after user exposure is known."""

    try:
        generated_message = explain_personalised_v4(
            analysis_context=analysis_context,
            exposure_summary=exposure_summary,
            required_actions=required_actions,
        )

        guard_result = guard_message(
            message=generated_message,
            required_actions=required_actions,
            analysis_context=analysis_context,
        )

        if guard_result["passed"]:
            return {
                "source": (
                    "explainer_v4"
                    if required_actions
                    else "explainer_v4_no_actions"
                ),
                "message": generated_message,
                "guard": guard_result,
            }

        fallback_message = personalised_fallback_message_v4(
            analysis_context=analysis_context,
            exposure_summary=exposure_summary,
            required_actions=required_actions,
        )

        fallback_guard = guard_message(
            message=fallback_message,
            required_actions=required_actions,
            analysis_context=analysis_context,
        )

        return {
            "source": (
                "fallback_after_guard_fail"
                if required_actions
                else "fallback_no_actions_after_guard_fail"
            ),
            "message": fallback_message,
            "guard": guard_result,
            "fallback_guard": fallback_guard,
        }

    except Exception as error:
        fallback_message = personalised_fallback_message_v4(
            analysis_context=analysis_context,
            exposure_summary=exposure_summary,
            required_actions=required_actions,
        )

        fallback_guard = guard_message(
            message=fallback_message,
            required_actions=required_actions,
            analysis_context=analysis_context,
        )

        return {
            "source": (
                (
                    "fallback_after_error:"
                    if required_actions
                    else "fallback_no_actions_after_error:"
                )
                + type(error).__name__
            ),
            "message": fallback_message,
            "guard": {
                "passed": None,
                "misses": ["explainer_call_failed"],
            },
            "fallback_guard": fallback_guard,
        }


RULE_SIGNAL_MAP = {
    # High caution rules
    "OTP_REQUEST": {
        "otp_request",
    },

    "REMOTE_ACCESS_REQUEST": {
        "remote_access_request",
    },

    "DOMAIN_MISMATCH_CREDENTIALS": {
        "credential_request",
    },

    "URGENT_EXTERNAL_CREDENTIAL": {
        "urgent_account_threat",
        "external_verification_link",
        "credential_request",
    },

    "PRIZE_WITH_UPFRONT_PAYMENT": {
        "prize_or_reward_claim",
        "upfront_fee_request",
        "payment_request",
    },

    "IMPERSONATION_PAYMENT": {
        "impersonation_claim",
        "payment_request",
    },

    # Medium caution rules
    "URGENCY_PLUS_LINK": {
        "urgent_account_threat",
        "external_verification_link",
    },

    # The policy fires when the domain is unreadable and at least
    # one other observation is present. All supported observations
    # are retained for this rule.
    "UNVERIFIABLE_DOMAIN_PLUS_RISK": {
        "*",
    },

    "PAYMENT_PLUS_SECRECY": {
        "payment_request",
        "secrecy_request",
    },

    "IMPERSONATION_CREDENTIALS": {
        "impersonation_claim",
        "credential_request",
    },

    "PRIZE_LINK_IMPERSONATION": {
        "prize_or_reward_claim",
        "external_verification_link",
        "impersonation_claim",
    },
}


def observations_for_explanation(
    audit: Dict,
    caution: Dict,
) -> List[Dict]:
    """Return only observations supporting the triggered caution rules.

    Only clear or partial evidence is allowed into the user-facing
    explanation.

    When a new caution rule is added to evaluate_caution(), this function
    raises an error until the new rule is explicitly mapped. This prevents
    an unmapped rule from silently using unrelated evidence.
    """

    triggered_rules = caution.get(
        "triggered_rules",
        [],
    )

    if not triggered_rules:
        return []

    unknown_rules = [
        rule_id
        for rule_id in triggered_rules
        if rule_id not in RULE_SIGNAL_MAP
    ]

    if unknown_rules:
        raise ValueError(
            "Missing explanation-evidence mapping for caution rules: "
            f"{unknown_rules}"
        )

    allowed_signals: Set[str] = set()
    include_all_supported = False

    for rule_id in triggered_rules:
        mapped_signals = (
            RULE_SIGNAL_MAP[
                rule_id
            ]
        )

        if "*" in mapped_signals:
            include_all_supported = True
        else:
            allowed_signals.update(
                mapped_signals
            )

    supported_observations = [
        observation
        for observation in audit.get(
            "observations",
            [],
        )
        if observation.get(
            "evidence_quality"
        )
        in {
            "clear",
            "partial",
        }
    ]

    if include_all_supported:
        selected_observations = (
            supported_observations
        )
    else:
        selected_observations = [
            observation
            for observation
            in supported_observations
            if observation.get(
                "signal_type"
            )
            in allowed_signals
        ]

    # Remove duplicates while retaining the original order.
    unique_observations = []
    seen_observations = set()

    for observation in selected_observations:
        observation_key = (
            observation.get(
                "signal_type"
            ),
            observation.get(
                "evidence"
            ),
        )

        if observation_key in seen_observations:
            continue

        seen_observations.add(
            observation_key
        )

        unique_observations.append(
            observation
        )

    return unique_observations


def domain_analysis_for_explanation(
    audit: Dict,
    caution: Dict,
) -> Optional[Dict]:
    """Return domain analysis only when it supported a triggered rule."""

    triggered_rules = set(
        caution.get(
            "triggered_rules",
            [],
        )
    )

    domain = audit.get(
        "domain_analysis",
        {},
    )

    if not domain.get(
        "domain_visible"
    ):
        return None

    relationship = domain.get(
        "domain_relationship"
    )

    readability = domain.get(
        "domain_readability"
    )

    # This rule directly requires a clear mismatched domain.
    if (
        "DOMAIN_MISMATCH_CREDENTIALS"
        in triggered_rules
        and relationship == "mismatch"
        and readability == "clear"
    ):
        return {
            key: value
            for key, value in domain.items()
            if key != "evidence"
        }

    # PRIZE_LINK_IMPERSONATION may fire through either an
    # impersonation signal or a clear domain mismatch.
    # Include the domain only when the mismatch was actually present.
    if (
        "PRIZE_LINK_IMPERSONATION"
        in triggered_rules
        and relationship == "mismatch"
        and readability == "clear"
    ):
        return {
            key: value
            for key, value in domain.items()
            if key != "evidence"
        }

    # This rule directly requires a visible but unreadable domain.
    if (
        "UNVERIFIABLE_DOMAIN_PLUS_RISK"
        in triggered_rules
        and readability == "unreadable"
    ):
        return {
            key: value
            for key, value in domain.items()
            if key != "evidence"
        }

    return None


def build_personalised_prompt_v4(
    analysis_context: Dict,
    exposure_summary: Dict,
    required_actions: List[RecoveryAction],
) -> str:
    """Build the V4.1 prompt using only rule-supporting evidence."""

    classifier = analysis_context[
        "classifier"
    ]

    audit = analysis_context[
        "audit"
    ]

    caution = analysis_context[
        "caution"
    ]

    reconciliation = reconciliation_context(
        classifier_label=classifier[
            "label"
        ],
        auditor_caution_level=caution[
            "caution_level"
        ],
    )

    selected_observations = (
        observations_for_explanation(
            audit=audit,
            caution=caution,
        )
    )

    selected_domain_analysis = (
        domain_analysis_for_explanation(
            audit=audit,
            caution=caution,
        )
    )

    observations = [
        {
            "signal_type": observation[
                "signal_type"
            ],
            "evidence": observation[
                "evidence"
            ],
            "evidence_quality": observation[
                "evidence_quality"
            ],
        }
        for observation
        in selected_observations
    ]

    context_payload = {
        "official_classifier_statement": (
            official_classifier_statement(
                analysis_context
            )
        ),
        "official_classifier_result": (
            classifier
        ),
        "auditor_caution": caution,
        "effective_caution_level": (
            analysis_context[
                "effective_caution_level"
            ]
        ),
        "reconciliation": reconciliation,
        "visible_observations_supporting_caution": (
            observations
        ),
        "domain_analysis_supporting_caution": (
            selected_domain_analysis
        ),
        "unclear_elements": audit.get(
            "unclear_elements",
            [],
        ),
        "user_exposure": {
            "answers": exposure_summary[
                "answers"
            ],
            "confirmed_dimensions": (
                exposure_summary[
                    "confirmed_dimensions"
                ]
            ),
            "uncertain_dimensions": (
                exposure_summary[
                    "uncertain_dimensions"
                ]
            ),
            "defaulted_dimensions": (
                exposure_summary.get(
                    "defaulted_dimensions",
                    [],
                )
            ),
        },
    }

    def actions_for_urgency(
        urgency: str,
    ) -> str:
        matching_actions = [
            action.text
            for action in required_actions
            if action.urgency == urgency
        ]

        if not matching_actions:
            return "(none)"

        return "\n".join(
            f'"{action_text}"'
            for action_text
            in matching_actions
        )

    return (
        "Use the following application context:\n\n"
        f"{json.dumps(context_payload, indent=2, ensure_ascii=False)}\n\n"
        "The visible observations and domain analysis have already "
        "been filtered by Python. Discuss only this supplied evidence.\n\n"
        "The answers field contains the user's actual answers. "
        "Defaulted dimensions were added automatically by Python and "
        "must not be described as user-confirmed.\n\n"
        "Copy every recovery action below exactly as written.\n\n"
        "Use official_classifier_statement exactly once as the first sentence.\n"
        "Any domain relationship is only a visual-review assessment. "
        "State that domain ownership was not independently verified.\n\n"
        f"RIGHT NOW:\n"
        f"{actions_for_urgency('now')}\n\n"
        f"SOON:\n"
        f"{actions_for_urgency('soon')}\n\n"
        f"ADVISABLE:\n"
        f"{actions_for_urgency('advisable')}\n\n"
        "Write the final user response now."
    )


def personalised_fallback_message_v4(
    analysis_context: Dict,
    exposure_summary: Dict,
    required_actions: List[RecoveryAction],
) -> str:
    """Build a deterministic fallback using rule-supporting evidence."""

    classifier = analysis_context[
        "classifier"
    ]

    audit = analysis_context[
        "audit"
    ]

    caution = analysis_context[
        "caution"
    ]

    reconciliation = reconciliation_context(
        classifier_label=classifier[
            "label"
        ],
        auditor_caution_level=caution[
            "caution_level"
        ],
    )

    response_lines = []

    response_lines.append(
        official_classifier_statement(
            analysis_context
        )
    )

    response_lines.append(
        reconciliation[
            "instruction"
        ]
    )

    selected_observations = (
        observations_for_explanation(
            audit=audit,
            caution=caution,
        )
    )

    if selected_observations:
        response_lines.append("")

        response_lines.append(
            "Visible signs supporting the additional caution:"
        )

        for observation in selected_observations:
            response_lines.append(
                f"- {observation['evidence']}"
            )

    selected_domain = (
        domain_analysis_for_explanation(
            audit=audit,
            caution=caution,
        )
    )

    if selected_domain:
        claimed_entity = (
            selected_domain.get(
                "claimed_entity"
            )
        )

        visible_domain = (
            selected_domain.get(
                "visible_domain"
            )
        )

        relationship = (
            selected_domain.get(
                "domain_relationship"
            )
        )

        readability = (
            selected_domain.get(
                "domain_readability"
            )
        )

        if (
            claimed_entity
            and visible_domain
        ):
            response_lines.append("")

            response_lines.append(
                "The visual review read the claimed organisation as "
                f"{claimed_entity} and the visible domain as {visible_domain}."
            )

        if relationship == "mismatch":
            response_lines.append(
                "The visual review suggests a possible mismatch, but domain ownership "
                "was not independently verified."
            )

        elif relationship == "match":
            response_lines.append(
                "The visual review suggests a possible match, but domain ownership "
                "was not independently verified."
            )

        elif readability == "unreadable":
            response_lines.append(
                "The visible domain could not be read clearly enough to verify."
            )

    unclear_elements = audit.get(
        "unclear_elements",
        [],
    )

    if unclear_elements:
        response_lines.append("")

        response_lines.append(
            "Some details could not be confirmed: "
            + "; ".join(
                unclear_elements
            )
        )

    confirmed_dimensions = (
        exposure_summary[
            "confirmed_dimensions"
        ]
    )

    uncertain_dimensions = (
        exposure_summary[
            "uncertain_dimensions"
        ]
    )

    defaulted_dimensions = (
        exposure_summary.get(
            "defaulted_dimensions",
            [],
        )
    )

    if confirmed_dimensions:
        response_lines.append("")

        response_lines.append(
            "You confirmed these interactions: "
            + ", ".join(
                confirmed_dimensions
            )
            + "."
        )

    if uncertain_dimensions:
        response_lines.append("")

        response_lines.append(
            "You were unsure about these interactions, so cautious "
            "recovery steps have been included: "
            + ", ".join(
                uncertain_dimensions
            )
            + "."
        )

    if (
        "general_contact"
        in defaulted_dimensions
    ):
        response_lines.append("")

        response_lines.append(
            "You did not confirm interacting with the content. "
            "Preventive guidance is included because the screenshot "
            "still contains concerning signs."
        )

    urgency_titles = {
        "now": "Do these right now:",
        "soon": "Then do these soon:",
        "advisable": "Also worth doing:",
    }

    for urgency in [
        "now",
        "soon",
        "advisable",
    ]:
        matching_actions = [
            action
            for action in required_actions
            if action.urgency == urgency
        ]

        if not matching_actions:
            continue

        response_lines.append("")

        response_lines.append(
            urgency_titles[
                urgency
            ]
        )

        for action in matching_actions:
            response_lines.append(
                f"- {action.text}"
            )

    return "\n".join(
        response_lines
    ).strip()
