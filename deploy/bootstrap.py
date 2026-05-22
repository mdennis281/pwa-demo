"""One-shot provisioning + autodeploy installer for the LAN box.

`bootstrap()` is idempotent: every step is safe to re-run, and we only do
work when state on the box says we need to.
"""
from __future__ import annotations

import os
import shlex
from pathlib import Path

from .config import TARGET
from .ssh import Remote


TEMPLATES = Path(__file__).parent / "templates"


def _read_template(name: str) -> str:
    return (TEMPLATES / name).read_text(encoding="utf-8")


def _missing(r: Remote, cmd: str) -> bool:
    """True if `command -v <cmd>` finds nothing remotely."""
    out = r.run(f"command -v {shlex.quote(cmd)} >/dev/null 2>&1 && echo Y || echo N",
                check=True, stream=False)
    return out.stdout.strip().endswith("N")


def _apt_install(r: Remote, packages: list[str]) -> None:
    pkgs = " ".join(shlex.quote(p) for p in packages)
    r.run("DEBIAN_FRONTEND=noninteractive apt-get update -y", sudo=True)
    r.run(f"DEBIAN_FRONTEND=noninteractive apt-get install -y {pkgs}", sudo=True)


def _install_node20(r: Remote) -> None:
    if not _missing(r, "node"):
        ver = r.run("node --version", stream=False).stdout.strip()
        print(f"  node already installed: {ver}")
        return
    print("  installing node 20.x via NodeSource…")
    r.run(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - "
        "&& DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs",
        sudo=True,
    )


def _ensure_user(r: Remote, user: str, home: str) -> None:
    out = r.run(f"getent passwd {shlex.quote(user)} || true", stream=False)
    if out.stdout.strip():
        print(f"  user {user} exists")
        return
    print(f"  creating user {user}")
    r.run(
        f"useradd --system --create-home --home-dir {shlex.quote(home)} "
        f"--shell /bin/bash {shlex.quote(user)}",
        sudo=True,
    )


def _clone_repo(r: Remote, app_root: str, repo_url: str, branch: str) -> None:
    repo_dir = f"{app_root}/repo"
    out = r.run(f"test -d {shlex.quote(repo_dir)}/.git && echo Y || echo N", stream=False)
    if out.stdout.strip() == "Y":
        print(f"  repo already cloned at {repo_dir}")
        return
    print(f"  cloning {repo_url} -> {repo_dir}")
    r.run(
        f"sudo -u pwademo git clone --branch {shlex.quote(branch)} "
        f"{shlex.quote(repo_url)} {shlex.quote(repo_dir)}",
        sudo=True,
    )


def _upload_env(r: Remote, app_root: str) -> None:
    """Push the local .env to /opt/pwa-demo/repo/.env (the server expects it
    at the repo root, since env.ts loads it from there).

    Forces WEB_ORIGIN/HOST to LAN-friendly defaults so the deploy is usable.
    """
    repo_root = Path(__file__).resolve().parents[1]
    local_env = repo_root / ".env"
    text = local_env.read_text(encoding="utf-8")
    # rewrite the dev values to LAN values
    overrides = {
        "PORT": "3000",
        "HOST": "0.0.0.0",
        "WEB_ORIGIN": f"http://{TARGET.host}",
    }
    lines = text.splitlines()
    seen = set()
    out_lines: list[str] = []
    for line in lines:
        m = line.split("=", 1)
        key = m[0].strip()
        if key in overrides:
            out_lines.append(f"{key}={overrides[key]}")
            seen.add(key)
        else:
            out_lines.append(line)
    for k, v in overrides.items():
        if k not in seen:
            out_lines.append(f"{k}={v}")
    final = "\n".join(out_lines) + "\n"

    remote_env = f"{app_root}/repo/.env"
    r.put_text(final, remote_env, sudo=True, mode=0o640)
    r.run(f"chown pwademo:pwademo {shlex.quote(remote_env)}", sudo=True)
    print(f"  uploaded .env -> {remote_env}")


def _install_systemd(r: Remote) -> None:
    units = [
        ("pwa-demo.service", "/etc/systemd/system/pwa-demo.service"),
        ("pwa-demo-autodeploy.service", "/etc/systemd/system/pwa-demo-autodeploy.service"),
        ("pwa-demo-autodeploy.timer", "/etc/systemd/system/pwa-demo-autodeploy.timer"),
    ]
    for name, remote in units:
        r.put_text(_read_template(name), remote, sudo=True, mode=0o644)
    r.put_text(
        _read_template("autodeploy.sh"),
        "/opt/pwa-demo/bin/autodeploy.sh",
        sudo=True,
        mode=0o755,
    )
    r.run("chown -R pwademo:pwademo /opt/pwa-demo/bin", sudo=True)
    r.run("systemctl daemon-reload", sudo=True)


