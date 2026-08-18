import pytest
from nodes.image_generator import _flatten_sentences, _build_parts

def test_flatten_sentences_standard_keys():
    essay_data = {
        "title": "Quantum Computing",
        "sections": [
            {"heading": "Introduction", "body": "Quantum computing is revolutionary. It uses qubits instead of bits."},
            {"heading": "Applications", "body": "It excels at cryptography. Drug discovery is another key application."}
        ]
    }
    units = _flatten_sentences(essay_data)
    assert len(units) == 4
    assert units[0]["heading"] == "Introduction"
    assert units[2]["heading"] == "Applications"

def test_flatten_sentences_fallback_keys():
    essay_data = {
        "title": "Quantum Computing",
        "sections": [
            {"subheading": "Introduction", "content": "Quantum computing is revolutionary. It uses qubits instead of bits."},
            {"subheading": "Applications", "content": "It excels at cryptography. Drug discovery is another key application."}
        ]
    }
    units = _flatten_sentences(essay_data)
    assert len(units) == 4
    assert units[0]["heading"] == "Introduction"

def test_build_parts_four_images():
    essay_data = {
        "title": "Artificial Intelligence",
        "sections": [
            {"heading": "Intro", "body": "AI is expanding rapidly. Neural networks drive deep learning."},
            {"heading": "NLP", "body": "Language models understand human speech. Transformers improved context handling."},
            {"heading": "Vision", "body": "Computer vision detects objects in images. Autonomous cars use vision systems."},
            {"heading": "Ethics", "body": "Ethical AI ensures fairness and safety. Bias mitigation is crucial."}
        ]
    }
    parts = _build_parts(essay_data, target=4)
    assert len(parts) == 4
