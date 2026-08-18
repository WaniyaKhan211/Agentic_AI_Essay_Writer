from unittest.mock import MagicMock

import pytest

import nodes.writer as writer_module
from nodes.writer import generate_essay
from nodes.graph import writer_node
from schemas.essay_schema import EssayOutput, EssaySection, Table, Formula


def _sample_essay_output() -> EssayOutput:
    return EssayOutput(
        title="The Role of AI in Healthcare",
        introduction="AI is transforming modern medicine.",
        sections=[
            EssaySection(
                heading="Diagnostics",
                body="AI models can **detect disease** earlier than humans.",
            ),
            EssaySection(
                heading="Comparison",
                body="A quick comparison of approaches.",
            ),
        ],
        tables=[
            Table(
                title="Traditional vs AI Diagnostics",
                headers=["Feature", "Traditional", "AI-assisted"],
                rows=[["Speed", "Slow", "Fast"]],
            )
        ],
        formulas=[],
        conclusion="AI will keep improving healthcare outcomes.",
    )


def _patch_structured_llm(monkeypatch, invoke_side_effect_or_return):
    """Replace nodes.writer.llm.with_structured_output(...) with a mock
    whose .invoke behaves as given (a return value, or a list for side_effect).

    Note: `llm` (ChatGroq) is a pydantic model and won't allow setting
    `.with_structured_output` on the instance directly, so we swap out the
    whole module-level `nodes.writer.llm` name for a plain MagicMock instead.
    """
    fake_structured_llm = MagicMock()
    if isinstance(invoke_side_effect_or_return, list):
        fake_structured_llm.invoke = MagicMock(side_effect=invoke_side_effect_or_return)
    else:
        fake_structured_llm.invoke = MagicMock(return_value=invoke_side_effect_or_return)

    fake_llm = MagicMock()
    fake_llm.with_structured_output = MagicMock(return_value=fake_structured_llm)
    monkeypatch.setattr(writer_module, "llm", fake_llm)
    return fake_structured_llm


class TestGenerateEssay:

    def test_happy_path_builds_markdown_with_references(self, monkeypatch):
        _patch_structured_llm(monkeypatch, _sample_essay_output())

        references = [
            {"title": "Source One", "url": "https://example.com/1"},
            {"title": "Source Two", "url": "https://example.com/2"},
        ]

        result = generate_essay(
            user_idea="The Role of AI in Healthcare",
            research="Some research text about AI diagnostics.",
            references=references,
            feedback="",
            previous_essay="",
            conversation_history=[],
        )

        assert result["title"] == "The Role of AI in Healthcare"
        assert result["markdown"].startswith("# The Role of AI in Healthcare")
        assert "## Diagnostics" in result["markdown"]
        assert "## References" in result["markdown"]
        assert "[Source One](https://example.com/1)" in result["markdown"]
        assert "[Source Two](https://example.com/2)" in result["markdown"]
        assert result["sections"] == [
            {"heading": "Diagnostics", "body": "AI models can **detect disease** earlier than humans."},
            {"heading": "Comparison", "body": "A quick comparison of approaches."},
        ]

    def test_no_references_means_no_references_section(self, monkeypatch):
        _patch_structured_llm(monkeypatch, _sample_essay_output())

        result = generate_essay(user_idea="AI in Healthcare", references=[])

        assert "## References" not in result["markdown"]

    def test_user_topic_and_research_are_in_prompt(self, monkeypatch):
        fake_structured_llm = _patch_structured_llm(monkeypatch, _sample_essay_output())

        generate_essay(
            user_idea="Climate Change and Renewable Energy",
            research="Solar power adoption grew 30% in 2025.",
        )

        prompt_sent = fake_structured_llm.invoke.call_args[0][0]
        assert "Climate Change and Renewable Energy" in prompt_sent
        assert "Solar power adoption grew 30% in 2025." in prompt_sent

    def test_feedback_and_previous_essay_are_included_for_retries(self, monkeypatch):
        fake_structured_llm = _patch_structured_llm(monkeypatch, _sample_essay_output())

        generate_essay(
            user_idea="add a section about cost",
            previous_essay="# Old Essay\n\nOld content here.",
            feedback="Add more statistics and improve the conclusion.",
        )

        prompt_sent = fake_structured_llm.invoke.call_args[0][0]
        assert "Old Essay" in prompt_sent
        assert "Add more statistics and improve the conclusion." in prompt_sent

    def test_retries_on_malformed_output_then_succeeds(self, monkeypatch):
        fake_structured_llm = _patch_structured_llm(
            monkeypatch,
            [ValueError("bad json"), ValueError("bad json again"), _sample_essay_output()],
        )

        result = generate_essay(user_idea="AI in Healthcare")

        assert fake_structured_llm.invoke.call_count == 3
        assert result["title"] == "The Role of AI in Healthcare"

    def test_raises_clear_error_after_all_attempts_fail(self, monkeypatch):
        fake_structured_llm = _patch_structured_llm(
            monkeypatch,
            [ValueError("bad"), ValueError("bad"), ValueError("bad")],
        )

        with pytest.raises(RuntimeError, match="malformed output"):
            generate_essay(user_idea="AI in Healthcare")

        assert fake_structured_llm.invoke.call_count == 3


class TestWriterNodeGraphWrapper:

    def test_wraps_generate_essay_output_for_graph_state(self, monkeypatch):
        mock_generate = MagicMock(
            return_value={
                "markdown": "# Title\n\nBody",
                "title": "Title",
                "sections": [{"heading": "H", "body": "B"}],
            }
        )
        monkeypatch.setattr("nodes.graph.generate_essay", mock_generate)

        state = {
            "idea": "AI in Healthcare",
            "research": "research text",
            "references": [],
            "feedback": ["improve clarity"],
            "previous_essay": "",
            "conversation_history": [],
        }
        result = writer_node(state)

        mock_generate.assert_called_once_with(
            user_idea="AI in Healthcare",
            research="research text",
            references=[],
            feedback="improve clarity",
            previous_essay="",
            conversation_history=[],
        )
        assert result == {"essay": "# Title\n\nBody", "sections": [{"heading": "H", "body": "B"}]}