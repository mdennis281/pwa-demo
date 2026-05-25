"""Deployment target configuration.

Reads target host/user/password from a repo-root `.env` (if python-dotenv is
installed) and from process env. No secrets live in this file — see
`.env.example` for the keys.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[1]


def _inline_load_dotenv(path: Path, *, override: bool = False) -> None:
    """Minimal .env loader so deploy/ works without python-dotenv installed.

    Supports KEY=VALUE, # comments, blank lines, and surrounding quotes —
    enough for our 4 deploy creds. Silent no-op if the file is missing.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
            v = v[1:-1]
        if override or k not in os.environ:
            os.environ[k] = v


# Prefer python-dotenv when available (handles edge cases like multi-line
# values), but fall back to the inline parser so a fresh checkout works
# without an extra `pip install`. Either way, the .env never overrides
# variables already in the shell — explicit env wins.
try:
    from dotenv import load_dotenv  # type: ignore[import-untyped]

    load_dotenv(_REPO_ROOT / ".env", override=False)
except ImportError:
    _inline_load_dotenv(_REPO_ROOT / ".env", override=False)


@dataclass(frozen=True)
class Target:
    host: str
    user: str
    password: str | None
    port: int = 22

    app_root: str = "/opt/pwa-demo"
    repo_url: str = "https://github.com/mdennis281/pwa-demo.git"
    branch: str = "main"
    service_name: str = "pwa-demo"
    autodeploy_service: str = "pwa-demo-autodeploy"
    nginx_site: str = "pwa-demo"


def _password() -> str | None:
    pw = os.environ.get("PWADEMO_PASSWORD")
    return pw if pw else None


TARGET = Target(
    host=os.environ.get("PWADEMO_HOST", "pwa-demo.lan"),
    user=os.environ.get("PWADEMO_USER", "dipduo"),
    password=_password(),
    port=int(os.environ.get("PWADEMO_PORT", "22")),
)
