"""Temporary offline coverage for Render analysis-token diagnostics."""

import base64
import hashlib
import hmac
import io
import json
import os
import re
import unittest
from unittest.mock import patch

from app import app as flask_app
from services.screenshot import screenshot_service


SIGNING_KEY = "temporary-token-diagnostic-test-key-123456789"
CONTEXT_MARKER = "private-signed-context-marker"


def _analysis_context():
    return {
        "classifier": {
            "label": "legitimate",
            "scam_probability": 0.1,
            "confidence_pct": 90.0,
        },
        "audit": {
            "content_type": "website",
            "observations": [],
            "domain_analysis": {
                "domain_visible": False,
                "visible_domain": None,
                "claimed_entity": None,
                "domain_readability": "unreadable",
                "domain_relationship": "cannot_determine",
                "evidence": None,
            },
            "unclear_elements": [CONTEXT_MARKER],
        },
        "audit_status": "available",
        "audit_signals": [],
        "display_observations": [],
        "caution": {
            "caution_level": "none",
            "caution_raised": False,
            "triggered_rules": [],
        },
        "effective_caution_level": "none",
        "risky": False,
        "exposure_questions": [],
    }


def _encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _signed_token(payload_bytes, key=SIGNING_KEY, version="v1"):
    signature = hmac.new(
        key.encode("utf-8"),
        payload_bytes,
        hashlib.sha256,
    ).digest()
    return f"{version}.{_encode(payload_bytes)}.{_encode(signature)}"


