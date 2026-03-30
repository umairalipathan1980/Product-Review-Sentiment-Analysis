"""Data QA agent - tool implementations and OpenAI Agents SDK runner."""

from __future__ import annotations

import ast
import asyncio
import contextlib
import io
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from openai import AsyncAzureOpenAI, AsyncOpenAI

from config import get_openai_config
from runtime_store import get_latest_sentiment_cache_key, get_latest_sentiment_df, get_latest_sentiment_path

try:
    from agents import Agent, ModelSettings, OpenAIProvider, RunConfig, Runner, function_tool
except Exception as exc:  # pragma: no cover
    Agent = None
    ModelSettings = None
    OpenAIProvider = None
    RunConfig = None
    Runner = None
    function_tool = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None

ROOT = Path(__file__).resolve().parents[1]
SENTIMENT_FILE = ROOT / "input" / "sentiment_enriched.xlsx"

ALLOWED_FIELDS = [
    "source",
    "product_code",
    "product_name",
    "reference_model",
    "generation_family",
    "region",
    "country",
    "language",
    "rating",
    "overall_sentiment",
    "overall_confidence",
    "review_type",
    "review_date",
    "aspect",
]

GROUPABLE_FIELDS = [
    "source",
    "product_code",
    "product_name",
    "reference_model",
    "generation_family",
    "region",
    "country",
    "language",
    "overall_sentiment",
    "review_type",
]

METRICS = [
    "review_count",
    "avg_rating",
    "avg_confidence",
    "positive_rate",
    "neutral_rate",
    "negative_rate",
]

DEFAULT_ROW_COLUMNS = [
    "review_id",
    "source",
    "product_code",
    "product_name",
    "country",
    "language",
    "rating",
    "overall_sentiment",
    "overall_confidence",
    "review_date",
    "review_text",
]

_SAFE_BUILTINS = {
    "abs": abs, "all": all, "any": any, "bool": bool, "chr": chr,
    "dict": dict, "enumerate": enumerate, "filter": filter, "float": float,
    "format": format, "frozenset": frozenset, "int": int,
    "isinstance": isinstance, "iter": iter, "len": len, "list": list,
    "map": map, "max": max, "min": min, "next": next, "print": print,
    "range": range, "repr": repr, "reversed": reversed, "round": round,
    "set": set, "slice": slice, "sorted": sorted, "str": str, "sum": sum,
    "tuple": tuple, "type": type, "zip": zip,
    "True": True, "False": False, "None": None,
}
_FORBIDDEN_CALLS = {"eval", "exec", "open", "compile", "__import__"}
_FORBIDDEN_MODULES = {
    "os", "sys", "subprocess", "shutil", "pathlib", "socket",
    "urllib", "requests", "http", "pickle", "importlib",
}
_TEXT_STOP_WORDS = {
    "this", "that", "with", "have", "from", "they", "will", "been", "were",
    "their", "what", "when", "there", "which", "your", "more", "very", "just",
    "also", "than", "then", "some", "would", "about", "product", "review",
    "item",
}


@dataclass
class AgentResult:
    answer: str
    plan: dict[str, Any]
    evidence: dict[str, Any]
    columns: list[str]
    rows: list[dict[str, Any]]


_cache_df: pd.DataFrame | None = None
_cache_key: str | None = None


def _normalize_source(value: Any) -> str:
    text = str(value or "").strip().lower()
    if text in {"amazon", "amz"}:
        return "amazon"
    if text in {"direct", "direct_source"}:
        return "direct"
    return text


