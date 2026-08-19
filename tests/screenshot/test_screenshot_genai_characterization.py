"""Behavioral characterization tests for the active Screenshot GenAI pipeline.

All Gemini interactions are replaced with deterministic fakes.  The public
``build_canonical_outputs`` helper is also used to compare the exact Phase 1
baseline behavior and the active modular working tree.
"""

from __future__ import annotations

import difflib
import hashlib
import hmac
import importlib
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import BaseModel
from PIL import Image, ImageDraw
from PIL.PngImagePlugin import PngInfo


# screenshot_genai constructs its client at import time.  A fixed dummy value
# keeps the tests independent of a developer's .env without making a request.
os.environ["GEMINI_API_KEY"] = "characterization-test-key"

from services.screenshot import auditor  # noqa: E402
from services.screenshot import contracts  # noqa: E402
from services.screenshot import explainer  # noqa: E402
from services.screenshot import exposure  # noqa: E402
from services.screenshot import gemini_client  # noqa: E402
from services.screenshot import pipeline  # noqa: E402
from services.screenshot import policy  # noqa: E402
from services.screenshot import recovery  # noqa: E402
from services.screenshot import screenshot_genai as genai  # noqa: E402


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PRODUCTION_PACKAGE_PATH = "services/screenshot"
PHASE1_BASELINE_REVISION = "28f38a8c8b945179a5f6e5e2ad7f9ec3b9f3e7bd"
GOLDEN_BASELINE_PATH = Path(__file__).with_name(
    "screenshot_genai_phase1_baseline.json"
)


