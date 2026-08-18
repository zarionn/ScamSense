"""Exposure-question derivation and answer resolution for Screenshot GenAI."""

from typing import Dict, List

from .contracts import ExposureAnswer, ExposureProbe


SIGNAL_TO_DIMENSION = {
    "otp_request":                    "shared_otp",
    "payment_request":                "made_payment",
    "upfront_fee_request":            "made_payment",
    "unusual_payment_method":         "made_payment",
    "remote_access_request":          "gave_remote_access",
    "credential_request":             "entered_credentials",
    "personal_information_request":   "shared_personal_info",
    "attachment_or_download_request": "opened_attachment",
    "external_verification_link":     "clicked_link",
}

EXPOSURE_META = {
    "shared_otp":           ("critical", "Did you share a one-time password (OTP) or verification code?"),
    "made_payment":         ("critical", "Did you make any payment or transfer, or pay a fee to proceed?"),
    "gave_remote_access":   ("critical", "Did you install any app or allow remote access to your device?"),
    "entered_credentials":  ("high",     "Did you type your username or password on this page or in a reply?"),
    "shared_personal_info": ("high",     "Did you share personal details such as your NRIC, address, or date of birth?"),
    "opened_attachment":    ("high",     "Did you open or download the attachment or file?"),
    "clicked_link":         ("moderate", "Did you tap or open the link?"),
    "general_contact":      ("moderate", "Did you reply to, call back, or otherwise engage with this message?"),
}

SEVERITY_ORDER = {"critical": 0, "high": 1, "moderate": 2}


def derive_exposure_probes(audit, is_risky: bool) -> List[ExposureProbe]:
    """Deterministic map from the auditor's signals to the exposure questions to ask.
    Returns [] when there is no risk to probe. The model is not involved."""
    if not is_risky:
        return []

    by_dim = {}                        # dimension -> signals that hit it
    for o in audit.observations:
        dim = SIGNAL_TO_DIMENSION.get(o.signal_type)
        if dim:
            by_dim.setdefault(dim, []).append(o.signal_type)

    probes = []
    for dim, sigs in by_dim.items():
        severity, question = EXPOSURE_META[dim]
        probes.append(ExposureProbe(dimension=dim, question=question,
                                     severity=severity, triggered_by=sorted(set(sigs))))

    if not probes:                     # cautioned but no action signal: ask the baseline question
        severity, question = EXPOSURE_META["general_contact"]
        probes.append(ExposureProbe(dimension="general_contact", question=question,
                                     severity=severity, triggered_by=[]))

    probes.sort(key=lambda p: SEVERITY_ORDER[p.severity])
    return probes


def exposure_question_payload(
    probes: List[ExposureProbe],
) -> List[Dict]:
    """Convert exposure probes into JSON-friendly question objects.

    The frontend uses dimension as the stable question ID and sends
    yes, no or unsure for each displayed question.
    """

    return [
        {
            **probe.model_dump(),
            "answer_options": [
                "yes",
                "no",
                "unsure",
            ],
        }
        for probe in probes
    ]


def resolve_exposure_answers(
    exposure_questions: List[Dict],
    answers: Dict[str, ExposureAnswer],
    risky: bool,
) -> Dict:
    """Validate user answers and select relevant exposure dimensions.

    A yes answer confirms an exposure.

    An unsure answer is treated cautiously and receives the relevant
    recovery actions, while remaining marked as uncertain.

    When the screenshot is risky but every answer is no, the application
    adds general_contact automatically so that preventive guidance is
    still provided. It is recorded separately as a defaulted dimension
    and must not be described as user-confirmed.
    """

    expected_dimensions = {
        question["dimension"]
        for question in exposure_questions
    }

    provided_dimensions = set(answers)

    missing_dimensions = (
        expected_dimensions
        - provided_dimensions
    )

    unexpected_dimensions = (
        provided_dimensions
        - expected_dimensions
    )

    if missing_dimensions:
        raise ValueError(
            "Missing exposure answers for: "
            f"{sorted(missing_dimensions)}"
        )

    if unexpected_dimensions:
        raise ValueError(
            "Unexpected exposure answers for: "
            f"{sorted(unexpected_dimensions)}"
        )

    allowed_answers = {
        "yes",
        "no",
        "unsure",
    }

    invalid_answers = {
        dimension: answer
        for dimension, answer in answers.items()
        if answer not in allowed_answers
    }

    if invalid_answers:
        raise ValueError(
            f"Invalid exposure answers: {invalid_answers}"
        )

    confirmed_dimensions = [
        dimension
        for dimension, answer in answers.items()
        if answer == "yes"
    ]

    uncertain_dimensions = [
        dimension
        for dimension, answer in answers.items()
        if answer == "unsure"
    ]

    selected_dimensions = list(
        dict.fromkeys(
            confirmed_dimensions
            + uncertain_dimensions
        )
    )

    defaulted_dimensions = []

    # A risky screenshot still receives general preventive guidance
    # when the user did not confirm or remain unsure about any interaction.
    if risky and not selected_dimensions:
        selected_dimensions = [
            "general_contact"
        ]

        defaulted_dimensions = [
            "general_contact"
        ]

    return {
        "answers": answers,
        "confirmed_dimensions": (
            confirmed_dimensions
        ),
        "uncertain_dimensions": (
            uncertain_dimensions
        ),
        "defaulted_dimensions": (
            defaulted_dimensions
        ),
        "selected_dimensions": (
            selected_dimensions
        ),
    }
