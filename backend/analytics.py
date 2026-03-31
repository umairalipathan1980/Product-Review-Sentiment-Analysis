"""
Analytics module for computing metrics from sentiment_enriched.xlsx.

This module provides functions to:
- Load sentiment-enriched review data
- Extract available filter options for each dimension
- Apply filters to dataframe
- Calculate 6 key analytics: total reviews, avg rating, sentiment %, trends, aspect frequency
"""

import json
from pathlib import Path

import pandas as pd

from runtime_store import get_latest_sentiment_df


def load_sentiment_data():
    """Load sentiment_enriched data from the latest in-memory result or fallback file."""
    return get_latest_sentiment_df()


def get_filter_options(df: pd.DataFrame) -> dict:
    """
    Get available options for each filter dimension.

    Args:
        df: Sentiment-enriched dataframe

    Returns:
        Dictionary mapping dimension names to sorted lists of unique values
    """
    return {
        "country": sorted(df["country"].dropna().unique().tolist()),
        "source": sorted(df["source"].dropna().unique().tolist()),
        "reference_model": sorted(df["reference_model"].dropna().unique().tolist()),
        "product_name": sorted(df["product_name"].dropna().unique().tolist()),
        "generation_family": sorted(df["generation_family"].dropna().unique().tolist()),
        "region": sorted(df["region"].dropna().unique().tolist()),
    }


def apply_filter(df: pd.DataFrame, dimension: str, value: str) -> pd.DataFrame:
    """
    Apply filter to dataframe based on dimension and value.

    Args:
        df: Sentiment-enriched dataframe
        dimension: Filter dimension (country, source, reference_model, etc.)
        value: Specific value to filter by

    Returns:
        Filtered dataframe
    """
    if dimension == "overall":
        return df
    return df[df[dimension] == value]


def calculate_analytics(df: pd.DataFrame) -> dict:
    """
    Calculate all 6 analytics for filtered data:
    1. Total reviews
    2. Average rating
    3. Sentiment percentages (positive/neutral/negative)
    4. Rating trend over time
    5. Sentiment trend over time
    6. Aspect frequency

    Args:
        df: Filtered sentiment-enriched dataframe

    Returns:
        Dictionary with all calculated analytics
    """
    sentiment_counts = df["overall_sentiment"].value_counts()
    total = len(df)
    rating_series = pd.to_numeric(df.get("rating"), errors="coerce")

    return {
        # 1. Total reviews
        "total_reviews": total,
        # 2. Average rating
        "avg_rating": float(rating_series.mean()) if total > 0 and rating_series.notna().any() else 0,
        # 3. Sentiment percentages
        "positive_percent": round(
            float((sentiment_counts.get("positive", 0) / total * 100) if total > 0 else 0), 1
        ),
        "neutral_percent": round(
            float((sentiment_counts.get("neutral", 0) / total * 100) if total > 0 else 0), 1
        ),
        "negative_percent": round(
            float((sentiment_counts.get("negative", 0) / total * 100) if total > 0 else 0), 1
        ),
        # 4. Rating trend over time
        "rating_trend": get_rating_trend(df),
        # 5. Sentiment trend over time
        "sentiment_trend": get_sentiment_trend(df),
        # 6. Aspect frequency
        "aspect_frequency": get_aspect_frequency(df),
    }


def get_rating_trend(df: pd.DataFrame) -> list:
    """
    Calculate average rating by date.

    Args:
        df: Sentiment-enriched dataframe

    Returns:
        List of dicts with:
        - date
        - avg_rating
        - review_count
        - avg_rating_rolling_7d
        - avg_rating_rolling_30d
    """
    if df.empty or "review_date" not in df.columns:
        return []

    df_copy = df.copy()
    df_copy["review_date"] = pd.to_datetime(df_copy["review_date"], errors="coerce")
    df_copy["rating_num"] = pd.to_numeric(df_copy.get("rating"), errors="coerce")
    df_copy = df_copy.dropna(subset=["review_date"])

    if df_copy.empty:
        return []

    trend = (
        df_copy.groupby(df_copy["review_date"].dt.date)
        .agg(
            avg_rating=("rating_num", "mean"),
            review_count=("rating_num", "size"),
        )
        .reset_index()
    )
    trend.columns = ["date", "avg_rating", "review_count"]
    trend = trend.sort_values("date")
    trend["avg_rating"] = trend["avg_rating"].round(2)
    trend["avg_rating_rolling_7d"] = trend["avg_rating"].rolling(window=7, min_periods=1).mean().round(2)
    trend["avg_rating_rolling_30d"] = trend["avg_rating"].rolling(window=30, min_periods=1).mean().round(2)
    trend["date"] = trend["date"].astype(str)
    return trend.to_dict("records")


