"""OpenAI structured-output client. One call per chunk.

The API key is read from the environment only. It is never logged, never
written to an output file, and never committed: load it with
`set -a; . ~/.wattson.env; set +a` before running.
"""
from __future__ import annotations

import json
import os
import ssl
import time
import urllib.error
import urllib.request

import certifi

from .prompt import build_system_prompt, build_user_prompt
from .schema import CLAIM_SCHEMA

API_URL = "https://api.openai.com/v1/chat/completions"

# This Python build ships no CA bundle (ssl.get_default_verify_paths().cafile
# is None), so every HTTPS call fails CERTIFICATE_VERIFY_FAILED without an
# explicit context. Verification stays ON; it is pointed at certifi's bundle.
SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())

#: Pinned to a dated snapshot so a rerun cannot silently change behaviour.
MODEL = "gpt-5-mini-2025-08-07"

MAX_RETRIES = 4


class ExtractionError(RuntimeError):
    pass


def _api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        raise ExtractionError(
            "OPENAI_API_KEY is not set. Run: set -a; . ~/.wattson.env; set +a"
        )
    return key


def _post(payload: dict, key: str, timeout: int = 120) -> dict:
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout,
                                context=SSL_CONTEXT) as response:
        return json.loads(response.read())


def extract_chunk(chunk: dict, model: str = MODEL, key: str | None = None) -> dict:
    """Return the model's parsed object for one chunk.

    {"chunk_quality": {...}, "claims": [...]}. Provenance is added later, by
    verify.reconcile, from the chunk record rather than from the model.
    """
    key = key or _api_key()
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": build_user_prompt(chunk)},
        ],
        "response_format": {"type": "json_schema", "json_schema": CLAIM_SCHEMA},
    }

    last = None
    for attempt in range(MAX_RETRIES):
        try:
            body = _post(payload, key)
            content = body["choices"][0]["message"]["content"]
            return json.loads(content)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode()[:300]
            last = f"HTTP {exc.code}: {detail}"
            # Never retry a bad request; it will fail identically.
            if exc.code in (400, 401, 403, 404):
                raise ExtractionError(last) from None
            time.sleep(2 ** attempt)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError,
                KeyError) as exc:
            last = f"{type(exc).__name__}: {exc}"
            time.sleep(2 ** attempt)

    raise ExtractionError(f"failed after {MAX_RETRIES} attempts: {last}")
