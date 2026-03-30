"""
Filter-based sentiment summary generation and caching.
"""
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from pydantic import BaseModel

from config import create_openai_client, get_openai_config


ROOT = Path(__file__).resolve().parents[1]
CACHE_FILE = ROOT / "input" / "product_summaries.json"
REVIEW_COUNT_THRESHOLD = 8000
MAX_ASPECTS_PER_GROUP = 5
MAX_QUOTES_PER_ASPECT = 3
SUMMARY_DIMENSION_LABELS = {
    "overall": "Overall",
    "country": "Country",
    "source": "Source",
    "reference_model": "Model",
    "product_name": "Product",
    "generation_family": "Generation",
    "region": "Region",
}


class ProductSummaryOutput(BaseModel):
    positive_summary: str
    negative_summary: str
    improvements: str


def load_cache() -> Dict:
    """Load the summary cache file."""
    if not CACHE_FILE.exists():
        return {}

    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception as exc:
        print(f"Warning: Could not load cache: {exc}")
        return {}


def save_cache(cache: Dict) -> None:
    """Save the summary cache file."""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as handle:
        json.dump(cache, handle, indent=2, ensure_ascii=False)


def _is_summary_payload(value: object) -> bool:
    return isinstance(value, dict) and {
        "generated_at",
        "review_count",
        "positive_summary",
        "negative_summary",
        "improvements",
    }.issubset(value.keys())


def get_dimension_label(dimension: str) -> str:
    return SUMMARY_DIMENSION_LABELS.get(dimension, dimension.replace("_", " ").title())


def get_cached_summary(dimension: str, value: str) -> Optional[Dict]:
    """Get cached summary for a given filter dimension and value."""
    cache = load_cache()

    dimension_cache = cache.get(dimension)
    if isinstance(dimension_cache, dict):
        cached = dimension_cache.get(value)
        if _is_summary_payload(cached):
            return cached

    # Backward compatibility for legacy product-only cache shape.
    if dimension == "product_name":
        legacy = cache.get(value)
        if _is_summary_payload(legacy):
            return legacy

    return None


def aggregate_aspects_from_reviews(df: pd.DataFrame) -> Dict[str, Dict[str, List[str]]]:
    """Aggregate aspect evidence grouped by review-level overall sentiment."""
    aggregated = {
        "positive": defaultdict(list),
        "negative": defaultdict(list),
        "neutral": defaultdict(list),
    }

    for _, row in df.iterrows():
        overall_sentiment = row.get("overall_sentiment", "neutral")
        aspects_json = row.get("aspects_json")

        if pd.isna(aspects_json) or not aspects_json:
            continue

        try:
            aspects = json.loads(aspects_json)
        except json.JSONDecodeError:
            continue

        for aspect_obj in aspects:
            aspect_name = aspect_obj.get("aspect", "UNKNOWN")
            evidence = aspect_obj.get("evidence", "")
            if not evidence:
                continue

            sentiment_key = overall_sentiment if overall_sentiment in aggregated else "neutral"
            aggregated[sentiment_key][aspect_name].append(evidence)

    return aggregated


def cap_aggregated_data(
    aggregated: Dict[str, Dict[str, List[str]]],
    review_count: int,
) -> Dict[str, Dict[str, List[str]]]:
    """Cap prompt payload size for large review groups."""
    if review_count <= REVIEW_COUNT_THRESHOLD:
        return aggregated

    capped: Dict[str, Dict[str, List[str]]] = {}
    for sentiment, aspects_dict in aggregated.items():
        sorted_aspects = sorted(aspects_dict.items(), key=lambda item: len(item[1]), reverse=True)
        top_aspects = sorted_aspects[:MAX_ASPECTS_PER_GROUP]
        capped[sentiment] = {
            aspect: quotes[:MAX_QUOTES_PER_ASPECT]
            for aspect, quotes in top_aspects
        }
    return capped


