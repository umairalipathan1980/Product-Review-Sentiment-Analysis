"""Prompts, constants, and Pydantic models for sentiment analysis."""

from enum import Enum

from pydantic import BaseModel, Field


class AspectType(str, Enum):
    """Valid aspect types for sentiment analysis."""

    SOUND_QUALITY = "SOUND_QUALITY"
    NOISE_CANCELLATION = "NOISE_CANCELLATION"
    COMFORT_FIT = "COMFORT_FIT"
    BATTERY_LIFE = "BATTERY_LIFE"
    BUILD_DURABILITY = "BUILD_DURABILITY"
    CONNECTIVITY = "CONNECTIVITY"
    MICROPHONE_QUALITY = "MICROPHONE_QUALITY"
    USE_CASE = "USE_CASE"
    PRICE_VALUE = "PRICE_VALUE"
    BRAND_TRUST = "BRAND_TRUST"


class SentimentLabel(str, Enum):
    """Valid sentiment labels."""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    MIXED = "mixed"


class AspectSentimentLabel(str, Enum):
    """Valid sentiment labels for individual aspects."""

    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"


class AspectSentiment(BaseModel):
    """Sentiment analysis for a single aspect."""

    aspect: AspectType = Field(description="The aspect category from taxonomy")
    sentiment: AspectSentimentLabel = Field(description="Sentiment for this aspect")
    evidence: str = Field(description="Direct quote from review text")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0.0-1.0")


class ReviewSentiment(BaseModel):
    """Sentiment analysis result for a single review."""

    review_id: str = Field(description="Review ID from input")
    language: str = Field(description="ISO 639-1 language code (en, de, fr, etc.)")
    overall_sentiment: SentimentLabel = Field(description="Overall sentiment label")
    overall_confidence: float = Field(ge=0.0, le=1.0, description="Confidence 0.0-1.0")
    aspects: list[AspectSentiment] = Field(
        default_factory=list, description="List of aspect-level sentiments"
    )


class BatchReviewSentiment(BaseModel):
    """Container for batch of review sentiment results."""

    reviews: list[ReviewSentiment] = Field(description="List of review results")


ASPECT_DESCRIPTIONS = {
    AspectType.SOUND_QUALITY: "General audio performance, bass, treble, clarity, soundstage",
    AspectType.NOISE_CANCELLATION: "Active noise cancellation effectiveness, ambient noise blocking, transparency mode",
    AspectType.COMFORT_FIT: "Wearing comfort, ear cup pressure, fit stability, long-session fatigue",
    AspectType.BATTERY_LIFE: "Battery duration, charging speed, standby drain, battery longevity over time",
    AspectType.BUILD_DURABILITY: "Construction, materials, hinge strength, durability, craftsmanship",
    AspectType.CONNECTIVITY: "Bluetooth stability, pairing speed, multipoint, range, audio dropouts",
    AspectType.MICROPHONE_QUALITY: "Call clarity, voice pickup, background noise rejection, video call performance",
    AspectType.USE_CASE: "Specific use cases mentioned (commuting, gym, travel, gaming, etc.)",
    AspectType.PRICE_VALUE: "Price, value for money, worth the cost",
    AspectType.BRAND_TRUST: "Brand reputation, SonicWave quality expectations",
}

BATCH_CONFIG = {
    "batch_size": 300,
    "max_retries": 3,
    "retry_wait_seconds": 5,
    "inter_batch_wait_seconds": 1,
}

SYSTEM_PROMPT = """You are a product review sentiment analyst specializing in consumer audio products and headphones.

## Task
Analyze product reviews and extract:
1. Overall sentiment (positive/negative/neutral/mixed)
2. Aspect-level sentiment with evidence (direct quotes)

## Aspect Taxonomy (CLOSED SET - use ONLY these)
{aspect_list}

## Rules (MUST FOLLOW)
1. Do not invent aspects outside the taxonomy
2. Do not paraphrase evidence - quote directly from the review text
3. Do not assign an aspect without evidence
4. Prefer fewer, high-confidence aspects over many weak ones
5. Use mixed only for overall_sentiment

## Language Handling
- Analyze reviews in their original language
- Return evidence quotes in the original language
- Detect and report the language code (en, de, fr, es, it, nl, etc.)
"""

USER_PROMPT_TEMPLATE = """Analyze the following {count} product reviews for consumer audio products/headphones.

Return exactly {count} review results in the same order as provided.

Reviews:
{reviews}
"""


def build_system_prompt() -> str:
    """Build the system prompt with aspect taxonomy."""
    aspect_list = "\n".join(
        f"- {aspect.value}: {ASPECT_DESCRIPTIONS[aspect]}" for aspect in AspectType
    )
    return SYSTEM_PROMPT.format(aspect_list=aspect_list)


def build_user_prompt(reviews: list[dict]) -> str:
    """Build user prompt for a batch of reviews."""
    review_texts = []
    for review in reviews:
        title = review.get("review_title") or ""
        text = review.get("review_text") or ""
        review_id = review.get("review_id", "")
        combined = f"[ID: {review_id}]\nTitle: {title}\nText: {text}"
        review_texts.append(combined)

    reviews_block = "\n\n---\n\n".join(review_texts)
    return USER_PROMPT_TEMPLATE.format(count=len(reviews), reviews=reviews_block)
