"""Build zPhotoEditor into a single-file desktop executable with PyInstaller.

Usage:
    python desktop/build.py

Output lands in desktop/dist/ as one file: ZPhotoEditor on macOS/Linux,
ZPhotoEditor.exe on Windows.

PyInstaller does not cross-compile: this only builds an executable for the
OS/architecture it's run on. To ship for macOS, Windows and Linux, run this
same command on a machine (or CI runner) of each target OS -- each run
produces that platform's single-file executable in its own desktop/dist/.

This does not copy or modify the parent zphotoeditor project -- it points
PyInstaller at it directly (--paths, --add-data) so app.py, templates/,
static/ and models/ are picked up from where they already live.
"""
import os
import subprocess
import sys
from pathlib import Path

DESKTOP_DIR = Path(__file__).resolve().parent
PARENT_DIR = DESKTOP_DIR.parent

# Heavy ML packages whose non-.py assets / dynamic imports PyInstaller's
# static analysis tends to miss (native extensions, plugin registries).
COLLECT_ALL = ("torch", "torchvision", "cv2", "basicsr", "facexlib", "gfpgan", "realesrgan")


def add_data(src: Path, dest_name: str) -> str:
    return f"{src}{os.pathsep}{dest_name}"


def main() -> None:
    if not (PARENT_DIR / "app.py").exists():
        sys.exit(f"Expected parent app at {PARENT_DIR / 'app.py'}, not found")

    args = [
        sys.executable, "-m", "PyInstaller",
        "--name", "ZPhotoEditor",
        "--onefile",
        "--windowed",
        "--noconfirm",
        "--distpath", str(DESKTOP_DIR / "dist"),
        "--workpath", str(DESKTOP_DIR / "build"),
        "--specpath", str(DESKTOP_DIR),
        "--paths", str(PARENT_DIR),
        "--add-data", add_data(PARENT_DIR / "templates", "templates"),
        "--add-data", add_data(PARENT_DIR / "static", "static"),
    ]

    models_dir = PARENT_DIR / "models"
    if models_dir.exists() and any(models_dir.iterdir()):
        args += ["--add-data", add_data(models_dir, "models")]

    for pkg in COLLECT_ALL:
        args += ["--collect-all", pkg]

    args.append(str(DESKTOP_DIR / "main.py"))

    subprocess.run(args, check=True)


if __name__ == "__main__":
    main()
