"""Deterministic caution policy for Screenshot GenAI audit results."""

from typing import Dict, List


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
