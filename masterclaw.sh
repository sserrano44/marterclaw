#!/usr/bin/env bash
# masterclaw — Wake me when you need me.
set -euo pipefail

CLAWS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTANCES_DIR="$CLAWS_DIR/.instances"
CLAWS_CONFIGS_DIR="$CLAWS_DIR/claws"
OPENCLAW_DIR="$CLAWS_DIR/openclaw"
COMPOSE_FILE="$OPENCLAW_DIR/docker-compose.yml"

# Default port range start (each claw uses 2 ports: gateway + bridge)
DEFAULT_PORT_START=18789

usage() {
  cat <<EOF
Usage: masterclaw <command> [name] [options]

Commands:
  init                        Clone openclaw repo and build the Docker image
  list                        List all registered claws and their status
  add <name> [options]        Register a new claw instance
  create <name> [options]     Register + run docker setup in one step (add + setup)
  import <name> <backup.tar.gz> [options]
                              Restore a claw from an openclaw backup archive
  setup <name>                Run openclaw docker setup (interactive onboarding)
  start <name>                Start a claw
  stop <name>                 Stop a claw
  restart <name>              Restart a claw
  status <name>               Show status and info for a claw
  logs <name> [args...]       Follow gateway logs (extra args passed to docker compose logs)
  exec <name> [cmd...]        Run openclaw CLI command inside the claw
  shell <name>                Open an interactive bash shell in the gateway container
  update <name>               Rebuild/pull the openclaw image and restart the claw
  remove <name>               Stop and unregister a claw (config/workspace preserved)
  token <name>                Print the gateway token for a claw
  url <name>                  Print the dashboard URL for a claw

Options for 'add' / 'import':
  --config <dir>     Config directory (default: $CLAWS_CONFIGS_DIR/<name>)
  --workspace <dir>  Workspace directory (default: $CLAWS_CONFIGS_DIR/<name>/workspace)
  --port <port>      Gateway port (bridge port = gateway port + 1)
                     Default: next available port starting from $DEFAULT_PORT_START

Examples:
  masterclaw create elbo
  masterclaw create mybot --port 18800
  masterclaw create mybot --config /path/to/config --workspace /path/to/workspace
  masterclaw import godin godin-openclaw-backup.tar.gz
  masterclaw import godin godin-openclaw-backup.tar.gz --port 18800
  masterclaw add elbo --port 18789
  masterclaw start elbo
  masterclaw list
  masterclaw logs elbo
  masterclaw exec elbo channels login
EOF
}

fail() { echo "ERROR: $*" >&2; exit 1; }

require_name() {
  [[ -n "${1:-}" ]] || fail "claw name required"
}

instance_dir() { echo "$INSTANCES_DIR/$1"; }
instance_env() { echo "$INSTANCES_DIR/$1/env"; }

load_instance() {
  local name="$1"
  local env_file
  env_file="$(instance_env "$name")"
  [[ -f "$env_file" ]] || fail "claw '$name' not found. Run: masterclaw add $name"
  # shellcheck source=/dev/null
  source "$env_file"
}

compose_args() {
  local name="$1"
  echo "-f $COMPOSE_FILE --project-name claw-$name"
}