def _load_phase1_screenshot_genai():
    """Load the pinned Phase 1 screenshot package from an isolated copy."""

    completed = subprocess.run(
        [
            "git",
            "ls-tree",
            "-r",
            "--name-only",
            PHASE1_BASELINE_REVISION,
            PRODUCTION_PACKAGE_PATH,
        ],
        cwd=REPOSITORY_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    module_paths = [
        path
        for path in completed.stdout.splitlines()
        if path.endswith(".py")
    ]

    with tempfile.TemporaryDirectory() as directory:
        package_name = f"head_screenshot_{uuid.uuid4().hex}"
        package_path = Path(directory) / package_name
        package_path.mkdir()
        (package_path / "__init__.py").write_text("", encoding="utf-8")

        for module_path in module_paths:
            source = subprocess.run(
                ["git", "show", f"{PHASE1_BASELINE_REVISION}:{module_path}"],
                cwd=REPOSITORY_ROOT,
                check=True,
                capture_output=True,
            ).stdout
            (package_path / Path(module_path).name).write_bytes(source)

        sys.path.insert(0, directory)
        try:
            head_contracts = importlib.import_module(f"{package_name}.contracts")
            head_auditor = importlib.import_module(f"{package_name}.auditor")
            head_explainer = importlib.import_module(f"{package_name}.explainer")
            head_exposure = importlib.import_module(f"{package_name}.exposure")
            head_gemini_client = importlib.import_module(f"{package_name}.gemini_client")
            head_policy = importlib.import_module(f"{package_name}.policy")
            head_recovery = importlib.import_module(f"{package_name}.recovery")
            head_genai = importlib.import_module(f"{package_name}.screenshot_genai")
        finally:
            sys.path.remove(directory)

        head_gemini_client.client = _NoNetworkClient()
        return SimpleNamespace(
            Observation=head_contracts.Observation,
            DomainAnalysis=head_contracts.DomainAnalysis,
            AuditorResult=head_contracts.AuditorResult,
            analyse=head_genai.analyse,
            respond=head_genai.respond,
            audit_screenshot=head_auditor.audit_screenshot,
            explain_personalised_v4=head_explainer.explain_personalised_v4,
            derive_exposure_probes=head_exposure.derive_exposure_probes,
            exposure_question_payload=head_exposure.exposure_question_payload,
            resolve_exposure_answers=head_exposure.resolve_exposure_answers,
            actions_for_dimensions=head_recovery.actions_for_dimensions,
            ACTION_CATALOGUE=head_recovery.ACTION_CATALOGUE,
            evaluate_caution=head_policy.evaluate_caution,
            observations_for_explanation=head_explainer.observations_for_explanation,
            build_personalised_prompt_v4=head_explainer.build_personalised_prompt_v4,
            reconciliation_context=head_explainer.reconciliation_context,
            _owners={
                "audit_screenshot": head_auditor,
                "explain_personalised_v4": head_explainer,
                "client": head_gemini_client,
            },
        )


def _observation(module, signal_type: str, evidence: str, quality: str = "clear"):
    return module.Observation(
        signal_type=signal_type,
        evidence=evidence,
        evidence_quality=quality,
    )


def _audit(module, *observations, domain=None, unclear=None):
    return module.AuditorResult(
        content_type="website",
        observations=list(observations),
        domain_analysis=domain or module.DomainAnalysis(domain_visible=False),
        unclear_elements=list(unclear or []),
    )


def _classification(label: str, probability: float):
    return {
        "label": label,
        "scam_probability": probability,
        "confidence_pct": max(probability, 1 - probability) * 100,
    }


class _FakeInteractions:
    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        output = self.outputs.pop(0)
        if isinstance(output, BaseException):
            raise output
        return SimpleNamespace(output_text=output)


class _FakeClient:
    def __init__(self, *outputs):
        self.interactions = _FakeInteractions(outputs)


class _NoNetworkInteractions:
    def create(self, **kwargs):
        del kwargs
        raise AssertionError("Unexpected live Gemini call in characterization test")


class _NoNetworkClient:
    interactions = _NoNetworkInteractions()


# Every intended model path replaces this with a deterministic fake locally.
# Any missed patch therefore fails immediately without attempting network I/O.
gemini_client.client = _NoNetworkClient()


WORKTREE = SimpleNamespace(
    Observation=contracts.Observation,
    DomainAnalysis=contracts.DomainAnalysis,
    AuditorResult=contracts.AuditorResult,
    analyse=genai.analyse,
    respond=genai.respond,
    audit_screenshot=auditor.audit_screenshot,
    explain_personalised_v4=explainer.explain_personalised_v4,
    derive_exposure_probes=exposure.derive_exposure_probes,
    exposure_question_payload=exposure.exposure_question_payload,
    resolve_exposure_answers=exposure.resolve_exposure_answers,
    actions_for_dimensions=recovery.actions_for_dimensions,
    ACTION_CATALOGUE=recovery.ACTION_CATALOGUE,
    evaluate_caution=policy.evaluate_caution,
    observations_for_explanation=explainer.observations_for_explanation,
    build_personalised_prompt_v4=explainer.build_personalised_prompt_v4,
    reconciliation_context=explainer.reconciliation_context,
    _owners={
        "audit_screenshot": auditor,
        "explain_personalised_v4": explainer,
        "client": gemini_client,
    },
)


def _owner_for(module, symbol):
    try:
        return module._owners[symbol]
    except (AttributeError, KeyError) as error:
        raise ValueError(f"Unknown modular patch target: {symbol}") from error


def _patch_internal(module, symbol, **kwargs):
    return patch.object(_owner_for(module, symbol), symbol, **kwargs)


@contextmanager
def _temporary_image(contents=b"image-bytes"):
    """Yield a closed temporary image path that Windows can reopen."""

    with tempfile.TemporaryDirectory() as directory:
        image_path = Path(directory) / "screenshot.png"
        image_path.write_bytes(contents)
        yield image_path


def _stage1(module, classification, audit):
    with _patch_internal(module, "audit_screenshot", return_value=audit):
        return module.analyse(classification, "unused-by-mock.png")


def _guarded_message(analysis_context, exposure_summary, required_actions):
    del exposure_summary
    return _official_statement(analysis_context) + "\nGenerated explanation.\n" + "\n".join(
        action.text for action in required_actions
    )


def _legacy_guarded_message(analysis_context, exposure_summary, required_actions):
    del analysis_context, exposure_summary
    return "Generated explanation.\n" + "\n".join(
        action.text for action in required_actions
    )


def _no_actions_message(analysis_context, exposure_summary, required_actions):
    del exposure_summary, required_actions
    return _official_statement(analysis_context) + "\nMocked no-actions explanation."


def _legacy_no_actions_message(analysis_context, exposure_summary, required_actions):
    del analysis_context, exposure_summary, required_actions
    return "Mocked no-actions explanation."


def _official_statement(analysis_context):
    classifier = analysis_context["classifier"]
    return (
        "The official image classifier rated this screenshot as "
        f"{classifier['label']}. The predicted scam probability was "
        f"{classifier['scam_probability']:.1%}."
    )


def _canonicalize(value):
    if isinstance(value, BaseModel):
        return value.model_dump()
    if isinstance(value, dict):
        return {key: _canonicalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_canonicalize(item) for item in value]
    return value


def build_canonical_outputs(module=WORKTREE):
    """Return deterministic outputs that describe all currently active paths."""

    empty_audit = _audit(module)
    medium_audit = _audit(
        module,
        _observation(module, "urgent_account_threat", "The page says the account will be locked."),
        _observation(module, "external_verification_link", "A link asks the user to verify now."),
    )
    high_audit = _audit(
        module,
        _observation(module, "otp_request", "The message asks for a one-time password."),
    )
    prize_audit = _audit(
        module,
        _observation(module, "prize_or_reward_claim", "The message promises a cash prize."),
        _observation(module, "external_verification_link", "A link is provided to claim the prize."),
        _observation(module, "impersonation_claim", "The sender claims to represent Example Bank."),
    )

    stage1 = {
        "legitimate": _stage1(module, _classification("legitimate", 0.1), empty_audit),
        "suspicious": _stage1(module, _classification("suspicious", 0.5), medium_audit),
        "scam": _stage1(module, _classification("scam", 0.9), high_audit),
    }

    ordered_audit = _audit(
        module,
        _observation(module, "external_verification_link", "A verification link is visible."),
        _observation(module, "credential_request", "The page asks for a password."),
        _observation(module, "otp_request", "The page asks for an OTP."),
    )
    ordered_probes = module.derive_exposure_probes(ordered_audit, is_risky=True)
    ordered_questions = module.exposure_question_payload(ordered_probes)

    mixed_answers = {
        "shared_otp": "yes",
        "entered_credentials": "no",
        "clicked_link": "unsure",
    }
    resolved_mixed = module.resolve_exposure_answers(
        ordered_questions,
        mixed_answers,
        risky=True,
    )
    resolved_all_no = module.resolve_exposure_answers(
        ordered_questions,
        {dimension: "no" for dimension in mixed_answers},
        risky=True,
    )

    selected_actions = module.actions_for_dimensions(
        ["clicked_link", "entered_credentials"]
    )

    evidence_audit = {
        "observations": [
            {
                "signal_type": "urgent_account_threat",
                "evidence": "The account is threatened with immediate closure.",
                "evidence_quality": "clear",
            },
            {
                "signal_type": "external_verification_link",
                "evidence": "A separate verification link is visible.",
                "evidence_quality": "partial",
            },
            {
                "signal_type": "payment_request",
                "evidence": "An unrelated payment request is visible.",
                "evidence_quality": "clear",
            },
            {
                "signal_type": "urgent_account_threat",
                "evidence": "Weak urgency should not be explained.",
                "evidence_quality": "weak",
            },
        ]
    }
    medium_caution = {
        "caution_level": "medium",
        "caution_raised": True,
        "triggered_rules": ["URGENCY_PLUS_LINK"],
    }

    suspicious_context = stage1["suspicious"]
    with _patch_internal(
        module,
        "explain_personalised_v4",
        side_effect=(
            _guarded_message
            if module is WORKTREE
            else _legacy_guarded_message
        ),
    ):
        stage2_success = module.respond(suspicious_context, {"clicked_link": "yes"})

    with _patch_internal(
        module,
        "explain_personalised_v4",
        return_value="Generated output without the required action.",
    ):
        stage2_guard_failure = module.respond(
            suspicious_context,
            {"clicked_link": "yes"},
        )

    with _patch_internal(
        module,
        "explain_personalised_v4",
        side_effect=RuntimeError("explainer offline"),
    ):
        stage2_explainer_failure = module.respond(
            suspicious_context,
            {"clicked_link": "yes"},
        )

    with _patch_internal(
        module,
        "explain_personalised_v4",
        side_effect=(
            _no_actions_message
            if module is WORKTREE
            else _legacy_no_actions_message
        ),
    ):
        stage2_no_actions = module.respond(stage1["legitimate"], {})

    with _patch_internal(
        module,
        "audit_screenshot",
        side_effect=RuntimeError("offline"),
    ):
        degraded_stage1 = module.analyse(
            _classification("suspicious", 0.5),
            "unused-by-mock.png",
        )

    malformed_client = _FakeClient("{malformed", "still malformed")
    with _temporary_image() as image_path:
        with _patch_internal(module, "client", new=malformed_client):
            with redirect_stdout(io.StringIO()):
                malformed_auditor_stage1 = module.analyse(
                    _classification("suspicious", 0.5),
                    image_path,
                )

    prompt_context = {
        **suspicious_context,
        "audit": {
            **suspicious_context["audit"],
            "observations": evidence_audit["observations"],
        },
    }
    prompt_exposure_summary = module.resolve_exposure_answers(
        suspicious_context["exposure_questions"],
        {"clicked_link": "yes"},
        risky=True,
    )
    personalised_prompt = module.build_personalised_prompt_v4(
        prompt_context,
        prompt_exposure_summary,
        module.ACTION_CATALOGUE["clicked_link"],
    )

    prize_caution = module.evaluate_caution(prize_audit)

    return _canonicalize(
        {
            "stage1": stage1,
            "stage1_degraded": degraded_stage1,
            "prize_link_impersonation": prize_caution,
            "ordered_questions": ordered_questions,
            "resolved_mixed_answers": resolved_mixed,
            "resolved_all_no_answers": resolved_all_no,
            "selected_actions": selected_actions,
            "filtered_evidence": module.observations_for_explanation(
                evidence_audit,
                medium_caution,
            ),
            "personalised_prompt": personalised_prompt,
            "stage1_malformed_auditor": malformed_auditor_stage1,
            "stage2_success": stage2_success,
            "stage2_guard_failure": stage2_guard_failure,
            "stage2_explainer_failure": stage2_explainer_failure,
            "stage2_no_actions": stage2_no_actions,
        }
    )


def canonical_outputs_json(module=WORKTREE):
    return json.dumps(
        build_canonical_outputs(module),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def capture_model_call_contract(module):
    """Capture exact deterministic Gemini request payloads for both model paths."""

    auditor_response = json.dumps(
        {
            "content_type": "sms_or_chat",
            "observations": [],
            "domain_analysis": {"domain_visible": False},
            "unclear_elements": [],
        }
    )
    auditor_client = _FakeClient(auditor_response)
    with _temporary_image() as image_path:
        with _patch_internal(module, "client", new=auditor_client):
            module.audit_screenshot(image_path)

    analysis_context = _stage1(
        module,
        _classification("suspicious", 0.5),
        _audit(
            module,
            _observation(
                module,
                "external_verification_link",
                "A verification link is visible.",
            ),
        ),
    )
    exposure_summary = module.resolve_exposure_answers(
        analysis_context["exposure_questions"],
        {"clicked_link": "yes"},
        risky=True,
    )
    explainer_client = _FakeClient(" Deterministic explanation. ")
    with _patch_internal(module, "client", new=explainer_client):
        module.explain_personalised_v4(
            analysis_context,
            exposure_summary,
            module.ACTION_CATALOGUE["clicked_link"],
        )

    return _canonicalize(
        {
            "auditor": auditor_client.interactions.calls[0],
            "explainer": explainer_client.interactions.calls[0],
        }
    )


def compare_phase1_and_worktree():
    """Compare the pinned Phase 1 baseline with the active working tree."""

    phase1_module = _load_phase1_screenshot_genai()
    original_json = canonical_outputs_json(phase1_module)
    modular_json = canonical_outputs_json(WORKTREE)
    original_pretty = json.dumps(
        json.loads(original_json),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    modular_pretty = json.dumps(
        json.loads(modular_json),
        ensure_ascii=False,
        indent=2,
        sort_keys=True,
    )
    exact_diff = "".join(
        difflib.unified_diff(
            original_pretty.splitlines(keepends=True),
            modular_pretty.splitlines(keepends=True),
            fromfile=f"{PHASE1_BASELINE_REVISION}/screenshot_genai.py",
            tofile="worktree/screenshot_genai.py",
        )
    )
    return {
        "original_json": original_json,
        "modular_json": modular_json,
        "original_sha256": hashlib.sha256(original_json.encode("utf-8")).hexdigest(),
        "modular_sha256": hashlib.sha256(modular_json.encode("utf-8")).hexdigest(),
        "exact_json_diff": exact_diff,
        "behavioral_diff_empty": original_json == modular_json,
    }


def _difference_paths(left, right, path=""):
    if type(left) is not type(right):
        return [path]
    if isinstance(left, dict):
        paths = []
        for key in sorted(set(left) | set(right)):
            child_path = f"{path}.{key}" if path else key
            if key not in left or key not in right:
                paths.append(child_path)
            else:
                paths.extend(_difference_paths(left[key], right[key], child_path))
        return paths
    if isinstance(left, list):
        if len(left) != len(right):
            return [path]
        paths = []
        for index, (left_item, right_item) in enumerate(zip(left, right)):
            paths.extend(
                _difference_paths(left_item, right_item, f"{path}[{index}]")
            )
        return paths
    return [] if left == right else [path]


class ScreenshotGenAICharacterizationTests(unittest.TestCase):
    def test_stage1_structure_labels_and_caution_levels(self):
        outputs = build_canonical_outputs()["stage1"]
        expected_keys = {
            "classifier",
            "audit",
            "audit_status",
            "audit_signals",
            "display_observations",
            "caution",
            "effective_caution_level",
            "risky",
            "exposure_questions",
        }
        self.assertEqual(set(outputs["legitimate"]), expected_keys)
        self.assertEqual(outputs["legitimate"]["caution"]["caution_level"], "none")
        self.assertEqual(outputs["suspicious"]["caution"]["caution_level"], "medium")
        self.assertEqual(outputs["scam"]["caution"]["caution_level"], "high")
        self.assertFalse(outputs["legitimate"]["risky"])
        self.assertTrue(outputs["suspicious"]["risky"])
        self.assertTrue(outputs["scam"]["risky"])

    def test_prize_link_impersonation_rule_is_active(self):
        caution = build_canonical_outputs()["prize_link_impersonation"]
        self.assertEqual(caution["caution_level"], "medium")
        self.assertIn("PRIZE_LINK_IMPERSONATION", caution["triggered_rules"])

    def test_exposure_question_derivation_and_ordering(self):
        questions = build_canonical_outputs()["ordered_questions"]
        self.assertEqual(
            [question["dimension"] for question in questions],
            ["shared_otp", "entered_credentials", "clicked_link"],
        )
        self.assertEqual(
            [question["severity"] for question in questions],
            ["critical", "high", "moderate"],
        )

    def test_yes_no_unsure_and_general_contact_resolution(self):
        outputs = build_canonical_outputs()
        mixed = outputs["resolved_mixed_answers"]
        self.assertEqual(mixed["confirmed_dimensions"], ["shared_otp"])
        self.assertEqual(mixed["uncertain_dimensions"], ["clicked_link"])
        self.assertEqual(mixed["selected_dimensions"], ["shared_otp", "clicked_link"])
        all_no = outputs["resolved_all_no_answers"]
        self.assertEqual(all_no["confirmed_dimensions"], [])
        self.assertEqual(all_no["uncertain_dimensions"], [])
        self.assertEqual(all_no["selected_dimensions"], ["general_contact"])
        self.assertEqual(all_no["defaulted_dimensions"], ["general_contact"])

    def test_recovery_actions_and_final_clicked_link_actions(self):
        action_result = build_canonical_outputs()["selected_actions"]
        actions = action_result["required_actions"]
        self.assertEqual(
            [action["urgency"] for action in actions],
            ["now", "now", "soon", "soon", "soon"],
        )
        clicked_link_actions = [
            action.model_dump() for action in recovery.ACTION_CATALOGUE["clicked_link"]
        ]
        self.assertEqual(
            clicked_link_actions,
            [
                {
                    "text": "Do not enter any information on the page that opened, and close it.",
                    "urgency": "now",
                    "theme": "do_not_enter",
                },
                {
                    "text": "Open the organisation's official app or type its official website address manually to check whether the message was genuine.",
                    "urgency": "soon",
                    "theme": "official_verification",
                },
            ],
        )

    def test_rule_filtered_explanation_evidence(self):
        selected = build_canonical_outputs()["filtered_evidence"]
        self.assertEqual(
            [observation["signal_type"] for observation in selected],
            ["urgent_account_threat", "external_verification_link"],
        )

    def test_classifier_risk_does_not_display_policy_irrelevant_evidence(self):
        audit_result = _audit(
            WORKTREE,
            _observation(
                WORKTREE,
                "payment_request",
                "A standalone payment request is visible.",
            ),
            _observation(
                WORKTREE,
                "urgent_account_threat",
                "A weak urgency cue is visible.",
                "weak",
            ),
        )
        result = _stage1(
            WORKTREE,
            _classification("suspicious", 0.5),
            audit_result,
        )
        self.assertTrue(result["risky"])
        self.assertEqual(result["caution"]["triggered_rules"], [])
        self.assertEqual(result["display_observations"], [])
        self.assertEqual(len(result["audit"]["observations"]), 2)

    def test_real_personalised_prompt_is_rule_filtered_and_complete(self):
        prompt = build_canonical_outputs()["personalised_prompt"]
        prefix = "Use the following application context:\n\n"
        suffix = (
            "\n\nThe visible observations and domain analysis have already "
            "been filtered by Python."
        )
        context_json = prompt.removeprefix(prefix).split(suffix, 1)[0]
        context = json.loads(context_json)

        self.assertEqual(
            context["visible_observations_supporting_caution"],
            [
                {
                    "signal_type": "urgent_account_threat",
                    "evidence": "The account is threatened with immediate closure.",
                    "evidence_quality": "clear",
                },
                {
                    "signal_type": "external_verification_link",
                    "evidence": "A separate verification link is visible.",
                    "evidence_quality": "partial",
                },
            ],
        )
        self.assertNotIn("An unrelated payment request is visible.", prompt)
        self.assertNotIn("Weak urgency should not be explained.", prompt)
        self.assertEqual(
            context["reconciliation"],
            explainer.reconciliation_context("suspicious", "medium"),
        )
        for action in recovery.ACTION_CATALOGUE["clicked_link"]:
            self.assertEqual(prompt.count(action.text), 1)

    def test_stage2_structure_guard_success_failure_and_fallback(self):
        outputs = build_canonical_outputs()
        success = outputs["stage2_success"]
        expected_keys = {
            "classifier",
            "audit",
            "audit_status",
            "audit_signals",
            "display_observations",
            "caution",
            "effective_caution_level",
            "risky",
            "exposure_questions",
            "exposure_answers",
            "confirmed_exposures",
            "uncertain_exposures",
            "defaulted_exposures",
            "selected_exposures",
            "required_actions",
            "response_source",
            "response_message",
            "response_guard",
            "fallback_guard",
            "related_official_advisories",
        }
        self.assertEqual(set(success), expected_keys)
        self.assertEqual(success["related_official_advisories"], [])
        self.assertEqual(success["response_source"], "explainer_v4")
        self.assertTrue(success["response_guard"]["passed"])

        failure = outputs["stage2_guard_failure"]
        self.assertEqual(failure["response_source"], "fallback_after_guard_fail")
        self.assertFalse(failure["response_guard"]["passed"])
        self.assertTrue(failure["fallback_guard"]["passed"])
        self.assertIn("Do not enter any information", failure["response_message"])
        self.assertEqual(failure["related_official_advisories"], [])

    def test_stage2_explainer_exception_uses_guarded_deterministic_fallback(self):
        result = build_canonical_outputs()["stage2_explainer_failure"]
        self.assertEqual(result["response_source"], "fallback_after_error:RuntimeError")
        self.assertEqual(result["response_guard"]["misses"], ["explainer_call_failed"])
        self.assertTrue(result["fallback_guard"]["passed"])
        self.assertEqual(result["related_official_advisories"], [])
        for action in result["required_actions"]:
            self.assertIn(action["text"], result["response_message"])

    def test_no_actions_response_path(self):
        result = build_canonical_outputs()["stage2_no_actions"]
        self.assertEqual(result["required_actions"], [])
        self.assertEqual(result["response_source"], "explainer_v4_no_actions")
        self.assertEqual(
            result["response_message"],
            _official_statement(result) + "\nMocked no-actions explanation.",
        )
        self.assertTrue(result["response_guard"]["passed"])
        self.assertEqual(result["related_official_advisories"], [])

    def test_gemini_auditor_success(self):
        response_json = json.dumps(
            {
                "content_type": "sms_or_chat",
                "observations": [
                    {
                        "signal_type": "otp_request",
                        "evidence": "The message asks for an OTP.",
                        "evidence_quality": "clear",
                    }
                ],
                "domain_analysis": {"domain_visible": False},
                "unclear_elements": [],
            }
        )
        fake_client = _FakeClient(response_json)
        with _temporary_image(b"not-a-real-image-but-no-decoder-is-called") as image_path:
            with patch.object(gemini_client, "client", fake_client):
                result = auditor.audit_screenshot(image_path)
        self.assertEqual(result.observations[0].signal_type, "otp_request")
        self.assertEqual(len(fake_client.interactions.calls), 1)
        self.assertEqual(
            fake_client.interactions.calls[0]["response_format"]["schema"],
            auditor.gemini_auditor_schema(),
        )

    def test_gemini_auditor_transport_schema_omits_only_unsupported_max_items(self):
        def schema_contains_key(value, target):
            if isinstance(value, dict):
                return target in value or any(
                    schema_contains_key(item, target)
                    for item in value.values()
                )
            if isinstance(value, list):
                return any(schema_contains_key(item, target) for item in value)
            return False

        local_schema = contracts.AuditorResult.model_json_schema()
        transport_schema = auditor.gemini_auditor_schema()

        self.assertTrue(schema_contains_key(local_schema, "maxItems"))
        self.assertFalse(schema_contains_key(transport_schema, "maxItems"))
        self.assertTrue(schema_contains_key(transport_schema, "maxLength"))
        self.assertFalse(transport_schema["additionalProperties"])
        self.assertEqual(
            local_schema["properties"]["observations"]["maxItems"],
            32,
        )

        def simulate_gemini_schema_validation(schema):
            if schema_contains_key(schema, "maxItems"):
                raise ValueError("Request contains an invalid argument.")

        with self.assertRaisesRegex(ValueError, "invalid argument"):
            simulate_gemini_schema_validation(local_schema)
        simulate_gemini_schema_validation(transport_schema)

        expected_transport = json.loads(json.dumps(local_schema))

        def remove_max_items(value):
            if isinstance(value, dict):
                value.pop("maxItems", None)
                for item in value.values():
                    remove_max_items(item)
            elif isinstance(value, list):
                for item in value:
                    remove_max_items(item)

        remove_max_items(expected_transport)
        self.assertEqual(transport_schema, expected_transport)

    def test_malformed_gemini_json_retries_then_uses_active_fallback(self):
        fake_client = _FakeClient("{malformed", "still malformed")
        with _temporary_image() as image_path:
            with patch.object(gemini_client, "client", fake_client):
                with self.assertRaises(auditor.MalformedAuditError):
                    auditor.audit_screenshot(image_path)
        self.assertEqual(len(fake_client.interactions.calls), 2)

    def test_malformed_auditor_parse_fallback_is_reported_through_analyse(self):
        result = build_canonical_outputs()["stage1_malformed_auditor"]
        self.assertEqual(result["audit_status"], "malformed")
        self.assertEqual(result["audit"]["observations"], [])
        self.assertEqual(
            result["audit"]["unclear_elements"],
            ["Audit response could not be parsed; treated as no signals found."],
        )

    def test_gemini_call_failure_propagates_and_stage1_degrades(self):
        fake_client = _FakeClient(RuntimeError("offline"))
        with _temporary_image() as image_path:
            with patch.object(gemini_client, "client", fake_client):
                with self.assertRaises(RuntimeError):
                    auditor.audit_screenshot(image_path)

        degraded = build_canonical_outputs()["stage1_degraded"]
        self.assertEqual(degraded["audit_status"], "unavailable")
        self.assertTrue(degraded["risky"])

    def test_unexpected_auditor_failure_is_unavailable_and_logged_safely(self):
        sensitive_key = "api-key-must-not-appear"
        sensitive_image_data = "A" * 256
        failure = RuntimeError(
            f"unexpected failure api_key={sensitive_key} data={sensitive_image_data}"
        )

        with _temporary_image() as image_path:
            with patch.object(
                pipeline.auditor,
                "audit_screenshot",
                side_effect=failure,
            ):
                with self.assertLogs(pipeline.logger.name, level="WARNING") as captured:
                    result = pipeline.analyse(
                        _classification("suspicious", 0.5),
                        image_path,
                    )

        log_output = "\n".join(captured.output)
        self.assertEqual(result["audit_status"], "unavailable")
        self.assertIn("RuntimeError", log_output)
        self.assertIn("Unexpected auditor failure.", log_output)
        self.assertNotIn(sensitive_key, log_output)
        self.assertNotIn(sensitive_image_data, log_output)

    def test_explanation_guard_direct_success_and_failure(self):
        context = build_canonical_outputs()["stage1"]["suspicious"]
        required = recovery.ACTION_CATALOGUE["clicked_link"]
        passing = _official_statement(context) + "\n" + "\n".join(
            action.text for action in required
        )
        self.assertTrue(
            explainer.guard_message(passing, required, context)["passed"]
        )
        failing = explainer.guard_message("Close the page.", required, context)
        self.assertFalse(failing["passed"])
        self.assertEqual(
            failing["misses"],
            [
                "action_order",
                "classifier_statement",
                "do_not_enter",
                "official_verification",
            ],
        )

    def test_explanation_guard_rejects_duplicates_order_and_new_identifiers(self):
        context = build_canonical_outputs()["stage1"]["suspicious"]
        required = recovery.ACTION_CATALOGUE["clicked_link"]
        statement = _official_statement(context)

        duplicated = (
            statement
            + "\n"
            + required[0].text
            + "\n"
            + required[0].text
            + "\n"
            + required[1].text
        )
        self.assertFalse(
            explainer.guard_message(duplicated, required, context)["passed"]
        )

        reordered = statement + "\n" + "\n".join(
            action.text for action in reversed(required)
        )
        reordered_guard = explainer.guard_message(reordered, required, context)
        self.assertFalse(reordered_guard["passed"])
        self.assertEqual(reordered_guard["misses"], ["action_order"])

        invented = (
            statement
            + "\nThe account expires in 72 hours at https://localhost.\n"
            + "\n".join(action.text for action in required)
        )
        invented_guard = explainer.guard_message(invented, required, context)
        self.assertFalse(invented_guard["passed"])
        self.assertIn("unexpected_identifiers", invented_guard["misses"])

        misplaced_statement = (
            "Introductory claim.\n"
            + statement
            + "\n"
            + "\n".join(action.text for action in required)
        )
        self.assertIn(
            "classifier_statement",
            explainer.guard_message(
                misplaced_statement,
                required,
                context,
            )["misses"],
        )

    def test_no_actions_guard_performs_equivalent_bounded_checks(self):
        context = build_canonical_outputs()["stage1"]["legitimate"]
        passing = _official_statement(context) + "\nNo additional warning was verified."
        guard = explainer.guard_message(passing, [], context)
        self.assertTrue(guard["passed"])
        self.assertTrue(guard["checks"]["required_actions_exact_once"])
        self.assertTrue(guard["checks"]["required_actions_in_order"])

        failing = explainer.guard_message(
            "A different classifier statement with 9999.",
            [],
            context,
        )
        self.assertFalse(failing["passed"])
        self.assertIn("classifier_statement", failing["misses"])
        self.assertIn("unexpected_identifiers", failing["misses"])

    def test_domain_wording_is_qualified_and_raw_evidence_is_not_forwarded(self):
        domain = contracts.DomainAnalysis(
            domain_visible=True,
            visible_domain="login.example",
            claimed_entity="Example Bank",
            domain_readability="clear",
            domain_relationship="mismatch",
            evidence="This definitely does not belong to Example Bank.",
        )
        audit_result = _audit(
            WORKTREE,
            _observation(
                WORKTREE,
                "credential_request",
                "The page asks for a password.",
            ),
            domain=domain,
        )
        context = _stage1(
            WORKTREE,
            _classification("suspicious", 0.5),
            audit_result,
        )
        exposure_summary = exposure.resolve_exposure_answers(
            context["exposure_questions"],
            {"entered_credentials": "no"},
            risky=True,
        )
        actions = recovery.ACTION_CATALOGUE["general_contact"]
        prompt = explainer.build_personalised_prompt_v4(
            context,
            exposure_summary,
            actions,
        )
        fallback = explainer.personalised_fallback_message_v4(
            context,
            exposure_summary,
            actions,
        )

        self.assertNotIn("This definitely does not belong", prompt)
        self.assertIn("domain ownership was not independently verified", prompt.lower())
        self.assertIn("suggests a possible mismatch", fallback)
        self.assertIn("domain ownership was not independently verified", fallback.lower())
        self.assertNotIn("does not match the claimed organisation", fallback)

        unqualified = (
            _official_statement(context)
            + "\nThe visible domain does not match the claimed organisation.\n"
            + "\n".join(action.text for action in actions)
        )
        unqualified_guard = explainer.guard_message(
            unqualified,
            actions,
            context,
        )
        self.assertFalse(unqualified_guard["passed"])
        self.assertIn("domain_qualification", unqualified_guard["misses"])

    def test_canonical_output_is_stable_json(self):
        first = canonical_outputs_json()
        second = canonical_outputs_json()
        self.assertEqual(first, second)

    def test_phase1_baseline_and_modular_worktree_differ_only_as_approved(self):
        comparison = compare_phase1_and_worktree()
        self.assertFalse(comparison["behavioral_diff_empty"])
        original = json.loads(comparison["original_json"])
        modular = json.loads(comparison["modular_json"])
        self.assertEqual(
            set(_difference_paths(original, modular)),
            {
                "personalised_prompt",
                "stage1.legitimate.display_observations",
                "stage1.scam.display_observations",
                "stage1.suspicious.display_observations",
                "stage1_degraded.audit_status",
                "stage1_degraded.display_observations",
                "stage1_malformed_auditor.audit_status",
                "stage1_malformed_auditor.display_observations",
                "stage2_explainer_failure.display_observations",
                "stage2_explainer_failure.related_official_advisories",
                "stage2_explainer_failure.fallback_guard.checks",
                "stage2_explainer_failure.fallback_guard.scope",
                "stage2_guard_failure.display_observations",
                "stage2_guard_failure.related_official_advisories",
                "stage2_guard_failure.fallback_guard.checks",
                "stage2_guard_failure.fallback_guard.scope",
                "stage2_guard_failure.response_guard.checks",
                "stage2_guard_failure.response_guard.misses",
                "stage2_guard_failure.response_guard.scope",
                "stage2_no_actions.display_observations",
                "stage2_no_actions.related_official_advisories",
                "stage2_no_actions.response_guard.checks",
                "stage2_no_actions.response_guard.scope",
                "stage2_no_actions.response_message",
                "stage2_success.display_observations",
                "stage2_success.related_official_advisories",
                "stage2_success.response_guard.checks",
                "stage2_success.response_guard.scope",
                "stage2_success.response_message",
            },
            comparison["exact_json_diff"],
        )

    def test_phase1_and_modular_model_calls_differ_only_as_approved(self):
        phase1_module = _load_phase1_screenshot_genai()
        original = capture_model_call_contract(phase1_module)
        modular = capture_model_call_contract(WORKTREE)
        self.assertNotEqual(
            modular["auditor"]["response_format"]["schema"],
            original["auditor"]["response_format"]["schema"],
        )
        self.assertFalse(
            modular["auditor"]["response_format"]["schema"][
                "additionalProperties"
            ]
        )
        modular["auditor"]["response_format"]["schema"] = original["auditor"][
            "response_format"
        ]["schema"]
        self.assertEqual(modular["auditor"], original["auditor"])
        self.assertNotEqual(
            modular["explainer"]["system_instruction"],
            original["explainer"]["system_instruction"],
        )
        self.assertNotEqual(
            modular["explainer"]["input"][0]["text"],
            original["explainer"]["input"][0]["text"],
        )
        modular["explainer"]["system_instruction"] = original["explainer"][
            "system_instruction"
        ]
        modular["explainer"]["input"][0]["text"] = original["explainer"][
            "input"
        ][0]["text"]
        self.assertEqual(modular["explainer"], original["explainer"])

    def test_current_output_matches_phase1_golden_baseline(self):
        golden_json = GOLDEN_BASELINE_PATH.read_text(encoding="utf-8").strip()
        self.assertEqual(
            canonical_outputs_json(_load_phase1_screenshot_genai()),
            golden_json,
        )

    def test_gemini_client_initializes_lazily_and_requires_key_on_use(self):
        sentinel_client = object()
        with patch.object(gemini_client, "client", None):
            with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=False):
                with self.assertRaisesRegex(RuntimeError, "GEMINI_API_KEY is not set"):
                    gemini_client.get_client()

        with patch.object(gemini_client, "client", None):
            with patch.dict(
                os.environ,
                {"GEMINI_API_KEY": "lazy-characterization-key"},
                clear=False,
            ):
                with patch.object(
                    gemini_client.genai,
                    "Client",
                    return_value=sentinel_client,
                ) as constructor:
                    self.assertIs(gemini_client.get_client(), sentinel_client)
                    self.assertIs(gemini_client.get_client(), sentinel_client)
                    constructor.assert_called_once_with(
                        api_key="lazy-characterization-key"
                    )

    def test_tflite_model_path_is_cwd_independent(self):
        with tempfile.TemporaryDirectory() as directory:
            environment = os.environ.copy()
            environment["PYTHONPATH"] = str(REPOSITORY_ROOT)
            completed = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    (
                        "from services.screenshot import screenshot_service as service; "
                        "print(service.MODEL_PATH)"
                    ),
                ],
                cwd=directory,
                env=environment,
                check=True,
                capture_output=True,
                text=True,
            )
        self.assertEqual(
            Path(completed.stdout.splitlines()[-1]),
            REPOSITORY_ROOT / "model.tflite",
        )

    def test_concurrent_tflite_calls_cannot_overlap(self):
        from services.screenshot import screenshot_service

        class ConcurrencyCheckingInterpreter:
            def __init__(self):
                self.state_lock = threading.Lock()
                self.active = False
                self.overlap_detected = False

            def set_tensor(self, index, value):
                del index, value
                with self.state_lock:
                    if self.active:
                        self.overlap_detected = True
                    self.active = True

            def invoke(self):
                time.sleep(0.03)

            def get_tensor(self, index):
                del index
                with self.state_lock:
                    self.active = False
                return [[0.5]]

        image_buffer = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(image_buffer, format="PNG")
        prepared_image = screenshot_service.prepare_image(image_buffer.getvalue())
        fake_interpreter = ConcurrencyCheckingInterpreter()

        with patch.object(screenshot_service, "interpreter", fake_interpreter):
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(
                    executor.map(
                        screenshot_service.classify,
                        [prepared_image, prepared_image],
                    )
                )

        self.assertFalse(fake_interpreter.overlap_detected)
        self.assertEqual([result["label"] for result in results], ["suspicious"] * 2)

    def test_jpeg_and_png_are_normalized_once_with_real_format_and_no_metadata(self):
        from services.screenshot import screenshot_service

        screenshot_fixture = Image.new("RGB", (96, 64), (244, 247, 250))
        draw = ImageDraw.Draw(screenshot_fixture)
        draw.rectangle((0, 0, 95, 12), fill=(30, 41, 59))
        draw.rectangle((8, 20, 87, 25), fill=(71, 85, 105))
        draw.rectangle((8, 31, 68, 36), fill=(148, 163, 184))
        draw.rectangle((54, 45, 87, 57), fill=(220, 38, 38))

        cases = []

        jpeg_buffer = io.BytesIO()
        jpeg_exif = Image.Exif()
        jpeg_exif[270] = "private comment"
        screenshot_fixture.save(
            jpeg_buffer,
            format="JPEG",
            quality=87,
            exif=jpeg_exif,
        )
        cases.append((jpeg_buffer.getvalue(), "JPEG", "image/jpeg", ".jpg"))

        png_buffer = io.BytesIO()
        png_info = PngInfo()
        png_info.add_text("Comment", "private comment")
        screenshot_fixture.convert("RGBA").save(
            png_buffer,
            format="PNG",
            pnginfo=png_info,
        )
        cases.append((png_buffer.getvalue(), "PNG", "image/png", ".png"))

        expected_comparisons = {
            "JPEG": {
                "original_label": "scam",
                "normalized_label": "scam",
                "original_probability": 0.9994863867759705,
                "normalized_probability": 0.9995928406715393,
                "score_difference": 0.00010645389556884766,
                "threshold_crossed": False,
            },
            "PNG": {
                "original_label": "scam",
                "normalized_label": "scam",
                "original_probability": 0.9971587657928467,
                "normalized_probability": 0.9971587657928467,
                "score_difference": 0.0,
                "threshold_crossed": False,
            },
        }
        comparisons = []
        for original, expected_format, expected_mime, expected_suffix in cases:
            with self.subTest(format=expected_format):
                # Wrapping the original encoded bytes bypasses prepare_image while
                # exercising the unchanged PIL resize and TFLite classifier path.
                pre_hardening_input = screenshot_service.PreparedImage(
                    data=original,
                    format=expected_format,
                    mime_type=expected_mime,
                    suffix=expected_suffix,
                    width=screenshot_fixture.width,
                    height=screenshot_fixture.height,
                )
                original_result = screenshot_service.classify(pre_hardening_input)
                prepared = screenshot_service.prepare_image(original)
                self.assertEqual(prepared.format, expected_format)
                self.assertEqual(prepared.mime_type, expected_mime)
                self.assertEqual(prepared.suffix, expected_suffix)
                with Image.open(io.BytesIO(prepared.data)) as normalized:
                    normalized.load()
                    self.assertEqual(normalized.format, expected_format)
                    self.assertEqual(len(normalized.getexif()), 0)
                    self.assertNotIn("comment", {key.lower() for key in normalized.info})

                normalized_result = screenshot_service.classify(prepared)
                score_difference = (
                    normalized_result["scam_probability"]
                    - original_result["scam_probability"]
                )
                threshold_crossed = (
                    original_result["label"] != normalized_result["label"]
                )
                comparisons.append(
                    {
                        "format": expected_format,
                        "original_label": original_result["label"],
                        "normalized_label": normalized_result["label"],
                        "original_probability": original_result["scam_probability"],
                        "normalized_probability": normalized_result["scam_probability"],
                        "score_difference": score_difference,
                        "threshold_crossed": threshold_crossed,
                    }
                )

                self.assertIn(
                    normalized_result["label"],
                    {"legitimate", "suspicious", "scam"},
                )
                self.assertGreaterEqual(normalized_result["scam_probability"], 0.0)
                self.assertLessEqual(normalized_result["scam_probability"], 1.0)
                expected = expected_comparisons[expected_format]
                self.assertEqual(
                    original_result["label"],
                    expected["original_label"],
                )
                self.assertEqual(
                    normalized_result["label"],
                    expected["normalized_label"],
                )
                self.assertEqual(
                    threshold_crossed,
                    expected["threshold_crossed"],
                )
                self.assertAlmostEqual(
                    original_result["scam_probability"],
                    expected["original_probability"],
                    delta=1e-6,
                )
                self.assertAlmostEqual(
                    normalized_result["scam_probability"],
                    expected["normalized_probability"],
                    delta=1e-6,
                )
                self.assertAlmostEqual(
                    score_difference,
                    expected["score_difference"],
                    delta=1e-6,
                )

        print(
            "CLASSIFIER_NORMALIZATION_COMPARISON="
            + json.dumps(comparisons, sort_keys=True, separators=(",", ":"))
        )

    def test_exif_orientation_is_applied_before_classification_and_audit(self):
        from services.screenshot import screenshot_service

        image = Image.new("RGB", (4, 2), "white")
        exif = Image.Exif()
        exif[274] = 6
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", exif=exif)

        prepared = screenshot_service.prepare_image(buffer.getvalue())
        self.assertEqual((prepared.width, prepared.height), (2, 4))
        with Image.open(io.BytesIO(prepared.data)) as normalized:
            self.assertEqual(normalized.size, (2, 4))
            self.assertEqual(len(normalized.getexif()), 0)

        observed = {}

        def inspect_auditor_input(classification, image_path):
            del classification
            path = Path(image_path)
            observed["suffix"] = path.suffix
            observed["bytes"] = path.read_bytes()
            return {"ok": True}

        with patch.object(
            screenshot_service.screenshot_genai,
            "analyse",
            side_effect=inspect_auditor_input,
        ):
            screenshot_service.run_stage1_audit(
                _classification("legitimate", 0.1),
                prepared,
            )

        self.assertEqual(observed["suffix"], ".jpg")
        self.assertEqual(observed["bytes"], prepared.data)

    def test_unsafe_or_unsupported_images_are_rejected_before_use(self):
        from services.screenshot import screenshot_service

        gif_buffer = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(gif_buffer, format="GIF")
        with self.assertRaises(screenshot_service.ImageValidationError):
            screenshot_service.prepare_image(gif_buffer.getvalue())

        jpeg_buffer = io.BytesIO()
        Image.new("RGB", (16, 16), "white").save(jpeg_buffer, format="JPEG")
        truncated = jpeg_buffer.getvalue()[: len(jpeg_buffer.getvalue()) // 2]
        with self.assertRaises(screenshot_service.ImageValidationError):
            screenshot_service.prepare_image(truncated)

        with patch.object(screenshot_service, "MAX_IMAGE_DIMENSION", 7):
            png_buffer = io.BytesIO()
            Image.new("RGB", (8, 2), "white").save(png_buffer, format="PNG")
            with self.assertRaisesRegex(
                screenshot_service.ImageValidationError,
                "dimensions are too large",
            ):
                screenshot_service.prepare_image(png_buffer.getvalue())

        with patch.object(screenshot_service, "MAX_IMAGE_PIXELS", 15):
            png_buffer = io.BytesIO()
            Image.new("RGB", (4, 4), "white").save(png_buffer, format="PNG")
            with self.assertRaisesRegex(
                screenshot_service.ImageValidationError,
                "dimensions are too large",
            ):
                screenshot_service.prepare_image(png_buffer.getvalue())

        with patch.object(screenshot_service, "MAX_NORMALIZED_BYTES", 10):
            png_buffer = io.BytesIO()
            Image.new("RGB", (8, 8), "white").save(png_buffer, format="PNG")
            with self.assertRaisesRegex(
                screenshot_service.ImageValidationError,
                "too large to analyse after safe preparation",
            ):
                screenshot_service.prepare_image(png_buffer.getvalue())

        with patch.object(
            screenshot_service.Image,
            "open",
            side_effect=Image.DecompressionBombError("bomb"),
        ):
            with self.assertRaises(screenshot_service.ImageValidationError):
                screenshot_service.prepare_image(b"not-empty")

    def test_analysis_token_round_trip_replay_and_service_recovery(self):
        from services.screenshot import screenshot_service

        context = build_canonical_outputs()["stage1"]["suspicious"]
        signing_key = "s" * 32
        with patch.dict(
            os.environ,
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": signing_key},
            clear=False,
        ):
            token = screenshot_service.issue_analysis_token(context, now=1_000)
            self.assertTrue(token.startswith("v1."))
            self.assertLessEqual(
                len(token),
                screenshot_service.MAX_ANALYSIS_TOKEN_LENGTH,
            )
            _, encoded_payload, encoded_signature = token.split(".")
            payload_bytes = screenshot_service._urlsafe_decode(encoded_payload)
            signature_bytes = screenshot_service._urlsafe_decode(encoded_signature)
            self.assertEqual(
                payload_bytes,
                json.dumps(
                    json.loads(payload_bytes.decode("utf-8")),
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                ).encode("utf-8"),
            )
            self.assertEqual(len(signature_bytes), hashlib.sha256().digest_size)
            self.assertTrue(
                hmac.compare_digest(
                    signature_bytes,
                    hmac.new(
                        signing_key.encode("utf-8"),
                        payload_bytes,
                        hashlib.sha256,
                    ).digest(),
                )
            )
            first = screenshot_service.verify_analysis_token(token, now=1_100)
            second = screenshot_service.verify_analysis_token(token, now=1_100)
            self.assertEqual(first, context)
            self.assertEqual(second, context)

            with patch.object(
                screenshot_service.screenshot_genai,
                "respond",
                return_value={"ok": True},
            ) as responder:
                with patch.object(screenshot_service.time, "time", return_value=1_100):
                    self.assertEqual(
                        screenshot_service.respond(token, {"clicked_link": "yes"}),
                        {"ok": True, "related_official_advisories": []},
                    )
                responder.assert_called_once_with(
                    context,
                    {"clicked_link": "yes"},
                )

    def test_analysis_token_rejects_tampering_encoding_length_and_bad_time(self):
        from services.screenshot import screenshot_service

        context = build_canonical_outputs()["stage1"]["suspicious"]
        with patch.dict(
            os.environ,
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": "t" * 32},
            clear=False,
        ):
            token = screenshot_service.issue_analysis_token(context, now=1_000)
            prefix, payload, signature = token.split(".")
            signature_bytes = bytearray(screenshot_service._urlsafe_decode(signature))
            signature_bytes[0] ^= 1
            tampered = (
                f"{prefix}.{payload}."
                f"{screenshot_service._urlsafe_encode(bytes(signature_bytes))}"
            )

            with patch.object(
                screenshot_service.SignedAnalysisPayload,
                "model_validate",
            ) as validator:
                with patch.object(screenshot_service.json, "loads") as json_loader:
                    with self.assertRaises(screenshot_service.AnalysisTokenError):
                        screenshot_service.verify_analysis_token(tampered, now=1_001)
                    json_loader.assert_not_called()
                validator.assert_not_called()

            invalid_tokens = [
                "v2." + payload + "." + signature,
                "v1.%%%..",
                "v1.only-two-parts",
                "x" * (screenshot_service.MAX_ANALYSIS_TOKEN_LENGTH + 1),
            ]
            for invalid_token in invalid_tokens:
                with self.subTest(token=invalid_token[:20]):
                    with self.assertRaises(screenshot_service.AnalysisTokenError):
                        screenshot_service.verify_analysis_token(
                            invalid_token,
                            now=1_001,
                        )

            future = screenshot_service.issue_analysis_token(context, now=1_031)
            with self.assertRaises(screenshot_service.AnalysisTokenError):
                screenshot_service.verify_analysis_token(future, now=1_000)

            within_skew = screenshot_service.issue_analysis_token(context, now=1_030)
            self.assertEqual(
                screenshot_service.verify_analysis_token(within_skew, now=1_000),
                context,
            )

            expired = screenshot_service.issue_analysis_token(context, now=1_000)
            with self.assertRaises(screenshot_service.AnalysisTokenError):
                screenshot_service.verify_analysis_token(expired, now=1_931)

    def test_analysis_token_rejects_signed_invalid_version_fields_and_bounds(self):
        from services.screenshot import screenshot_service

        key_text = "u" * 32
        key = key_text.encode("utf-8")
        context = build_canonical_outputs()["stage1"]["suspicious"]

        def sign_payload(payload):
            payload_bytes = json.dumps(
                payload,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            signature = hmac.new(key, payload_bytes, hashlib.sha256).digest()
            return (
                "v1."
                + screenshot_service._urlsafe_encode(payload_bytes)
                + "."
                + screenshot_service._urlsafe_encode(signature)
            )

        base_payload = {
            "version": 1,
            "issued_at": 1_000,
            "context": context,
        }
        invalid_payloads = []

        wrong_version = json.loads(json.dumps(base_payload))
        wrong_version["version"] = 2
        invalid_payloads.append(wrong_version)

        unexpected = json.loads(json.dumps(base_payload))
        unexpected["context"]["unexpected"] = "not allowed"
        invalid_payloads.append(unexpected)

        unexpected_nested = json.loads(json.dumps(base_payload))
        unexpected_nested["context"]["audit"]["domain_analysis"]["unexpected"] = (
            "not allowed"
        )
        invalid_payloads.append(unexpected_nested)

        excessive_evidence = json.loads(json.dumps(base_payload))
        excessive_evidence["context"]["audit"]["observations"][0]["evidence"] = (
            "x" * 1_001
        )
        invalid_payloads.append(excessive_evidence)

        excessive_observations = json.loads(json.dumps(base_payload))
        observation = excessive_observations["context"]["audit"]["observations"][0]
        excessive_observations["context"]["audit"]["observations"] = [
            observation
            for _ in range(33)
        ]
        invalid_payloads.append(excessive_observations)

        with patch.dict(
            os.environ,
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": key_text},
            clear=False,
        ):
            for payload_data in invalid_payloads:
                with self.subTest(payload=payload_data):
                    with self.assertRaises(screenshot_service.AnalysisTokenError):
                        screenshot_service.verify_analysis_token(
                            sign_payload(payload_data),
                            now=1_001,
                        )

    def test_analysis_token_requires_dedicated_strong_secret(self):
        from services.screenshot import screenshot_service

        context = build_canonical_outputs()["stage1"]["legitimate"]
        for environment in (
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": ""},
            {"SCREENSHOT_CONTEXT_SIGNING_KEY": "too-short"},
        ):
            with self.subTest(environment=environment):
                with patch.dict(os.environ, environment, clear=False):
                    with self.assertRaisesRegex(
                        RuntimeError,
                        "SCREENSHOT_CONTEXT_SIGNING_KEY",
                    ):
                        screenshot_service.issue_analysis_token(context, now=1_000)

    def test_screenshot_frontend_reposts_only_token_and_answers(self):
        source = (
            REPOSITORY_ROOT
            / "frontend"
            / "src"
            / "pages"
            / "screenshot"
            / "ScreenshotScanPage.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn(
            "JSON.stringify({ analysis_token: analysisToken, answers })",
            source,
        )
        self.assertNotIn("JSON.stringify({ analysis_context:", source)
        app_source = (REPOSITORY_ROOT / "app.py").read_text(encoding="utf-8")
        self.assertIn('body.get("analysis_token")', app_source)
        self.assertIn('"Invalid or expired analysis token"', app_source)

    def test_displayed_fallback_always_uses_its_own_guard(self):
        source = (
            REPOSITORY_ROOT
            / "frontend"
            / "src"
            / "pages"
            / "screenshot"
            / "components"
            / "ResultView.jsx"
        ).read_text(encoding="utf-8")

        self.assertIn(
            "const displayedGuard = fallbackGuard ?? responseGuard",
            source,
        )
        self.assertNotIn("fallbackGuard?.passed", source)

        response_guard = {"passed": False, "source": "generated"}
        passing_fallback = {"passed": True, "source": "fallback"}
        failed_fallback = {"passed": False, "source": "fallback"}

        def select_guard(fallback):
            return fallback if fallback is not None else response_guard

        self.assertIs(select_guard(passing_fallback), passing_fallback)
        self.assertIs(select_guard(failed_fallback), failed_fallback)
        self.assertIs(select_guard(None), response_guard)

    def test_visual_review_credential_wording_is_observational_and_qualified(self):
        screenshot_root = (
            REPOSITORY_ROOT
            / "frontend"
            / "src"
            / "pages"
            / "screenshot"
        )
        component_root = screenshot_root / "components"
        warning_source = (component_root / "WarningSignsSection.jsx").read_text(
            encoding="utf-8"
        )
        evidence_source = (component_root / "EvidenceCard.jsx").read_text(
            encoding="utf-8"
        )
        metadata_source = (screenshot_root / "utils" / "observations.js").read_text(
            encoding="utf-8"
        )
        summary_source = (component_root / "ResultSummary.jsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("What the Visual Review Found", warning_source)
        self.assertNotIn("Why This Screenshot Is Suspicious", warning_source)
        self.assertIn(
            "credential_request: { title: 'Login Details Requested'",
            metadata_source,
        )
        self.assertIn(
            "observation.signal_type === 'credential_request'",
            evidence_source,
        )
        self.assertIn(
            "Login forms can be legitimate. Consider this together with the website "
            "address and the overall classifier result.",
            evidence_source,
        )
        self.assertEqual(evidence_source.count("Login forms can be legitimate."), 1)
        self.assertIn("{observation.evidence}", evidence_source)

        other_titles = {
            "otp_request": "OTP Request",
            "personal_information_request": "Personal Information Request",
            "urgent_account_threat": "Urgency or Pressure",
            "authority_pressure": "Authority Pressure",
            "secrecy_request": "Secrecy Request",
            "payment_request": "Unusual Payment Request",
            "upfront_fee_request": "Upfront Fee Request",
            "prize_or_reward_claim": "Suspicious Reward Claim",
            "unusual_payment_method": "Unusual Payment Method",
            "external_verification_link": "Suspicious External Link",
            "impersonation_claim": "Impersonation",
            "remote_access_request": "Remote Access Request",
            "attachment_or_download_request": "Suspicious Attachment",
        }
        for signal_type, title in other_titles.items():
            with self.subTest(signal_type=signal_type):
                self.assertIn(
                    f"{signal_type}: {{ title: '{title}'",
                    metadata_source,
                )

        self.assertIn("Official classifier", summary_source)
        self.assertIn("Confidence in this classification", summary_source)

    def test_major_result_headings_share_the_existing_icon_pattern(self):
        component_root = (
            REPOSITORY_ROOT
            / "frontend"
            / "src"
            / "pages"
            / "screenshot"
            / "components"
        )
        expected_headings = {
            "WarningSignsSection.jsx": ("ScanSearch", "What the Visual Review Found"),
            "SafetyRecommendationsCard.jsx": ("ShieldCheck", "Safety Recommendations"),
            "AnswerContextCard.jsx": ("ClipboardCheck", "Based on Your Answers"),
            "DomainAnalysisCard.jsx": ("Globe", "Domain Analysis"),
            "AIExplanationCard.jsx": ("Sparkles", "AI Explanation"),
        }

        for filename, (icon, title) in expected_headings.items():
            with self.subTest(filename=filename):
                source = (component_root / filename).read_text(encoding="utf-8")
                self.assertIn(
                    '<CardTitle className="flex items-center gap-2">',
                    source,
                )
                self.assertIn(
                    f'<{icon} className="size-4 text-primary" aria-hidden="true" />',
                    source,
                )
                self.assertIn(title, source)

        evidence_source = (component_root / "EvidenceCard.jsx").read_text(
            encoding="utf-8"
        )
        recommendations_source = (
            component_root / "SafetyRecommendationsCard.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn(
            '<Icon className="mt-0.5 size-4 shrink-0 text-destructive"',
            evidence_source,
        )
        self.assertIn("<CheckCircle2", recommendations_source)
        self.assertNotIn("h-full", recommendations_source)

    def test_empty_visual_warning_wording_depends_on_audit_availability(self):
        component_root = (
            REPOSITORY_ROOT
            / "frontend"
            / "src"
            / "pages"
            / "screenshot"
            / "components"
        )
        warning_source = (component_root / "WarningSignsSection.jsx").read_text(
            encoding="utf-8"
        )
        result_source = (component_root / "ResultView.jsx").read_text(
            encoding="utf-8"
        )

        self.assertIn("auditStatus === 'unavailable'", warning_source)
        self.assertIn("auditStatus === 'malformed'", warning_source)
        self.assertIn(
            "No visual warning-sign assessment is available because the independent "
            "visual review could not be completed.",
            warning_source,
        )
        self.assertIn(
            "No specific visual warning signs were flagged in this screenshot.",
            warning_source,
        )
        self.assertIn("auditStatus={auditStatus}", result_source)

        unavailable_message = (
            "No visual warning-sign assessment is available because the independent "
            "visual review could not be completed."
        )
        available_message = (
            "No specific visual warning signs were flagged in this screenshot."
        )

        def empty_message(audit_status):
            if audit_status in {"unavailable", "malformed"}:
                return unavailable_message
            return available_message

        self.assertEqual(empty_message("unavailable"), unavailable_message)
        self.assertEqual(empty_message("malformed"), unavailable_message)
        self.assertEqual(empty_message("available"), available_message)


if __name__ == "__main__":
    unittest.main()