def get_sentiment_trend(df: pd.DataFrame) -> list:
    """
    Calculate date-wise sentiment mix and rolling positive sentiment.

    Args:
        df: Sentiment-enriched dataframe

    Returns:
        List of dicts with:
        - date
        - positive_percent
        - neutral_percent
        - negative_percent
        - positive_rolling_7d
        - positive_rolling_30d
    """
    if df.empty or "review_date" not in df.columns:
        return []

    df_copy = df.copy()
    df_copy["review_date"] = pd.to_datetime(df_copy["review_date"], errors="coerce")
    df_copy["rating_num"] = pd.to_numeric(df_copy.get("rating"), errors="coerce")
    df_copy = df_copy.dropna(subset=["review_date"])

    if df_copy.empty:
        return []

    df_copy["date"] = df_copy["review_date"].dt.date

    counts = (
        df_copy.groupby(["date", "overall_sentiment"]).size().unstack(fill_value=0).reset_index()
    )
    for label in ["positive", "neutral", "negative"]:
        if label not in counts.columns:
            counts[label] = 0

    counts["total"] = counts[["positive", "neutral", "negative"]].sum(axis=1)
    counts = counts[counts["total"] > 0].copy()
    counts = counts.sort_values("date")

    counts["positive_percent"] = (counts["positive"] / counts["total"] * 100).round(1)
    counts["neutral_percent"] = (counts["neutral"] / counts["total"] * 100).round(1)
    counts["negative_percent"] = (counts["negative"] / counts["total"] * 100).round(1)
    counts["positive_rolling_7d"] = (
        counts["positive_percent"].rolling(window=7, min_periods=1).mean().round(1)
    )
    counts["positive_rolling_30d"] = (
        counts["positive_percent"].rolling(window=30, min_periods=1).mean().round(1)
    )
    counts["date"] = counts["date"].astype(str)

    return counts[
        [
            "date",
            "positive_percent",
            "neutral_percent",
            "negative_percent",
            "positive_rolling_7d",
            "positive_rolling_30d",
        ]
    ].to_dict("records")


def get_aspect_frequency(df: pd.DataFrame) -> list:
    """
    Count mentions of each aspect across all reviews.

    Args:
        df: Sentiment-enriched dataframe

    Returns:
        List of dicts with per-aspect positive/negative counts, sorted by total mentions
    """
    if df.empty or "aspects_json" not in df.columns:
        return []

    aspects = []
    for aspects_str in df["aspects_json"].dropna():
        try:
            parsed = json.loads(aspects_str)
            if isinstance(parsed, list):
                aspects.extend(parsed)
        except (json.JSONDecodeError, TypeError):
            continue

    if not aspects:
        return []

    aspect_df = pd.DataFrame(aspects)
    if "aspect" not in aspect_df.columns:
        return []

    if "sentiment" not in aspect_df.columns:
        return []

    aspect_df["sentiment"] = aspect_df["sentiment"].astype(str).str.lower()

    grouped = (
        aspect_df.groupby("aspect")
        .agg(
            positive_count=("sentiment", lambda s: int((s == "positive").sum())),
            negative_count=("sentiment", lambda s: int((s == "negative").sum())),
            total_count=("sentiment", "size"),
        )
        .reset_index()
    )

    grouped = grouped[grouped["total_count"] > 0].copy()
    grouped["positive_percent"] = (
        (grouped["positive_count"] / grouped["total_count"] * 100).round(1)
    )
    grouped["negative_percent"] = (
        (grouped["negative_count"] / grouped["total_count"] * 100).round(1)
    )
    grouped = grouped.sort_values("total_count", ascending=False)

    return grouped.to_dict("records")


def _normalize_aspect_name(value: str) -> str:
    return str(value).replace("_", " ").title()


def _extract_aspect_rows(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "aspects_json" not in df.columns:
        return pd.DataFrame()

    rows: list[dict] = []
    for _, row in df.iterrows():
        product = row.get("product_name", "")
        source = row.get("source", "")
        country = row.get("country", "")
        aspects_raw = row.get("aspects_json", "")
        if not isinstance(aspects_raw, str) or not aspects_raw.strip():
            continue
        try:
            parsed = json.loads(aspects_raw)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(parsed, list):
            continue
        for item in parsed:
            if not isinstance(item, dict):
                continue
            aspect = item.get("aspect")
            sentiment = str(item.get("sentiment", "")).lower()
            if not aspect:
                continue
            rows.append(
                {
                    "product_name": product,
                    "source": source,
                    "country": country,
                    "aspect": _normalize_aspect_name(aspect),
                    "sentiment": sentiment,
                }
            )

    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)


