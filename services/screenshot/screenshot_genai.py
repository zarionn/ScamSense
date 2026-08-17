import os
import base64
import json
import mimetypes
from pathlib import Path
from typing import Dict, List, Literal, Optional, Set
from pydantic import BaseModel, Field
from google import genai
from dotenv import load_dotenv

load_dotenv()

if "GEMINI_API_KEY" not in os.environ:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. Put it in a local .env file or in the Render "
        "environment variables before starting the server."
    )

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL_ID = "gemini-3.5-flash"
AUDITOR_MAX_TOKENS = 2048

# ============================================================================
# PIPELINE
# ============================================================================

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


def _has(result, signal, min_quality="clear"):
    """True if `signal` is present with quality >= min_quality."""
    order = {"weak": 0, "partial": 1, "clear": 2}
    need = order[min_quality]
    return any(o.signal_type == signal and order[o.evidence_quality] >= need
               for o in result.observations)

def _domain_mismatch_clear(result):
    d = result.domain_analysis
    return d.domain_relationship == "mismatch" and d.domain_readability == "clear"

def _domain_unreadable(result):
    d = result.domain_analysis
    return d.domain_visible and d.domain_readability == "unreadable"

def evaluate_caution(result) -> Dict:
    """Maps an AuditorResult to a caution decision. Python owns this, not the LLM."""
    fired: List[str] = []

    # HIGH: single serious clear signals (stand-alone)
    if _has(result, "otp_request"):
        fired.append("OTP_REQUEST")
    if _has(result, "remote_access_request"):
        fired.append("REMOTE_ACCESS_REQUEST")

    # HIGH: combinations (all constituents clear)
    if _domain_mismatch_clear(result) and _has(result, "credential_request"):
        fired.append("DOMAIN_MISMATCH_CREDENTIALS")
    if (_has(result, "urgent_account_threat")
            and _has(result, "external_verification_link")
            and _has(result, "credential_request")):
        fired.append("URGENT_EXTERNAL_CREDENTIAL")
    if _has(result, "prize_or_reward_claim") and (
            _has(result, "upfront_fee_request") or _has(result, "payment_request")):
        fired.append("PRIZE_WITH_UPFRONT_PAYMENT")
    if _has(result, "impersonation_claim") and _has(result, "payment_request"):
        fired.append("IMPERSONATION_PAYMENT")

    high_rules = {"OTP_REQUEST", "REMOTE_ACCESS_REQUEST", "DOMAIN_MISMATCH_CREDENTIALS",
                  "URGENT_EXTERNAL_CREDENTIAL", "PRIZE_WITH_UPFRONT_PAYMENT",
                  "IMPERSONATION_PAYMENT"}
    if any(r in high_rules for r in fired):
        return {"caution_level": "high", "caution_raised": True, "triggered_rules": fired}

    # MEDIUM
    if _has(result, "urgent_account_threat") and _has(result, "external_verification_link"):
        fired.append("URGENCY_PLUS_LINK")
    if _domain_unreadable(result) and len(result.observations) >= 1:
        fired.append("UNVERIFIABLE_DOMAIN_PLUS_RISK")
    if _has(result, "payment_request") and _has(result, "secrecy_request"):
        fired.append("PAYMENT_PLUS_SECRECY")
    if _has(result, "impersonation_claim") and _has(result, "credential_request"):
        fired.append("IMPERSONATION_CREDENTIALS")

    # NEW (v2): reward bait routed through an external link that impersonates a
    # brand. Rescues the lottery-link smish (170957) that dangles a prize link without
    # asking for payment. Gated on impersonation OR a clear domain mismatch so genuine
    # brand rewards (reward + own-domain link, e.g. pokemon_go) do not fire.
    if (_has(result, "prize_or_reward_claim")
            and _has(result, "external_verification_link")
            and (_has(result, "impersonation_claim") or _domain_mismatch_clear(result))):
        fired.append("PRIZE_LINK_IMPERSONATION")

    medium_rules = {"URGENCY_PLUS_LINK", "UNVERIFIABLE_DOMAIN_PLUS_RISK",
                    "PAYMENT_PLUS_SECRECY", "IMPERSONATION_CREDENTIALS",
                    "PRIZE_LINK_IMPERSONATION"}
    if any(r in medium_rules for r in fired):
        return {"caution_level": "medium", "caution_raised": True, "triggered_rules": fired}

    # LOW / NONE (default)
    return {"caution_level": "none", "caution_raised": False, "triggered_rules": []}


