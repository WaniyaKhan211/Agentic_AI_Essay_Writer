import base64
import io
import re

from huggingface_hub import InferenceClient
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from config import HF_API_KEY, HF_MODEL, GROQ_API_KEY, GROQ_MODEL, TEMPERATURE
from prompts.image_prompt import IMAGE_PROMPT_SYSTEM

MAX_IMAGES = 4

# LLM used to WRITE the image prompt (separate job from essay writing/judging)
_prompt_llm = ChatGroq(
    api_key=GROQ_API_KEY,
    model=GROQ_MODEL,
    temperature=TEMPERATURE,
)

# --- Guardrail keyword lists -------------------------------------------------

RELIGIOUS_KEYWORDS = [
    "islam", "muslim", "quran", "koran", "prophet", "muhammad", "allah",
    "hadith", "mosque", "jesus", "christ", "christian", "bible", "church",
    "hindu", "krishna", "buddha", "buddhist", "sikh", "guru granth",
    "judaism", "torah", "rabbi", "synagogue",
]

UNSAFE_KEYWORDS = [
    "blood", "corpse", "torture", "weapon", "gun", "knife", "suicide",
    "self-harm", "explicit",
]

_client = InferenceClient(model=HF_MODEL, token=HF_API_KEY)


def _is_sensitive_topic(text: str) -> bool:
    lowered = text.lower()
    return any(word in lowered for word in RELIGIOUS_KEYWORDS)


def _sanitize(text: str) -> str:
    """Strip any explicit/unsafe words before they ever reach the prompt."""
    cleaned = text
    for word in UNSAFE_KEYWORDS:
        cleaned = re.sub(word, "", cleaned, flags=re.IGNORECASE)
    return cleaned


def _strip_markdown(text: str) -> str:
    text = re.sub(r"[*_`#>\[\]()]", "", text or "")
    return " ".join(text.split())


def _flatten_sentences(essay_data: dict) -> list[dict]:
   
    units = []
    for section in essay_data.get("sections", []):
        heading = section.get("heading", "Section")
        body = section.get("body", "") or ""
        # crude sentence split; keeps markdown (e.g. **bold**) intact so
        # key-concept extraction still works per chunk later
        sentences = re.split(r"(?<=[.!?])\s+", body.strip())
        for sentence in sentences:
            if sentence.strip():
                units.append({"heading": heading, "sentence": sentence})
    return units


def _build_parts(essay_data: dict, target: int = MAX_IMAGES) -> list[dict]:
   
    units = _flatten_sentences(essay_data)

    if not units:
        return [{"heading": essay_data.get("title", "Essay"), "text": ""}]

    n = len(units)
    groups = min(target, n)  # can't make more parts than sentences exist

    
    base, remainder = divmod(n, groups)
    sizes = [base + 1] * remainder + [base] * (groups - remainder)

    parts = []
    i = 0
    for size in sizes:
        chunk = units[i:i + size]
        i += size
        headings = [u["heading"] for u in chunk]
        heading = max(set(headings), key=headings.count)  # dominant heading in this chunk
        text = " ".join(u["sentence"] for u in chunk)
        parts.append({"heading": heading, "text": text})

    return parts


def _extract_key_concepts(text: str, limit: int = 6) -> list[str]:
    
    bolded = re.findall(r"\*\*(.+?)\*\*", text or "")
    seen = []
    for term in bolded:
        term = term.strip()
        if term and term.lower() not in [s.lower() for s in seen]:
            seen.append(term)
        if len(seen) >= limit:
            break
    return seen


