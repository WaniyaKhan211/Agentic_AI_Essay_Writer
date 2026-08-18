from types import SimpleNamespace
from unittest.mock import MagicMock

import nodes.research as research_module
from nodes.research import decide_and_research, format_search_results
from nodes.graph import research_node


def _fake_search_result(url, text, title=None):
    """Mimic a single Exa search result item (has .url/.text/.title attrs)."""
    if title is not None:
        return SimpleNamespace(url=url, text=text, title=title)
    return SimpleNamespace(url=url, text=text)


class TestFormatSearchResults:

    def test_builds_research_text_and_references(self):
        raw_results = SimpleNamespace(
            results=[
                _fake_search_result(
                    "https://example.com/a",
                    "Fact one about the topic.",
                    title="Article A",
                ),
                _fake_search_result(
                    "https://example.com/b",
                    "Fact two about the topic.",
                    title="Article B",
                ),
            ]
        )

        data = format_search_results(raw_results)

        assert "Fact one about the topic." in data["research"]
        assert "Fact two about the topic." in data["research"]
        assert "https://example.com/a" in data["research"]
        assert data["references"] == [
            {"title": "Article A", "url": "https://example.com/a"},
            {"title": "Article B", "url": "https://example.com/b"},
        ]

    def test_falls_back_to_url_when_title_missing(self):
        raw_results = SimpleNamespace(
            results=[_fake_search_result("https://example.com/no-title", "Some text.")]
        )

        data = format_search_results(raw_results)

        assert data["references"] == [
            {"title": "https://example.com/no-title", "url": "https://example.com/no-title"}
        ]

    def test_content_is_truncated_to_500_chars(self):
        long_text = "x" * 900
        raw_results = SimpleNamespace(
            results=[_fake_search_result("https://example.com/c", long_text, title="C")]
        )

        data = format_search_results(raw_results)

        # only the first 500 chars of the source text should appear
        assert ("x" * 500) in data["research"]
        assert ("x" * 501) not in data["research"]

    def test_malformed_results_fall_back_gracefully(self):
        """If `results` isn't iterable the way we expect, don't crash -
        return the raw object stringified with empty references instead."""
        broken_results = object()  # has no `.results` attribute at all

        data = format_search_results(broken_results)

        assert data["references"] == []
        assert isinstance(data["research"], str)


class TestDecideAndResearch:

    def test_uses_llm_query_to_call_search_and_formats_output(self, monkeypatch):
        # Mock the query-generation LLM call. `decision_llm` (ChatGroq) is a
        # pydantic model and won't allow setting `.invoke` on the instance,
        # so we swap the whole module-level `decision_llm` name instead.
        mock_llm_response = SimpleNamespace(content="  AI healthcare statistics 2026  ")
        fake_decision_llm = MagicMock()
        mock_decision_invoke = MagicMock(return_value=mock_llm_response)
        fake_decision_llm.invoke = mock_decision_invoke
        monkeypatch.setattr(research_module, "decision_llm", fake_decision_llm)

        # Mock the actual web search so no network call happens
        fake_raw_results = SimpleNamespace(
            results=[_fake_search_result("https://example.com/x", "Some AI health fact.", title="X")]
        )
        mock_search_web = MagicMock(return_value=fake_raw_results)
        monkeypatch.setattr(research_module, "search_web", mock_search_web)

        result = decide_and_research("The Role of AI in Healthcare")

        # The query sent to search_web should be the *stripped* LLM output
        mock_search_web.assert_called_once_with("AI healthcare statistics 2026")

        assert "Some AI health fact." in result["research"]
        assert result["references"] == [{"title": "X", "url": "https://example.com/x"}]

    def test_original_topic_is_passed_to_query_generation_llm(self, monkeypatch):
        fake_decision_llm = MagicMock()
        mock_decision_invoke = MagicMock(
            return_value=SimpleNamespace(content="renewable energy trends")
        )
        fake_decision_llm.invoke = mock_decision_invoke
        monkeypatch.setattr(research_module, "decision_llm", fake_decision_llm)
        monkeypatch.setattr(
            research_module,
            "search_web",
            MagicMock(return_value=SimpleNamespace(results=[])),
        )

        decide_and_research("Renewable Energy Solutions")

        prompt_sent = mock_decision_invoke.call_args[0][0]
        assert "Renewable Energy Solutions" in prompt_sent


class TestResearchNodeGraphWrapper:

    def test_wraps_decide_and_research_output_for_graph_state(self, monkeypatch):
        mock_decide = MagicMock(
            return_value={
                "research": "some research text",
                "references": [{"title": "T", "url": "https://example.com"}],
            }
        )
        monkeypatch.setattr("nodes.graph.decide_and_research", mock_decide)

        state = {"idea": "Climate Change and Renewable Energy"}
        result = research_node(state)

        mock_decide.assert_called_once_with("Climate Change and Renewable Energy")
        assert result == {
            "research": "some research text",
            "references": [{"title": "T", "url": "https://example.com"}],
        }