AUDITOR_SYSTEM_INSTRUCTION_V2 = """You are the independent visual safety auditor of ScamSense, a \
scam-screenshot tool used by the public in Singapore.

Your ONLY job is to REPORT what is visibly present in the screenshot as structured signals. \
You do NOT decide whether the screenshot is a scam, a separate system makes that decision. \
Do not state an overall verdict, risk score, or conclusion.

RULES:
1. Only emit signals from the provided taxonomy. Never invent new signal_type values.
2. Every observation MUST have 'evidence' describing what is literally visible. If you cannot \
point to visible evidence for a signal, do not emit it. Keep each 'evidence' field to one \
concise sentence.
3. Set evidence_quality honestly: 'clear' only when plainly readable; 'weak' when you are \
inferring from something faint or ambiguous.
4. DOMAIN FORMAT: put ONLY a bare domain in visible_domain, for example 'rtapit.com', with \
nothing else. No sentences, no explanation, no surrounding text. If you need to explain the \
domain, put that in the domain_analysis 'evidence' field, never in visible_domain.
5. DOMAIN ACCURACY: read the address bar or URL EXACTLY and copy only the characters you can \
actually see. Never append, complete, guess or invent characters to finish a URL. If the URL is \
cut off or partly unreadable, set domain_readability to 'partial' or 'unreadable', record the \
unreadable portion in unclear_elements, and do NOT fill in the missing part. Only set \
domain_relationship to 'mismatch' when you can clearly read both the claimed brand and a domain \
that does not belong to it.
6. IMPERSONATION: emit impersonation_claim ONLY when the message presents itself as a specific \
named organisation or authority AND there is visible evidence the sender is not that \
organisation, for example a domain, email address, phone number or handle that does not belong \
to the claimed brand, or a clearly unofficial channel presenting itself as official. A message \
that genuinely names its own brand with no visible evidence contradicting it is NOT \
impersonation; do not emit the signal in that case.
7. Put anything you cannot read or verify into unclear_elements. Never approximate text with \
'or similar'.
8. Report only what you SEE. Do not assume intent beyond the visible evidence."""

def audit_screenshot(img_path, model_id=MODEL_ID, _retries=1):
    """Independent visual audit (image only, no classifier label), auditor prompt V2.
    Retries once on truncated/malformed JSON, then falls back to a safe empty audit."""
    img_bytes = Path(img_path).read_bytes()
    mime = mimetypes.guess_type(str(img_path))[0] or "image/png"
    img_b64 = base64.b64encode(img_bytes).decode("utf-8")

    prompt = (
        "Examine this screenshot and report the visible warning signals using the taxonomy. "
        "List each concerning element you can see, with evidence and how clearly you see it. "
        "Fill domain_analysis if any address bar/URL is present, putting only a bare domain in "
        "visible_domain. Record anything unreadable in unclear_elements. Do NOT state whether "
        "this is a scam. Keep each 'evidence' field to one concise sentence."
    )

    last_err = None
    for attempt in range(_retries + 1):
        try:
            interaction = client.interactions.create(
                model=model_id,
                input=[
                    {"type": "image", "data": img_b64, "mime_type": mime},
                    {"type": "text",  "text": prompt},
                ],
                system_instruction=AUDITOR_SYSTEM_INSTRUCTION_V2,   # the only change vs the fixed V1
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": AuditorResult.model_json_schema(),
                },
                generation_config={
                    "thinking_level": "minimal",
                    "max_output_tokens": AUDITOR_MAX_TOKENS,
                },
            )
            data = json.loads(interaction.output_text)
            result = AuditorResult(**data)
            if attempt > 0:
                print(f"    (recovered after {attempt} retry on {Path(img_path).name})")
            return result
        except (json.JSONDecodeError, ValueError) as e:
            last_err = e
            continue

    print(f"    (audit fell back to empty for {Path(img_path).name}: {str(last_err)[:50]})")
    return AuditorResult(
        content_type="other",
        observations=[],
        domain_analysis=DomainAnalysis(domain_visible=False),
        unclear_elements=["Audit response could not be parsed; treated as no signals found."],
    )


