"""
Shared API configuration for OpenAI and Azure OpenAI.

This module provides reusable configuration utilities for creating
OpenAI/Azure OpenAI clients across different extraction modules.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import AzureOpenAI, OpenAI

# Settings file path
ROOT = Path(__file__).resolve().parent.parent
SETTINGS_FILE = ROOT / "settings.json"
BACKEND_DIR = Path(__file__).resolve().parent

# Load only backend/.env for this service.
load_dotenv(dotenv_path=BACKEND_DIR / ".env", override=True)


def _clean_env_value(value: str | None) -> str | None:
    """Normalize env var values by trimming whitespace and wrapping quotes."""
    if value is None:
        return None
    cleaned = value.strip().strip('"').strip("'").strip()
    return cleaned or None


def _read_env(*keys: str, default: str | None = None) -> str | None:
    """Read first non-empty env value from a list of key aliases."""
    for key in keys:
        value = _clean_env_value(os.getenv(key))
        if value is not None:
            return value
    return default


def _normalize_azure_endpoint(endpoint: str | None) -> str | None:
    """Ensure endpoint is a clean base URL without trailing slash."""
    endpoint = _clean_env_value(endpoint)
    if endpoint is None:
        return None
    return endpoint.rstrip("/")


def _load_settings():
    """Load settings from settings.json if it exists"""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def get_openai_config(use_azure: bool = True) -> dict:
    """
    Get OpenAI configuration based on whether to use Azure or standard OpenAI.

    Credentials are read from: environment variables (.env) > defaults
    API provider choice is read from: settings.json > defaults

    Args:
        use_azure: If True, use Azure OpenAI. If False, use standard OpenAI API.

    Returns:
        Configuration dictionary with appropriate settings

    Example:
        >>> config = get_openai_config(use_azure=True)
        >>> # Returns Azure config with deployment name
        >>> config = get_openai_config(use_azure=False)
        >>> # Returns OpenAI config with model name
    """
    # Load settings to check api_provider preference
    settings = _load_settings()

    # If settings exist, use api_provider from settings
    if settings:
        use_azure = settings.get("api_provider", "azure") == "azure"

    if use_azure:
        # Read Azure credentials and model settings from env vars (with common aliases)
        api_key = _read_env("AZURE_API_KEY", "AZURE_OPENAI_API_KEY")
        azure_endpoint = _normalize_azure_endpoint(
            _read_env("AZURE_ENDPOINT", "AZURE_OPENAI_ENDPOINT")
        )
        api_version = _read_env("AZURE_API_VERSION", "OPENAI_API_VERSION", default="2025-03-01-preview")
        model = _read_env(
            "AZURE_DEPLOYMENT",
            "AZURE_OPENAI_DEPLOYMENT",
            "AZURE_OPENAI_CHAT_DEPLOYMENT",
            default="gpt-5.4",
        )

        if not api_key:
            raise ValueError("Missing Azure API key. Set AZURE_API_KEY (or AZURE_OPENAI_API_KEY).")
        if not azure_endpoint:
            raise ValueError("Missing Azure endpoint. Set AZURE_ENDPOINT (or AZURE_OPENAI_ENDPOINT).")

        return {
            "use_azure": True,
            "api_key": api_key,
            "azure_endpoint": azure_endpoint,
            "azure_audio_endpoint": azure_endpoint,
            "api_version": api_version,
            "model": model,
            "transcription_model": _read_env("AZURE_TRANSCRIPTION_MODEL", default="whisper"),
        }
    else:
        api_key = _read_env("OPENAI_API_KEY")
        model = _read_env("OPENAI_MODEL", default="gpt-5.4-2026-03-05")

        if not api_key:
            raise ValueError("Missing OpenAI API key. Set OPENAI_API_KEY.")

        return {
            "use_azure": False,
            "api_key": api_key,
            "model": model,
            "transcription_model": _read_env("OPENAI_TRANSCRIPTION_MODEL", default="whisper-1"),
        }


def create_openai_client(config: dict):
    """
    Create an OpenAI or Azure OpenAI client based on configuration.

    Args:
        config: Configuration dictionary from get_openai_config()

    Returns:
        OpenAI or AzureOpenAI client instance

    Example:
        >>> config = get_openai_config(use_azure=True)
        >>> client = create_openai_client(config)
    """
    if config.get("use_azure", False):
        return AzureOpenAI(
            api_key=config["api_key"],
            api_version=config["api_version"],
            azure_endpoint=config["azure_endpoint"],
        )
    else:
        return OpenAI(api_key=config["api_key"])