def _generate_prompt_with_llm(part: dict, topic: str, sensitive: bool) -> str:
    
    heading = _sanitize(part["heading"])
    plain_text = _sanitize(_strip_markdown(part["text"]))
    key_concepts = _extract_key_concepts(part["text"])
    snippet = plain_text[:300] if not key_concepts else plain_text[:200]

    concepts_line = (
        f"Key concepts this section explains: {', '.join(key_concepts)}."
        if key_concepts else ""
    )

    user_message = f"""
Essay Topic: {topic}

Section Heading: {heading}

{concepts_line}

Section Description:
{snippet}

Sensitive topic (religious/cultural): {"YES — no human faces or religious figures at all" if sensitive else "no"}

Write the single image-generation prompt for this section now.
"""

    last_error = None
    for attempt in range(1, 3):
        try:
            response = _prompt_llm.invoke([
                SystemMessage(content=IMAGE_PROMPT_SYSTEM),
                HumanMessage(content=user_message),
            ])
            generated_prompt = response.content.strip()
            if generated_prompt:
                return generated_prompt
        except Exception as e:
            last_error = e
            print(f"[image prompt llm] attempt {attempt} failed: {e}")

    # Fallback so a flaky LLM call never kills image generation entirely.
    print(f"[image prompt llm] giving up, using plain fallback prompt. Last error: {last_error}")
    fallback = (
        f"Photorealistic, museum-quality educational illustration about "
        f"{topic}, focused on: {heading}. {concepts_line} "
        "No text, no watermark, no logo, no human faces."
    )
    return fallback

def _blur_faces(image_bytes: bytes) -> bytes:
    """Detect and blur any faces in the image (religious-content guardrail)."""
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)

        for (x, y, w, h) in faces:
            roi = img[y:y + h, x:x + w]
            blurred = cv2.GaussianBlur(roi, (51, 51), 30)
            img[y:y + h, x:x + w] = blurred

        success, buf = cv2.imencode(".png", img)
        return buf.tobytes() if success else image_bytes

    except Exception as e:
        print("Face-blur guardrail skipped:", e)
        return image_bytes


def _image_to_data_uri(image, sensitive: bool) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    image_bytes = buf.getvalue()

    if sensitive:
        image_bytes = _blur_faces(image_bytes)

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


NEGATIVE_PROMPT = (
    "cartoon, anime, comic, manga, illustration, painting, drawing, sketch, "
    "vector art, clipart, flat design, low poly, toy, plastic, CGI cartoon, "
    "unrealistic proportions, childish, fantasy, stylized, blurry, "
    "low quality, low resolution, pixelated, distorted, duplicate, "
    "watermark, logo, signature, text, letters, words, numbers, "
    "foreign characters, chinese characters, japanese characters, "
    "korean characters, arabic text, gibberish text"
)

IMAGE_MAX_RETRIES = 2  # retries per section, in addition to the first attempt


def _build_benefit(part: dict, key_concepts: list[str]) -> str:
    """
    A short, honest, human-readable note on what this illustration is for —
    shown to the user instead of the old redundant "Illustration for: X" caption.
    """
    if key_concepts:
        return (
            f"Visualizes {', '.join(key_concepts[:3])} from “{part['heading']}” "
            "to help you picture the idea rather than just read it."
        )
    return f"A visual companion to the “{part['heading']}” section."


def generate_images(topic: str, essay_data: dict) -> list[dict]:
    if not HF_API_KEY:
        print("HF_API_KEY missing — skipping image generation.")
        return []

    sensitive = _is_sensitive_topic(topic) or _is_sensitive_topic(
        essay_data.get("title", "")
    )

    parts = _build_parts(essay_data)

    results = []

    for part in parts:
        prompt = _generate_prompt_with_llm(part, topic, sensitive)
        key_concepts = _extract_key_concepts(part["text"])

        image = None
        last_error = None

        for attempt in range(1, IMAGE_MAX_RETRIES + 2):
            try:
                image = _client.text_to_image(
                    prompt,
                    model=HF_MODEL,
                    negative_prompt=NEGATIVE_PROMPT,
                )
                break
            except Exception as e:
                last_error = e
                print(
                    f"Image generation attempt {attempt} failed for "
                    f"'{part['heading']}':", e
                )

        if image is None:
            # Every retry failed for this one section — log it clearly so it's
            # visible *why* the final count is short, instead of failing silently.
            print(
                f"Giving up on image for '{part['heading']}' after "
                f"{IMAGE_MAX_RETRIES + 1} attempts. Last error: {last_error}"
            )
            continue

        data_uri = _image_to_data_uri(image, sensitive)

        results.append({
            "title": part["heading"],
            "caption": _build_benefit(part, key_concepts),
            "image": data_uri,
        })

    if len(results) < len(parts):
        print(
            f"Image generation produced {len(results)}/{len(parts)} images "
            "— see attempt logs above for which section(s) failed."
        )

    return results