ExposureDimension = Literal[
    "shared_otp", "made_payment", "gave_remote_access",                  # critical
    "entered_credentials", "shared_personal_info", "opened_attachment",  # high
    "clicked_link", "general_contact",                                   # moderate
]

class ExposureProbe(BaseModel):
    dimension: ExposureDimension
    question: str
    severity: Literal["critical", "high", "moderate"]
    triggered_by: List[str]

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


class RecoveryAction(BaseModel):
    text: str
    urgency: Literal["now", "soon", "advisable"]
    theme: Optional[str] = None

ACTION_CATALOGUE = {
    "shared_otp": [
        RecoveryAction(text="Contact the real organisation using a number you find yourself, not one from the message, and tell them the code was shared.", urgency="now", theme="contact_real_org"),
        RecoveryAction(text="If it was a bank or Singpass code, call your bank's 24/7 anti-scam hotline or the ScamShield Helpline at 1799 immediately.", urgency="now", theme="bank_hotline"),
        RecoveryAction(text="Change the password of the account the code was for, and turn on two-factor authentication if it is not already on.", urgency="soon", theme="change_password"),
    ],
    "made_payment": [
        RecoveryAction(text="Call your bank's 24/7 anti-scam hotline now to report the transfer and ask if it can be stopped or reversed.", urgency="now", theme="bank_hotline"),
        RecoveryAction(text="Freeze or lock the card or account used, through your banking app or by phone.", urgency="now", theme="freeze_card"),
        RecoveryAction(text="Report the scam at ScamShield (report.scamshield.gov.sg) or call 1799, and keep the transaction reference.", urgency="soon", theme="report_scamshield"),
    ],
    "gave_remote_access": [
        RecoveryAction(text="Disconnect the device from the internet now to cut off the remote session.", urgency="now", theme="disconnect_device"),
        RecoveryAction(text="Uninstall any app they asked you to install (such as AnyDesk or TeamViewer), then run a security scan.", urgency="now", theme="scan_device"),
        RecoveryAction(text="From a different, trusted device, change the passwords of any accounts you opened while they had access, starting with banking.", urgency="soon", theme="change_password"),
    ],
    "entered_credentials": [
        RecoveryAction(text="Change that account's password now from a device you trust, and change it anywhere else you reused the same password.", urgency="now", theme="change_password"),
        RecoveryAction(text="Turn on two-factor authentication for the account.", urgency="soon", theme="enable_2fa"),
        RecoveryAction(text="Check the account's recent login or security activity for sessions you do not recognise, and sign them out.", urgency="soon", theme="check_logins"),
    ],
    "shared_personal_info": [
        RecoveryAction(text="Be alert for follow-up scams that use your details to sound convincing; treat any urgent contact that references them with suspicion.", urgency="advisable", theme="watch_followup"),
        RecoveryAction(text="If you shared your NRIC or Singpass details, report it to ScamShield (1799) and monitor your Singpass activity.", urgency="soon", theme="report_scamshield"),
    ],
    "opened_attachment": [
        RecoveryAction(text="Do not enter any details into anything the file opened.", urgency="now", theme="do_not_enter"),
        RecoveryAction(text="Run a security scan on your device, and change key passwords from a different trusted device if you are unsure what it did.", urgency="soon", theme="scan_device"),
    ],
    "clicked_link": [
        RecoveryAction(text="Do not enter any information on the page that opened, and close it.", urgency="now", theme="do_not_enter"),
        RecoveryAction(text="Open the organisation's official app or type its official website address manually to check whether the message was genuine.", urgency="soon", theme="official_verification"),
    ],
    "general_contact": [
        RecoveryAction(text="Do not reply further, click anything, or send money or details.", urgency="now", theme="do_not_engage"),
        RecoveryAction(text="Verify independently through the organisation's official channel, and report the message to ScamShield (1799) if it is a scam.", urgency="advisable", theme="report_scamshield"),
    ],
}

