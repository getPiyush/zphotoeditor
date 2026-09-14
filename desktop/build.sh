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

# On Apple Silicon, prefer a native arm64 python.org install (framework
# layout) over whatever's on PATH: Homebrew installed under /usr/local is
# the Intel prefix and runs x86_64-only interpreters under Rosetta, and
# PyTorch no longer ships macOS x86_64 wheels at all - torch install would
# fail no matter which Python version that interpreter is.
if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
    for fw in /Library/Frameworks/Python.framework/Versions/*/bin/python3; do
        if [ -x "$fw" ] && [ "$("$fw" -c 'import platform; print(platform.machine())' 2>/dev/null)" = "arm64" ]; then
            PYTHON="$fw"
        fi
    done
fi

if [ -z "$PYTHON" ]; then
    for candidate in python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            PYTHON="$candidate"
            break
        fi
    done
fi

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

if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
    PYTHON_ARCH="$("$PYTHON" -c 'import platform; print(platform.machine())' 2>/dev/null || echo unknown)"
    if [ "$PYTHON_ARCH" != "arm64" ]; then
        echo "$PYTHON runs as $PYTHON_ARCH under Rosetta, but this Mac is Apple Silicon (arm64)."
        echo "PyTorch no longer publishes macOS x86_64 wheels, so torch will fail to install into it."
        echo "Install a native arm64 Python from https://www.python.org/downloads/macos/ (or set up an"
        echo "arm64 Homebrew under /opt/homebrew) and re-run this script."
        exit 1
    fi
fi

"$PYTHON" -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip setuptools wheel

# basicsr==1.4.2 fails to build on Python 3.13+; install a patched copy up
# front so the main install below finds it already satisfied. See
# install_patched_basicsr.py for details.
"$VENV_DIR/bin/python" "$SCRIPT_DIR/install_patched_basicsr.py"

"$VENV_DIR/bin/pip" install --quiet -r "$PARENT_DIR/requirements.txt" -r "$SCRIPT_DIR/requirements.txt"
"$VENV_DIR/bin/python" "$SCRIPT_DIR/build.py"

echo "Done. Executable is in $SCRIPT_DIR/dist/"
