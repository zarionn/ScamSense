"""Backend integration tests for signed-context advisory retrieval."""

import base64
import hashlib
import hmac
import json
import os
import time
import unittest
from copy import deepcopy
from unittest.mock import patch

from app import app as flask_app
from services.screenshot import auditor, explainer, recovery, screenshot_service
from services.screenshot.advisory_corpus import ADVISORY_CORPUS


SIGNING_KEY = "stage2-integration-test-signing-key-1234567890"


def _analysis_context(
    signals=(),
    *,
    audit_status="available",
    content_type="website",
    claimed_entity=None,
    domain_visible=False,
    visible_domain=None,
    domain_readability="unreadable",
    domain_relationship="cannot_determine",
):
    observations = [
        {
            "signal_type": signal,
            "evidence": f"Visible evidence for {signal}.",
            "evidence_quality": "clear",
        }
        for signal in signals
    ]
    return {
        "classifier": {
            "label": "legitimate",
            "scam_probability": 0.1,
            "confidence_pct": 90.0,
        },
        "audit": {
            "content_type": content_type,
            "observations": observations,
            "domain_analysis": {
                "domain_visible": domain_visible,
                "visible_domain": visible_domain,
                "claimed_entity": claimed_entity,
                "domain_readability": domain_readability,
                "domain_relationship": domain_relationship,
                "evidence": None,
            },
            "unclear_elements": [],
        },
        "audit_status": audit_status,
        "audit_signals": list(signals),
        "display_observations": observations,
        "caution": {
            "caution_level": "none",
            "caution_raised": False,
            "triggered_rules": [],
        },
        "effective_caution_level": "none",
        "risky": False,
        "exposure_questions": [],
    }


def _core_response(source="explainer_v4_no_actions"):
    return {
        "response_source": source,
        "response_message": "Core Stage 2 response.",
        "required_actions": [],
        "response_guard": {"passed": True, "misses": []},
        "fallback_guard": None,
    }


def _signed_malformed_context_token():
    payload = {
        "version": 1,
        "issued_at": int(time.time()),
        "context": {"unexpected": "field"},
    }
    payload_bytes = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    signature = hmac.new(
        SIGNING_KEY.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).digest()

    def encode(value):
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

    return f"v1.{encode(payload_bytes)}.{encode(signature)}"


