# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`masterclaw` is a Node.js CLI for managing multiple [openclaw](https://github.com/openclaw) instances side-by-side. Each "claw" is a named openclaw agent running in Docker Compose with its own config directory, workspace, and port pair (gateway + bridge).

- **Instance registry**: `.instances/<name>/env` — sourced shell file holding all env vars for a claw
- **Default port strategy**: gateway starts at `18789`, each claw uses `PORT` and `PORT+1`; `next_available_port()` auto-increments by 2
- **Openclaw source**: `<repo>/openclaw` — the shared Docker Compose file and setup script live there (cloned by `masterclaw init`)
- **Per-instance config**: `<repo>/claws/<name>/` (openclaw.json, identity/, agents/, credentials/, etc.)
- **Per-instance workspace**: `<repo>/claws/<name>/workspace/` — mounted into the container

## Common commands

```bash
# Manage claws
masterclaw list
masterclaw create <name>               # add + interactive docker setup
masterclaw add <name> --port 18800
masterclaw start <name>
masterclaw stop <name>
masterclaw logs <name>
masterclaw exec <name> channels login
masterclaw shell <name>                # bash inside the gateway container
masterclaw token <name>                # print the gateway token
masterclaw remove <name>               # unregisters; config/workspace preserved

# Check Docker status for a specific claw
docker compose -f ./openclaw/docker-compose.yml \
  --project-name claw-<name> ps
```

## Architecture

```
masterclaw
├── ~/.masterclaw/config/instances/<name>/env    ← per-instance env vars (sourced at runtime)
├── ~/claws/<name>/                              ← openclaw config dir
│   ├── openclaw.json        ← gateway config including auth token
│   ├── identity/            ← device identity
│   ├── agents/main/         ← agent sessions and auth state
│   ├── credentials/         ← Telegram, WhatsApp, etc.
│   └── workspace/           ← agent's working files (SOUL.md, IDENTITY.md, etc.)
└── ~/.masterclaw/openclaw/                     ← support checkout for docker compose + setup script
```

All Docker operations use the shared compose file at `./openclaw/docker-compose.yml` with `--project-name claw-<name>` for isolation. The env vars set in `.instances/<name>/env` are exported before each `docker compose` call.

## Token management

If `openclaw.json` already exists in the config dir when `masterclaw add` is run, the existing gateway token is preserved (parsed via Python). Otherwise a new 32-byte hex token is generated with `openssl rand -hex 32`.
