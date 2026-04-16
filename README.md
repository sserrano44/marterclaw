# masterclaw

> Wake me when you need me.

Manage multiple [openclaw](https://github.com/openclaw) agents side-by-side. Each "claw" is a named openclaw instance running in Docker Compose with its own config, workspace, and port pair.

## Quick start

```bash
# 1. Clone openclaw and build the image
./masterclaw.sh init

# 2. Create your first claw (interactive onboarding)
./masterclaw.sh create mybot

# 3. Start it
./masterclaw.sh start mybot
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Clone openclaw repo and build the Docker image |
| `list` | List all registered claws and their status |
| `create <name>` | Register + run interactive docker setup |
| `add <name>` | Register a new claw (no setup) |
| `import <name> <backup.tar.gz>` | Restore a claw from an openclaw backup |
| `setup <name>` | Run openclaw interactive onboarding |
| `start <name>` | Start a claw |
| `stop <name>` | Stop a claw |
| `restart <name>` | Restart a claw |
| `status <name>` | Show status and connection info |
| `logs <name>` | Follow gateway logs |
| `exec <name> <cmd...>` | Run an openclaw CLI command inside the claw |
| `shell <name>` | Open a bash shell in the gateway container |
| `update <name>` | Pull latest openclaw and restart |
| `remove <name>` | Unregister a claw (config/workspace preserved) |
| `token <name>` | Print the gateway token |
| `url <name>` | Print the dashboard URL |

## Options for `add` / `import`

```
--config <dir>     Config directory  (default: ./claws/<name>/)
--workspace <dir>  Workspace dir     (default: ./claws/<name>/workspace/)
--port <port>      Gateway port; bridge = port+1
                   Default: next available starting from 18789
```

## Layout

```
masterclaw.sh
├── .instances/<name>/env    ← per-instance env vars (tokens, ports, paths)
├── claws/<name>/            ← openclaw config (gitignored)
│   ├── openclaw.json
│   ├── identity/
│   ├── agents/main/
│   ├── credentials/
│   └── workspace/
└── openclaw/                ← openclaw source clone (gitignored)
```

Instance configs (`claws/`) and the openclaw source (`openclaw/`) are gitignored — no tokens or credentials are ever committed.

## Requirements

- Docker with Compose v2
- `openssl` or Python 3 (for token generation)
