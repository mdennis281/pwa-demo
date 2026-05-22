"""Manual deploy entry-point (alternative to the timer-driven autodeploy)."""
from __future__ import annotations

import shlex

from .config import TARGET
from .ssh import Remote


def deploy(*, quiet: bool = False, branch: str | None = None) -> None:
    br = branch or TARGET.branch
    with Remote(quiet=quiet) as r:
        # Just kick the same script the timer uses — single source of truth.
        r.run(
            f"BRANCH={shlex.quote(br)} /opt/pwa-demo/bin/autodeploy.sh",
            sudo=True,
        )
        r.run(
            "curl -sS -m 5 -o /dev/null -w 'http://localhost -> %{http_code}\\n' http://localhost",
            sudo=True, check=False,
        )
