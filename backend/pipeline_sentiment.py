"""Sentiment analysis pipeline for unified reviews."""

import json
import time
from pathlib import Path

import pandas as pd

from config import create_openai_client, get_openai_config
from runtime_store import set_latest_sentiment_enriched
from sentiment_prompts import (
    BATCH_CONFIG,
    BatchReviewSentiment,
    ReviewSentiment,
    build_system_prompt,
    build_user_prompt,
)


RESULT_COLUMNS = [
    "review_id",
    "language",
    "overall_sentiment",
    "overall_confidence",
    "aspects_json",
    "aspect_count",
]


def _call_api(client, config: dict, system_prompt: str, user_prompt: str) -> BatchReviewSentiment:
    """Call OpenAI API with structured output and return parsed result."""
    response = client.beta.chat.completions.parse(
        model=config["model"],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=BatchReviewSentiment,
    )
    return response.choices[0].message.parsed


def _flatten_result(result: ReviewSentiment) -> dict:
    """Flatten a ReviewSentiment to a flat dict for DataFrame."""
    return {
        "review_id": result.review_id,
        "language": result.language,
        "overall_sentiment": result.overall_sentiment.value,
        "overall_confidence": result.overall_confidence,
        "aspects_json": json.dumps(
            [
                {
                    "aspect": aspect.aspect.value,
                    "sentiment": aspect.sentiment.value,
                    "evidence": aspect.evidence,
                    "confidence": aspect.confidence,
                }
                for aspect in result.aspects
            ],
            ensure_ascii=False,
        ),
        "aspect_count": len(result.aspects),
    }


def _process_batch(
    client, config: dict, reviews: list[dict], system_prompt: str, batch_num: int
) -> list[dict]:
    """Process a batch of reviews and return flattened results."""
    user_prompt = build_user_prompt(reviews)

    for attempt in range(BATCH_CONFIG["max_retries"]):
        try:
            parsed = _call_api(client, config, system_prompt, user_prompt)

            if len(parsed.reviews) != len(reviews):
                print(
                    f"  Warning: Batch {batch_num} returned {len(parsed.reviews)} results "
                    f"for {len(reviews)} reviews"
                )

            return [_flatten_result(r) for r in parsed.reviews]

        except Exception as e:
            print(f"  Batch {batch_num} attempt {attempt + 1}: Error - {e}")
            if attempt < BATCH_CONFIG["max_retries"] - 1:
                time.sleep(BATCH_CONFIG["retry_wait_seconds"])

    print(f"  Batch {batch_num} failed after {BATCH_CONFIG['max_retries']} attempts")
    return []


def run_sentiment_pipeline(
    unified_reviews_path: Path,
    batch_size: int | None = None,
    max_reviews: int | None = None,
) -> dict:
    """Run sentiment analysis over unified reviews and prepare downloadable enriched output."""
    if not unified_reviews_path.exists():
        raise FileNotFoundError(f"Unified reviews file not found: {unified_reviews_path}")

    if batch_size is None:
        batch_size = BATCH_CONFIG["batch_size"]

    config = get_openai_config(use_azure=True)
    client = create_openai_client(config)
    system_prompt = build_system_prompt()

    provider = "Azure OpenAI" if config.get("use_azure") else "OpenAI"
    model = config.get("model", "unknown")
    print(f"Using {provider} with model: {model}")

    df = pd.read_excel(unified_reviews_path, dtype=str)
    df = df.fillna("")

    if max_reviews is not None:
        df = df.head(max_reviews)

    reviews = df[["review_id", "review_title", "review_text"]].to_dict("records")
    total = len(reviews)
    print(f"Processing {total} reviews in batches of {batch_size}")

    all_results = []
    num_batches = (total + batch_size - 1) // batch_size

    for i in range(0, total, batch_size):
        batch_num = i // batch_size + 1
        batch = reviews[i : i + batch_size]
        print(f"Processing batch {batch_num}/{num_batches} ({len(batch)} reviews)...")

        results = _process_batch(client, config, batch, system_prompt, batch_num)
        all_results.extend(results)

        if batch_num < num_batches:
            time.sleep(BATCH_CONFIG["inter_batch_wait_seconds"])

    results_df = pd.DataFrame(all_results)
    if "review_id" not in results_df.columns:
        results_df = pd.DataFrame(columns=RESULT_COLUMNS)
    else:
        results_df = results_df[[c for c in RESULT_COLUMNS if c in results_df.columns]]

    enriched = df.merge(results_df, on="review_id", how="left")
    set_latest_sentiment_enriched(enriched)

    print("Saved latest sentiment result in memory for download")
    print("\n=== Summary ===")
    print(f"Total reviews: {total}")
    print(f"Processed: {len(results_df)}")
    if "overall_sentiment" in results_df.columns:
        print("\nSentiment distribution:")
        print(results_df["overall_sentiment"].value_counts())

    return {
        "total_reviews": int(total),
        "processed_reviews": int(len(results_df)),
        "download_filename": "sentiment_enriched.xlsx",
        "model": config["model"],
        "use_azure": bool(config["use_azure"]),
    }

