"""Deployment target configuration.

Override per-host via environment variables or by editing this file.
Password is here for the LAN demo box — rotate or move to env for anything
that matters.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Target:
    host: str
    user: str
    password: str | None
    port: int = 22

    # Remote paths the rest of the tooling assumes.
    app_root: str = "/opt/pwa-demo"
    repo_url: str = "https://github.com/mdennis281/pwa-demo.git"
    branch: str = "main"
    service_name: str = "pwa-demo"
    autodeploy_service: str = "pwa-demo-autodeploy"
    nginx_site: str = "pwa-demo"


TARGET = Target(
    host=os.environ.get("PWADEMO_HOST", "pwa-demo.lan"),
    user=os.environ.get("PWADEMO_USER", "dipduo"),
    password=os.environ.get("PWADEMO_PASSWORD", "mdennis281"),
    port=int(os.environ.get("PWADEMO_PORT", "22")),
)
