from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
FALLBACK_SENTIMENT_FILE = ROOT / "input" / "sentiment_enriched.xlsx"

_latest_sentiment_df: pd.DataFrame | None = None
_latest_sentiment_bytes: bytes | None = None
_latest_sentiment_version: int = 0
_latest_sentiment_filename: str = "sentiment_enriched.xlsx"


def set_latest_sentiment_enriched(
    df: pd.DataFrame,
    filename: str = "sentiment_enriched.xlsx",
) -> None:
    global _latest_sentiment_df, _latest_sentiment_bytes, _latest_sentiment_version, _latest_sentiment_filename

    buffer = BytesIO()
    df.to_excel(buffer, index=False)
    _latest_sentiment_df = df.copy()
    _latest_sentiment_bytes = buffer.getvalue()
    _latest_sentiment_version += 1
    _latest_sentiment_filename = filename


def get_latest_sentiment_df() -> pd.DataFrame:
    if _latest_sentiment_df is not None:
        return _latest_sentiment_df.copy()
    if FALLBACK_SENTIMENT_FILE.exists():
        return pd.read_excel(FALLBACK_SENTIMENT_FILE)
    raise FileNotFoundError(f"Sentiment file not found: {FALLBACK_SENTIMENT_FILE}")


def get_latest_sentiment_bytes() -> bytes:
    if _latest_sentiment_bytes is not None:
        return _latest_sentiment_bytes
    if FALLBACK_SENTIMENT_FILE.exists():
        return FALLBACK_SENTIMENT_FILE.read_bytes()
    raise FileNotFoundError(f"Sentiment file not found: {FALLBACK_SENTIMENT_FILE}")


def get_latest_sentiment_filename() -> str:
    if _latest_sentiment_bytes is not None:
        return _latest_sentiment_filename
    return FALLBACK_SENTIMENT_FILE.name


def get_latest_sentiment_cache_key() -> str:
    if _latest_sentiment_df is not None:
        return f"memory:{_latest_sentiment_version}"
    if FALLBACK_SENTIMENT_FILE.exists():
        return f"file:{FALLBACK_SENTIMENT_FILE.stat().st_mtime}"
    return "missing"


def get_latest_sentiment_path() -> str:
    if _latest_sentiment_df is not None:
        return "in-memory latest sentiment result"
    return str(FALLBACK_SENTIMENT_FILE)