next_available_port() {
  local port=$DEFAULT_PORT_START
  while true; do
    local in_use=false
    for env_file in "$INSTANCES_DIR"/*/env; do
      [[ -f "$env_file" ]] || continue
      # shellcheck source=/dev/null
      source "$env_file"
      if [[ "$OPENCLAW_GATEWAY_PORT" == "$port" || "$OPENCLAW_BRIDGE_PORT" == "$port" ]]; then
        in_use=true
        break
      fi
    done
    if [[ "$in_use" == false ]]; then
      echo "$port"
      return
    fi
    (( port += 2 ))
  done
}

cmd_list() {
  if [[ ! -d "$INSTANCES_DIR" ]] || [[ -z "$(ls -A "$INSTANCES_DIR" 2>/dev/null)" ]]; then
    echo "No claws registered. Use: masterclaw add <name>"
    return
  fi

  printf "%-15s %-8s %-8s %-12s %-40s\n" "NAME" "G-PORT" "B-PORT" "STATUS" "CONFIG_DIR"
  printf "%-15s %-8s %-8s %-12s %-40s\n" "----" "------" "------" "------" "----------"

  for env_file in "$INSTANCES_DIR"/*/env; do
    [[ -f "$env_file" ]] || continue
    unset CLAW_NAME OPENCLAW_GATEWAY_PORT OPENCLAW_BRIDGE_PORT OPENCLAW_CONFIG_DIR OPENCLAW_WORKSPACE_DIR
    # shellcheck source=/dev/null
    source "$env_file"
    local status
    if docker compose -f "$COMPOSE_FILE" --project-name "claw-$CLAW_NAME" ps --quiet openclaw-gateway 2>/dev/null | grep -q .; then
      status="running"
    else
      status="stopped"
    fi
    printf "%-15s %-8s %-8s %-12s %-40s\n" \
      "$CLAW_NAME" \
      "$OPENCLAW_GATEWAY_PORT" \
      "$OPENCLAW_BRIDGE_PORT" \
      "$status" \
      "$OPENCLAW_CONFIG_DIR"
  done
}

cmd_add() {
  local name="$1"; shift
  require_name "$name"

  local config_dir="$CLAWS_CONFIGS_DIR/$name"
  local workspace_dir="$CLAWS_CONFIGS_DIR/$name/workspace"
  local port=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --config)    config_dir="$2"; shift 2 ;;
      --workspace) workspace_dir="$2"; shift 2 ;;
      --port)      port="$2"; shift 2 ;;
      *) fail "Unknown option: $1" ;;
    esac
  done

  local inst_dir
  inst_dir="$(instance_dir "$name")"
  if [[ -d "$inst_dir" ]]; then
    fail "claw '$name' already registered. Use 'masterclaw remove $name' first to re-add."
  fi

  if [[ -z "$port" ]]; then
    port="$(next_available_port)"
  fi
  local bridge_port=$(( port + 1 ))

  # Read existing token from config if present
  local token=""
  local config_json="$config_dir/openclaw.json"
  if [[ -f "$config_json" ]] && command -v python3 >/dev/null 2>&1; then
    token="$(python3 - "$config_json" <<'PY'
import json, sys
try:
    cfg = json.load(open(sys.argv[1]))
    t = cfg.get("gateway", {}).get("auth", {}).get("token", "")
    if t: print(t.strip())
except: pass
PY
)" || true
  fi
  if [[ -z "$token" ]]; then
    token="$(openssl rand -hex 32 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(32))')"
  fi

  mkdir -p "$inst_dir"
  mkdir -p "$config_dir"
  mkdir -p "$workspace_dir"
  mkdir -p "$config_dir/identity"
  mkdir -p "$config_dir/agents/main/agent"
  mkdir -p "$config_dir/agents/main/sessions"

  cat >"$(instance_env "$name")" <<ENV
CLAW_NAME=$name
OPENCLAW_CONFIG_DIR=$config_dir
OPENCLAW_WORKSPACE_DIR=$workspace_dir
OPENCLAW_GATEWAY_PORT=$port
OPENCLAW_BRIDGE_PORT=$bridge_port
OPENCLAW_GATEWAY_TOKEN=$token
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
ENV

  echo "Registered claw '$name'"
  echo "  Config:    $config_dir"
  echo "  Workspace: $workspace_dir"
  echo "  Gateway:   http://localhost:$port  (token: $token)"
  echo ""
  echo "Next steps:"
  echo "  masterclaw setup $name    # interactive onboarding (first time)"
  echo "  masterclaw start $name    # start the gateway"
}

cmd_create() {
  local name="$1"; shift
  require_name "$name"
  cmd_add "$name" "$@"
  echo ""
  cmd_setup "$name"
}

