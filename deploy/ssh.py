"""Thin paramiko wrapper: run commands (user/sudo), copy files/trees.

Designed to be import-friendly and CLI-friendly. Streams remote stdout to
local stdout so long-running commands feel responsive.
"""
from __future__ import annotations

import io
import os
import posixpath
import shlex
import stat
import sys
import time
from dataclasses import dataclass
from typing import Iterable

import paramiko

from .config import TARGET, Target


@dataclass
class RunResult:
    exit_status: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.exit_status == 0


class Remote:
    """Long-lived SSH session. Lazily opens SFTP on first use."""

    def __init__(self, target: Target | None = None, *, quiet: bool = False) -> None:
        self.target = target or TARGET
        self.quiet = quiet
        self._client: paramiko.SSHClient | None = None
        self._sftp: paramiko.SFTPClient | None = None

    def __enter__(self) -> "Remote":
        self.connect()
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # --- connection -------------------------------------------------------
    def connect(self) -> None:
        if self._client:
            return
        # Fail fast with a useful pointer when no password is configured —
        # paramiko's "No authentication methods available" otherwise reads
        # like a server-side problem and sends people on a goose chase.
        if not self.target.password:
            raise SystemExit(
                f"deploy: no password configured for {self.target.user}@{self.target.host}.\n"
                "  Add PWADEMO_PASSWORD=... to the repo-root .env (see .env.example),\n"
                "  or export it for this shell: $env:PWADEMO_PASSWORD = '...'"
            )
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(
            hostname=self.target.host,
            port=self.target.port,
            username=self.target.user,
            password=self.target.password,
            allow_agent=False,
            look_for_keys=False,
            timeout=15,
        )
        self._client = c

    @property
    def sftp(self) -> paramiko.SFTPClient:
        if self._sftp is None:
            assert self._client is not None
            self._sftp = self._client.open_sftp()
        return self._sftp

    def close(self) -> None:
        if self._sftp:
            self._sftp.close()
            self._sftp = None
        if self._client:
            self._client.close()
            self._client = None

    # --- exec -------------------------------------------------------------
    def run(
        self,
        cmd: str,
        *,
        sudo: bool = False,
        cwd: str | None = None,
        check: bool = True,
        env: dict[str, str] | None = None,
        stream: bool = True,
    ) -> RunResult:
        """Execute *cmd* on the remote host.

        For sudo we use `sudo -S` and feed the password on stdin, so the
        same password authenticates ssh and elevation.
        """
        assert self._client is not None, "call connect() or use Remote() as context manager"

        full = cmd
        if cwd:
            full = f"cd {shlex.quote(cwd)} && {full}"
        if env:
            prefix = " ".join(f"{k}={shlex.quote(v)}" for k, v in env.items())
            full = f"{prefix} {full}"
        if sudo:
            # -S: read password from stdin; -p '': suppress prompt so it doesn't
            # interleave with stdout; -E: keep env (harmless if not used).
            full = f"sudo -S -p '' -E bash -c {shlex.quote(full)}"
        else:
            full = f"bash -c {shlex.quote(full)}"

        if not self.quiet:
            label = "sudo$" if sudo else "$"
            print(f"  {label} {cmd}", flush=True)

        stdin, stdout, stderr = self._client.exec_command(full, get_pty=False)
        if sudo:
            stdin.write((self.target.password or "") + "\n")
            stdin.flush()
        stdin.channel.shutdown_write()

        out_buf: list[str] = []
        err_buf: list[str] = []
        chan = stdout.channel
        while True:
            if chan.recv_ready():
                data = chan.recv(65536).decode("utf-8", errors="replace")
                out_buf.append(data)
                if stream and not self.quiet:
                    sys.stdout.write(data)
                    sys.stdout.flush()
            if chan.recv_stderr_ready():
                data = chan.recv_stderr(65536).decode("utf-8", errors="replace")
                err_buf.append(data)
                if stream and not self.quiet:
                    sys.stderr.write(data)
                    sys.stderr.flush()
            if chan.exit_status_ready() and not chan.recv_ready() and not chan.recv_stderr_ready():
                break
            time.sleep(0.02)

        # drain
        while chan.recv_ready():
            out_buf.append(chan.recv(65536).decode("utf-8", errors="replace"))
        while chan.recv_stderr_ready():
            err_buf.append(chan.recv_stderr(65536).decode("utf-8", errors="replace"))

        rc = chan.recv_exit_status()
        result = RunResult(rc, "".join(out_buf), "".join(err_buf))
        if check and not result.ok:
            raise RuntimeError(
                f"remote command failed (rc={rc}): {cmd}\nstderr:\n{result.stderr}"
            )
        return result

    # --- file ops ---------------------------------------------------------
    def put(self, local: str, remote: str, *, sudo: bool = False, mode: int | None = None) -> None:
        """Upload a single file to *remote*.

        If sudo is True we upload to /tmp first then `sudo install` into place
        so we can write to root-owned paths without enabling sudo over SFTP.
        """
        local = os.fspath(local)
        if sudo:
            tmp = f"/tmp/.pwadeploy.{os.getpid()}.{int(time.time()*1000)}"
            self._sftp_put(local, tmp)
            inst = ["install"]
            if mode is not None:
                inst += ["-m", oct(mode)[2:]]
            inst += [shlex.quote(tmp), shlex.quote(remote)]
            self.run(" ".join(inst), sudo=True, check=True, stream=False)
            self.run(f"rm -f {shlex.quote(tmp)}", sudo=True, check=False, stream=False)
        else:
            self._ensure_remote_dir(posixpath.dirname(remote))
            self._sftp_put(local, remote)
            if mode is not None:
                self.sftp.chmod(remote, mode)

    def put_text(self, content: str, remote: str, *, sudo: bool = False, mode: int | None = None) -> None:
        """Write *content* into *remote* in one shot (handy for configs)."""
        tmp_local = os.path.join(os.environ.get("TEMP", "/tmp"), f".pwadeploy.{os.getpid()}.{int(time.time()*1000)}")
        with open(tmp_local, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        try:
            self.put(tmp_local, remote, sudo=sudo, mode=mode)
        finally:
            try:
                os.remove(tmp_local)
            except OSError:
                pass

    def put_tree(
        self,
        local_dir: str,
        remote_dir: str,
        *,
        sudo: bool = False,
        excludes: Iterable[str] = (),
    ) -> int:
        """Recursively upload a directory. Returns file count uploaded."""
        local_dir = os.path.abspath(local_dir)
        excludes = tuple(excludes)

        def _excluded(rel: str) -> bool:
            parts = rel.replace("\\", "/").split("/")
            for ex in excludes:
                if ex in parts:
                    return True
            return False

        count = 0
        self._ensure_remote_dir(remote_dir, sudo=sudo)

        for root, dirs, files in os.walk(local_dir):
            rel_root = os.path.relpath(root, local_dir).replace("\\", "/")
            if rel_root == ".":
                rel_root = ""
            dirs[:] = [d for d in dirs if not _excluded(posixpath.join(rel_root, d) if rel_root else d)]
            remote_root = posixpath.join(remote_dir, rel_root) if rel_root else remote_dir
            self._ensure_remote_dir(remote_root, sudo=sudo)
            for fname in files:
                rel = posixpath.join(rel_root, fname) if rel_root else fname
                if _excluded(rel):
                    continue
                local_path = os.path.join(root, fname)
                remote_path = posixpath.join(remote_root, fname)
                self.put(local_path, remote_path, sudo=sudo)
                count += 1
        return count

    # --- internals --------------------------------------------------------
    def _sftp_put(self, local: str, remote: str) -> None:
        self.sftp.put(local, remote)

    def _ensure_remote_dir(self, path: str, *, sudo: bool = False) -> None:
        if not path or path in ("/", "."):
            return
        if sudo:
            self.run(f"mkdir -p {shlex.quote(path)}", sudo=True, check=True, stream=False)
            return
        # walk components, create as needed via sftp
        parts = path.strip("/").split("/")
        cur = ""
        for p in parts:
            cur = f"{cur}/{p}" if cur else f"/{p}"
            try:
                st = self.sftp.stat(cur)
                if not stat.S_ISDIR(st.st_mode):
                    raise RuntimeError(f"remote path exists but is not a directory: {cur}")
            except FileNotFoundError:
                self.sftp.mkdir(cur)


def open_remote(*, quiet: bool = False) -> Remote:
    r = Remote(quiet=quiet)
    r.connect()
    return r
