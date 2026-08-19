"""Focused tests for retrieval-only impersonation validation."""

import unittest

from services.screenshot.advisory_retrieval import (
    RetrievalContext,
    retrieve_advisories,
    validate_retrieval_signals,
)
from services.screenshot.contracts import AuditorResult, DomainAnalysis, Observation


def _context(
    signal_tags,
    *,
    claimed_entity="Example Bank",
    domain_readability=None,
    domain_relationship=None,
    content_type="website",
):
    return RetrievalContext(
        signal_tags=tuple(signal_tags),
        content_type=content_type,
        claimed_entity=claimed_entity,
        domain_readability=domain_readability,
        domain_relationship=domain_relationship,
    )


class AdvisoryRetrievalImpersonationValidationTests(unittest.TestCase):
    def test_branding_only_missing_domain_rejects_impersonation(self):
        context = _context(("credential_request", "impersonation_claim"))

        validation = validate_retrieval_signals(context)
        response = retrieve_advisories(context)

        self.assertEqual(validation.signal_tags, ("credential_request",))
        self.assertEqual(
            validation.impersonation_rejection_reason,
            "domain_readability_missing",
        )
        self.assertFalse(response["eligibility_gate"]["eligible"])
        self.assertEqual(response["results"], [])

    def test_unreadable_domain_rejects_impersonation(self):
        validation = validate_retrieval_signals(
            _context(
                ("impersonation_claim",),
                domain_readability="unreadable",
                domain_relationship="cannot_determine",
            )
        )

        self.assertEqual(validation.signal_tags, ())
        self.assertEqual(
            validation.impersonation_rejection_reason,
            "domain_readability_not_clear",
        )

    def test_partial_or_missing_domain_relationship_rejects_impersonation(self):
        cases = (
            ("partial", "mismatch", "domain_readability_not_clear"),
            ("clear", None, "domain_relationship_missing"),
        )
        for readability, relationship, reason in cases:
            with self.subTest(
                readability=readability,
                relationship=relationship,
            ):
                validation = validate_retrieval_signals(
                    _context(
                        ("impersonation_claim",),
                        domain_readability=readability,
                        domain_relationship=relationship,
                    )
                )
                self.assertEqual(validation.signal_tags, ())
                self.assertEqual(
                    validation.impersonation_rejection_reason,
                    reason,
                )

    def test_cannot_determine_relationship_rejects_impersonation(self):
        validation = validate_retrieval_signals(
            _context(
                ("impersonation_claim",),
                domain_readability="clear",
                domain_relationship="cannot_determine",
            )
        )

        self.assertEqual(validation.signal_tags, ())
        self.assertEqual(
            validation.impersonation_rejection_reason,
            "domain_relationship_not_mismatch",
        )

    def test_matching_domain_rejects_impersonation(self):
        validation = validate_retrieval_signals(
            _context(
                ("impersonation_claim",),
                domain_readability="clear",
                domain_relationship="match",
            )
        )

        self.assertEqual(validation.signal_tags, ())
        self.assertEqual(
            validation.impersonation_rejection_reason,
            "domain_relationship_not_mismatch",
        )

    def test_missing_or_blank_claimed_entity_rejects_impersonation(self):
        for claimed_entity in (None, "", "   \t"):
            with self.subTest(claimed_entity=claimed_entity):
                validation = validate_retrieval_signals(
                    _context(
                        ("impersonation_claim",),
                        claimed_entity=claimed_entity,
                        domain_readability="clear",
                        domain_relationship="mismatch",
                    )
                )
                self.assertEqual(validation.signal_tags, ())
                self.assertEqual(
                    validation.impersonation_rejection_reason,
                    "claimed_entity_missing_or_blank",
                )

    def test_clear_mismatching_domain_retains_impersonation(self):
        context = _context(
            ("credential_request", "impersonation_claim"),
            claimed_entity="Singpass",
            domain_readability="clear",
            domain_relationship="mismatch",
            content_type="login_page",
        )

        validation = validate_retrieval_signals(context)
        response = retrieve_advisories(context)

        self.assertEqual(validation.signal_tags, context.signal_tags)
        self.assertTrue(validation.impersonation_retained)
        self.assertIsNone(validation.impersonation_rejection_reason)
        self.assertTrue(response["eligibility_gate"]["eligible"])
        self.assertIn(
            "impersonation_claim",
            response["results"][0]["matched_signal_tags"],
        )

    def test_other_pair_opens_without_rejected_impersonation_score(self):
        unsupported = _context(
            (
                "credential_request",
                "external_verification_link",
                "impersonation_claim",
            ),
            claimed_entity="Apple",
        )
        without_impersonation = _context(
            ("credential_request", "external_verification_link"),
            claimed_entity="Apple",
        )

        actual = retrieve_advisories(unsupported, enable_entity_matching=False)
        expected = retrieve_advisories(
            without_impersonation,
            enable_entity_matching=False,
        )

        self.assertTrue(actual["eligibility_gate"]["eligible"])
        self.assertEqual(actual, expected)
        for result in actual["results"]:
            self.assertNotIn("impersonation_claim", result["matched_signal_tags"])

    def test_retrieval_does_not_mutate_audit_context_or_signal_collection(self):
        audit = AuditorResult(
            content_type="website",
            observations=[
                Observation(
                    signal_type="credential_request",
                    evidence="A password field is visible.",
                    evidence_quality="clear",
                ),
                Observation(
                    signal_type="impersonation_claim",
                    evidence="Branding is visible.",
                    evidence_quality="clear",
                ),
            ],
            domain_analysis=DomainAnalysis(
                domain_visible=False,
                claimed_entity="Example Bank",
            ),
        )
        original_audit = audit.model_dump(mode="json")
        original_signals = tuple(
            observation.signal_type for observation in audit.observations
        )
        context = _context(
            original_signals,
            claimed_entity=audit.domain_analysis.claimed_entity,
            domain_readability=audit.domain_analysis.domain_readability,
            domain_relationship=audit.domain_analysis.domain_relationship,
        )
        original_context = context.model_dump(mode="json")

        retrieve_advisories(context)

        self.assertEqual(audit.model_dump(mode="json"), original_audit)
        self.assertEqual(original_signals, context.signal_tags)
        self.assertEqual(context.model_dump(mode="json"), original_context)

    def test_non_impersonation_gate_and_scoring_are_unchanged(self):
        signals = ("remote_access_request", "attachment_or_download_request")
        without_domain_metadata = _context(
            signals,
            claimed_entity=None,
        )
        with_domain_metadata = _context(
            signals,
            claimed_entity=None,
            domain_readability="clear",
            domain_relationship="mismatch",
        )

        self.assertEqual(
            retrieve_advisories(without_domain_metadata),
            retrieve_advisories(with_domain_metadata),
        )

    def test_entity_tiebreaker_remains_separate_from_signal_validation(self):
        supported = _context(
            ("credential_request", "impersonation_claim"),
            claimed_entity="Singpass",
            domain_readability="clear",
            domain_relationship="mismatch",
            content_type="login_page",
        )
        entity_off = retrieve_advisories(supported, enable_entity_matching=False)
        entity_on = retrieve_advisories(supported, enable_entity_matching=True)

        self.assertEqual(
            entity_off["results"][0]["corpus_id"],
            entity_on["results"][0]["corpus_id"],
        )
        self.assertEqual(
            entity_off["results"][0]["score_breakdown"]["claimed_entity_score"],
            0.0,
        )
        self.assertEqual(
            entity_on["results"][0]["score_breakdown"]["claimed_entity_score"],
            0.1,
        )

        unsupported = _context(
            (
                "credential_request",
                "external_verification_link",
                "impersonation_claim",
            ),
            claimed_entity="Singpass",
            domain_readability="unreadable",
            domain_relationship="cannot_determine",
            content_type="login_page",
        )
        unsupported_off = retrieve_advisories(
            unsupported,
            enable_entity_matching=False,
        )
        unsupported_on = retrieve_advisories(
            unsupported,
            enable_entity_matching=True,
        )
        self.assertEqual(
            unsupported_off["results"][0]["score_breakdown"][
                "claimed_entity_score"
            ],
            0.0,
        )
        self.assertEqual(
            unsupported_on["results"][0]["score_breakdown"][
                "claimed_entity_score"
            ],
            0.1,
        )
        self.assertNotIn(
            "impersonation_claim",
            unsupported_on["results"][0]["matched_signal_tags"],
        )


if __name__ == "__main__":
    unittest.main()
