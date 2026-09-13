"""Native desktop shell for zPhotoEditor.

Runs the Flask app from the parent zphotoeditor project in a background
thread and displays it in a native OS window via pywebview, instead of a
browser tab. This is the only file that reaches into the parent project;
zphotoeditor itself stays a normal, independently-runnable Flask app with
no knowledge of this wrapper.
"""
import socket
import sys
import threading
import time
from pathlib import Path

import webview

PARENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PARENT_DIR))

import app as photoeditor  # noqa: E402 (import must follow the sys.path patch above)

HOST = "127.0.0.1"
PORT = 5000


def _run_server() -> None:
    photoeditor.app.run(host=HOST, port=PORT, debug=False, threaded=True, use_reloader=False)


def _wait_for_server(timeout: float = 20.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((HOST, PORT), timeout=0.5):
                return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError("zPhotoEditor server did not start in time")


def main() -> None:
    # pywebview disables native file downloads by default, so clicking the
    # app's download link just navigates the window to the image blob
    # instead of prompting a save dialog. This must be set before the
    # window is created.
    webview.settings["ALLOW_DOWNLOADS"] = True

    threading.Thread(target=_run_server, daemon=True).start()
    _wait_for_server()
    webview.create_window(
        "zPhotoEditor",
        f"http://{HOST}:{PORT}",
        width=1280,
        height=860,
        min_size=(960, 640),
    )
    webview.start()


if __name__ == "__main__":
    main()
