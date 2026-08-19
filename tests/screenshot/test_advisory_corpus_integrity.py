"""Corpus integrity checks that both ends of the persistence codec depend on.

An advisory that the backend accepts but the frontend codec later rejects would
render live and then vanish on reload, so the frontend's rules are re-applied
here against the real corpus.
"""

from pathlib import Path
import re
import unittest
from urllib.parse import urlsplit

from services.screenshot.advisory_corpus import ADVISORY_CORPUS


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CODEC_PATH = REPOSITORY_ROOT / "frontend/src/services/conversation-message-codec.js"

# The frontend codec's own rules, mirrored so drift fails here rather than
# silently downgrading a restored advisory to plain text.
_STABLE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# Exactly the URLs supplied for this expansion. Stored verbatim: no redirect
# following, no host rewriting, no trailing-slash or query tidying.
SUPPLIED_URLS = frozenset(
    {
        "https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2025-004/",
        "https://www.csa.gov.sg/alerts-and-advisories/advisories/ad-2025-005/",
        "https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2025-123/",
        "https://www.scamshield.gov.sg/i-want-protection-from-scams/learn-to-recognise-scams/job-scams/",
        "https://www.scamshield.gov.sg/i-want-protection-from-scams/learn-to-recognise-scams/e-commerce-scams/",
        "https://www.mas.gov.sg/news/media-releases/2024/uptick-in-government-official-impersonation-scam-variant-featuring-impersonation-of-banks",
        "https://www.mas.gov.sg/news/media-releases/2025/copy-of-joint-pnr-on-scams-involving-chinese-messaging-and-payment-platforms",
    }
)


def _codec_allowlist() -> frozenset[str]:
    source = CODEC_PATH.read_text(encoding="utf-8")
    block = source[
        source.index("APPROVED_OFFICIAL_HOSTNAMES") : source.index("const STABLE_ID_PATTERN")
    ]
    domains = set(re.findall(r"'([^']+)'", block))
    return frozenset(domains | {f"www.{domain}" for domain in domains})


class AdvisoryCorpusIntegrityTests(unittest.TestCase):
    def test_every_entry_passes_the_frontend_codec_rules(self):
        allowlist = _codec_allowlist()

        for entry in ADVISORY_CORPUS:
            with self.subTest(advisory_id=entry.id):
                parsed = urlsplit(entry.url)
                self.assertRegex(entry.id, _STABLE_ID_PATTERN)
                self.assertEqual(parsed.scheme, "https")
                self.assertIn(parsed.hostname.lower(), allowlist)
                self.assertFalse(parsed.username)
                self.assertFalse(parsed.password)
                self.assertIsNone(parsed.port)
                self.assertNotIn(parsed.path, ("", "/"))

    def test_added_urls_are_stored_verbatim(self):
        stored = {entry.url for entry in ADVISORY_CORPUS}

        self.assertTrue(
            SUPPLIED_URLS <= stored,
            f"missing or rewritten: {sorted(SUPPLIED_URLS - stored)}",
        )

    def test_corpus_has_no_duplicate_ids_or_urls(self):
        ids = [entry.id for entry in ADVISORY_CORPUS]
        urls = [entry.url for entry in ADVISORY_CORPUS]

        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(urls), len(set(urls)))

    def test_backend_and_frontend_allowlists_agree(self):
        from services.screenshot.advisory_corpus import APPROVED_SOURCE_HOSTNAMES

        self.assertEqual(set(APPROVED_SOURCE_HOSTNAMES), set(_codec_allowlist()))


if __name__ == "__main__":
    unittest.main()