URGENCY_ORDER = {"now": 0, "soon": 1, "advisable": 2}

def guard_message(message, required_actions) -> Dict:
    """Each required action must appear VERBATIM (case-insensitive, trailing '.' ignored).
    Verbatim action strings are long and unique, so unrelated text cannot satisfy them."""
    msg = message.lower()
    misses = []
    if any("1799" in a.text for a in required_actions) and "1799" not in msg:
        misses.append("hotline_1799")
    for a in required_actions:
        needle = a.text.lower().rstrip(".")
        if needle not in msg:
            misses.append(a.theme or a.text[:24])
    return {"passed": not misses, "misses": sorted(set(misses))}


SEVERITY = {"none": 0, "medium": 1, "high": 2}

CLASSIFIER_LEVEL = {"legitimate": "none", "suspicious": "medium", "scam": "high"}

def is_risky_verdict(classifier_label, caution_decision) -> bool:
    """Risky if the classifier is not confidently legitimate, or the policy raised a caution."""
    return classifier_label in ("scam", "suspicious") or caution_decision["caution_raised"]

def effective_caution(classifier_label, caution_decision) -> Dict:
    """Combine classifier verdict and escalation into one message-facing level, taking the more
    severe. Escalate-only: the level can only rise. The classifier LABEL is never changed."""
    clf = CLASSIFIER_LEVEL.get(classifier_label, "none")
    pol = caution_decision["caution_level"]
    level = clf if SEVERITY[clf] >= SEVERITY[pol] else pol
    return {"caution_level": level, "caution_raised": level != "none",
            "triggered_rules": caution_decision["triggered_rules"]}


ExposureAnswer = Literal["yes", "no", "unsure"]

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


def actions_for_dimensions(dimensions: List[str]) -> Dict:
    """Select mandatory actions only for the user's confirmed or uncertain exposures.

    De-duplicates by exact text and by action theme, keeping the most urgent
    action for a repeated theme.
    """
    invalid_dimensions = [
        dimension
        for dimension in dimensions
        if dimension not in ACTION_CATALOGUE
    ]

    if invalid_dimensions:
        raise ValueError(
            f"Unknown exposure dimensions: {invalid_dimensions}"
        )

    best_by_theme = {}
    seen_text = set()
    untagged = []

    for dimension in dimensions:
        for action in ACTION_CATALOGUE.get(dimension, []):
            if action.text in seen_text:
                continue

            seen_text.add(action.text)

            if action.theme is None:
                untagged.append(action)
                continue

            current = best_by_theme.get(action.theme)

            if (
                current is None
                or URGENCY_ORDER[action.urgency]
                < URGENCY_ORDER[current.urgency]
            ):
                best_by_theme[action.theme] = action

    actions = list(best_by_theme.values()) + untagged
    actions.sort(key=lambda action: URGENCY_ORDER[action.urgency])

    return {
        "dimensions": dimensions,
        "required_actions": actions,
    }


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

