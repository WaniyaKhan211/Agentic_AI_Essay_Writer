import os
import uuid
from dotenv import load_dotenv
from langsmith import Client
from langsmith.evaluation import evaluate
from langchain_groq import ChatGroq

# 1. Load environment variables (.env file)
load_dotenv()

# Import your graph from langraph_flow.py
from langraph_flow import essay_graph

# ==========================================
# STEP 3: Define Target Prediction Function
# ==========================================
def predict_essay(inputs: dict) -> dict:
    """Takes a test case input (e.g., {"topic": "..."}) and runs your LangGraph essay writer.
    Returns the output state for LangSmith to evaluate.
    """
    topic = inputs["topic"]
    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "idea": topic,
        "research": "",
        "references": [],
        "essay": "",
        "score": 0,
        "best_essay": "",
        "best_score": 0,
        "best_sections": [],
        "feedback": [],
        "passed": False,
        "attempts": 0,
        "is_valid": True,
        "response": "",
        "is_followup": False,
        "previous_essay": "",
    }

    # Run your LangGraph graph
    result = essay_graph.invoke(initial_state, config=config)

    return {
        "final_essay": result.get("best_essay") or result.get("essay", ""),
        "score": result.get("best_score", 0),
        "passed": result.get("passed", False),
        "attempts": result.get("attempts", 0),
        "is_valid": result.get("is_valid", True)
    }

# ==========================================
# STEP 4: Define Evaluator Functions
# ==========================================
def length_and_keyword_evaluator(run, example):
    """Rule-based evaluator: Checks word count and keyword presence."""
    essay_text = run.outputs.get("final_essay", "")
    word_count = len(essay_text.split())
    min_words = example.outputs.get("min_words", 100)
    
    # Calculate word count score (0.0 to 1.0)
    score = 1.0 if word_count >= min_words else round(word_count / min_words, 2)
    
    return {
        "key": "word_count_compliance",
        "score": score,
        "comment": f"Generated {word_count} words (Target minimum: {min_words})"
    }


def llm_judge_evaluator(run, example):
    """LLM-as-a-Judge: Uses Llama 3 on Groq to grade essay quality."""
    topic = example.inputs["topic"]
    essay_text = run.outputs.get("final_essay", "")

    if not essay_text:
        return {"key": "essay_quality_score", "score": 0.0, "comment": "No essay was generated."}

    eval_llm = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0)
    
    prompt = f"""
    You are an expert academic evaluator. Rate the quality of the following essay on a scale from 1 to 5.

    Topic: {topic}
    Essay:
    {essay_text}

    Format your output strictly as valid JSON without extra markdown, like:
    {{"score": 4, "reason": "Clear structure, solid arguments, good grammar."}}
    """
    
    try:
        response = eval_llm.invoke(prompt)
        import json
        clean_content = response.content.strip().replace("```json", "").replace("```", "")
        data = json.loads(clean_content)
        
        # Normalize score to 0.0 - 1.0 range (e.g. score 4/5 -> 0.8)
        score_normalized = data.get("score", 0) / 5.0
        return {
            "key": "llm_quality_score",
            "score": score_normalized,
            "comment": data.get("reason", "")
        }
    except Exception as e:
        return {
            "key": "llm_quality_score",
            "score": 0.0,
            "comment": f"Failed to parse LLM evaluation: {str(e)}"
        }

# ==========================================
# STEP 5: Create Dataset & Run Experiment
# ==========================================
def main():
    client = Client()
    dataset_name = "Essay Writer Benchmark Dataset"

    # 1. Create dataset in LangSmith if it doesn't exist
    if not client.has_dataset(dataset_name=dataset_name):
        print(f"📦 Creating new LangSmith dataset: '{dataset_name}'...")
        dataset = client.create_dataset(
            dataset_name=dataset_name,
            description="Test topics and criteria for Essay Generation graph evaluation."
        )

        test_examples = [
            {
                "inputs": {"topic": "The Role of Artificial Intelligence in Healthcare"},
                "outputs": {"min_words": 150}
            },
            {
                "inputs": {"topic": "Climate Change and Renewable Energy Solutions"},
                "outputs": {"min_words": 150}
            },
            {
                "inputs": {"topic": "The Impact of Social Media on Modern Youth"},
                "outputs": {"min_words": 150}
            }
        ]

        for example in test_examples:
            client.create_example(
                inputs=example["inputs"],
                outputs=example["outputs"],
                dataset_id=dataset.id
            )
        print("✅ Dataset created successfully!")
    else:
        print(f"ℹ️ Found existing dataset: '{dataset_name}'")

    # 2. Run LangSmith evaluation
    print("🚀 Launching LangSmith Evaluation suite...")
    results = evaluate(
        predict_essay,
        data=dataset_name,
        evaluators=[
            length_and_keyword_evaluator,
            llm_judge_evaluator
        ],
        experiment_prefix="essay-graph-test",
        max_concurrency=1
    )
    print("\n🎉 Evaluation complete!")
    print("🔗 View your results on https://smith.langchain.com under Datasets & Testing.")

if __name__ == "__main__":
    main()