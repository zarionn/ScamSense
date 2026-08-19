"""Realistic offline evaluation for Assistant advisory retrieval.

This replaces the metadata-alignment approach used by
`evaluation/screenshot/advisory_retrieval_evaluation.py`, whose cases are built
by copying each advisory's own `signal_tags`, `content_types` and `entity_tags`
and then asserting that retrieval returns that same advisory. That is circular:
it measures whether the index matches itself, and it gets easier, not harder,
as the corpus grows.

The cases below are written as a worried person would actually type them, then
labelled by reading the advisory and asking "is this the document a human would
hand this person?". No case was produced by rewriting a corpus tag into a
sentence.

Where two advisories genuinely cover the same ground, the case lists every
acceptable answer rather than pretending one arbitrary winner is correct.
Nothing here tunes the retriever — it only measures it.
"""

from pathlib import Path
import sys
from typing import NamedTuple


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from services.chatbot.advisory_assistant import search_advisories  # noqa: E402


class NaturalQueryCase(NamedTuple):
    case_id: str
    query: str
    # Empty means the correct behaviour is abstention.
    acceptable_advisory_ids: frozenset[str]
    rationale: str


NATURAL_QUERY_CASES = (
    NaturalQueryCase(
        "nq-01-bank-officer-call",
        "Someone called me claiming to be from OCBC asking me to verify a transfer I never made.",
        frozenset({"bank-officer-impersonation-uptick-2024"}),
        "The bank-impersonation advisory names this exact opening move.",
    ),
    NaturalQueryCase(
        "nq-02-fake-investigation-notice",
        "I received a notice saying I'm under criminal investigation for cyber crimes and must reply within 48 hours.",
        frozenset({"government-officer-impersonation-fake-notice-2025"}),
        "The fake criminal investigation notice and 48-hour deadline are the alert's core description.",
    ),
    NaturalQueryCase(
        "nq-03-singpass-deactivation-sms",
        "I got an SMS saying my Singpass will be deactivated unless I log in through the link.",
        frozenset({"singpass-phishing-login-2022"}),
        "Singpass deactivation threat plus a spoofed login link.",
    ),
    NaturalQueryCase(
        "nq-04-task-commission-job",
        "Someone offered me an online job liking posts for commission but I have to pay upfront first.",
        frozenset({"job-task-payment-scams-2024", "scamshield-job-scams-guide"}),
        "Two advisories genuinely cover task-and-commission job scams; either is a correct answer.",
    ),
    NaturalQueryCase(
        "nq-05-offline-payment-request",
        "A seller on an online marketplace wants me to pay him directly instead of through the app.",
        frozenset({"scamshield-e-commerce-scams-guide", "marketplace-fake-buyer-phishing-2025"}),
        "Off-platform payment is the e-commerce warning sign; the marketplace advisory also fits.",
    ),
    NaturalQueryCase(
        "nq-06-buyer-link-otp",
        "A buyer sent me a delivery confirmation link that asked for my bank login and the OTP.",
        frozenset({"marketplace-fake-buyer-phishing-2025"}),
        "Fake-buyer phishing with credential and OTP capture.",
    ),
    NaturalQueryCase(
        "nq-07-telegram-guaranteed-returns",
        "Someone promised me guaranteed returns in a Telegram investment group.",
        frozenset({"investment-scams-2025"}),
        "Messaging-platform approach promising returns is the investment advisory.",
    ),
    NaturalQueryCase(
        "nq-08-support-remote-access",
        "A pop-up said my computer is infected and told me to install AnyDesk so support can fix it.",
        frozenset({"technical-support-remote-access-2025"}),
        "Technical-support impersonation with a remote-access tool.",
    ),
    NaturalQueryCase(
        "nq-09-wechat-subscription-call",
        "I got a call from someone saying they are from WeChat about a subscription that is renewing.",
        frozenset({"chinese-platform-impersonation-2025"}),
        "WeChat subscription-renewal pretext is the advisory's exact scenario.",
    ),
    NaturalQueryCase(
        "nq-10-ai-generated-endorsement",
        "I saw a video of a famous person promoting an investment but it looked AI generated.",
        frozenset({"digital-manipulation-deepfake-scams-2025"}),
        "Synthetic media used to lend credibility to an offer.",
    ),
    NaturalQueryCase(
        "nq-11-whatsapp-code-request",
        "My friend messaged me on WhatsApp asking me to send him the verification code I just received.",
        frozenset({"whatsapp-account-impersonation-2026"}),
        "Compromised-contact OTP request.",
    ),
    NaturalQueryCase(
        "nq-12-crypto-wallet-drained",
        "I clicked a link and my crypto wallet was emptied after I pasted a command they gave me.",
        frozenset(
            {"cryptocurrency-asset-compromise-2025", "cryptocurrency-malicious-links-2026"}
        ),
        "Two crypto advisories overlap here; keying an unknown command favours the 2025 one.",
    ),
    NaturalQueryCase(
        "nq-13-livestream-prize-fee",
        "I won a lucky draw on a Facebook livestream and they want a fee before releasing the prize.",
        frozenset({"facebook-live-lucky-draw-2026"}),
        "Prize claim plus an upfront release fee.",
    ),
    # ---- Section C: abstention. Nothing here should return an advisory. ----
    NaturalQueryCase(
        "ab-01-etf-research",
        "I'm comparing ETFs for long-term investing.",
        frozenset(),
        "Ordinary personal finance. Sharing the investment-scam advisory would be alarmist.",
    ),
    NaturalQueryCase(
        "ab-02-legitimate-login",
        "This is the official bank login page.",
        frozenset(),
        "A statement about a legitimate page, with no scam indicator.",
    ),
    NaturalQueryCase(
        "ab-03-normal-paynow",
        "My friend sent me a normal PayNow request.",
        frozenset(),
        "An expected transfer between people who know each other.",
    ),
    NaturalQueryCase(
        "ab-04-schoolwork",
        "I'm reading about cybersecurity for school.",
        frozenset(),
        "Background reading, not an incident.",
    ),
)


