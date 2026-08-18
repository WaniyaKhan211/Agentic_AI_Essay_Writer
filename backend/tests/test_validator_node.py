from unittest.mock import MagicMock

from langchain_core.messages import AIMessage, HumanMessage

from nodes.validator import validator_node
from schemas.validator_schema import ValidationResult


def _mock_llm(monkeypatch, is_valid: bool, response_text: str) -> MagicMock:
    """Patch validator.py's structured_llm to return a fixed result.

    Note: `structured_llm` (a langchain RunnableSequence) is a pydantic
    model, which forbids setting arbitrary attributes like `.invoke` on an
    *instance*. So instead of patching `structured_llm.invoke`, we swap out
    the whole `nodes.validator.structured_llm` module-level name for a plain
    MagicMock that has an `.invoke` we control.
    """
    fake_result = ValidationResult(is_valid=is_valid, response=response_text)
    fake_structured_llm = MagicMock()
    fake_structured_llm.invoke = MagicMock(return_value=fake_result)
    monkeypatch.setattr("nodes.validator.structured_llm", fake_structured_llm)
    return fake_structured_llm.invoke


class TestValidatorNode:

    def test_valid_essay_topic_is_accepted(self, monkeypatch):
        mock_invoke = _mock_llm(
            monkeypatch,
            is_valid=True,
            response_text="Great! I'll generate a well-structured essay on this topic.",
        )
        state = {
            "idea": "The Role of Artificial Intelligence in Healthcare",
            "conversation_history": [],
        }

        result = validator_node(state)

        assert result == {
            "is_valid": True,
            "response": "Great! I'll generate a well-structured essay on this topic.",
        }
        mock_invoke.assert_called_once()

    def test_unrelated_input_is_rejected(self, monkeypatch):
        mock_invoke = _mock_llm(
            monkeypatch,
            is_valid=False,
            response_text="I'm an AI Essay Writer and can only generate essays. "
            "Want to try a topic like climate change or AI in education?",
        )
        state = {"idea": "What's today's gold price?", "conversation_history": []}

        result = validator_node(state)

        assert result["is_valid"] is False
        assert "essay" in result["response"].lower()
        mock_invoke.assert_called_once()

    def test_missing_conversation_history_defaults_to_empty(self, monkeypatch):
        """state.get('conversation_history', []) should not raise a KeyError."""
        mock_invoke = _mock_llm(monkeypatch, True, "Sounds good!")
        state = {"idea": "Climate Change"}  # no conversation_history key at all

        result = validator_node(state)

        assert result["is_valid"] is True
        mock_invoke.assert_called_once()

    def test_current_topic_is_included_in_prompt(self, monkeypatch):
        mock_invoke = _mock_llm(monkeypatch, True, "ok")
        state = {"idea": "Renewable Energy Solutions", "conversation_history": []}

        validator_node(state)

        prompt_sent = mock_invoke.call_args[0][0]
        assert "Renewable Energy Solutions" in prompt_sent
        # No history was supplied, so the "CONVERSATION SO FAR" block
        # must not be injected into the prompt.
        assert "CONVERSATION SO FAR" not in prompt_sent

    def test_followup_message_includes_history_in_prompt(self, monkeypatch):
        """
        A short follow-up like 'add more about elections after 2026' should
        still be treated as valid when there's prior essay context - we can't
        test the LLM's judgement itself (it's mocked), but we CAN verify the
        node correctly forwards the conversation history into the prompt so
        the LLM has the context it needs to make that judgement.
        """
        mock_invoke = _mock_llm(monkeypatch, True, "Continuing on that topic.")
        history = [
            HumanMessage(content="Write an essay about Pakistan elections"),
            AIMessage(content="# Pakistan Elections\n\n..."),
        ]
        state = {
            "idea": "also talk about the elections coming after 2026",
            "conversation_history": history,
        }

        result = validator_node(state)

        assert result["is_valid"] is True
        prompt_sent = mock_invoke.call_args[0][0]
        assert "CONVERSATION SO FAR" in prompt_sent
        assert "Pakistan elections" in prompt_sent