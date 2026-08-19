"""Offline tests for advisory clarification continuity.

The rule under test is narrow: when the assistant has just asked the advisory
clarification question, the *next* user turn supplies the search topic. The
word alone never carries that meaning — the preceding turn does.
"""

import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch


os.environ["GEMINI_API_KEY"] = "assistant-clarification-test-key"

from services.chatbot import advisory_assistant  # noqa: E402
from services.chatbot import chatbot_service  # noqa: E402


class _FakeInteractions:
    def __init__(self, reply="Ordinary Assistant reply"):
        self.calls = []
        self.reply = reply

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self.reply)


class _FakeClient:
    def __init__(self, reply="Ordinary Assistant reply"):
        self.interactions = _FakeInteractions(reply)


class ClarificationContinuityTests(unittest.TestCase):
    def test_vague_request_asks_the_clarification_question(self):
        response = advisory_assistant.handle_advisory_query(
            "Are there any recent scam advisories?"
        )

        self.assertEqual(response.status, "needs_clarification")
        self.assertEqual(response.message, advisory_assistant.CLARIFICATION_MESSAGE)
        self.assertEqual(response.advisories, ())

    def test_single_word_answer_is_routed_to_retrieval(self):
        response = advisory_assistant.handle_advisory_query(
            "investment", awaiting_topic=True
        )

        self.assertIsNotNone(response)
        self.assertEqual(response.status, "matches")
        self.assertTrue(response.advisories)

    def test_descriptive_answer_is_routed_to_retrieval(self):
        response = advisory_assistant.handle_advisory_query(
            "Telegram investment scams", awaiting_topic=True
        )

        self.assertIsNotNone(response)
        self.assertEqual(response.status, "matches")

    def test_organisation_answer_is_routed_even_when_it_abstains(self):
        # Routing is the requirement here, not a guaranteed card. Whichever
        # way the corpus falls, the turn must reach retrieval rather than
        # leaking back into ordinary chat.
        response = advisory_assistant.handle_advisory_query("OCBC", awaiting_topic=True)

        self.assertIsNotNone(response)
        self.assertIn(response.status, {"matches", "no_match"})

    def test_clarification_answer_never_reaches_gemini(self):
        fake_client = _FakeClient()
        with patch.object(chatbot_service, "_client", fake_client):
            result = chatbot_service.generate_assistant_reply(
                "investment", {"awaiting_advisory_topic": True}
            )

        self.assertEqual(result["source"], "trusted_advisory")
        self.assertEqual(result["advisory_search"]["status"], "matches")
        self.assertEqual(fake_client.interactions.calls, [])


class ClarificationEscapeHatchTests(unittest.TestCase):
    """A pending clarification must never swallow an unrelated turn."""

    def test_explicit_detector_request_clears_the_state(self):
        self.assertIsNone(
            advisory_assistant.handle_advisory_query(
                "actually just scan this message for me", awaiting_topic=True
            )
        )

    def test_pasted_url_clears_the_state(self):
        for pasted in (
            "https://secure-login.example.com/verify",
            "http://bit.ly/3xample",
            "www.dbs-verify.example.com",
        ):
            with self.subTest(pasted=pasted):
                self.assertIsNone(
                    advisory_assistant.handle_advisory_query(
                        pasted, awaiting_topic=True
                    )
                )

    def test_cancellation_clears_the_state(self):
        for cancellation in (
            "never mind",
            "forget it",
            "nvm",
            "cancel",
            "never mind, analyse this",
            "forget it, scan this",
        ):
            with self.subTest(cancellation=cancellation):
                self.assertIsNone(
                    advisory_assistant.handle_advisory_query(
                        cancellation, awaiting_topic=True
                    )
                )

    def test_cleared_turn_falls_through_to_the_existing_gemini_path(self):
        fake_client = _FakeClient()
        with patch.object(chatbot_service, "_client", fake_client):
            result = chatbot_service.generate_assistant_reply(
                "never mind", {"awaiting_advisory_topic": True}
            )

        self.assertNotIn("advisory_search", result)
        self.assertEqual(len(fake_client.interactions.calls), 1)

    def test_state_is_consumed_by_one_turn_only(self):
        # The same word, with no pending clarification, must not retrieve.
        consumed = advisory_assistant.handle_advisory_query(
            "investment", awaiting_topic=False
        )

        self.assertIsNone(consumed)


class ClarificationNegativeRoutingTests(unittest.TestCase):
    """Written before the implementation: the word is not the intent."""

    def test_standalone_topic_word_does_not_trigger_retrieval(self):
        self.assertIsNone(advisory_assistant.handle_advisory_query("investment"))

    def test_ordinary_investing_message_does_not_trigger_retrieval(self):
        self.assertIsNone(
            advisory_assistant.handle_advisory_query(
                "I'm thinking about investing in ETFs."
            )
        )

    def test_scam_analysis_request_does_not_become_advisory_search(self):
        self.assertIsNone(
            advisory_assistant.handle_advisory_query(
                "I received this investment message, is it a scam?"
            )
        )

    def test_descriptive_scam_question_answers_a_pending_clarification(self):
        # Deliberate: only an *imperative* detector request ("scan this
        # message") clears a pending clarification, matching the escape-hatch
        # examples. A descriptive question typed straight after the
        # clarification is read as the topic, which is the whole point of the
        # rule — the preceding turn is what gives it meaning. Standalone, the
        # same sentence still stays out of advisory search (test above).
        response = advisory_assistant.handle_advisory_query(
            "I received this investment message, is it a scam?",
            awaiting_topic=True,
        )

        self.assertIsNotNone(response)
        self.assertEqual(response.status, "matches")

    def test_direct_advisory_queries_still_work(self):
        response = advisory_assistant.handle_advisory_query(
            "Are there any recent investment scam warnings?"
        )

        self.assertEqual(response.status, "matches")

    def test_abstention_still_works(self):
        response = advisory_assistant.handle_advisory_query(
            "Are there official advisories about competitive tropical fishkeeping?"
        )

        self.assertEqual(response.status, "no_match")
        self.assertEqual(response.advisories, ())


if __name__ == "__main__":
    unittest.main()