cmd_setup() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  export OPENCLAW_CONFIG_DIR OPENCLAW_WORKSPACE_DIR OPENCLAW_GATEWAY_PORT \
         OPENCLAW_BRIDGE_PORT OPENCLAW_GATEWAY_TOKEN OPENCLAW_IMAGE \
         OPENCLAW_GATEWAY_BIND OPENCLAW_SANDBOX OPENCLAW_TZ \
         OPENCLAW_EXTRA_MOUNTS OPENCLAW_HOME_VOLUME \
         OPENCLAW_DOCKER_APT_PACKAGES OPENCLAW_EXTENSIONS \
         OPENCLAW_ALLOW_INSECURE_PRIVATE_WS DOCKER_GID

  echo "==> Running openclaw setup for claw '$name'"
  echo "    Config:    $OPENCLAW_CONFIG_DIR"
  echo "    Workspace: $OPENCLAW_WORKSPACE_DIR"
  echo "    Port:      $OPENCLAW_GATEWAY_PORT"
  echo ""

  # Setup runs docker compose from OPENCLAW_DIR context with per-instance env
  # COMPOSE_PROJECT_NAME is the real Docker Compose env var for project namespacing
  COMPOSE_PROJECT_NAME="claw-$name" \
  bash "$OPENCLAW_DIR/scripts/docker/setup.sh"
}

cmd_start() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  echo "Starting claw '$name' on port $OPENCLAW_GATEWAY_PORT..."
  env OPENCLAW_CONFIG_DIR="$OPENCLAW_CONFIG_DIR" \
      OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
      OPENCLAW_GATEWAY_PORT="$OPENCLAW_GATEWAY_PORT" \
      OPENCLAW_BRIDGE_PORT="$OPENCLAW_BRIDGE_PORT" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
      OPENCLAW_IMAGE="$OPENCLAW_IMAGE" \
      OPENCLAW_GATEWAY_BIND="$OPENCLAW_GATEWAY_BIND" \
      OPENCLAW_SANDBOX="$OPENCLAW_SANDBOX" \
      OPENCLAW_TZ="${OPENCLAW_TZ:-UTC}" \
      OPENCLAW_EXTRA_MOUNTS="$OPENCLAW_EXTRA_MOUNTS" \
      OPENCLAW_HOME_VOLUME="$OPENCLAW_HOME_VOLUME" \
      OPENCLAW_DOCKER_APT_PACKAGES="$OPENCLAW_DOCKER_APT_PACKAGES" \
      OPENCLAW_EXTENSIONS="$OPENCLAW_EXTENSIONS" \
      OPENCLAW_ALLOW_INSECURE_PRIVATE_WS="$OPENCLAW_ALLOW_INSECURE_PRIVATE_WS" \
      DOCKER_GID="${DOCKER_GID:-}" \
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" \
      up -d openclaw-gateway

  echo "Started. Dashboard: http://localhost:$OPENCLAW_GATEWAY_PORT"
}

cmd_stop() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  echo "Stopping claw '$name'..."
  env OPENCLAW_CONFIG_DIR="$OPENCLAW_CONFIG_DIR" \
      OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
      OPENCLAW_GATEWAY_PORT="$OPENCLAW_GATEWAY_PORT" \
      OPENCLAW_BRIDGE_PORT="$OPENCLAW_BRIDGE_PORT" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
      OPENCLAW_IMAGE="$OPENCLAW_IMAGE" \
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" \
      down
  echo "Stopped."
}

cmd_restart() {
  local name="$1"
  require_name "$name"
  cmd_stop "$name"
  cmd_start "$name"
}

