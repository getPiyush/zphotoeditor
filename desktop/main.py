"""Native desktop shell for zPhotoEditor.

Runs the Flask app from the parent zphotoeditor project in a background
thread and displays it in a native OS window via pywebview, instead of a
browser tab. This is the only file that reaches into the parent project;
zphotoeditor itself stays a normal, independently-runnable Flask app with
no knowledge of this wrapper.
"""
import sys
import threading
from pathlib import Path

import webview
from werkzeug.serving import make_server

PARENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PARENT_DIR))

import app as photoeditor  # noqa: E402 (import must follow the sys.path patch above)

HOST = "127.0.0.1"


def _start_server():
    # Port 0 lets the OS pick a free port. A fixed port (the dev server's
    # 5000) collides with a dev server left running and, on macOS, with
    # AirPlay Receiver - and a connect-based readiness check can't tell
    # those apart from our own server, so the window would load the wrong
    # page. The socket is bound before this returns, so the window can
    # load the URL immediately with no readiness polling.
    server = make_server(HOST, 0, photoeditor.app, threaded=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main() -> None:
    # pywebview disables native file downloads by default, so clicking the
    # app's download link just navigates the window to the image blob
    # instead of prompting a save dialog. This must be set before the
    # window is created.
    webview.settings["ALLOW_DOWNLOADS"] = True

    server = _start_server()
    webview.create_window(
        "zPhotoEditor",
        f"http://{HOST}:{server.server_port}",
        width=1280,
        height=860,
        min_size=(960, 640),
    )
    webview.start()
    server.shutdown()


if __name__ == "__main__":
    main()
