# deploy/ — pwa-demo deployment toolbox

Small Python CLI for pushing this app to a Linux box and keeping it in sync
with `origin/main` via a systemd timer (no inbound webhook needed, works
behind NAT/LAN).

## What it sets up on the box

- **node 20** (NodeSource) + **nginx** + **policykit-1** + build-essential
- **avahi-daemon** publishes `<hostname>.local` over mDNS — gives you a
  stable URL even if DHCP gives the box a new IP and your router's DNS
  caches a stale `<hostname>.lan` entry (which is what happened to us)
- system user **pwademo** owning `/opt/pwa-demo/`
- git clone of this repo at `/opt/pwa-demo/repo`
- **`pwa-demo.service`** — runs `node apps/server/dist/index.js` on `:3000`
- **`pwa-demo-autodeploy.service`** + **`.timer`** — every 60s, polls
  `origin/main`; on change: `git reset --hard`, `npm ci`, `npm run build`,
  `systemctl restart pwa-demo`
- **nginx site** reverse-proxies `:80` → `127.0.0.1:3000` (with WebSocket
  upgrade headers for socket.io)
- **polkit rule** lets the `pwademo` user restart its own unit without a
  password (and only that unit)

After bootstrap, open **http://pwa-demo.local** — that name resolves via
mDNS straight off the box and survives reboots / IP changes. Prefer it
over `pwa-demo.lan` (router DNS) for that reason.

The autodeploy compares the remote tip against
`/opt/pwa-demo/state/last-sha` (last *successful* deploy), so a failed
build gets retried on the next tick instead of being silently swallowed.

## Target config

`deploy/config.py` reads host/user/password from env vars and falls back
to the LAN demo box. Override via:

```
$env:PWADEMO_HOST = "..."   # PowerShell
$env:PWADEMO_USER = "..."
$env:PWADEMO_PASSWORD = "..."
```

## Commands

```
python -m deploy ping                          # uname + uptime
python -m deploy run  "<cmd>" [--cwd DIR]      # run as login user
python -m deploy sudo "<cmd>" [--cwd DIR]      # run via sudo
python -m deploy put  LOCAL REMOTE [--sudo] [--mode 644]
python -m deploy put-tree LOCAL REMOTE [--sudo] [--exclude DIR]
python -m deploy bootstrap                     # full provision (idempotent)
python -m deploy deploy                        # force an immediate deploy
python -m deploy autodeploy install            # reinstall timer/unit/script
python -m deploy autodeploy trigger            # fire one run + tail journal
python -m deploy autodeploy status             # timer + recent journal
python -m deploy status                        # services + http probe
python -m deploy logs [--unit U] [-n 100]      # journalctl
python -m deploy ip                            # current IPv4 + .local URL
```

## First-time setup

```
pip install paramiko
python -m deploy bootstrap
```

Bootstrap is idempotent — safe to re-run after edits to the templates
under `deploy/templates/` (the file system contents will be re-uploaded
and the daemon reloaded).

## How auto-deploy reacts to a push

1. Timer fires `pwa-demo-autodeploy.service` every 60s.
2. The service runs `/opt/pwa-demo/bin/autodeploy.sh` as `pwademo`.
3. `git fetch origin main`; if the tip differs from `state/last-sha`:
   - `git reset --hard origin/main`
   - `npm ci && npm run build`
   - `systemctl restart pwa-demo`
   - write the new SHA into `state/last-sha` only on success

Watch a deploy live: `python -m deploy logs --unit pwa-demo-autodeploy -n 50`

## Why polling instead of a webhook

The target is a LAN box. Webhooks need inbound from GitHub. Polling
every 60s costs essentially nothing, has no public surface, and survives
network blips — the next tick just retries.

## Files

```
deploy/
  config.py                       target host (env-overridable)
  ssh.py                          paramiko wrapper: run/sudo/put/put-tree
  cli.py                          argparse front-end
  bootstrap.py                    one-shot provisioning
  pipeline.py                     manual deploy trigger
  templates/
    nginx-pwa-demo.conf           :80 reverse proxy w/ websocket
    pwa-demo.service              node systemd unit
    pwa-demo-autodeploy.service   oneshot deploy unit
    pwa-demo-autodeploy.timer     poll every 60s
    autodeploy.sh                 the actual deploy logic
    50-pwademo-restart.rules      polkit: pwademo can restart its own unit
```