def _install_polkit(r: Remote) -> None:
    r.put_text(
        _read_template("50-pwademo-restart.rules"),
        "/etc/polkit-1/rules.d/50-pwademo-restart.rules",
        sudo=True,
        mode=0o644,
    )
    # polkit picks up new rules without an explicit reload, but make sure
    # the daemon is running.
    r.run("systemctl is-active polkit >/dev/null 2>&1 || systemctl start polkit", sudo=True, check=False)


def _install_nginx_site(r: Remote) -> None:
    conf = _read_template("nginx-pwa-demo.conf")
    r.put_text(conf, "/etc/nginx/sites-available/pwa-demo", sudo=True, mode=0o644)
    r.run(
        "ln -sf /etc/nginx/sites-available/pwa-demo /etc/nginx/sites-enabled/pwa-demo",
        sudo=True,
    )
    # Remove the default site (it claims `listen 80 default_server` and would
    # collide with ours).
    r.run("rm -f /etc/nginx/sites-enabled/default", sudo=True)
    r.run("nginx -t", sudo=True)
    r.run("systemctl reload nginx || systemctl restart nginx", sudo=True)


def _first_build(r: Remote, app_root: str) -> None:
    repo = f"{app_root}/repo"
    # Run as pwademo so node_modules ownership ends up right.
    r.run(
        f"sudo -u pwademo bash -lc 'cd {shlex.quote(repo)} && npm ci --no-audit --no-fund && npm run build'",
        sudo=True,
    )


def _enable_services(r: Remote) -> None:
    r.run("systemctl enable --now pwa-demo.service", sudo=True)
    r.run("systemctl enable --now pwa-demo-autodeploy.timer", sudo=True)


def bootstrap(*, quiet: bool = False) -> None:
    print(f"=== bootstrap {TARGET.user}@{TARGET.host} ===")
    with Remote(quiet=quiet) as r:
        # 1. base packages
        print("[1/9] base packages")
        _apt_install(r, [
            "ca-certificates", "curl", "git", "build-essential",
            "nginx", "policykit-1",
            # avahi-daemon publishes <hostname>.local via mDNS so the box is
            # reachable by a stable name regardless of DHCP lease churn or
            # stale entries in a router's DNS resolver.
            "avahi-daemon",
        ])
        r.run("systemctl enable --now avahi-daemon", sudo=True, check=False)

        # 2. node 20
        print("[2/9] node 20")
        _install_node20(r)

        # 3. service user
        print("[3/9] service user")
        _ensure_user(r, "pwademo", TARGET.app_root)

        # 4. directory layout
        print("[4/9] app dirs")
        r.run(
            f"mkdir -p {TARGET.app_root}/bin {TARGET.app_root}/state {TARGET.app_root}/repo && "
            f"chown -R pwademo:pwademo {TARGET.app_root} && "
            # Make the tree traversable so the deploy user (and ops) can stat
            # contents without sudo. Repo files keep their own perms.
            f"chmod 755 {TARGET.app_root} {TARGET.app_root}/bin {TARGET.app_root}/state {TARGET.app_root}/repo",
            sudo=True,
        )

        # 5. clone repo + .env
        print("[5/9] repo + .env")
        _clone_repo(r, TARGET.app_root, TARGET.repo_url, TARGET.branch)
        _upload_env(r, TARGET.app_root)

        # 6. systemd units + polkit rule
        print("[6/9] systemd + polkit")
        _install_systemd(r)
        _install_polkit(r)

        # 7. nginx site
        print("[7/9] nginx")
        _install_nginx_site(r)

        # 8. first build
        print("[8/9] first build (npm ci + npm run build)")
        _first_build(r, TARGET.app_root)

        # 9. enable + start
        print("[9/9] enable + start")
        _enable_services(r)

        # diagnostics
        print("\n=== status ===")
        r.run(
            "systemctl is-active pwa-demo; systemctl is-active pwa-demo-autodeploy.timer; "
            "systemctl is-active nginx; "
            "curl -sS -m 5 -o /dev/null -w 'http://localhost -> %{http_code}\\n' http://localhost",
            check=False, sudo=True,
        )
    print(f"\ndone. open http://{TARGET.host}")


def install_autodeploy(*, quiet: bool = False) -> None:
    """Re-install just the autodeploy unit + timer (idempotent)."""
    with Remote(quiet=quiet) as r:
        _install_systemd(r)
        r.run("systemctl enable --now pwa-demo-autodeploy.timer", sudo=True)
        r.run("systemctl status pwa-demo-autodeploy.timer --no-pager", sudo=True, check=False)


def autodeploy_state() -> None:
    with Remote() as r:
        r.run("systemctl status pwa-demo-autodeploy.timer --no-pager -l | head -15", sudo=True, check=False)
        r.run("journalctl -u pwa-demo-autodeploy.service -n 50 --no-pager", sudo=True, check=False)


def trigger_autodeploy() -> None:
    """Force an immediate autodeploy run instead of waiting for the timer."""
    with Remote() as r:
        r.run("systemctl start pwa-demo-autodeploy.service", sudo=True)
        r.run("journalctl -u pwa-demo-autodeploy.service -n 30 --no-pager", sudo=True, check=False)