def _safe_json_loads(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return value
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _load_dataframe() -> pd.DataFrame:
    global _cache_df, _cache_key

    cache_key = get_latest_sentiment_cache_key()
    if cache_key == "missing":
        raise FileNotFoundError(f"Sentiment file not found: {SENTIMENT_FILE}")

    if _cache_df is not None and _cache_key == cache_key:
        return _cache_df.copy()

    df = get_latest_sentiment_df().fillna("")

    if "source" in df.columns:
        df["source"] = df["source"].map(_normalize_source)
    if "rating" in df.columns:
        df["_rating_num"] = pd.to_numeric(df["rating"], errors="coerce")
    else:
        df["_rating_num"] = pd.Series(dtype="float64")
    if "overall_confidence" in df.columns:
        df["_confidence_num"] = pd.to_numeric(df["overall_confidence"], errors="coerce")
    else:
        df["_confidence_num"] = pd.Series(dtype="float64")
    if "review_date" in df.columns:
        df["_review_date"] = pd.to_datetime(df["review_date"], errors="coerce", utc=False)
    else:
        df["_review_date"] = pd.Series(dtype="datetime64[ns]")

    if "aspects_json" in df.columns:
        parsed = df["aspects_json"].map(_safe_json_loads)
        df["_aspect_list"] = parsed
        df["_aspect_names"] = parsed.map(
            lambda items: [str(item.get("aspect", "")).strip().lower() for item in items if isinstance(item, dict)]
        )
    else:
        df["_aspect_list"] = [[] for _ in range(len(df))]
        df["_aspect_names"] = [[] for _ in range(len(df))]

    _cache_df = df
    _cache_key = cache_key
    return df.copy()


def _normalize_aspect_name(aspect: str) -> str:
    """Normalize aspect name: convert spaces to underscores and make uppercase."""
    if not aspect:
        return ""
    return str(aspect).strip().replace(" ", "_").upper()


def _filter_df(df: pd.DataFrame, filters: list[dict[str, Any]]) -> pd.DataFrame:
    filtered = df
    for flt in filters or []:
        field = str(flt.get("field", "")).strip()
        op = str(flt.get("op", "eq")).strip().lower()
        value = flt.get("value")

        if field not in ALLOWED_FIELDS:
            continue

        if field == "rating":
            series = filtered["_rating_num"]
        elif field == "overall_confidence":
            series = filtered["_confidence_num"]
        elif field == "review_date":
            series = filtered["_review_date"]
        elif field == "aspect":
            values = value if isinstance(value, list) else [value]
            # Normalize aspect names: convert spaces to underscores, uppercase, then lowercase for matching
            targets = [_normalize_aspect_name(v).lower() for v in values if str(v).strip()]
            if not targets:
                continue
            if op in {"eq", "contains", "in"}:
                filtered = filtered[filtered["_aspect_names"].map(lambda items: any(t in items for t in targets))]
            elif op == "neq":
                filtered = filtered[~filtered["_aspect_names"].map(lambda items: any(t in items for t in targets))]
            continue
        else:
            if field not in filtered.columns:
                continue
            series = filtered[field]

        if op == "eq":
            filtered = filtered[series.astype(str).str.lower() == str(value).lower()]
        elif op == "neq":
            filtered = filtered[series.astype(str).str.lower() != str(value).lower()]
        elif op == "contains":
            filtered = filtered[series.astype(str).str.lower().str.contains(str(value).lower(), na=False)]
        elif op == "in":
            values = value if isinstance(value, list) else [value]
            targets = {str(v).lower() for v in values}
            filtered = filtered[series.astype(str).str.lower().isin(targets)]
        elif op == "gte":
            if field == "review_date":
                filtered = filtered[series >= pd.to_datetime(value, errors="coerce")]
            else:
                filtered = filtered[series >= pd.to_numeric(value, errors="coerce")]
        elif op == "lte":
            if field == "review_date":
                filtered = filtered[series <= pd.to_datetime(value, errors="coerce")]
            else:
                filtered = filtered[series <= pd.to_numeric(value, errors="coerce")]
        elif op == "between":
            if isinstance(value, list) and len(value) == 2:
                left, right = value[0], value[1]
                if field == "review_date":
                    left_date = pd.to_datetime(left, errors="coerce")
                    right_date = pd.to_datetime(right, errors="coerce")
                    filtered = filtered[(series >= left_date) & (series <= right_date)]
                else:
                    left_num = pd.to_numeric(left, errors="coerce")
                    right_num = pd.to_numeric(right, errors="coerce")
                    filtered = filtered[(series >= left_num) & (series <= right_num)]
    return filtered


def _metric_value(df: pd.DataFrame, metric: str) -> float | int:
    if metric == "review_count":
        return int(len(df))
    if metric == "avg_rating":
        return float(df["_rating_num"].mean()) if len(df) else 0.0
    if metric == "avg_confidence":
        return float(df["_confidence_num"].mean()) if len(df) else 0.0
    if metric == "positive_rate":
        return float((df["overall_sentiment"].astype(str).str.lower() == "positive").mean() * 100) if len(df) else 0.0
    if metric == "neutral_rate":
        return float((df["overall_sentiment"].astype(str).str.lower() == "neutral").mean() * 100) if len(df) else 0.0
    if metric == "negative_rate":
        return float((df["overall_sentiment"].astype(str).str.lower() == "negative").mean() * 100) if len(df) else 0.0
    return 0.0


def _tool_get_schema(df: pd.DataFrame) -> dict[str, Any]:
    options: dict[str, list[str]] = {}
    for field in ["source", "product_code", "product_name", "country", "language", "overall_sentiment", "review_type"]:
        if field in df.columns:
            values = [str(v) for v in sorted(df[field].dropna().astype(str).unique()) if str(v).strip()]
            options[field] = values[:200]
    return {
        "table": "sentiment_enriched.xlsx",
        "row_count": int(len(df)),
        "fields": ALLOWED_FIELDS,
        "groupable_fields": GROUPABLE_FIELDS,
        "metrics": METRICS,
        "sample_filter_values": options,
    }


def _tool_aggregate_reviews(
    df: pd.DataFrame,
    filters: list[dict[str, Any]] | None = None,
    group_by: list[str] | None = None,
    metrics: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    limit: int = 20,
) -> dict[str, Any]:
    metrics = [m for m in (metrics or ["review_count"]) if m in METRICS] or ["review_count"]
    group_by = [g for g in (group_by or []) if g in GROUPABLE_FIELDS and g in df.columns][:2]
    limit = max(1, min(int(limit or 20), 100))

    filtered = _filter_df(df, filters or [])
    total = int(len(filtered))

    if not group_by:
        row = {m: _metric_value(filtered, m) for m in metrics}
        return {"total_matching_rows": total, "columns": list(row.keys()), "rows": [row]}

    grouped_rows: list[dict[str, Any]] = []
    for keys, grp in filtered.groupby(group_by, dropna=False):
        keys_tuple = keys if isinstance(keys, tuple) else (keys,)
        row = {group_by[idx]: keys_tuple[idx] for idx in range(len(group_by))}
        for m in metrics:
            row[m] = _metric_value(grp, m)
        grouped_rows.append(row)

    if grouped_rows:
        sort_target = sort_by if sort_by in grouped_rows[0] else metrics[0]
        reverse = str(sort_order).lower() != "asc"
        grouped_rows = sorted(grouped_rows, key=lambda item: item.get(sort_target, 0), reverse=reverse)
        grouped_rows = grouped_rows[:limit]
        cols = list(grouped_rows[0].keys())
    else:
        cols = group_by + metrics

    return {"total_matching_rows": total, "columns": cols, "rows": grouped_rows}


def _tool_find_reviews(
    df: pd.DataFrame,
    filters: list[dict[str, Any]] | None = None,
    row_columns: list[str] | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    limit: int = 10,
) -> dict[str, Any]:
    limit = max(1, min(int(limit or 10), 50))
    filtered = _filter_df(df, filters or [])
    total = int(len(filtered))

    cols = [c for c in (row_columns or DEFAULT_ROW_COLUMNS) if c in filtered.columns]
    if not cols:
        cols = [c for c in DEFAULT_ROW_COLUMNS if c in filtered.columns]

    working = filtered
    if sort_by and sort_by in working.columns:
        asc = str(sort_order).lower() == "asc"
        working = working.sort_values(by=sort_by, ascending=asc, na_position="last")

    sample = working.head(limit)[cols].copy()
    for c in sample.columns:
        if c == "review_date":
            sample[c] = pd.to_datetime(sample[c], errors="coerce").dt.strftime("%Y-%m-%d").fillna("")
        else:
            sample[c] = sample[c].astype(str)

    return {"total_matching_rows": total, "columns": cols, "rows": sample.to_dict(orient="records")}


def _tool_get_time_trends(
    df: pd.DataFrame,
    metric: str,
    period: str = "month",
    filters: list[dict[str, Any]] | None = None,
    aspect_name: str | None = None,
) -> dict[str, Any]:
    """Analyze how metrics change over time."""
    working = _filter_df(df, filters or [])

    if "_review_date" not in working.columns or working["_review_date"].isna().all():
        return {"error": "No valid review dates available"}

    working = working[working["_review_date"].notna()].copy()

    if aspect_name:
        # Normalize aspect name: convert spaces to underscores, then lowercase for matching
        aspect_lower = _normalize_aspect_name(aspect_name).lower()
        working = working[working["_aspect_names"].map(lambda items: aspect_lower in items)]

    # Group by time period
    if period == "month":
        working["_period"] = working["_review_date"].dt.to_period("M").astype(str)
    elif period == "quarter":
        working["_period"] = working["_review_date"].dt.to_period("Q").astype(str)
    elif period == "year":
        working["_period"] = working["_review_date"].dt.to_period("Y").astype(str)
    else:
        working["_period"] = working["_review_date"].dt.date.astype(str)

    rows = []
    for period_val, grp in working.groupby("_period"):
        row = {"period": str(period_val), "review_count": len(grp)}

        if metric in {"rating", "all"}:
            row["avg_rating"] = float(grp["_rating_num"].mean()) if len(grp) else 0.0
        if metric in {"sentiment", "all"}:
            total = len(grp)
            row["positive_rate"] = float((grp["overall_sentiment"].astype(str).str.lower() == "positive").sum() / total * 100) if total else 0.0
            row["negative_rate"] = float((grp["overall_sentiment"].astype(str).str.lower() == "negative").sum() / total * 100) if total else 0.0

        rows.append(row)

    rows = sorted(rows, key=lambda x: x["period"])
    cols = list(rows[0].keys()) if rows else ["period"]

    return {"total_periods": len(rows), "columns": cols, "rows": rows}


def _tool_compare_segments(
    df: pd.DataFrame,
    dimension: str,
    values: list[str],
    metrics: list[str] | None = None,
) -> dict[str, Any]:
    """Compare metrics across multiple segments side-by-side."""
    if dimension not in df.columns:
        return {"error": f"Dimension '{dimension}' not found"}

    metrics = metrics or ["review_count", "avg_rating", "positive_rate"]
    metrics = [m for m in metrics if m in METRICS]

    rows = []
    for value in values[:4]:  # Limit to 4 comparisons
        segment = df[df[dimension].astype(str).str.lower() == str(value).lower()]
        if len(segment) == 0:
            continue

        row = {dimension: str(value)}
        for m in metrics:
            row[m] = _metric_value(segment, m)
        rows.append(row)

    cols = [dimension] + metrics
    return {"segments_compared": len(rows), "columns": cols, "rows": rows}


def _tool_detect_anomalies(
    df: pd.DataFrame,
    dimension: str,
    metric: str = "negative_rate",
    threshold: float = 2.0,
) -> dict[str, Any]:
    """Identify segments with unusually high/low metrics (outliers)."""
    if dimension not in GROUPABLE_FIELDS or dimension not in df.columns:
        return {"error": f"Cannot group by '{dimension}'"}

    if metric not in METRICS:
        return {"error": f"Invalid metric '{metric}'"}

    grouped_vals = []
    for val, grp in df.groupby(dimension, dropna=False):
        metric_val = _metric_value(grp, metric)
        grouped_vals.append({"segment": str(val), "value": metric_val, "count": len(grp)})

    if len(grouped_vals) < 3:
        return {"message": "Not enough segments to detect anomalies", "columns": [], "rows": []}

    values = [item["value"] for item in grouped_vals]
    mean_val = sum(values) / len(values)
    variance = sum((v - mean_val) ** 2 for v in values) / len(values)
    std_dev = variance ** 0.5

    anomalies = []
    for item in grouped_vals:
        if std_dev > 0:
            z_score = (item["value"] - mean_val) / std_dev
            if abs(z_score) >= threshold:
                anomalies.append({
                    "segment": item["segment"],
                    metric: round(item["value"], 2),
                    "z_score": round(z_score, 2),
                    "review_count": item["count"],
                    "deviation": "above average" if z_score > 0 else "below average",
                })

    anomalies = sorted(anomalies, key=lambda x: abs(x["z_score"]), reverse=True)
    cols = ["segment", metric, "z_score", "review_count", "deviation"]

    return {
        "anomalies_found": len(anomalies),
        "mean": round(mean_val, 2),
        "std_dev": round(std_dev, 2),
        "columns": cols,
        "rows": anomalies,
    }


def _tool_explain_sentiment_drivers(
    df: pd.DataFrame,
    sentiment: str = "negative",
    filters: list[dict[str, Any]] | None = None,
    top_n: int = 5,
) -> dict[str, Any]:
    """Explain what drives positive OR negative sentiment with aspect-level analysis."""
    sentiment = sentiment.lower()
    if sentiment not in {"positive", "negative"}:
        return {"error": "sentiment must be 'positive' or 'negative'"}

    working = _filter_df(df, filters or [])
    working = working[working["overall_sentiment"].astype(str).str.lower() == sentiment]

    top_n = max(1, min(int(top_n or 5), 10))

    aspect_counts: dict[str, int] = {}
    for items in working["_aspect_list"]:
        for item in items:
            if not isinstance(item, dict):
                continue
            aspect = str(item.get("aspect", "")).strip()
            aspect_sentiment = str(item.get("sentiment", "")).strip().lower()
            if not aspect or aspect_sentiment != sentiment:
                continue
            aspect_counts[aspect] = aspect_counts.get(aspect, 0) + 1

    sorted_aspects = sorted(aspect_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
    rows = [{"aspect": aspect, f"{sentiment}_mentions": count} for aspect, count in sorted_aspects]

    return {
        f"total_{sentiment}_reviews": int(len(working)),
        "columns": ["aspect", f"{sentiment}_mentions"],
        "rows": rows,
    }


def _tool_get_aspect_summary(
    df: pd.DataFrame,
    filters: list[dict[str, Any]] | None = None,
    sentiment_filter: str | None = None,
) -> dict[str, Any]:
    """Get summary of all aspects with mention counts and sentiment breakdown."""
    working = _filter_df(df, filters or [])

    if sentiment_filter and sentiment_filter.lower() in {"positive", "negative", "neutral"}:
        working = working[working["overall_sentiment"].astype(str).str.lower() == sentiment_filter.lower()]

    aspect_stats: dict[str, dict[str, int]] = {}

    for items in working["_aspect_list"]:
        for item in items:
            if not isinstance(item, dict):
                continue
            aspect = str(item.get("aspect", "")).strip()
            if not aspect:
                continue
            sentiment = str(item.get("sentiment", "")).strip().lower()

            if aspect not in aspect_stats:
                aspect_stats[aspect] = {"positive": 0, "negative": 0, "neutral": 0, "total": 0}

            aspect_stats[aspect]["total"] += 1
            if sentiment in {"positive", "negative", "neutral"}:
                aspect_stats[aspect][sentiment] += 1

    rows = [
        {
            "aspect": aspect,
            "total_mentions": stats["total"],
            "positive_mentions": stats["positive"],
            "negative_mentions": stats["negative"],
            "neutral_mentions": stats["neutral"],
        }
        for aspect, stats in aspect_stats.items()
    ]

    rows = sorted(rows, key=lambda x: x["total_mentions"], reverse=True)

    return {
        "total_reviews": int(len(working)),
        "unique_aspects": len(rows),
        "columns": ["aspect", "total_mentions", "positive_mentions", "negative_mentions", "neutral_mentions"],
        "rows": rows,
    }


def _tool_statistical_comparison(
    df: pd.DataFrame,
    metric: str,
    group_a_filters: list[dict[str, Any]],
    group_b_filters: list[dict[str, Any]],
) -> dict[str, Any]:
    """Compare two groups statistically and test if differences are significant."""
    if metric not in METRICS:
        return {"error": f"Invalid metric '{metric}'"}

    group_a = _filter_df(df, group_a_filters)
    group_b = _filter_df(df, group_b_filters)

    val_a = _metric_value(group_a, metric)
    val_b = _metric_value(group_b, metric)
    difference = val_a - val_b

    # Simple effect size calculation
    if metric in {"avg_rating", "avg_confidence"}:
        pooled_std = ((group_a["_rating_num"].std() ** 2 + group_b["_rating_num"].std() ** 2) / 2) ** 0.5
        effect_size = abs(difference) / pooled_std if pooled_std > 0 else 0
    else:
        effect_size = abs(difference) / 100  # For percentage metrics

    interpretation = "large" if effect_size > 0.8 else "medium" if effect_size > 0.5 else "small" if effect_size > 0.2 else "negligible"

    return {
        "group_a_value": round(val_a, 2),
        "group_b_value": round(val_b, 2),
        "difference": round(difference, 2),
        "effect_size": round(effect_size, 2),
        "interpretation": interpretation,
        "group_a_size": len(group_a),
        "group_b_size": len(group_b),
    }


def _tool_analyze_correlations(
    df: pd.DataFrame,
    target_metric: str,
    dimensions: list[str] | None = None,
    limit: int = 5,
) -> dict[str, Any]:
    """Find which dimensions most strongly correlate with target metric."""
    if target_metric not in {"avg_rating", "positive_rate", "negative_rate"}:
        return {"error": f"Target metric must be avg_rating, positive_rate, or negative_rate"}

    dimensions = dimensions or ["source", "product_name", "country"]
    dimensions = [d for d in dimensions if d in GROUPABLE_FIELDS and d in df.columns][:3]

    correlations = []
    for dim in dimensions:
        dim_values = []
        for val, grp in df.groupby(dim, dropna=False):
            if len(grp) < 10:  # Minimum sample size
                continue
            metric_val = _metric_value(grp, target_metric)
            dim_values.append((str(val), metric_val))

        if len(dim_values) < 2:
            continue

        # Calculate variance
        values = [v[1] for v in dim_values]
        mean_val = sum(values) / len(values)
        variance = sum((v - mean_val) ** 2 for v in values) / len(values)

        correlations.append({
            "dimension": dim,
            "variance": round(variance, 2),
            "segments_analyzed": len(dim_values),
            "insight": "high variance" if variance > 100 else "moderate variance" if variance > 50 else "low variance",
        })

    correlations = sorted(correlations, key=lambda x: x["variance"], reverse=True)[:limit]

    return {
        "target_metric": target_metric,
        "columns": ["dimension", "variance", "segments_analyzed", "insight"],
        "rows": correlations,
    }


def _tool_explain_negative_drivers(
    df: pd.DataFrame,
    product_name: str | None = None,
    product_code: str | None = None,
    source: str | None = None,
    top_n: int = 5,
) -> dict[str, Any]:
    top_n = max(1, min(int(top_n or 5), 10))
    working = df[df["overall_sentiment"].astype(str).str.lower() == "negative"]
    if product_name:
        working = working[working["product_name"].astype(str).str.lower() == str(product_name).lower()]
    if product_code:
        working = working[working["product_code"].astype(str).str.lower() == str(product_code).lower()]
    if source:
        working = working[working["source"].astype(str).str.lower() == str(source).lower()]

    aspect_counts: dict[str, int] = {}
    aspect_evidence: dict[str, list[str]] = {}
    for items in working["_aspect_list"]:
        for item in items:
            if not isinstance(item, dict):
                continue
            aspect = str(item.get("aspect", "")).strip()
            if not aspect:
                continue
            evidence = str(item.get("evidence", "")).strip()
            aspect_counts[aspect] = aspect_counts.get(aspect, 0) + 1
            if evidence:
                if aspect not in aspect_evidence:
                    aspect_evidence[aspect] = []
                if len(aspect_evidence[aspect]) < 3:
                    aspect_evidence[aspect].append(evidence)

    sorted_aspects = sorted(aspect_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
    rows = [
        {"aspect": aspect, "negative_mentions": count, "evidence_samples": aspect_evidence.get(aspect, [])}
        for aspect, count in sorted_aspects
    ]
    return {"total_negative_reviews": int(len(working)), "columns": ["aspect", "negative_mentions", "evidence_samples"], "rows": rows}


def _tool_search_review_text(
    df: pd.DataFrame,
    keywords: list[str],
    match: str = "any",
    filters: list[dict[str, Any]] | None = None,
    limit: int = 10,
    count_only: bool = False,
) -> dict[str, Any]:
    """Search review text for one or more keywords."""
    if not keywords:
        return {"error": "At least one keyword is required"}
    keywords = [str(k).strip().lower() for k in keywords if str(k).strip()][:5]
    limit = max(1, min(int(limit or 10), 50))

    working = _filter_df(df, filters or [])
    if "review_text" not in working.columns:
        return {"error": "review_text column not available"}

    text_lower = working["review_text"].astype(str).str.lower()
    masks = [text_lower.str.contains(kw, regex=False, na=False) for kw in keywords]

    combined = masks[0]
    for m in masks[1:]:
        combined = (combined & m) if match == "all" else (combined | m)

    matched = working[combined]
    total = int(len(matched))

    if count_only:
        return {"total_matching_rows": total, "keywords": keywords, "match_mode": match}

    cols = [c for c in DEFAULT_ROW_COLUMNS if c in matched.columns]
    sample = matched.head(limit)[cols].copy()
    for c in sample.columns:
        if c == "review_date":
            sample[c] = pd.to_datetime(sample[c], errors="coerce").dt.strftime("%Y-%m-%d").fillna("")
        else:
            sample[c] = sample[c].astype(str)

    return {
        "total_matching_rows": total,
        "keywords": keywords,
        "match_mode": match,
        "columns": cols,
        "rows": sample.to_dict(orient="records"),
    }


def _tool_get_top_keywords(
    df: pd.DataFrame,
    filters: list[dict[str, Any]] | None = None,
    top_n: int = 20,
    min_word_length: int = 4,
) -> dict[str, Any]:
    """Return the most frequent words across review text."""
    top_n = max(1, min(int(top_n or 20), 50))
    min_word_length = max(2, min(int(min_word_length or 4), 10))

    working = _filter_df(df, filters or [])
    if "review_text" not in working.columns or len(working) == 0:
        return {"error": "No review_text data available"}

    all_text = " ".join(working["review_text"].astype(str).str.lower())
    words = re.findall(r'\b[a-z]+\b', all_text)
    filtered_words = [
        w for w in words
        if len(w) >= min_word_length and w not in _TEXT_STOP_WORDS
    ]

    rows = [
        {"word": word, "count": count}
        for word, count in Counter(filtered_words).most_common(top_n)
    ]
    return {
        "total_reviews_analyzed": len(working),
        "columns": ["word", "count"],
        "rows": rows,
    }


def _tool_get_aspect_cooccurrence(
    df: pd.DataFrame,
    anchor_aspect: str | None = None,
    sentiment_filter: str | None = None,
    filters: list[dict[str, Any]] | None = None,
    top_n: int = 10,
) -> dict[str, Any]:
    """Find aspects that co-occur in the same reviews."""
    top_n = max(1, min(int(top_n or 10), 20))

    working = _filter_df(df, filters or [])
    if sentiment_filter and sentiment_filter.lower() in {"positive", "negative", "neutral"}:
        working = working[
            working["overall_sentiment"].astype(str).str.lower() == sentiment_filter.lower()
        ]

    if anchor_aspect:
        anchor_norm = _normalize_aspect_name(anchor_aspect).lower()
        working = working[
            working["_aspect_names"].map(lambda items: anchor_norm in items)
        ]

    if len(working) == 0:
        return {"message": "No matching reviews found", "columns": [], "rows": []}

    cooccurrence: Counter = Counter()
    anchor_norm = _normalize_aspect_name(anchor_aspect).lower() if anchor_aspect else None

    for aspects in working["_aspect_names"]:
        if not isinstance(aspects, list):
            continue
        unique_aspects = list(set(aspects))
        if anchor_norm:
            for a in unique_aspects:
                if a != anchor_norm:
                    cooccurrence[a] += 1
        else:
            for i, a in enumerate(unique_aspects):
                for b in unique_aspects[i + 1:]:
                    cooccurrence[tuple(sorted([a, b]))] += 1

    if anchor_norm:
        rows = [{"co_aspect": k, "co_occurrences": v} for k, v in cooccurrence.most_common(top_n)]
        cols = ["co_aspect", "co_occurrences"]
    else:
        rows = [
            {"aspect_a": k[0], "aspect_b": k[1], "co_occurrences": v}
            for k, v in cooccurrence.most_common(top_n)
        ]
        cols = ["aspect_a", "aspect_b", "co_occurrences"]

    return {
        "total_reviews_analyzed": len(working),
        "anchor_aspect": anchor_aspect,
        "columns": cols,
        "rows": rows,
    }


def _tool_run_pandas_code(df: pd.DataFrame, code: str) -> dict[str, Any]:
    """Execute a Python/pandas snippet in a restricted sandbox."""
    if not code or not code.strip():
        return {"error": "No code provided"}
    if len(code) > 2000:
        return {"error": "Code too long (max 2000 characters)"}

    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return {"error": f"Syntax error: {exc}"}

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            for alias in getattr(node, "names", []):
                mod = alias.name.split(".")[0]
                if mod in _FORBIDDEN_MODULES:
                    return {"error": f"Import of '{mod}' is not allowed"}
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in _FORBIDDEN_CALLS:
                return {"error": f"Call to '{node.func.id}' is not allowed"}

    namespace: dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        "df": df.copy(),
        "pd": pd,
        "np": __import__("numpy"),
        "re": re,
        "Counter": Counter,
        "result": None,
    }
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(code, namespace)  # noqa: S102
    except Exception as exc:
        return {"error": f"Execution error: {exc}"}

    output = buf.getvalue().strip()
    result = namespace.get("result")

    if isinstance(result, pd.DataFrame):
        cols = list(result.columns)
        rows = result.head(50).fillna("").astype(str).to_dict(orient="records")
        return {"columns": cols, "rows": rows, "total_rows": len(result), "stdout": output[:500]}
    if isinstance(result, (pd.Series, pd.Index)):
        return {"result": str(result.head(50)), "stdout": output[:500]}
    if result is not None:
        return {"result": str(result)[:3000], "stdout": output[:500]}
    if output:
        return {"output": output[:3000]}
    return {"message": "Code ran but produced no output. Assign the answer to `result`."}


def _execute_tool(df: pd.DataFrame, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "get_schema":
        return _tool_get_schema(df)
    if name == "get_aspect_summary":
        return _tool_get_aspect_summary(
            df=df,
            filters=args.get("filters"),
            sentiment_filter=args.get("sentiment_filter"),
        )
    if name == "aggregate_reviews":
        return _tool_aggregate_reviews(
            df=df,
            filters=args.get("filters"),
            group_by=args.get("group_by"),
            metrics=args.get("metrics"),
            sort_by=args.get("sort_by"),
            sort_order=args.get("sort_order", "desc"),
            limit=args.get("limit", 20),
        )
    if name == "find_reviews":
        return _tool_find_reviews(
            df=df,
            filters=args.get("filters"),
            row_columns=args.get("row_columns"),
            sort_by=args.get("sort_by"),
            sort_order=args.get("sort_order", "desc"),
            limit=args.get("limit", 10),
        )
    if name == "explain_negative_drivers":
        return _tool_explain_negative_drivers(
            df=df,
            product_name=args.get("product_name"),
            product_code=args.get("product_code"),
            source=args.get("source"),
            top_n=args.get("top_n", 5),
        )
    if name == "get_time_trends":
        return _tool_get_time_trends(
            df=df,
            metric=args.get("metric", "rating"),
            period=args.get("period", "month"),
            filters=args.get("filters"),
            aspect_name=args.get("aspect_name"),
        )
    if name == "compare_segments":
        return _tool_compare_segments(
            df=df,
            dimension=args.get("dimension"),
            values=args.get("values", []),
            metrics=args.get("metrics"),
        )
    if name == "detect_anomalies":
        return _tool_detect_anomalies(
            df=df,
            dimension=args.get("dimension"),
            metric=args.get("metric", "negative_rate"),
            threshold=args.get("threshold", 2.0),
        )
    if name == "explain_sentiment_drivers":
        return _tool_explain_sentiment_drivers(
            df=df,
            sentiment=args.get("sentiment", "negative"),
            filters=args.get("filters"),
            top_n=args.get("top_n", 5),
        )
    if name == "statistical_comparison":
        return _tool_statistical_comparison(
            df=df,
            metric=args.get("metric"),
            group_a_filters=args.get("group_a_filters", []),
            group_b_filters=args.get("group_b_filters", []),
        )
    if name == "analyze_correlations":
        return _tool_analyze_correlations(
            df=df,
            target_metric=args.get("target_metric"),
            dimensions=args.get("dimensions"),
            limit=args.get("limit", 5),
        )
    if name == "search_review_text":
        return _tool_search_review_text(
            df=df,
            keywords=args.get("keywords", []),
            match=args.get("match", "any"),
            filters=args.get("filters"),
            limit=args.get("limit", 10),
            count_only=args.get("count_only", False),
        )
    if name == "get_top_keywords":
        return _tool_get_top_keywords(
            df=df,
            filters=args.get("filters"),
            top_n=args.get("top_n", 20),
            min_word_length=args.get("min_word_length", 4),
        )
    if name == "get_aspect_cooccurrence":
        return _tool_get_aspect_cooccurrence(
            df=df,
            anchor_aspect=args.get("anchor_aspect"),
            sentiment_filter=args.get("sentiment_filter"),
            filters=args.get("filters"),
            top_n=args.get("top_n", 10),
        )
    if name == "run_pandas_code":
        return _tool_run_pandas_code(df=df, code=args.get("code", ""))
    return {"error": f"Unknown tool: {name}"}


def _should_show_table(question: str, tool_trace: list[dict[str, Any]]) -> bool:
    """Determine if table data should be included in response based on question intent."""
    q_lower = question.lower()

    # Explicit table request keywords
    table_keywords = [
        "show me", "list", "give me", "display",
        "what are the", "which", "top ", "bottom ",
        "breakdown", "details", "data", "table",
        "examples", "sample", "reviews for",
        "all ", "each "
    ]

    # Questions that want summary only (no table)
    summary_only = [
        "how many", "what is the", "is there",
        "has ", "compare ", "difference between",
        "why ", "what causes", "what drives",
        "overall", "total", "average",
    ]

    # If find_reviews was called, always show table (user wants to see reviews)
    if any(t.get("name") == "find_reviews" for t in tool_trace):
        return True

    # Check if question explicitly wants a table
    has_table_keyword = any(kw in q_lower for kw in table_keywords)

    # Check if question wants summary only
    has_summary_keyword = any(kw in q_lower for kw in summary_only)

    # Show table if explicit table keyword found and no summary-only keyword
    # OR if only aggregate_reviews/get_aspect_summary was called with grouping
    if has_table_keyword and not has_summary_keyword:
        return True

    return False

def _require_runner_sdk() -> None:
    if _IMPORT_ERROR is not None or None in {Agent, OpenAIProvider, RunConfig, Runner, function_tool}:
        raise RuntimeError(
            "Runner mode is unavailable because the OpenAI Agents SDK is not installed in this environment."
        )


def get_agent_schema() -> dict[str, Any]:
    df = _load_dataframe()
    schema = _tool_get_schema(df)
    schema["path"] = get_latest_sentiment_path()
    schema["suggested_questions"] = [
        "How many unique aspects are there and what are they?",
        "Compare sentiment between all sources",
        "What are the main drivers of negative sentiment?",
        "Has average rating improved over time?",
        "Which aspects are most frequently mentioned positively?",
        "Are there any products with unusually high negative rates?",
    ]
    return schema





def _build_runner_system_prompt() -> str:
    return (
        "You are Review Copilot, an expert data analyst for the product review sentiment dataset.\n\n"

        "## Scope\n"
        "Answer ANY question that involves this dataset's columns: ratings, sentiments, aspects, "
        "products, countries, sources, review text, or review dates. "
        "This includes - but is not limited to - averages, medians, percentiles, counts, fractions, "
        "trends, comparisons, distributions, correlations, word frequencies, and custom statistics. "
        "If the question asks about the data in any way, it is in scope.\n"
        "Respond with 'I cannot answer this question, because it is not relevant to the product review sentiment data.' "
        "ONLY when the question has no connection to the dataset whatsoever (e.g. cooking recipes, weather forecasts, geography trivia).\n\n"

        "## Tool Selection - use the most specific tool available\n"
        "1. Counts, averages, rates grouped by a field -> aggregate_reviews\n"
        "2. Aspect frequencies and sentiment breakdown -> get_aspect_summary\n"
        "3. Trend over time (rating or sentiment) -> get_time_trends\n"
        "4. Side-by-side comparison of segments -> compare_segments\n"
        "5. Statistical difference between two groups -> statistical_comparison\n"
        "6. Which dimension predicts a metric -> analyze_correlations\n"
        "7. Statistical outliers in a dimension -> detect_anomalies\n"
        "8. What drives positive or negative sentiment -> explain_sentiment_drivers\n"
        "9. Negative aspect drivers for a specific product -> explain_negative_drivers\n"
        "10. Keyword or phrase search in review text -> search_review_text\n"
        "11. Most frequent words in review text -> get_top_keywords\n"
        "12. Which aspects appear together in reviews -> get_aspect_cooccurrence\n"
        "13. Fetch individual review examples -> find_reviews (only when user asks for examples or quotes)\n"
        "14. Dataset schema and field values -> get_schema\n"
        "15. Custom analysis not covered by any above -> run_pandas_code (last resort only)\n\n"

        "## Multi-step reasoning\n"
        "- Break complex questions into sub-questions and call tools in sequence.\n"
        "- Use the output of one tool to inform parameters of the next.\n"
        "- Before using any product name, aspect name, or field value in a tool call, verify it exists "
        "by calling get_schema first. Never assume a name is valid - always confirm.\n"
        "- If a tool returns an error or empty result, call get_schema to discover the correct identifiers "
        "and retry with exact values from the schema.\n"
        "- Never conclude that data does not exist without first verifying the exact names via get_schema.\n"
        "- For 'why' questions: first get the quantitative answer, then explain it using aspect evidence.\n\n"

        "## When to use run_pandas_code\n"
        "Use run_pandas_code whenever the question requires ANY of the following - "
        "these cases CANNOT be handled by dedicated tools:\n"
        "- Median, percentile, or any statistic other than mean/count/rate\n"
        "- Word count, character count, or text-length metrics per review\n"
        "- Cross-field boolean filters (e.g. rating=5 AND sentiment=negative)\n"
        "- Custom ratios or derived metrics (e.g. 5-star to 1-star ratio per product)\n"
        "- Aspect-level sentiment filtering: when the question is about reviews where a specific "
        "aspect has negative/positive sentiment (not the overall review sentiment). "
        "Access this via aspects_json, which contains a list of dicts with keys: "
        "'aspect' (name string) and 'sentiment' ('positive'/'negative'/'neutral').\n"
        "- Any computation combining multiple columns in a way no single tool supports\n"
        "Use dedicated tools (1-14) when they fully cover the question. "
        "NEVER refuse a valid dataset question - use run_pandas_code if no dedicated tool fits.\n\n"

        "## run_pandas_code rules\n"
        "- Always assign the final answer to a variable named `result`.\n"
        "- Available in sandbox: df (DataFrame), pd, np, re, Counter.\n"
        "- Key columns: review_text, overall_sentiment, rating, product_name, country, source, "
        "review_date, aspects_json.\n"
        "- Before arithmetic on any column, convert with pd.to_numeric(..., errors='coerce').\n"
        "- For string comparisons, apply .str.lower() on both sides.\n"
        "- Never hardcode product names, aspect names, or field values - always derive them from "
        "the data (e.g. use df['product_name'].unique() if you need the list of products).\n\n"

        "## Aspect name handling\n"
        "- Aspects in tools use UPPERCASE_WITH_UNDERSCORES (e.g. SOUND_QUALITY, NOISE_CANCELLATION).\n"
        "- In aspects_json (for run_pandas_code), aspect names may be lowercase - compare with .lower().\n"
        "- Always call get_schema to find the exact aspect names present in this dataset before filtering.\n\n"

        "## Response style\n"
        "- Lead with the direct answer in plain language.\n"
        "- Weave numbers into prose; do not dump raw tables in text.\n"
        "- Add 1-3 sentences of interpretation when it adds value.\n"
        "- For small samples (< 20 reviews), state the sample is small.\n"
        "- If a comparison exists, name the winner and the gap plainly.\n"
        "- If a trend exists, state whether it is improving, worsening, or stable.\n"
        "- Never mention tools, JSON, schemas, or internal processing to the user.\n"
        "- If data is insufficient, say so clearly instead of guessing.\n\n"

        "## Data integrity\n"
        "- Use ONLY tool outputs; never invent or estimate values.\n"
        "- Cite specific numbers from tool results.\n"
        "- Use conversation history to resolve references like 'that product', 'it', or 'the same source'.\n"
    )



def _build_input_messages(
    question: str, history: list[dict[str, str]] | None
) -> list[dict[str, str]]:
    """Build a message list for Runner.run() from conversation history + current question."""
    messages: list[dict[str, str]] = []
    for item in (history or [])[-10:]:
        role = str(item.get("role", "user")).strip().lower()
        if role not in {"user", "assistant"}:
            continue
        messages.append({"role": role, "content": str(item.get("content", "")).strip()})
    messages.append({"role": "user", "content": question.strip()})
    return messages


async def run_data_qa(
    question: str,
    history: list[dict[str, str]] | None = None,
    event_queue: asyncio.Queue | None = None,
) -> AgentResult:
    if not question or not question.strip():
        raise ValueError("Question cannot be empty")

    _require_runner_sdk()
    config = get_openai_config(use_azure=True)

    df = _load_dataframe()
    tool_trace: list[dict[str, Any]] = []
    last_tabular: dict[str, Any] = {"columns": [], "rows": [], "total_matching_rows": 0}

    def _call_tool(name: str, args: dict[str, Any]) -> str:
        if event_queue is not None:
            event_queue.put_nowait({"type": "tool_call", "tool": name})
        try:
            result = _execute_tool(df, name, args)
        except Exception as exc:
            result = {"error": f"Tool execution failed: {str(exc)}"}
        tool_trace.append({"name": name, "args": args})
        if isinstance(result, dict) and "columns" in result and "rows" in result:
            last_tabular.clear()
            last_tabular.update(result)
        return json.dumps(result, ensure_ascii=False)

    @function_tool(strict_mode=False)
    def get_schema() -> str:
        """Return dataset schema: column names, allowed filter fields, groupable fields, metrics, and sample values."""
        return _call_tool("get_schema", {})

    @function_tool(strict_mode=False)
    def get_aspect_summary(
        filters: list[dict[str, Any]] | None = None,
        sentiment_filter: str | None = None,
    ) -> str:
        """Return all aspects with mention counts and sentiment breakdown.
        sentiment_filter: optional - 'positive', 'negative', or 'neutral' to restrict which reviews are counted.
        """
        return _call_tool("get_aspect_summary", {"filters": filters, "sentiment_filter": sentiment_filter})

    @function_tool(strict_mode=False)
    def aggregate_reviews(
        filters: list[dict[str, Any]] | None = None,
        group_by: list[str] | None = None,
        metrics: list[str] | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        limit: int = 20,
    ) -> str:
        """Compute aggregated metrics with optional filters and grouping.
        group_by: list of fields to group by, e.g. ['product_name'] or ['country', 'source'].
        metrics: subset of ['review_count', 'avg_rating', 'positive_rate', 'neutral_rate', 'negative_rate'].
        sort_by: one of the metric names above.
        """
        return _call_tool(
            "aggregate_reviews",
            {
                "filters": filters,
                "group_by": group_by,
                "metrics": metrics,
                "sort_by": sort_by,
                "sort_order": sort_order,
                "limit": limit,
            },
        )

    @function_tool(strict_mode=False)
    def find_reviews(
        filters: list[dict[str, Any]] | None = None,
        row_columns: list[str] | None = None,
        sort_by: str | None = None,
        sort_order: str = "desc",
        limit: int = 10,
    ) -> str:
        """Fetch individual review rows. Use only when the user explicitly asks for examples or quotes.
        sort_by: a column name such as 'rating' or 'review_date'.
        """
        return _call_tool(
            "find_reviews",
            {
                "filters": filters,
                "row_columns": row_columns,
                "sort_by": sort_by,
                "sort_order": sort_order,
                "limit": limit,
            },
        )

    @function_tool(strict_mode=False)
    def explain_negative_drivers(
        product_name: str | None = None,
        product_code: str | None = None,
        source: str | None = None,
        top_n: int = 5,
    ) -> str:
        """Return the top aspects driving negative sentiment for a specific product.
        Provide at least one of product_name or product_code. source: 'amazon' or 'direct'.
        """
        return _call_tool(
            "explain_negative_drivers",
            {
                "product_name": product_name,
                "product_code": product_code,
                "source": source,
                "top_n": top_n,
            },
        )

    @function_tool(strict_mode=False)
    def get_time_trends(
        metric: str,
        period: str = "month",
        filters: list[dict[str, Any]] | None = None,
        aspect_name: str | None = None,
    ) -> str:
        """Show how a metric evolves over time.
        metric: 'rating' for average rating, 'sentiment' for sentiment rates, 'all' for both.
        period: 'month' (default), 'quarter', or 'year'.
        aspect_name: optional UPPERCASE_WITH_UNDERSCORES aspect to restrict the trend to.
        """
        return _call_tool(
            "get_time_trends",
            {
                "metric": metric,
                "period": period,
                "filters": filters,
                "aspect_name": aspect_name,
            },
        )

    @function_tool(strict_mode=False)
    def compare_segments(
        dimension: str,
        values: list[str],
        metrics: list[str] | None = None,
    ) -> str:
        """Compare metrics side-by-side across specific values of one dimension.
        dimension: a groupable field such as 'source', 'country', or 'product_name'.
        values: the specific segment values to compare, e.g. ['amazon', 'direct'].
        metrics: subset of ['review_count', 'avg_rating', 'positive_rate', 'neutral_rate', 'negative_rate'].
        """
        return _call_tool(
            "compare_segments",
            {"dimension": dimension, "values": values, "metrics": metrics},
        )

    @function_tool(strict_mode=False)
    def detect_anomalies(
        dimension: str,
        metric: str = "negative_rate",
        threshold: float = 2.0,
    ) -> str:
        """Find statistical outliers in a dimension.
        dimension: field to group by, e.g. 'product_name' or 'country'.
        metric: 'negative_rate' (default), 'avg_rating', or 'positive_rate'.
        threshold: z-score threshold; 2.0 means flag values more than 2 std devs from the mean.
        """
        return _call_tool(
            "detect_anomalies",
            {"dimension": dimension, "metric": metric, "threshold": threshold},
        )

    @function_tool(strict_mode=False)
    def explain_sentiment_drivers(
        sentiment: str,
        filters: list[dict[str, Any]] | None = None,
        top_n: int = 5,
    ) -> str:
        """Return the top aspects associated with a given sentiment polarity.
        sentiment: 'positive', 'negative', or 'neutral'.
        """
        return _call_tool(
            "explain_sentiment_drivers",
            {"sentiment": sentiment, "filters": filters, "top_n": top_n},
        )

    @function_tool(strict_mode=False)
    def statistical_comparison(
        metric: str,
        group_a_filters: list[dict[str, Any]],
        group_b_filters: list[dict[str, Any]],
    ) -> str:
        """Test whether two groups differ significantly on a metric.
        metric: 'avg_rating', 'positive_rate', or 'negative_rate'.
        group_a_filters / group_b_filters: filter lists defining each group.
        """
        return _call_tool(
            "statistical_comparison",
            {
                "metric": metric,
                "group_a_filters": group_a_filters,
                "group_b_filters": group_b_filters,
            },
        )

    @function_tool(strict_mode=False)
    def analyze_correlations(
        target_metric: str,
        dimensions: list[str] | None = None,
        limit: int = 5,
    ) -> str:
        """Find which dimensions most strongly predict a target metric.
        target_metric: 'avg_rating', 'positive_rate', or 'negative_rate'.
        dimensions: fields to test, e.g. ['source', 'country', 'product_name']. Defaults to all groupable fields.
        """
        return _call_tool(
            "analyze_correlations",
            {"target_metric": target_metric, "dimensions": dimensions, "limit": limit},
        )

    @function_tool(strict_mode=False)
    def search_review_text(
        keywords: list[str],
        match: str = "any",
        filters: list[dict[str, Any]] | None = None,
        limit: int = 10,
        count_only: bool = False,
    ) -> str:
        """Search review text for keywords or phrases.
        keywords: list of words or phrases to search for.
        match: 'any' (at least one keyword present, default) or 'all' (all keywords must appear).
        count_only: if True, return only the match count without review rows.
        """
        return _call_tool("search_review_text", {
            "keywords": keywords, "match": match,
            "filters": filters, "limit": limit, "count_only": count_only,
        })

    @function_tool(strict_mode=False)
    def get_top_keywords(
        filters: list[dict[str, Any]] | None = None,
        top_n: int = 20,
        min_word_length: int = 4,
    ) -> str:
        """Return the most frequently used words across review text, with stop-word filtering.
        min_word_length: minimum word length to include (default 4).
        """
        return _call_tool("get_top_keywords", {
            "filters": filters, "top_n": top_n, "min_word_length": min_word_length,
        })

    @function_tool(strict_mode=False)
    def get_aspect_cooccurrence(
        anchor_aspect: str | None = None,
        sentiment_filter: str | None = None,
        filters: list[dict[str, Any]] | None = None,
        top_n: int = 10,
    ) -> str:
        """Find which aspects appear together in the same reviews.
        anchor_aspect: optional UPPERCASE_WITH_UNDERSCORES aspect; if set, returns aspects that co-occur with it.
        sentiment_filter: restrict to reviews with this overall sentiment - 'positive', 'negative', or 'neutral'.
        """
        return _call_tool("get_aspect_cooccurrence", {
            "anchor_aspect": anchor_aspect, "sentiment_filter": sentiment_filter,
            "filters": filters, "top_n": top_n,
        })

    @function_tool(strict_mode=False)
    def run_pandas_code(code: str) -> str:
        """Execute a custom pandas snippet for analysis not covered by other tools.
        Use for: median/percentile, word counts per review, cross-field filters, custom ratios,
        aspect-level sentiment filtering via aspects_json.
        Always assign the final answer to a variable named `result`.
        """
        return _call_tool("run_pandas_code", {"code": code})

    if config.get("use_azure"):
        async_client = AsyncAzureOpenAI(
            api_key=config["api_key"],
            api_version=config["api_version"],
            azure_endpoint=config["azure_endpoint"],
        )
    else:
        async_client = AsyncOpenAI(api_key=config["api_key"])
    provider = OpenAIProvider(openai_client=async_client, use_responses=False)
    run_config = RunConfig(
        model=config["model"],
        model_provider=provider,
        tracing_disabled=True,
        model_settings=ModelSettings(temperature=0),
    )
    agent = Agent(
        name="Product Review Data QA Runner",
        instructions=_build_runner_system_prompt(),
        tools=[
            get_schema,
            get_aspect_summary,
            aggregate_reviews,
            find_reviews,
            explain_negative_drivers,
            get_time_trends,
            compare_segments,
            detect_anomalies,
            explain_sentiment_drivers,
            statistical_comparison,
            analyze_correlations,
            search_review_text,
            get_top_keywords,
            get_aspect_cooccurrence,
            run_pandas_code,
        ],
    )

    result = await Runner.run(
        starting_agent=agent,
        input=_build_input_messages(question, history),
        max_turns=10,
        run_config=run_config,
    )

    final_output = getattr(result, "final_output", None)
    if final_output is None and hasattr(result, "final_output_as"):
        try:
            final_output = result.final_output_as(str)
        except Exception:
            final_output = None
    answer = str(final_output).strip() if final_output is not None else "I could not derive an answer from the available data."
    show_table = _should_show_table(question, tool_trace)

    return AgentResult(
        answer=answer,
        plan={"agent": "openai_runner", "tools_called": tool_trace},
        evidence={"total_matching_rows": int(last_tabular.get("total_matching_rows", 0))},
        columns=list(last_tabular.get("columns", [])) if show_table else [],
        rows=list(last_tabular.get("rows", [])) if show_table else [],
    )









