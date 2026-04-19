#!/usr/bin/env bash
set -euo pipefail

PREFIX="${MASTERCLAW_INSTALL_PREFIX:-${MASTERCLAW_HOME:-$HOME/.masterclaw}}"
BIN_DIR="$PREFIX/bin"
PACKAGE_SPEC="${1:-.}"

usage() {
  cat <<EOF
Usage: ./install-cli.sh [package-spec]

Install masterclaw into a user-writable npm prefix instead of /usr/local.

Defaults:
  package-spec: .
  prefix:       ${PREFIX}

Examples:
  ./install-cli.sh
  ./install-cli.sh masterclaw@latest
  MASTERCLAW_INSTALL_PREFIX="\$HOME/.masterclaw" ./install-cli.sh masterclaw@latest
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

mkdir -p "$PREFIX"

echo "==> Installing masterclaw"
echo "    package: $PACKAGE_SPEC"
echo "    prefix:  $PREFIX"
echo

npm install -g "$PACKAGE_SPEC" --prefix "$PREFIX"

echo
echo "Installed."

case ":$PATH:" in
  *":$BIN_DIR:"*)
    echo "Binary path already on PATH: $BIN_DIR"
    ;;
  *)
    echo "Add this to your shell profile if needed:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo
echo "Verify:"
echo "  $BIN_DIR/masterclaw --help"
