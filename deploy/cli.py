"""Command-line entry point for the deploy toolbox.

Usage:
    python -m deploy run "uname -a"
    python -m deploy sudo "apt-get update"
    python -m deploy put local.txt /tmp/remote.txt
    python -m deploy put-tree apps/web/dist /opt/pwa-demo/web
    python -m deploy ping
    python -m deploy bootstrap          # provision packages, dirs, services
    python -m deploy deploy             # full app deploy
    python -m deploy autodeploy install # set up + start autodeploy timer
    python -m deploy status
    python -m deploy logs [-n 100]
"""
from __future__ import annotations

import argparse
import sys
from typing import Callable

# Streaming remote output can include any unicode (apt prints arrows etc.).
# Windows consoles default to cp1252 — reconfigure to utf-8/replace so we
# never blow up on a postinst character.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except Exception:
        pass

from .ssh import Remote


def _add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument("--quiet", action="store_true", help="suppress streaming output")


def cmd_ping(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        out = r.run("hostname && uname -a && uptime", check=False)
    return 0 if out.ok else out.exit_status


def cmd_run(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        out = r.run(args.command, sudo=False, cwd=args.cwd, check=False)
    return out.exit_status


def cmd_sudo(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        out = r.run(args.command, sudo=True, cwd=args.cwd, check=False)
    return out.exit_status


def cmd_put(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        r.put(args.local, args.remote, sudo=args.sudo, mode=int(args.mode, 8) if args.mode else None)
    print(f"uploaded {args.local} -> {args.remote}")
    return 0


def cmd_put_tree(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        n = r.put_tree(args.local, args.remote, sudo=args.sudo, excludes=args.exclude)
    print(f"uploaded {n} files: {args.local} -> {args.remote}")
    return 0


def cmd_bootstrap(args: argparse.Namespace) -> int:
    from .bootstrap import bootstrap
    bootstrap(quiet=args.quiet)
    return 0


def cmd_deploy(args: argparse.Namespace) -> int:
    from .pipeline import deploy
    deploy(quiet=args.quiet, branch=args.branch)
    return 0


def cmd_autodeploy(args: argparse.Namespace) -> int:
    from .bootstrap import install_autodeploy, autodeploy_state
    if args.action == "install":
        install_autodeploy(quiet=args.quiet)
    elif args.action == "status":
        autodeploy_state()
    elif args.action == "trigger":
        from .bootstrap import trigger_autodeploy
        trigger_autodeploy()
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        r.run("systemctl is-active pwa-demo pwa-demo-autodeploy.timer nginx || true; "
              "echo ---; systemctl status pwa-demo --no-pager -l | head -20 || true; "
              "echo ---; curl -sS -o /dev/null -w 'http://localhost  -> %{http_code}\\n' http://localhost || true",
              check=False, sudo=True)
    return 0


def cmd_logs(args: argparse.Namespace) -> int:
    with Remote(quiet=args.quiet) as r:
        r.run(f"journalctl -u {args.unit} -n {args.n} --no-pager", sudo=True, check=False)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="deploy", description="pwa-demo deployment toolbox")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add(name: str, handler: Callable[[argparse.Namespace], int]) -> argparse.ArgumentParser:
        sp = sub.add_parser(name)
        sp.set_defaults(func=handler)
        _add_common(sp)
        return sp

    add("ping", cmd_ping)

    sp = add("run", cmd_run)
    sp.add_argument("command")
    sp.add_argument("--cwd")

    sp = add("sudo", cmd_sudo)
    sp.add_argument("command")
    sp.add_argument("--cwd")

    sp = add("put", cmd_put)
    sp.add_argument("local")
    sp.add_argument("remote")
    sp.add_argument("--sudo", action="store_true")
    sp.add_argument("--mode", help="octal mode, e.g. 644")

    sp = add("put-tree", cmd_put_tree)
    sp.add_argument("local")
    sp.add_argument("remote")
    sp.add_argument("--sudo", action="store_true")
    sp.add_argument(
        "--exclude",
        action="append",
        default=["node_modules", ".git", "dev-dist", "dist-old"],
        help="dir basename to skip (repeatable)",
    )

    add("bootstrap", cmd_bootstrap)
    sp = add("deploy", cmd_deploy)
    sp.add_argument("--branch", default=None)

    sp = add("autodeploy", cmd_autodeploy)
    sp.add_argument("action", choices=["install", "status", "trigger"])

    add("status", cmd_status)

    sp = add("logs", cmd_logs)
    sp.add_argument("--unit", default="pwa-demo")
    sp.add_argument("-n", type=int, default=100)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\ninterrupted", file=sys.stderr)
        return 130
    except Exception as e:  # noqa: BLE001
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