def build_summary_prompt(
    dimension: str,
    value: str,
    review_count: int,
    aggregated: Dict[str, Dict[str, List[str]]],
) -> str:
    """Build the prompt for LLM summary generation."""
    label = get_dimension_label(dimension)
    lines = [
        f"Segment: {label} = {value}",
        f"Review count: {review_count}",
        "",
    ]

    positive_data = aggregated.get("positive", {})
    if positive_data:
        pos_count = sum(len(quotes) for quotes in positive_data.values())
        lines.append(f"Positive reviews ({pos_count} aspect mentions):")
        for aspect, quotes in sorted(positive_data.items(), key=lambda item: len(item[1]), reverse=True):
            quote_str = ", ".join(f'"{quote}"' for quote in quotes[:5])
            lines.append(f"  {aspect} ({len(quotes)} mentions): {quote_str}")
        lines.append("")

    negative_data = aggregated.get("negative", {})
    if negative_data:
        neg_count = sum(len(quotes) for quotes in negative_data.values())
        lines.append(f"Negative reviews ({neg_count} aspect mentions):")
        for aspect, quotes in sorted(negative_data.items(), key=lambda item: len(item[1]), reverse=True):
            quote_str = ", ".join(f'"{quote}"' for quote in quotes[:5])
            lines.append(f"  {aspect} ({len(quotes)} mentions): {quote_str}")
        lines.append("")

    neutral_data = aggregated.get("neutral", {})
    if neutral_data:
        neu_count = sum(len(quotes) for quotes in neutral_data.values())
        lines.append(f"Neutral/Mixed reviews ({neu_count} aspect mentions):")
        for aspect, quotes in sorted(neutral_data.items(), key=lambda item: len(item[1]), reverse=True):
            quote_str = ", ".join(f'"{quote}"' for quote in quotes[:5])
            lines.append(f"  {aspect} ({len(quotes)} mentions): {quote_str}")
        lines.append("")

    lines.append("Write all summaries in English only, regardless of the original review language or the selected region/source.")
    lines.append("")
    lines.append("Based on the aspect mentions and customer quotes above, write 3 concise summaries (2-3 sentences each):")
    lines.append(f"1. Positive summary: What customers consistently appreciate for this {label.lower()} segment")
    lines.append("2. Negative summary: Main complaints and recurring issues")
    lines.append("3. Improvements: Key areas to address based on negative and mixed feedback")

    return "\n".join(lines)


def call_llm_for_summary(prompt: str, use_azure: bool = True) -> ProductSummaryOutput:
    """Call OpenAI API to generate the summary."""
    config = get_openai_config(use_azure=use_azure)
    client = create_openai_client(config)

    system_prompt = (
        "You are a product insights analyst. Generate concise, actionable summaries "
        "based on customer review data. Focus on the most important patterns and themes. "
        "Always write the final summaries in English, regardless of the review language, country, or region."
    )

    response = client.beta.chat.completions.parse(
        model=config["model"],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        response_format=ProductSummaryOutput,
    )

    return response.choices[0].message.parsed


def generate_group_summary(dimension: str, value: str, df: pd.DataFrame, use_azure: bool = True) -> Dict:
    """Generate a fresh summary for a filtered review segment using the LLM."""
    review_count = len(df)
    aggregated = aggregate_aspects_from_reviews(df)
    aggregated = cap_aggregated_data(aggregated, review_count)
    prompt = build_summary_prompt(dimension, value, review_count, aggregated)

    print(f"Generating summary for {dimension}='{value}' ({review_count} reviews)...")
    summary_output = call_llm_for_summary(prompt, use_azure=use_azure)

    result = {
        "generated_at": datetime.now().isoformat(),
        "dimension": dimension,
        "dimension_label": get_dimension_label(dimension),
        "value": value,
        "review_count": review_count,
        "positive_summary": summary_output.positive_summary,
        "negative_summary": summary_output.negative_summary,
        "improvements": summary_output.improvements,
    }

    cache = load_cache()
    cache.setdefault(dimension, {})[value] = result
    save_cache(cache)

    print(f"Summary generated and cached for {dimension}='{value}'")
    return result


def generate_product_summary(product_name: str, df: pd.DataFrame, use_azure: bool = True) -> Dict:
    """Backward-compatible wrapper for the legacy product summary call path."""
    return generate_group_summary("product_name", product_name, df, use_azure=use_azure)