cmd_status() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  echo "==> Claw: $name"
  echo "    Config:    $OPENCLAW_CONFIG_DIR"
  echo "    Workspace: $OPENCLAW_WORKSPACE_DIR"
  echo "    Gateway:   http://localhost:$OPENCLAW_GATEWAY_PORT"
  echo "    Bridge:    port $OPENCLAW_BRIDGE_PORT"
  echo "    Token:     $OPENCLAW_GATEWAY_TOKEN"
  echo ""
  env OPENCLAW_CONFIG_DIR="$OPENCLAW_CONFIG_DIR" \
      OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
      OPENCLAW_GATEWAY_PORT="$OPENCLAW_GATEWAY_PORT" \
      OPENCLAW_BRIDGE_PORT="$OPENCLAW_BRIDGE_PORT" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
      OPENCLAW_IMAGE="$OPENCLAW_IMAGE" \
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" \
      ps 2>/dev/null || true
}

cmd_logs() {
  local name="$1"; shift
  require_name "$name"
  load_instance "$name"

  env OPENCLAW_CONFIG_DIR="$OPENCLAW_CONFIG_DIR" \
      OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
      OPENCLAW_GATEWAY_PORT="$OPENCLAW_GATEWAY_PORT" \
      OPENCLAW_BRIDGE_PORT="$OPENCLAW_BRIDGE_PORT" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
      OPENCLAW_IMAGE="$OPENCLAW_IMAGE" \
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" \
      logs -f "${@:-openclaw-gateway}"
}

cmd_exec() {
  local name="$1"; shift
  require_name "$name"
  load_instance "$name"

  env OPENCLAW_CONFIG_DIR="$OPENCLAW_CONFIG_DIR" \
      OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
      OPENCLAW_GATEWAY_PORT="$OPENCLAW_GATEWAY_PORT" \
      OPENCLAW_BRIDGE_PORT="$OPENCLAW_BRIDGE_PORT" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
      OPENCLAW_IMAGE="$OPENCLAW_IMAGE" \
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" \
      run --rm openclaw-cli "$@"
}

cmd_shell() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  env OPENCLAW_CONFIG_DIR="$OPENCLAW_CONFIG_DIR" \
      OPENCLAW_WORKSPACE_DIR="$OPENCLAW_WORKSPACE_DIR" \
      OPENCLAW_GATEWAY_PORT="$OPENCLAW_GATEWAY_PORT" \
      OPENCLAW_BRIDGE_PORT="$OPENCLAW_BRIDGE_PORT" \
      OPENCLAW_GATEWAY_TOKEN="$OPENCLAW_GATEWAY_TOKEN" \
      OPENCLAW_IMAGE="$OPENCLAW_IMAGE" \
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" \
      exec openclaw-gateway bash
}

cmd_init() {
  if [[ -d "$OPENCLAW_DIR" ]]; then
    echo "openclaw already present at $OPENCLAW_DIR"
  else
    echo "Cloning openclaw into $OPENCLAW_DIR..."
    git clone git@github.com:openclaw/openclaw.git "$OPENCLAW_DIR"
  fi

  echo "Building Docker image (openclaw:local)..."
  DOCKER_BUILDKIT=1 docker build -t openclaw:local "$OPENCLAW_DIR"

  echo ""
  echo "Done. openclaw is ready. Next:"
  echo "  masterclaw create <name>    # create your first claw"
}

cmd_update() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  echo "Updating openclaw for claw '$name'..."

  if [[ "$OPENCLAW_IMAGE" == "openclaw:local" ]]; then
    # Local image: pull latest source then rebuild
    echo "==> Pulling latest openclaw source..."
    git -C "$OPENCLAW_DIR" pull

    echo "==> Rebuilding image..."
    docker compose -f "$COMPOSE_FILE" --project-name "claw-$name" build openclaw-gateway
  else
    # Pre-built image (e.g. ghcr.io/openclaw/openclaw:latest): just pull
    echo "==> Pulling updated image: $OPENCLAW_IMAGE"
    docker pull "$OPENCLAW_IMAGE"
  fi

  echo "==> Restarting claw '$name'..."
  cmd_stop "$name"
  cmd_start "$name"

  echo "Done."
}

