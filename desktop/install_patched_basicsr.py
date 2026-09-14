"""Install basicsr from a patched sdist so it builds on Python 3.13+.

Usage:
    python desktop/install_patched_basicsr.py

Run this with the build venv's interpreter, before installing the parent
project's requirements. basicsr==1.4.2 (a dependency of realesrgan, pinned in
requirements.txt) is unmaintained and fails to build on Python 3.13 with
"KeyError: '__version__'" - see patch_basicsr_setup.py for why. This fetches
its sdist from PyPI, patches the bug out, and installs it, so the main
requirements install finds it already satisfied instead of trying to build
the broken version.

Pure Python (no curl/tar) so build.sh and build.cmd share one implementation.
"""
import json
import re
import ssl
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from importlib import metadata
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent
PARENT_DIR = DESKTOP_DIR.parent


def pinned_version() -> str | None:
    requirements = (PARENT_DIR / "requirements.txt").read_text()
    match = re.search(r"^basicsr==([A-Za-z0-9.]+)", requirements, re.MULTILINE)
    return match.group(1) if match else None


def installed_version() -> str | None:
    try:
        return metadata.version("basicsr")
    except metadata.PackageNotFoundError:
        return None


def ssl_context() -> ssl.SSLContext:
    # python.org's macOS installer ships without CA certificates (until the
    # user runs "Install Certificates.command"), so the default context fails
    # verification there. Use certifi's bundle instead - the copy vendored in
    # pip is always present in a venv, even when certifi itself isn't.
    try:
        import certifi
    except ImportError:
        from pip._vendor import certifi
    return ssl.create_default_context(cafile=certifi.where())


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, context=ssl_context()) as resp:
        return resp.read()


def sdist_url(version: str) -> str:
    release = json.loads(fetch(f"https://pypi.org/pypi/basicsr/{version}/json"))
    return next(u["url"] for u in release["urls"] if u["packagetype"] == "sdist")


def fetch_patched_source(version: str, work_dir: Path) -> Path:
    archive = work_dir / "basicsr.tar.gz"
    archive.write_bytes(fetch(sdist_url(version)))
    with tarfile.open(archive) as tar:
        # The "data" filter blocks path traversal; older patch releases of
        # 3.10/3.11 predate it and don't accept the argument.
        if hasattr(tarfile, "data_filter"):
            tar.extractall(work_dir, filter="data")
        else:
            tar.extractall(work_dir)
    src_dir = next(work_dir.glob("basicsr-*"))
    subprocess.run(
        [sys.executable, str(DESKTOP_DIR / "patch_basicsr_setup.py"), str(src_dir / "setup.py")],
        check=True,
    )
    return src_dir


def main() -> int:
    version = pinned_version()
    if version is None:
        print("basicsr is not pinned in requirements.txt; nothing to patch.")
        return 0
    if installed_version() == version:
        return 0

    print(f"Fetching and patching basicsr {version} for Python 3.13 compatibility...")
    with tempfile.TemporaryDirectory() as tmp:
        src_dir = fetch_patched_source(version, Path(tmp))
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--quiet",
             "--no-build-isolation", "--no-deps", str(src_dir)],
            check=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