def _payload_bytes(*, issued_at=1_000, context=None):
    return json.dumps(
        {
            "version": 1,
            "issued_at": issued_at,
            "context": _analysis_context() if context is None else context,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


class AnalysisTokenDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": SIGNING_KEY},
            clear=False,
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def _failure_log(self, token, *, now=1_000):
        with self.assertLogs(screenshot_service.logger.name, level="WARNING") as logs:
            with self.assertRaises(screenshot_service.AnalysisTokenError):
                screenshot_service.verify_analysis_token(token, now=now)
        result = next(
            message
            for message in logs.output
            if "event=token_verify_result" in message
        )
        return logs.output, result

    def test_realistic_round_trip_uses_the_same_key_identifier(self):
        context = _analysis_context()
        with self.assertLogs(screenshot_service.logger.name, level="WARNING") as logs:
            token = screenshot_service.issue_analysis_token(context, now=1_000)
            verified = screenshot_service.verify_analysis_token(token, now=1_001)

        self.assertEqual(verified, context)
        issue = next(message for message in logs.output if "event=token_issue" in message)
        start = next(
            message
            for message in logs.output
            if "event=token_verify_start" in message
        )
        result = next(
            message
            for message in logs.output
            if "event=token_verify_result" in message
        )
        issue_key_id = re.search(r"\bkey_id=([^ ]+)", issue).group(1)
        verify_key_id = re.search(r"\bkey_id=([^ ]+)", start).group(1)
        self.assertEqual(issue_key_id, verify_key_id)
        self.assertIn("outcome=success", result)
        self.assertIn("failure_category=none", result)

    def test_issuance_bytes_and_signature_are_unchanged(self):
        context = screenshot_service.AnalysisContext.model_validate(
            _analysis_context()
        )
        payload = screenshot_service.SignedAnalysisPayload(
            version=screenshot_service.ANALYSIS_TOKEN_VERSION,
            issued_at=1_000,
            context=context,
        )
        payload_bytes = json.dumps(
            payload.model_dump(mode="json"),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        expected = _signed_token(payload_bytes)

        actual = screenshot_service.issue_analysis_token(
            _analysis_context(),
            now=1_000,
        )

        self.assertEqual(actual, expected)

    def test_modified_signature_reports_signature_mismatch(self):
        token = screenshot_service.issue_analysis_token(
            _analysis_context(),
            now=1_000,
        )
        version, payload, signature = token.split(".")
        replacement = "A" if signature[0] != "A" else "B"
        tampered = f"{version}.{payload}.{replacement}{signature[1:]}"

        _, result = self._failure_log(tampered)

        self.assertIn("failure_category=signature_mismatch", result)
        self.assertIn("signature_valid=false", result)

    def test_malformed_structure_reports_invalid_format(self):
        for token in ("not-a-token", "invalid.payload.signature"):
            with self.subTest(token=token):
                _, result = self._failure_log(token)
                self.assertIn("failure_category=invalid_format", result)

    def test_unsupported_version_reports_unsupported_version(self):
        token = _signed_token(_payload_bytes(), version="v2")

        logs, result = self._failure_log(token)

        start = next(message for message in logs if "event=token_verify_start" in message)
        self.assertIn("parsed_version_if_available=2", start)
        self.assertIn("failure_category=unsupported_version", result)

    def test_invalid_payload_base64_reports_decode_failure(self):
        _, result = self._failure_log("v1.!.also-invalid")

        self.assertIn("failure_category=payload_base64_decode_failed", result)

    def test_invalid_signature_base64_reports_signature_mismatch(self):
        token = f"v1.{_encode(_payload_bytes())}.!"

        _, result = self._failure_log(token)

        self.assertIn("failure_category=signature_mismatch", result)

    def test_signed_invalid_json_reports_json_decode_failure(self):
        token = _signed_token(b'{"version":')

        _, result = self._failure_log(token)

        self.assertIn("signature_valid=true", result)
        self.assertIn("failure_category=payload_json_decode_failed", result)

    def test_signed_schema_invalid_payload_reports_only_schema_metadata(self):
        token = _signed_token(
            _payload_bytes(context={"secret_field": CONTEXT_MARKER})
        )

        logs, result = self._failure_log(token)

        self.assertIn("signature_valid=true", result)
        self.assertIn("failure_category=payload_schema_failed", result)
        self.assertIn("schema_error_locations_and_types_only=[", result)
        self.assertNotIn(CONTEXT_MARKER, "\n".join(logs))

    def test_signed_invalid_issued_at_has_its_stable_category(self):
        token = _signed_token(_payload_bytes(issued_at="not-an-integer"))

        _, result = self._failure_log(token)

        self.assertIn("failure_category=issued_at_invalid", result)

    def test_expired_token_reports_expired(self):
        token = screenshot_service.issue_analysis_token(
            _analysis_context(),
            now=1_000,
        )

        _, result = self._failure_log(token, now=1_931)

        self.assertIn("failure_category=expired", result)
        self.assertIn("token_age_seconds=931", result)

    def test_future_token_reports_issued_in_future(self):
        token = screenshot_service.issue_analysis_token(
            _analysis_context(),
            now=1_031,
        )

        _, result = self._failure_log(token, now=1_000)

        self.assertIn("failure_category=issued_in_future", result)
        self.assertIn("token_age_seconds=-31", result)

    def test_configuration_and_unexpected_categories_preserve_exceptions(self):
        token = _signed_token(_payload_bytes())
        with patch.dict(os.environ, {}, clear=True):
            with self.assertLogs(
                screenshot_service.logger.name,
                level="WARNING",
            ) as configuration_logs:
                with self.assertRaises(RuntimeError):
                    screenshot_service.verify_analysis_token(token, now=1_000)
        self.assertTrue(
            any(
                "failure_category=configuration_error" in message
                for message in configuration_logs.output
            )
        )

        with patch.object(
            screenshot_service.hmac,
            "new",
            side_effect=LookupError("diagnostic test failure"),
        ), self.assertLogs(
            screenshot_service.logger.name,
            level="WARNING",
        ) as unexpected_logs:
            with self.assertRaises(LookupError):
                screenshot_service.verify_analysis_token(token, now=1_000)
        self.assertTrue(
            any(
                "failure_category=unexpected_verification_error" in message
                for message in unexpected_logs.output
            )
        )

    def test_diagnostics_never_log_key_token_segments_or_context(self):
        context = _analysis_context()
        with self.assertLogs(screenshot_service.logger.name, level="WARNING") as logs:
            token = screenshot_service.issue_analysis_token(context, now=1_000)
            screenshot_service.verify_analysis_token(token, now=1_001)

        messages = "\n".join(logs.output)
        version, encoded_payload, signature = token.split(".")
        self.assertNotIn(SIGNING_KEY, messages)
        self.assertNotIn(token, messages)
        self.assertNotIn(encoded_payload, messages)
        self.assertNotIn(signature, messages)
        self.assertNotIn(CONTEXT_MARKER, messages)
        self.assertNotIn(f"{version}.", messages)

    def test_http_error_and_valid_route_round_trip_are_unchanged(self):
        client = flask_app.test_client()
        invalid = client.post(
            "/api/respond",
            json={"analysis_token": "broken", "answers": {}},
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(
            invalid.get_json(),
            {"error": "Invalid or expired analysis token"},
        )

        context = _analysis_context()
        with patch.object(
            screenshot_service,
            "prepare_image",
            return_value=object(),
        ), patch.object(
            screenshot_service,
            "classify",
            return_value=context["classifier"],
        ), patch.object(
            screenshot_service,
            "run_stage1_audit",
            return_value=context,
        ), patch.object(
            screenshot_service.screenshot_genai,
            "respond",
            return_value={"response_message": "unchanged"},
        ), patch.object(
            screenshot_service,
            "_retrieve_related_official_advisories",
            return_value=[],
        ):
            analysed = client.post(
                "/api/analyse",
                data={"file": (io.BytesIO(b"offline"), "scan.png")},
                content_type="multipart/form-data",
            )
            self.assertEqual(analysed.status_code, 200)
            token = analysed.get_json()["analysis_token"]
            responded = client.post(
                "/api/respond",
                json={"analysis_token": token, "answers": {}},
            )

        self.assertEqual(responded.status_code, 200)
        self.assertEqual(responded.get_json()["response_message"], "unchanged")


if __name__ == "__main__":
    unittest.main()
