# masterclaw

> Wake me when you need me.

Manage multiple [openclaw](https://github.com/openclaw/openclaw) agent instances side-by-side. Each claw is a named Docker Compose deployment with its own config directory, workspace, and port pair.

## Install

```bash
npm i -g masterclaw
```

This installs a `masterclaw` binary on your `PATH`.

If your npm global prefix points at a protected directory such as `/usr/local`, use the local-prefix installer instead:

```bash
./install-cli.sh
```

Or install the published package into a user-owned prefix:

```bash
./install-cli.sh masterclaw@latest
```

This mirrors OpenClaw's local-prefix install approach and avoids `EACCES` errors from `/usr/local/bin`.

## Install Troubleshooting

If `npm install -g masterclaw` fails with `EACCES`, check where npm is trying to install global packages:

```bash
npm prefix -g
echo "$PATH"
```

If that prefix is a system directory such as `/usr/local`, either:

1. Set npm to use your existing user-owned prefix:

```bash
npm config set prefix "$HOME/.npm-global"
hash -r
npm install -g masterclaw
```

2. Or use the bundled local-prefix installer:

```bash
./install-cli.sh masterclaw@latest
```

OpenClaw's official docs troubleshoot global CLI installs the same way: they tell users to inspect `npm prefix -g`, ensure `$(npm prefix -g)/bin` is on `PATH`, and they also offer a local-prefix installer path.

## Quickstart

```bash
# 1. Fetch OpenClaw support files and pull the released runtime image
masterclaw init

# 2. Create your first claw and run openclaw's interactive setup
masterclaw create elbo

# 3. Start it
masterclaw start elbo
```

## Runtime Paths

By default, `masterclaw` stores shared runtime state under your home directory:

| Concern | Path |
| --- | --- |
| CLI config and instance registry | `~/.masterclaw/config/instances/` |
| Openclaw source clone | `~/.masterclaw/openclaw/` |
| Docker Compose file | `~/.masterclaw/openclaw/docker-compose.yml` |
| Per-claw config dir | `~/claws/<name>/` |
| Per-claw workspace | `~/claws/<name>/workspace/` |

Power users can override the roots with:

- `MASTERCLAW_HOME` for `~/.masterclaw`
- `MASTERCLAW_CLAWS_DIR` for `~/claws`

Per-claw `--config` and `--workspace` flags still override the defaults on `add`, `create`, and `import`.

## Commands

| Command | Description |
| --- | --- |
| `init` | Fetch OpenClaw support files and prepare the default runtime image |
| `list` | List all registered claws and their status |
| `add <name>` | Register a new claw instance |
| `create <name>` | Register + run docker setup in one step |
| `import <name> <backup.tar.gz>` | Restore a claw from an openclaw backup archive |
| `setup <name>` | Run openclaw docker setup |
| `start <name>` | Start a claw |
| `stop <name>` | Stop a claw |
| `restart <name>` | Restart a claw |
| `status <name>` | Show status and info for a claw |
| `logs <name> [args...]` | Follow gateway logs |
| `exec <name> [cmd...]` | Run an openclaw CLI command inside the claw |
| `shell <name>` | Open an interactive bash shell in the gateway container |
| `update <name>` | Refresh support files, rebuild or pull the image, and restart the claw |
| `remove <name>` | Stop and unregister a claw (config/workspace preserved) |
| `token <name>` | Print the gateway token |
| `url <name>` | Print the dashboard URL |

## Options for `add`, `create`, and `import`

```text
--config <dir>     Config directory (default: ~/claws/<name>)
--workspace <dir>  Workspace directory (default: ~/claws/<name>/workspace)
--port <port>      Gateway port (bridge port = gateway port + 1)
                   Default: next available port starting from 18789
--image <image>    OpenClaw image (default: ghcr.io/openclaw/openclaw:latest)
```

## Runtime Defaults

By default, new claws use the released container image:

```text
ghcr.io/openclaw/openclaw:latest
```

That matches OpenClaw's recommended install posture more closely: normal users consume released artifacts, while source builds remain an opt-in contributor path.

For contributors who want a local source image instead:

```bash
masterclaw init --build-local
masterclaw create devclaw --image openclaw:local
```

## Instance Registry Format

Each registered claw is stored at `~/.masterclaw/config/instances/<name>/env` as a shell-sourceable file:

```bash
CLAW_NAME=elbo
OPENCLAW_CONFIG_DIR=/Users/sebas/claws/elbo
OPENCLAW_WORKSPACE_DIR=/Users/sebas/claws/elbo/workspace
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_BRIDGE_PORT=18790
OPENCLAW_GATEWAY_TOKEN=...
OPENCLAW_IMAGE=openclaw:local
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_SANDBOX=
OPENCLAW_TZ=
OPENCLAW_EXTRA_MOUNTS=
OPENCLAW_HOME_VOLUME=
OPENCLAW_DOCKER_APT_PACKAGES=
OPENCLAW_EXTENSIONS=
OPENCLAW_ALLOW_INSECURE_PRIVATE_WS=
DOCKER_GID=
```

## Manual Test Plan

Run these on a laptop with Docker Compose v2, Git, and access to the `openclaw` repository:

1. Build and install the package locally.

```bash
npm install
npm run build
npm i -g .
masterclaw --help
```

2. Verify default `init`.

```bash
masterclaw init
test -d "$HOME/.masterclaw/openclaw"
docker image inspect ghcr.io/openclaw/openclaw:latest >/dev/null
```

3. Verify contributor opt-in local build.

```bash
masterclaw init --build-local
docker image inspect openclaw:local >/dev/null
```

4. Verify `create`, `list`, `start`, `stop`, `token`, and `url`.

```bash
masterclaw create elbo
masterclaw list
masterclaw start elbo
masterclaw status elbo
masterclaw token elbo
masterclaw url elbo
masterclaw stop elbo
```

5. Verify `logs` and `exec`.

```bash
masterclaw start elbo
masterclaw logs elbo --tail 5
masterclaw exec elbo channels login
masterclaw stop elbo
```

6. Verify `import`.

```bash
masterclaw import imported /path/to/backup.tar.gz
masterclaw status imported
```

7. Verify `remove` preserves config and workspace.

```bash
masterclaw remove elbo
test ! -d "$HOME/.masterclaw/config/instances/elbo"
test -d "$HOME/claws/elbo"
```

8. Verify released-image update flow.

```bash
masterclaw update imported
```

9. Verify local-image update flow for contributors.

```bash
masterclaw create localdev --image openclaw:local
masterclaw update localdev
```