def _aspect_score_series(aspect_df: pd.DataFrame, aspect_order: list[str], name: str) -> dict:
    if aspect_df.empty:
        return {"name": name, "values": [0.0 for _ in aspect_order]}

    by_aspect = (
        aspect_df.groupby("aspect")
        .agg(
            total=("sentiment", "size"),
            positive=("sentiment", lambda s: int((s == "positive").sum())),
        )
        .reset_index()
    )
    by_aspect["score"] = (by_aspect["positive"] / by_aspect["total"] * 100).round(1)
    score_map = dict(zip(by_aspect["aspect"], by_aspect["score"]))
    return {"name": name, "values": [float(score_map.get(a, 0.0)) for a in aspect_order]}


def get_aspect_benchmark(
    df: pd.DataFrame,
    scope: str = "overall",
    source: str = "all",
    products: list[str] | None = None,
    countries: list[str] | None = None,
    sources: list[str] | None = None,
) -> dict:
    """
    Build aspect benchmark data for radar chart.

    Returns:
        {
          "categories": [aspect...],
          "series": [{"name": "...", "values": [...]}, ...],
          "metric": "positive_percent",
          "scope": "...",
          "source": "...",
          "available_sources": [...],
          "available_products": [...]
        }
    """
    products = products or []
    countries = countries or []
    sources = sources or []
    source = source or "all"

    available_sources = sorted([str(v) for v in df.get("source", pd.Series(dtype=str)).dropna().unique().tolist()])

    filtered = df.copy()
    if source != "all" and "source" in filtered.columns:
        filtered = filtered[filtered["source"] == source]
    available_products = sorted(
        [str(v) for v in filtered.get("product_name", pd.Series(dtype=str)).dropna().unique().tolist()]
    )
    available_countries = sorted(
        [str(v) for v in filtered.get("country", pd.Series(dtype=str)).dropna().unique().tolist()]
    )

    aspect_rows = _extract_aspect_rows(filtered)
    if aspect_rows.empty:
        return {
            "categories": [],
            "series": [],
            "metric": "positive_percent",
            "scope": scope,
            "source": source,
            "available_sources": ["all"] + available_sources,
            "available_products": available_products,
            "available_countries": available_countries,
        }

    aspect_order = (
        aspect_rows["aspect"]
        .value_counts()
        .head(10)
        .index.astype(str)
        .tolist()
    )

    if scope == "product":
        selected_products = [p for p in products if p in available_products]
        if not selected_products:
            return {
                "categories": [],
                "series": [],
                "metric": "positive_percent",
                "scope": scope,
                "source": source,
                "available_sources": ["all"] + available_sources,
                "available_products": available_products,
                "available_countries": available_countries,
            }
        series = []
        for product_name in selected_products:
            product_rows = aspect_rows[aspect_rows["product_name"] == product_name]
            series.append(_aspect_score_series(product_rows, aspect_order, product_name))
    elif scope == "country":
        selected_countries = [c for c in countries if c in available_countries]
        if not selected_countries:
            return {
                "categories": [],
                "series": [],
                "metric": "positive_percent",
                "scope": scope,
                "source": source,
                "available_sources": ["all"] + available_sources,
                "available_products": available_products,
                "available_countries": available_countries,
            }
        series = []
        for country_name in selected_countries:
            country_rows = aspect_rows[aspect_rows["country"] == country_name]
            series.append(_aspect_score_series(country_rows, aspect_order, country_name))
    elif scope == "source":
        selected_sources = [s for s in sources if s in available_sources]
        if not selected_sources:
            return {
                "categories": [],
                "series": [],
                "metric": "positive_percent",
                "scope": scope,
                "source": source,
                "available_sources": ["all"] + available_sources,
                "available_products": available_products,
                "available_countries": available_countries,
            }
        series = []
        for source_name in selected_sources:
            source_rows = aspect_rows[aspect_rows["source"] == source_name]
            series.append(_aspect_score_series(source_rows, aspect_order, source_name))
    else:
        series = [_aspect_score_series(aspect_rows, aspect_order, "Overall")]

    return {
        "categories": aspect_order,
        "series": series,
        "metric": "positive_percent",
        "scope": scope,
        "source": source,
        "available_sources": ["all"] + available_sources,
        "available_products": available_products,
        "available_countries": available_countries,
    }