cmd_remove() {
  local name="$1"
  require_name "$name"
  load_instance "$name"

  echo "Stopping claw '$name' before removal..."
  cmd_stop "$name" 2>/dev/null || true

  local inst_dir
  inst_dir="$(instance_dir "$name")"
  rm -rf "$inst_dir"

  echo "Removed claw '$name' from registry."
  echo "Note: config and workspace at '$OPENCLAW_CONFIG_DIR' were NOT deleted."
}

cmd_token() {
  local name="$1"
  require_name "$name"
  load_instance "$name"
  echo "$OPENCLAW_GATEWAY_TOKEN"
}

cmd_url() {
  local name="$1"
  require_name "$name"
  load_instance "$name"
  echo "http://localhost:$OPENCLAW_GATEWAY_PORT"
}

cmd_import() {
  local name="$1"; shift
  require_name "$name"

  local backup_file=""
  local port=""
  local config_dir="$CLAWS_CONFIGS_DIR/$name"
  local workspace_dir="$CLAWS_CONFIGS_DIR/$name/workspace"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --port)      port="$2"; shift 2 ;;
      --config)    config_dir="$2"; shift 2 ;;
      --workspace) workspace_dir="$2"; shift 2 ;;
      -*)          fail "Unknown option: $1" ;;
      *)           backup_file="$1"; shift ;;
    esac
  done

  [[ -n "$backup_file" ]] || fail "backup file required. Usage: masterclaw import <name> <backup.tar.gz>"
  [[ -f "$backup_file" ]] || fail "backup file not found: $backup_file"

  # Locate openclaw.json inside the archive to determine the strip depth
  local openclaw_json_path
  openclaw_json_path="$(tar -tzf "$backup_file" | grep -m1 'openclaw\.json$' || true)"
  [[ -n "$openclaw_json_path" ]] || fail "No openclaw.json found in backup — is this a valid openclaw backup?"

  # Strip count = number of path components in the directory containing openclaw.json
  # e.g. "<ts>-openclaw-backup/payload/posix/home/sebas/.openclaw/openclaw.json" → dirname has 6 parts
  local strip_count
  strip_count="$(dirname "$openclaw_json_path" | tr '/' '\n' | grep -c .)"

  echo "==> Extracting backup into $config_dir..."
  mkdir -p "$config_dir"
  tar -xzf "$backup_file" --strip-components="$strip_count" -C "$config_dir"
  echo "    Done."

  # Register the instance; cmd_add will read the token from the extracted openclaw.json
  local add_args=(--config "$config_dir" --workspace "$workspace_dir")
  [[ -n "$port" ]] && add_args+=(--port "$port")
  echo ""
  cmd_add "$name" "${add_args[@]}"

  echo ""
  echo "Import complete. Start with:"
  echo "  masterclaw start $name"
}

# ---- main ----
mkdir -p "$INSTANCES_DIR"

[[ $# -gt 0 ]] || { usage; exit 0; }

COMMAND="$1"; shift

case "$COMMAND" in
  init)    cmd_init ;;
  list)    cmd_list ;;
  create)  cmd_create "${1:-}" "${@:2}" ;;
  add)     cmd_add "${1:-}" "${@:2}" ;;
  import)  cmd_import "${1:-}" "${@:2}" ;;
  setup)   cmd_setup "${1:-}" ;;
  start)   cmd_start "${1:-}" ;;
  stop)    cmd_stop "${1:-}" ;;
  restart) cmd_restart "${1:-}" ;;
  status)  cmd_status "${1:-}" ;;
  logs)    cmd_logs "${1:-}" "${@:2}" ;;
  exec)    cmd_exec "${1:-}" "${@:2}" ;;
  shell)   cmd_shell "${1:-}" ;;
  update)  cmd_update "${1:-}" ;;
  remove)  cmd_remove "${1:-}" ;;
  token)   cmd_token "${1:-}" ;;
  url)     cmd_url "${1:-}" ;;
  help|-h|--help) usage ;;
  *) echo "Unknown command: $COMMAND"; echo; usage; exit 1 ;;
esac
