#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

MASTERCLAW_HOME="${MASTERCLAW_HOME:-$HOME/.masterclaw}"
MASTERCLAW_CLAWS_DIR="${MASTERCLAW_CLAWS_DIR:-$HOME/claws}"

OLD_INSTANCES_DIR="$REPO_ROOT/.instances"
OLD_CLAWS_DIR="$REPO_ROOT/claws"
OLD_OPENCLAW_DIR="$REPO_ROOT/openclaw"

NEW_CONFIG_DIR="$MASTERCLAW_HOME/config"
NEW_INSTANCES_DIR="$NEW_CONFIG_DIR/instances"
NEW_OPENCLAW_DIR="$MASTERCLAW_HOME/openclaw"

MODE="copy"

usage() {
  cat <<EOF
Usage: ./migrate.sh [--copy|--move]

Migrate a repo-local masterclaw.sh setup into the new home-directory layout.

Defaults:
  MASTERCLAW_HOME=${MASTERCLAW_HOME}
  MASTERCLAW_CLAWS_DIR=${MASTERCLAW_CLAWS_DIR}

Options:
  --copy    Copy repo-local state into the new layout and leave the old files in place
  --move    Move repo-local state into the new layout
  -h, --help
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo "==> $*"
}

warn() {
  echo "WARN: $*" >&2
}

path_exists() {
  [[ -e "$1" ]]
}

is_under_dir() {
  local child="$1"
  local parent="$2"

  [[ "$child" == "$parent" ]] || [[ "$child" == "$parent/"* ]]
}

map_repo_path() {
  local current_path="$1"
  local old_base="$2"
  local new_base="$3"

  if [[ "$current_path" == "$old_base" ]]; then
    printf '%s\n' "$new_base"
    return
  fi

  if [[ "$current_path" == "$old_base/"* ]]; then
    printf '%s\n' "$new_base/${current_path#"$old_base"/}"
    return
  fi

  printf '%s\n' "$current_path"
}

copy_tree() {
  local src="$1"
  local dst="$2"

  mkdir -p "$dst"
  cp -R "$src"/. "$dst"/
}

move_tree() {
  local src="$1"
  local dst="$2"
  local dst_parent

  dst_parent="$(dirname "$dst")"
  mkdir -p "$dst_parent"
  mv "$src" "$dst"
}

migrate_dir() {
  local src="$1"
  local dst="$2"
  local label="$3"

  if [[ "$src" == "$dst" ]]; then
    return
  fi

  if ! path_exists "$src"; then
    warn "$label source not found: $src"
    return
  fi

  if path_exists "$dst"; then
    warn "$label target already exists, leaving source untouched: $dst"
    return
  fi

  log "$MODE $label"
  echo "    from: $src"
  echo "    to:   $dst"

  if [[ "$MODE" == "move" ]]; then
    move_tree "$src" "$dst"
  else
    copy_tree "$src" "$dst"
  fi
}

rewrite_env_file() {
  local src_env="$1"
  local dst_env="$2"
  local new_config_dir="$3"
  local new_workspace_dir="$4"

  mkdir -p "$(dirname "$dst_env")"

  {
    while IFS= read -r line || [[ -n "$line" ]]; do
      case "$line" in
        OPENCLAW_CONFIG_DIR=*)
          printf 'OPENCLAW_CONFIG_DIR=%s\n' "$new_config_dir"
          ;;
        OPENCLAW_WORKSPACE_DIR=*)
          printf 'OPENCLAW_WORKSPACE_DIR=%s\n' "$new_workspace_dir"
          ;;
        *)
          printf '%s\n' "$line"
          ;;
      esac
    done <"$src_env"
  } >"$dst_env"
}

cleanup_empty_repo_dirs() {
  if [[ "$MODE" != "move" ]]; then
    return
  fi

  rmdir "$OLD_INSTANCES_DIR" 2>/dev/null || true
  rmdir "$OLD_CLAWS_DIR" 2>/dev/null || true
  rmdir "$OLD_OPENCLAW_DIR" 2>/dev/null || true
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy)
      MODE="copy"
      shift
      ;;
    --move)
      MODE="move"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

mkdir -p "$NEW_INSTANCES_DIR" "$MASTERCLAW_CLAWS_DIR"

log "Migrating masterclaw state"
echo "    repo root:         $REPO_ROOT"
echo "    masterclaw home:   $MASTERCLAW_HOME"
echo "    claws dir:         $MASTERCLAW_CLAWS_DIR"
echo "    mode:              $MODE"

if path_exists "$OLD_OPENCLAW_DIR"; then
  migrate_dir "$OLD_OPENCLAW_DIR" "$NEW_OPENCLAW_DIR" "openclaw checkout"
else
  warn "No repo-local openclaw checkout found at $OLD_OPENCLAW_DIR"
fi

if [[ ! -d "$OLD_INSTANCES_DIR" ]]; then
  warn "No repo-local instances found at $OLD_INSTANCES_DIR"
  exit 0
fi

shopt -s nullglob

for src_env in "$OLD_INSTANCES_DIR"/*/env; do
  [[ -f "$src_env" ]] || continue

  unset CLAW_NAME OPENCLAW_CONFIG_DIR OPENCLAW_WORKSPACE_DIR
  # shellcheck source=/dev/null
  source "$src_env"

  claw_name="${CLAW_NAME:-$(basename "$(dirname "$src_env")")}"
  [[ -n "$claw_name" ]] || fail "Could not determine claw name from $src_env"

  old_config_dir="${OPENCLAW_CONFIG_DIR:-$OLD_CLAWS_DIR/$claw_name}"
  old_workspace_dir="${OPENCLAW_WORKSPACE_DIR:-$old_config_dir/workspace}"

  new_config_dir="$(map_repo_path "$old_config_dir" "$OLD_CLAWS_DIR" "$MASTERCLAW_CLAWS_DIR")"
  new_workspace_dir="$(map_repo_path "$old_workspace_dir" "$OLD_CLAWS_DIR" "$MASTERCLAW_CLAWS_DIR")"

  log "Migrating claw '$claw_name'"

  if is_under_dir "$old_config_dir" "$OLD_CLAWS_DIR"; then
    migrate_dir "$old_config_dir" "$new_config_dir" "claw config"
  fi

  if is_under_dir "$old_workspace_dir" "$OLD_CLAWS_DIR" && ! is_under_dir "$old_workspace_dir" "$old_config_dir"; then
    migrate_dir "$old_workspace_dir" "$new_workspace_dir" "claw workspace"
  fi

  target_instance_dir="$NEW_INSTANCES_DIR/$claw_name"
  target_env="$target_instance_dir/env"

  if [[ "$MODE" == "move" ]]; then
    mkdir -p "$target_instance_dir"
    rewrite_env_file "$src_env" "$target_env" "$new_config_dir" "$new_workspace_dir"
    rm -f "$src_env"
    rmdir "$(dirname "$src_env")" 2>/dev/null || true
  else
    rewrite_env_file "$src_env" "$target_env" "$new_config_dir" "$new_workspace_dir"
  fi

  echo "    instance env: $target_env"
done

cleanup_empty_repo_dirs

echo
echo "Migration complete."
echo "Next checks:"
echo "  MASTERCLAW_HOME=\"$MASTERCLAW_HOME\" MASTERCLAW_CLAWS_DIR=\"$MASTERCLAW_CLAWS_DIR\" masterclaw list"
echo "  MASTERCLAW_HOME=\"$MASTERCLAW_HOME\" MASTERCLAW_CLAWS_DIR=\"$MASTERCLAW_CLAWS_DIR\" masterclaw status <name>"
