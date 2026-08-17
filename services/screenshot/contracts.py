"""Pydantic contracts shared within the Screenshot GenAI pipeline."""

from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


ShortText = Annotated[str, StringConstraints(min_length=1, max_length=256)]
EvidenceText = Annotated[str, StringConstraints(min_length=1, max_length=1000)]
RuleIdentifier = Annotated[str, StringConstraints(min_length=1, max_length=64)]


class ScreenshotContract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


SignalType = Literal[
    # credential / secret capture
    "credential_request",
    "otp_request",
    "personal_information_request",
    # pressure / manipulation
    "urgent_account_threat",
    "authority_pressure",
    "secrecy_request",
    # money
    "payment_request",
    "upfront_fee_request",
    "prize_or_reward_claim",
    "unusual_payment_method",
    # links / impersonation (the OOD headline cases)
    "external_verification_link",
    "impersonation_claim",
    # device compromise
    "remote_access_request",
    "attachment_or_download_request",
]

EvidenceQuality = Literal["clear", "partial", "weak"]


class Observation(ScreenshotContract):
    signal_type: SignalType                 # must be from the fixed taxonomy
    evidence: EvidenceText                  # what is LITERALLY visible that supports this
    evidence_quality: EvidenceQuality


class DomainAnalysis(ScreenshotContract):
    domain_visible: bool                    # is an address bar / URL visible at all?
    visible_domain: Optional[ShortText] = None    # what the auditor actually reads, e.g. "excelpatch.zip"
    claimed_entity: Optional[ShortText] = None    # who the page presents itself as, e.g. "Google"
    domain_readability: Literal["clear", "partial", "unreadable"] = "unreadable"
    domain_relationship: Literal["match", "mismatch", "cannot_determine"] = "cannot_determine"
    evidence: Optional[EvidenceText] = None


class AuditorResult(ScreenshotContract):
    content_type: Literal[
        "website", "login_page", "email", "sms_or_chat",
        "marketplace_listing", "other"
    ]
    observations: List[Observation] = Field(max_length=32)
    domain_analysis: DomainAnalysis         # always present; domain_visible=False if none
    unclear_elements: List[EvidenceText] = Field(
        default_factory=list,
        max_length=16,
        description="Things the auditor could NOT read or verify (blurry text, cut-off URL). "
                    "Recording uncertainty here is required — it must never be silently ignored."
    )


ExposureDimension = Literal[
    "shared_otp", "made_payment", "gave_remote_access",                  # critical
    "entered_credentials", "shared_personal_info", "opened_attachment",  # high
    "clicked_link", "general_contact",                                   # moderate
]

ExposureAnswer = Literal["yes", "no", "unsure"]


class ExposureProbe(ScreenshotContract):
    dimension: ExposureDimension
    question: EvidenceText
    severity: Literal["critical", "high", "moderate"]
    triggered_by: List[SignalType] = Field(max_length=16)


class RecoveryAction(ScreenshotContract):
    text: EvidenceText
    urgency: Literal["now", "soon", "advisable"]
    theme: Optional[ShortText] = None


AuditStatus = Literal["available", "malformed", "unavailable"]
CautionLevel = Literal["none", "medium", "high"]


class ClassifierResult(ScreenshotContract):
    label: Literal["legitimate", "suspicious", "scam"]
    scam_probability: float = Field(ge=0.0, le=1.0)
    confidence_pct: float = Field(ge=0.0, le=100.0)


class CautionDecision(ScreenshotContract):
    caution_level: CautionLevel
    caution_raised: bool
    triggered_rules: List[RuleIdentifier] = Field(max_length=16)


class ExposureQuestion(ExposureProbe):
    answer_options: List[ExposureAnswer] = Field(min_length=3, max_length=3)


class AnalysisContext(ScreenshotContract):
    classifier: ClassifierResult
    audit: AuditorResult
    audit_status: AuditStatus
    audit_signals: List[SignalType] = Field(max_length=32)
    display_observations: List[Observation] = Field(max_length=32)
    caution: CautionDecision
    effective_caution_level: CautionLevel
    risky: bool
    exposure_questions: List[ExposureQuestion] = Field(max_length=8)


class SignedAnalysisPayload(ScreenshotContract):
    version: Literal[1]
    issued_at: int = Field(ge=0)
    context: AnalysisContext