def explain_personalised_v4(
    analysis_context: Dict,
    exposure_summary: Dict,
    required_actions: List[RecoveryAction],
    model_id=MODEL_ID,
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
        client.interactions.create(
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
                "max_output_tokens": 1000,
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

    if not required_actions:
        return {
            "source": "none",
            "message": "",
            "guard": {
                "passed": True,
                "misses": [],
            },
        }

    try:
        generated_message = explain_personalised_v4(
            analysis_context=analysis_context,
            exposure_summary=exposure_summary,
            required_actions=required_actions,
        )

        guard_result = guard_message(
            message=generated_message,
            required_actions=required_actions,
        )

        if guard_result["passed"]:
            return {
                "source": "explainer_v4",
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
        )

        return {
            "source": "fallback_after_guard_fail",
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
        )

        return {
            "source": (
                f"fallback_after_error:{type(error).__name__}"
            ),
            "message": fallback_message,
            "guard": {
                "passed": None,
                "misses": ["explainer_call_failed"],
            },
            "fallback_guard": fallback_guard,
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
        resolve_exposure_answers(
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
        actions_for_dimensions(
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
            build_guarded_personalised_response_v4(
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
                explain_personalised_v4(
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
                personalised_fallback_message_v4(
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
        return domain

    # PRIZE_LINK_IMPERSONATION may fire through either an
    # impersonation signal or a clear domain mismatch.
    # Include the domain only when the mismatch was actually present.
    if (
        "PRIZE_LINK_IMPERSONATION"
        in triggered_rules
        and relationship == "mismatch"
        and readability == "clear"
    ):
        return domain

    # This rule directly requires a visible but unreadable domain.
    if (
        "UNVERIFIABLE_DOMAIN_PLUS_RISK"
        in triggered_rules
        and readability == "unreadable"
    ):
        return domain

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

    classifier_label = classifier[
        "label"
    ]

    scam_probability = classifier[
        "scam_probability"
    ]

    response_lines.append(
        "The official image classifier rated this screenshot as "
        f"{classifier_label}. The predicted scam probability was "
        f"{scam_probability:.1%}."
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
                "The page appears to claim it is from "
                f"{claimed_entity}, while the visible domain is "
                f"{visible_domain}."
            )

        if relationship == "mismatch":
            response_lines.append(
                "The visible domain does not match the claimed organisation."
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

# ============================================================================
# PUBLIC ENTRY POINTS (the two functions app.py calls)
# ============================================================================

def analyse(classification: Dict, img_path: str) -> Dict:
    """STAGE 1. Classification is computed in app.py (TFLite) and injected here.
    Runs auditor -> policy -> exposure questions. Degrades gracefully if the
    auditor is unavailable, keeping the classifier result."""
    try:
        audit = audit_screenshot(img_path)
        audit_status = "available"
    except Exception as error:
        audit = AuditorResult(
            content_type="other",
            observations=[],
            domain_analysis=DomainAnalysis(domain_visible=False),
            unclear_elements=["The independent visual safety review was temporarily unavailable."],
        )
        audit_status = f"degraded:{type(error).__name__}"

    caution = evaluate_caution(audit)
    risky = is_risky_verdict(classifier_label=classification["label"], caution_decision=caution)
    effective = effective_caution(classifier_label=classification["label"], caution_decision=caution)
    probes = derive_exposure_probes(audit=audit, is_risky=risky)
    audit_dict = audit.model_dump()

    return {
        "classifier": classification,
        "audit": audit_dict,
        "audit_status": audit_status,
        "audit_signals": [o["signal_type"] for o in audit_dict["observations"]],
        "caution": caution,
        "effective_caution_level": effective["caution_level"],
        "risky": risky,
        "exposure_questions": exposure_question_payload(probes),
    }


def respond(analysis_context: Dict, answers: Dict[str, str]) -> Dict:
    """STAGE 2. Resolve the user's exposure answers, select the mandatory actions,
    and produce the guarded explanation (or deterministic fallback). Delegates to the
    notebook's tested complete_analysis_with_answers."""
    return complete_analysis_with_answers(analysis_context, answers)
