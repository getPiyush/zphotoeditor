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
4. Use the **Selection** panel to restrict the next adjustment to part of the
   photo. Pick a tool, then draw on the image:
   - **Rectangle** / **Ellipse** — drag out a shape.
   - **Lasso** — drag a freehand loop; it closes itself when you let go. With
     **Snap to edges** on (the default) the path is pulled onto the nearest
     strong edge as you draw, so tracing a subject doesn't depend on a steady
     hand; **Snap radius** sets how far, in screen pixels, it may reach for an
     edge. Turn the checkbox off to keep the line exactly where you drew it.
   - **Paint** — drag to paint the selection with a brush (Brush size is a
     screen-pixel width, so a stroke stays the same thickness as you zoom).
   - **Color range** — click a pixel to select every similar color.
     **Tolerance** widens the match and **Contiguous region only** limits it to
     the connected patch you clicked (a magic wand) instead of every matching
     pixel in the photo. Both re-tune the last pick live, so you can dial them
     in without re-clicking.

   **Combine** decides what the next stroke does to what is already selected —
   start a new selection, or add / subtract / intersect. **Feather** softens the
   edge so an adjustment fades out instead of stopping at a hard line, and
   **Invert selection** flips it to everything else. The selected area is marked
   by a dashed marching-ants outline only -- the pixels inside it are never
   tinted or dimmed, so an edit previewed within the selection can be judged on
   its own; uncheck **Show selection outline** to hide the ants too. Apply an
   adjustment as usual and only the selected pixels change; the selection then
   stays put for the next adjustment until you clear it. Which settings honour
   a selection is listed in
   [What a selection applies to](#what-a-selection-applies-to).
5. Enter a width/height and click **Apply resize** to resize (aspect ratio
   locking is optional). The Enhancement menu includes Blur, Edge Sharpen,
   and Detail Enhance, as well as the existing enhancement filters. Use the
   enhancement strength percentage to control filter intensity. The percentage
   does not apply to **RealESRGAN x4plus**, which uses its fixed AI upscaling
   behavior. Its model weights are downloaded and initialized when the app
   starts.
6. Click **Reset** to discard all adjustments and start over from the
   original upload.
7. Click **Save to project** to write the edited image into `saved/` inside
   this project folder. A **Download** link then appears to save it locally.
8. Use **History Manager** to export the current settings history as a JSON
   file or import one. Importing can merge settings before or after the current
   history, save the current settings as a separate download before replacing
   it, or replace it directly. When importing, choose whether to exclude crop
   settings, resize settings, or both; **Replace existing** is the default.
9. Click a history step to view its settings without removing later steps.
   Drag steps to reorder them, use the delete control to remove a step, and
   use Step back/Step forward to navigate those history-structure changes.

## What a selection applies to

A selection is applied by running the edit over the whole image and then
blending the result back through the mask, so filters that read neighbouring
pixels (blur, sharpen, CLAHE) still sample across the selection boundary
instead of leaving a seam at it. That works for anything that changes pixels in
place, and cannot work for anything that changes the canvas:

| Setting | Honours a selection? |
| --- | --- |
| Light: brightness, exposure, contrast, alpha/beta, gamma, whites, blacks, shadows | Yes |
| Color: saturation, vibrance, warmth, pop, vignette, R/G/B balance | Yes |
| Grayscale (all methods) | Yes |
| Filters: vintage, noir, vivid, cool, warm, fade, sepia | Yes |
| Color Isolation | Yes |
| Enhancements: Blur, Edge Sharpen, CLAHE, Filter2D, Bilateral, Unsharp, Detail | Yes |
| Crop, Resize, Rotate, Flip | No — they redefine the pixel grid the selection's coordinates refer to, so applying one clears the selection |
| RealESRGAN x4plus | No — it rebuilds the image at 4x and resamples back, leaving no untouched "rest of the image" to blend against |

Vignette is worth calling out: it is a position-dependent effect, so inside a
selection it still darkens relative to the *whole image's* centre rather than
the selection's. That is usually what you want when masking a vignette off a
subject, but it means a vignette confined to a small off-centre selection
reads as a flat darkening rather than a ring.

## Notes

- A selection is stored as a recipe -- the ordered list of shape / lasso /
  brush / color-range ops and how each combines -- rather than as a bitmap, so
  it costs a few hundred bytes inside a history step, exports and imports as
  ordinary JSON along with the rest of the settings, and re-rasterizes exactly
  when a step is replayed.
- Edge snapping runs on the server too, one short segment at a time while the
  lasso is being dragged. Each segment is the cheapest path through a map built
  by inverting the image's color gradient, so "follow the edge" becomes "take
  the cheapest route" and an ordinary shortest-path search does the work. Only
  the snapped points are stored: the committed op is an ordinary polygon, which
  is what stops a replayed history step from re-snapping against pixels an
  earlier step has since changed.
- Rasterizing happens on the server for both the edit and the on-screen
  outline, so the outlined region is by construction the same mask that gets
  applied. A feathered selection is outlined at its halfway point, where the
  edit lands at half strength. It also means a color-range selection matches against the
  full-resolution photo rather than the downscaled preview in the browser.
- Reordering history can move a selection-bearing step to a point where the
  image has different dimensions; as with crop coordinates, the selection is
  re-rasterized against whatever the image is at that point, which may not be
  the region originally drawn.
- Original uploads are kept in `uploads/`; edits are always recomputed from
  the original, so nothing is destructively overwritten until you save.
- Saved exports land in `saved/` as PNG files.
- History exports are timestamped JSON files containing the ordered settings
   changes used to rebuild the edited image from its source.
- RealESRGAN weights are cached at `models/RealESRGAN_x4plus.pth`. Set
   `REALESRGAN_MODEL_PATH` to use a different local weights file.
- Both `uploads/` and `saved/` are git-ignored (aside from `.gitkeep`) since
  they hold user data, not source.
