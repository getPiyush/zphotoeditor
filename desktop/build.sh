#!/usr/bin/env bash
# One-command build for macOS and Linux: creates an isolated venv, installs
# the parent project's and the desktop wrapper's dependencies into it, then
# runs build.py. See build.py for what it produces and its cross-platform
# caveat (this only builds for the OS it runs on).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$SCRIPT_DIR/.build-venv"

PYTHON=""
for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON="$candidate"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "Python 3 was not found on this machine."
    case "$(uname -s)" in
        Darwin)
            echo "Install it from https://www.python.org/downloads/macos/ or run: brew install python"
            ;;
        *)
            echo "Install it with your distro's package manager, e.g.: sudo apt install python3 python3-venv"
            echo "See https://www.python.org/downloads/ for other options."
            ;;
    esac
    exit 1
fi

"$PYTHON" -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$PARENT_DIR/requirements.txt" -r "$SCRIPT_DIR/requirements.txt"
"$VENV_DIR/bin/python" "$SCRIPT_DIR/build.py"

echo "Done. Executable is in $SCRIPT_DIR/dist/"
