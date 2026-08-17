"""Pydantic contracts shared within the Screenshot GenAI pipeline."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


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


class Observation(BaseModel):
    signal_type: SignalType                 # must be from the fixed taxonomy
    evidence: str                           # what is LITERALLY visible that supports this
    evidence_quality: EvidenceQuality


class DomainAnalysis(BaseModel):
    domain_visible: bool                    # is an address bar / URL visible at all?
    visible_domain: Optional[str] = None    # what the auditor actually reads, e.g. "excelpatch.zip"
    claimed_entity: Optional[str] = None    # who the page presents itself as, e.g. "Google"
    domain_readability: Literal["clear", "partial", "unreadable"] = "unreadable"
    domain_relationship: Literal["match", "mismatch", "cannot_determine"] = "cannot_determine"
    evidence: Optional[str] = None


class AuditorResult(BaseModel):
    content_type: Literal[
        "website", "login_page", "email", "sms_or_chat",
        "marketplace_listing", "other"
    ]
    observations: List[Observation]         # may be empty if nothing concerning is visible
    domain_analysis: DomainAnalysis         # always present; domain_visible=False if none
    unclear_elements: List[str] = Field(
        default_factory=list,
        description="Things the auditor could NOT read or verify (blurry text, cut-off URL). "
                    "Recording uncertainty here is required — it must never be silently ignored."
    )


ExposureDimension = Literal[
    "shared_otp", "made_payment", "gave_remote_access",                  # critical
    "entered_credentials", "shared_personal_info", "opened_attachment",  # high
    "clicked_link", "general_contact",                                   # moderate
]

ExposureAnswer = Literal["yes", "no", "unsure"]


class ExposureProbe(BaseModel):
    dimension: ExposureDimension
    question: str
    severity: Literal["critical", "high", "moderate"]
    triggered_by: List[str]


class RecoveryAction(BaseModel):
    text: str
    urgency: Literal["now", "soon", "advisable"]
    theme: Optional[str] = None