def evaluate() -> int:
    positives = [case for case in NATURAL_QUERY_CASES if case.acceptable_advisory_ids]
    abstentions = [case for case in NATURAL_QUERY_CASES if not case.acceptable_advisory_ids]

    top1 = hit_at_3 = 0
    misses: list[str] = []

    print("=" * 78)
    print("Realistic natural-query evaluation — Assistant advisory retrieval")
    print("=" * 78)
    print(f"\n-- Section A: natural user queries ({len(positives)} cases) --\n")

    for case in positives:
        response = search_advisories(case.query)
        returned = [advisory.advisory_id for advisory in response.advisories]
        top_1 = returned[0] if returned else None

        is_top1 = top_1 in case.acceptable_advisory_ids
        is_hit3 = bool(case.acceptable_advisory_ids & set(returned))
        top1 += is_top1
        hit_at_3 += is_hit3

        mark = "PASS" if is_top1 else ("hit@3" if is_hit3 else "MISS")
        print(f"[{mark:5}] {case.case_id}")
        print(f"         query    : {case.query}")
        print(f"         expected : {' | '.join(sorted(case.acceptable_advisory_ids))}")
        print(f"         returned : {returned or '(abstained)'}")
        if not is_top1:
            misses.append(f"{case.case_id}: expected "
                          f"{sorted(case.acceptable_advisory_ids)}, got {returned or 'abstention'}")
        print()

    print(f"-- Section C: abstention cases ({len(abstentions)} cases) --\n")
    correct_abstentions = 0
    for case in abstentions:
        response = search_advisories(case.query)
        returned = [advisory.advisory_id for advisory in response.advisories]
        abstained = response.status == "no_match"
        correct_abstentions += abstained

        print(f"[{'PASS' if abstained else 'MISS':5}] {case.case_id}")
        print(f"         query    : {case.query}")
        print(f"         result   : {response.status} {returned if returned else ''}")
        if not abstained:
            misses.append(f"{case.case_id}: expected abstention, got {returned}")
        print()

    print("=" * 78)
    print(f"Section A  top-1 : {top1}/{len(positives)}")
    print(f"Section A  hit@3 : {hit_at_3}/{len(positives)}")
    print(f"Section C  abstain: {correct_abstentions}/{len(abstentions)}")
    print(f"Overall (top-1 + abstention): {top1 + correct_abstentions}/{len(NATURAL_QUERY_CASES)}")
    print("=" * 78)
    print("\nSection B (auditor-derived inputs): NOT RUN — see the report. No")
    print("representative screenshot test set exists in this repository, and")
    print("hand-written auditor output would reintroduce the circularity this")
    print("evaluation exists to remove.")

    if misses:
        print("\nMisses:")
        for miss in misses:
            print(f"  - {miss}")
    return 0


if __name__ == "__main__":
    raise SystemExit(evaluate())