class AdvisoryStage2IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": SIGNING_KEY},
            clear=False,
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def _token(self, context, *, now=None):
        return screenshot_service.issue_analysis_token(context, now=now)

    def _respond_with_core(self, context, core=None):
        with patch.object(
            screenshot_service.screenshot_genai,
            "respond",
            return_value=deepcopy(core or _core_response()),
        ):
            return screenshot_service.respond(self._token(context), {})

    def test_valid_signed_context_without_match_returns_empty_advisories(self):
        response = self._respond_with_core(
            _analysis_context(("credential_request",))
        )

        self.assertEqual(response["response_message"], "Core Stage 2 response.")
        self.assertEqual(response["related_official_advisories"], [])

    def test_valid_signed_context_returns_one_bounded_corpus_entry(self):
        response = self._respond_with_core(
            _analysis_context(
                ("remote_access_request", "attachment_or_download_request")
            )
        )
        expected = next(
            entry
            for entry in ADVISORY_CORPUS
            if entry.id == "technical-support-remote-access-2025"
        )

        self.assertEqual(len(response["related_official_advisories"]), 1)
        advisory = response["related_official_advisories"][0]
        self.assertEqual(
            set(advisory),
            {
                "advisory_id",
                "title",
                "authority",
                "publication_date",
                "summary",
                "source_url",
            },
        )
        self.assertEqual(
            advisory,
            {
                "advisory_id": expected.id,
                "title": expected.title,
                "authority": expected.authorities[0],
                "publication_date": expected.publication_date.isoformat(),
                "summary": expected.summary,
                "source_url": expected.url,
            },
        )
        self.assertNotIn("score", advisory)
        self.assertNotIn("signal_tags", advisory)

    def test_unsigned_client_signal_injection_is_ignored(self):
        token = self._token(_analysis_context(("credential_request",)))
        with patch.object(
            screenshot_service.screenshot_genai,
            "respond",
            return_value=_core_response(),
        ):
            response = flask_app.test_client().post(
                "/api/respond",
                json={
                    "analysis_token": token,
                    "answers": {},
                    "audit_signals": [
                        "remote_access_request",
                        "attachment_or_download_request",
                    ],
                    "content_type": "website",
                    "claimed_entity": "Microsoft",
                    "domain_readability": "clear",
                    "domain_relationship": "mismatch",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get_json()["related_official_advisories"],
            [],
        )

    def test_tampered_token_rejects_before_retrieval(self):
        token = self._token(_analysis_context())
        version, payload, signature = token.split(".")
        replacement = "A" if signature[0] != "A" else "B"
        tampered = f"{version}.{payload}.{replacement}{signature[1:]}"

        with patch.object(
            screenshot_service,
            "_retrieve_related_official_advisories",
        ) as retrieval:
            with self.assertRaises(screenshot_service.AnalysisTokenError):
                screenshot_service.respond(tampered, {})

        retrieval.assert_not_called()

    def test_core_stage2_validation_failure_is_not_suppressed(self):
        with patch.object(
            screenshot_service.screenshot_genai,
            "respond",
            side_effect=ValueError("invalid Stage 2 answers"),
        ), patch.object(
            screenshot_service,
            "_retrieve_related_official_advisories",
        ) as retrieval:
            with self.assertRaisesRegex(ValueError, "invalid Stage 2 answers"):
                screenshot_service.respond(
                    self._token(_analysis_context()),
                    {"clicked_link": "not-a-valid-answer"},
                )

        retrieval.assert_not_called()

    def test_expired_token_rejects_before_retrieval(self):
        token = self._token(_analysis_context(), now=0)

        with patch.object(
            screenshot_service,
            "_retrieve_related_official_advisories",
        ) as retrieval:
            with self.assertRaises(screenshot_service.AnalysisTokenError):
                screenshot_service.respond(token, {})

        retrieval.assert_not_called()

    def test_malformed_signed_context_rejects_before_retrieval(self):
        with patch.object(
            screenshot_service,
            "_retrieve_related_official_advisories",
        ) as retrieval:
            with self.assertRaises(screenshot_service.AnalysisTokenError):
                screenshot_service.respond(_signed_malformed_context_token(), {})

        retrieval.assert_not_called()

    def test_malformed_audit_status_returns_empty_advisories(self):
        response = self._respond_with_core(
            _analysis_context(audit_status="malformed")
        )

        self.assertEqual(response["response_message"], "Core Stage 2 response.")
        self.assertEqual(response["related_official_advisories"], [])

    def test_unavailable_audit_status_returns_empty_advisories(self):
        response = self._respond_with_core(
            _analysis_context(audit_status="unavailable")
        )

        self.assertEqual(response["response_message"], "Core Stage 2 response.")
        self.assertEqual(response["related_official_advisories"], [])

    def test_retrieval_failure_preserves_core_response_and_recovery_wording(self):
        core = _core_response("fallback_after_guard_fail")
        core["response_message"] = "Guarded fallback with exact recovery wording."
        core["required_actions"] = [
            {
                "text": action.text,
                "urgency": action.urgency,
                "theme": action.theme,
            }
            for action in recovery.ACTION_CATALOGUE["clicked_link"]
        ]
        expected = deepcopy(core)

        with patch.object(
            screenshot_service.screenshot_genai,
            "respond",
            return_value=core,
        ), patch.object(
            screenshot_service,
            "_retrieve_related_official_advisories",
            side_effect=RuntimeError("retrieval unavailable"),
        ), self.assertLogs(screenshot_service.logger.name, level="WARNING"):
            response = screenshot_service.respond(
                self._token(_analysis_context()),
                {},
            )

        self.assertEqual(
            {key: response[key] for key in expected},
            expected,
        )
        self.assertEqual(response["related_official_advisories"], [])

    def test_branding_only_impersonation_remains_rejected(self):
        response = self._respond_with_core(
            _analysis_context(
                ("credential_request", "impersonation_claim"),
                claimed_entity="Apple",
            )
        )

        self.assertEqual(response["related_official_advisories"], [])

    def test_clear_domain_mismatch_can_reach_gate_and_scorer(self):
        response = self._respond_with_core(
            _analysis_context(
                ("credential_request", "impersonation_claim"),
                content_type="login_page",
                claimed_entity="Singpass",
                domain_visible=True,
                visible_domain="not-singpass.example",
                domain_readability="clear",
                domain_relationship="mismatch",
            )
        )

        self.assertEqual(
            response["related_official_advisories"][0]["advisory_id"],
            "singpass-phishing-login-2022",
        )

    def test_every_core_success_source_contains_advisory_field(self):
        sources = (
            "explainer_v4",
            "fallback_after_guard_fail",
            "explainer_v4_no_actions",
        )
        for source in sources:
            with self.subTest(source=source):
                response = self._respond_with_core(
                    _analysis_context(),
                    _core_response(source),
                )
                self.assertEqual(response["response_source"], source)
                self.assertEqual(response["related_official_advisories"], [])

    def test_prompt_and_recovery_snapshots_are_unchanged(self):
        catalogue = json.dumps(
            {
                key: [action.model_dump(mode="json") for action in value]
                for key, value in recovery.ACTION_CATALOGUE.items()
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        self.assertEqual(
            hashlib.sha256(
                auditor.AUDITOR_SYSTEM_INSTRUCTION_V2.encode("utf-8")
            ).hexdigest(),
            "666e04beab4996b848f2c71b15e27d315f9d4632ee14fd0a5e62a939cdc5ddfc",
        )
        self.assertEqual(
            hashlib.sha256(
                explainer.PERSONALISED_EXPLAINER_V4_SYSTEM.encode("utf-8")
            ).hexdigest(),
            "38faddf56f3d1d11e4fbdfa5e513fb52d259c3b993fb56585cba59582dc0a5e6",
        )
        self.assertEqual(
            hashlib.sha256(catalogue.encode("utf-8")).hexdigest(),
            "87ec64aebb4a889a74ace1045c2215c2d25d01cba5ac6065b4fd27168e7bfd8b",
        )

    def test_unrelated_routes_remain_registered(self):
        rules = {
            rule.rule: frozenset(rule.methods)
            for rule in flask_app.url_map.iter_rules()
        }

        self.assertIn("POST", rules["/api/url/predict"])
        self.assertIn("POST", rules["/api/assistant/message"])


if __name__ == "__main__":
    unittest.main()
