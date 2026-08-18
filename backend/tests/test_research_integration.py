"""
Run just this file:
    pytest tests/test_research_integration.py -v -s
"""

import os
import re

import pytest

from tools.web_search import search_web
from nodes.research import decide_and_research

pytestmark = pytest.mark.integration

# Skip automatically if there's no real-looking Exa key in the environment
# (conftest.py sets a dummy "test-dummy-exa-key" fallback for the mocked
# unit tests, which is obviously not a real key we can use here).
_looks_like_dummy_key = os.getenv("EXA_API_KEY", "") in ("", "test-dummy-exa-key")

requires_real_exa_key = pytest.mark.skipif(
    _looks_like_dummy_key,
    reason="No real EXA_API_KEY found in environment - set it in your .env to run this.",
)

URL_RE = re.compile(r"^https?://")


def _keyword_overlap_score(topic: str, text: str) -> float:
    """
    Rough relevance heuristic: what fraction of the topic's significant
    words (len > 3, to skip 'the', 'and', 'of'...) show up in the returned
    text? Not a precise measure, but a cheap smoke-test for "did the search
    go completely off-topic."
    """
    topic_words = {w.lower() for w in re.findall(r"[A-Za-z]{4,}", topic)}
    if not topic_words:
        return 1.0  # nothing meaningful to check against

    text_lower = text.lower()
    hits = sum(1 for w in topic_words if w in text_lower)
    return hits / len(topic_words)


@requires_real_exa_key
class TestExaSearchRelevance:

    @pytest.mark.parametrize(
        "topic",
        [
            "Renewable Energy and Climate Change",
            "Artificial Intelligence in Healthcare",
        ],
    )
    def test_search_returns_usable_results_for_topic(self, topic):
        raw_results = search_web(topic)

        assert raw_results.results, f"Exa returned zero results for topic: {topic!r}"

        for r in raw_results.results:
            assert r.url, "A result is missing a URL"
            assert URL_RE.match(r.url), f"Not a valid http(s) URL: {r.url}"
            # text is optional in Exa's response, but if present it shouldn't
            # be pure whitespace / garbage
            if r.text:
                assert len(r.text.strip()) > 0

    @pytest.mark.parametrize(
        "topic",
        [
            "Renewable Energy and Climate Change",
            "Artificial Intelligence in Healthcare",
        ],
    )
    def test_search_results_are_topically_relevant(self, topic):
        """
        Heuristic check: at least SOME of the topic's keywords should show
        up across the combined titles + text of the results. This won't
        catch subtle relevance issues, but it WILL catch the search going
        completely off-topic (wrong query generated, API misuse, etc.).
        """
        raw_results = search_web(topic)
        assert raw_results.results, f"Exa returned zero results for topic: {topic!r}"

        combined_text = " ".join(
            f"{getattr(r, 'title', '') or ''} {r.text or ''}" for r in raw_results.results
        )

        score = _keyword_overlap_score(topic, combined_text)
        print(f"\n[relevance] topic={topic!r} keyword_overlap_score={score:.2f}")
        for r in raw_results.results:
            print(f"  - {getattr(r, 'title', r.url)} -> {r.url}")

        assert score > 0.0, (
            f"None of the topic's keywords appeared in Exa's results for {topic!r} - "
            "the search may have gone off-topic."
        )

    def test_end_to_end_query_generation_and_search(self):
        """
        Exercises the REAL path used in production: the query-generation
        LLM (Groq) turns the topic into a search query, then that query is
        sent to Exa. This is the closest thing to 'does research actually
        work end-to-end' without running the full graph.
        """
        topic = "The Impact of Social Media on Modern Youth"
        result = decide_and_research(topic)

        assert result["research"], "No research text was produced"
        assert result["references"], "No references were produced"

        for ref in result["references"]:
            assert URL_RE.match(ref["url"]), f"Bad reference URL: {ref['url']}"
            assert ref["title"], "Reference is missing a title"

        score = _keyword_overlap_score(topic, result["research"])
        print(f"\n[relevance] end-to-end topic={topic!r} keyword_overlap_score={score:.2f}")
        print("References found:")
        for ref in result["references"]:
            print(f"  - {ref['title']} -> {ref['url']}")

        assert score > 0.0, "Research text doesn't seem related to the topic at all"