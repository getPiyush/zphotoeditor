# ZPhoto Editor
Z(rugal) Photo Editor

A small Flask web app for basic photo editing: upload an image, adjust
brightness/exposure/contrast and color balance, crop and resize, then save
the result into the project folder or download it.

## Run as a Desktop App (No Setup Required)

If someone has already built the desktop app for you, you don't need Python,
a terminal, or any of the developer setup below — just the app file for your
operating system:

- **macOS**: `ZPhotoEditor`
- **Windows**: `ZPhotoEditor.exe`
- **Linux**: `ZPhotoEditor`

1. Double-click it (macOS/Windows) to open zPhotoEditor in its own window,
   just like any other app. On Linux, you may need to allow it to run first
   (right-click → Properties → Permissions → "Allow executing", or
   `chmod +x ZPhotoEditor` in a terminal), then double-click it or run
   `./ZPhotoEditor`.
2. The first time you open it:
   - **macOS**: Gatekeeper blocks apps from unidentified developers. Right-click
     (or Control-click) the file, choose **Open**, then confirm **Open** in the
     dialog that appears. You only need to do this once.
   - **Windows**: SmartScreen may show "Windows protected your PC." Click
     **More info**, then **Run anyway**.
3. Use the app exactly as described in [Usage](#usage) below — upload a photo,
   adjust it, then click **Save to project** or **Download** when you're happy
   with it.
4. Your edited photos are saved to a folder on your computer, not hidden
   inside the app itself:
   - **macOS**: `~/Library/Application Support/ZPhotoEditor/saved`
   - **Windows**: `%APPDATA%\ZPhotoEditor\saved`
   - **Linux**: `~/.local/share/ZPhotoEditor/saved`
5. To close the app, just close its window like any other program — there's
   no server to stop and no terminal to keep open.

Don't have a built app yet? Anyone with the project's source code can create
one for your operating system by running `desktop/build.sh` (macOS/Linux) or
`desktop/build.cmd` (Windows) from the project folder.

## Setup (For Developers)

```bash
cd photo-editor
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open http://127.0.0.1:5000 in a browser.

## Stop all Python instances

If a previous Flask server is still running and port 5000 is busy, stop all Python/Flask processes with:

```bash
pkill -if 'python.*app.py' || true; pkill -if 'python -c .*import app' || true; pkill -if 'flask run' || true; pkill -if 'python.*flask' || true
```

## Usage

1. Click **Upload photo** to select an image.
2. Use the sliders to adjust brightness, exposure, contrast, warmth, pop,
   vignette, and per-channel color balance (red/green/blue). Warmth ranges
   from cool to warm, Pop adds contrast and color, and Vignette darkens the
   edges. Previews update live.
3. Drag on the image to select a crop region, then click **Apply crop**.
4. Enter a width/height and click **Apply resize** to resize (aspect ratio
   locking is optional). The Enhancement menu includes Blur, Edge Sharpen,
   and Detail Enhance, as well as the existing enhancement filters. Use the
   enhancement strength percentage to control filter intensity. The percentage
   does not apply to **RealESRGAN x4plus**, which uses its fixed AI upscaling
   behavior. Its model weights are downloaded and initialized when the app
   starts.
5. Click **Reset** to discard all adjustments and start over from the
   original upload.
6. Click **Save to project** to write the edited image into `saved/` inside
   this project folder. A **Download** link then appears to save it locally.
7. Use **History Manager** to export the current settings history as a JSON
   file or import one. Importing can merge settings before or after the current
   history, save the current settings as a separate download before replacing
   it, or replace it directly. When importing, choose whether to exclude crop
   settings, resize settings, or both; **Replace existing** is the default.
8. Click a history step to view its settings without removing later steps.
   Drag steps to reorder them, use the delete control to remove a step, and
   use Step back/Step forward to navigate those history-structure changes.

## Notes

- Original uploads are kept in `uploads/`; edits are always recomputed from
  the original, so nothing is destructively overwritten until you save.
- Saved exports land in `saved/` as PNG files.
- History exports are timestamped JSON files containing the ordered settings
   changes used to rebuild the edited image from its source.
- RealESRGAN weights are cached at `models/RealESRGAN_x4plus.pth`. Set
   `REALESRGAN_MODEL_PATH` to use a different local weights file.
- Both `uploads/` and `saved/` are git-ignored (aside from `.gitkeep`) since
  they hold user data, not source.
