# Photo Editor

A small Flask web app for basic photo editing: upload an image, adjust
brightness/exposure/contrast and color balance, crop and resize, then save
the result into the project folder or download it.

## Setup

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
pkill -f 'python.*app.py' || true; pkill -f 'python -c .*import app' || true; pkill -f 'flask run' || true; pkill -f 'python.*flask' || true
```

## Usage

1. Click **Upload photo** to select an image.
2. Use the sliders to adjust brightness, exposure, contrast, and per-channel
   color balance (red/green/blue). Previews update live.
3. Drag on the image to select a crop region, then click **Apply crop**.
4. Enter a width/height and click **Apply resize** to resize (aspect ratio
   locking is optional). Choose **RealESRGAN x4plus** for AI upscaling. Its
   model weights are downloaded and initialized when the app starts.
5. Click **Reset** to discard all adjustments and start over from the
   original upload.
6. Click **Save to project** to write the edited image into `saved/` inside
   this project folder. A **Download** link then appears to save it locally.

## Notes

- Original uploads are kept in `uploads/`; edits are always recomputed from
  the original, so nothing is destructively overwritten until you save.
- Saved exports land in `saved/` as PNG files.
- RealESRGAN weights are cached at `models/RealESRGAN_x4plus.pth`. Set
   `REALESRGAN_MODEL_PATH` to use a different local weights file.
- Both `uploads/` and `saved/` are git-ignored (aside from `.gitkeep`) since
  they hold user data, not source.
