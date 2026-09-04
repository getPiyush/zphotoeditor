import io
import math
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, render_template, send_file, abort
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
SAVED_DIR = BASE_DIR / "saved"
STEPS_DIR = BASE_DIR / "steps"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "bmp"}

UPLOAD_DIR.mkdir(exist_ok=True)
SAVED_DIR.mkdir(exist_ok=True)
STEPS_DIR.mkdir(exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 25 * 1024 * 1024  # 25 MB

# In-memory edit history per image_id: [{"id", "timestamp", "filename", "label"}, ...]
# The last entry (if any) is always the current source image for further edits.
HISTORY: dict[str, list[dict]] = {}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def original_path(image_id: str) -> Path:
    matches = list(UPLOAD_DIR.glob(f"{image_id}_original.*"))
    if not matches:
        abort(404, description="Image not found")
    return matches[0]


def step_dir_path(image_id: str) -> Path:
    return STEPS_DIR / image_id


def current_source_path(image_id: str) -> Path:
    steps = HISTORY.get(image_id) or []
    if steps:
        return step_dir_path(image_id) / steps[-1]["filename"]
    return original_path(image_id)


def clear_working_images() -> None:
    """Wipe every previously uploaded/edited photo (originals + history steps)
    so only the newly uploaded one remains. Saved/exported downloads are untouched."""
    for f in UPLOAD_DIR.glob("*"):
        if f.is_file():
            f.unlink()
    for d in STEPS_DIR.glob("*"):
        if d.is_dir():
            shutil.rmtree(d)
    HISTORY.clear()


def add_history_step(image_id: str, img: Image.Image, label: str) -> dict:
    d = step_dir_path(image_id)
    d.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    step_id = uuid.uuid4().hex[:8]
    filename = f"{timestamp}_{step_id}.png"
    img.save(d / filename, format="PNG")
    entry = {"id": step_id, "timestamp": timestamp, "filename": filename, "label": label}
    HISTORY.setdefault(image_id, []).append(entry)
    return entry


def apply_channel_balance(img: Image.Image, r: float, g: float, b: float) -> Image.Image:
    if r == 1.0 and g == 1.0 and b == 1.0:
        return img
    bands = img.split()
    factors = (r, g, b) if len(bands) >= 3 else (r,)
    new_bands = [
        band.point(lambda p, f=f: max(0, min(255, int(p * f))))
        for band, f in zip(bands, factors)
    ]
    new_bands.extend(bands[len(new_bands):])
    return Image.merge(img.mode, new_bands)


def apply_exposure(img: Image.Image, exposure: float) -> Image.Image:
    if exposure == 1.0:
        return img
    return img.point(lambda p: max(0, min(255, int(p * exposure))))


# Per-tone-region weight curves (index = input 0-255 level), used to make
# whites/blacks/shadows push a targeted part of the tonal range rather than
# every pixel uniformly.
WHITES_WEIGHTS = [(i / 255.0) ** 2 for i in range(256)]  # strongest near white
BLACKS_WEIGHTS = [(1 - i / 255.0) ** 2 for i in range(256)]  # strongest near black
SHADOWS_WEIGHTS = [math.exp(-(((i / 255.0) - 0.25) / 0.25) ** 2) for i in range(256)]  # broad lower-midtone lift


def apply_tone_region(img: Image.Image, amount: float, weights: list) -> Image.Image:
    if amount == 0:
        return img
    lut = [max(0, min(255, int(round(i + amount * 255 * weights[i])))) for i in range(256)]
    # img.point() needs one 256-entry table per band; apply the curve to color
    # bands only and leave alpha (if any) untouched.
    color_bands = min(len(img.getbands()), 3)
    identity = list(range(256))
    full_lut = lut * color_bands + identity * (len(img.getbands()) - color_bands)
    return img.point(full_lut)


def apply_vibrance(img: Image.Image, amount: float) -> Image.Image:
    if amount == 0:
        return img
    base = img.convert("RGB") if img.mode != "RGB" else img
    h, s, v = base.convert("HSV").split()
    lut = []
    for i in range(256):
        sat = i / 255.0
        boosted = sat + amount * (1 - sat) * sat * 2
        lut.append(max(0, min(255, int(round(boosted * 255)))))
    s = s.point(lut)
    result = Image.merge("HSV", (h, s, v)).convert("RGB")
    if img.mode == "RGBA":
        result = result.convert("RGBA")
        result.putalpha(img.split()[3])
    return result


def normalize_orientation(img: Image.Image) -> Image.Image:
    corrected = ImageOps.exif_transpose(img)
    exif = corrected.getexif()
    if 274 in exif:
        exif.pop(274)
    corrected.info["exif"] = exif.tobytes() if exif else b""
    return corrected


def apply_enhancement(img: Image.Image, algorithm: str) -> Image.Image:
    if algorithm == "none":
        return img

    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    rgb = np.array(img.convert("RGB"))

    if algorithm == "clahe":
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        lightness, a_channel, b_channel = cv2.split(lab)
        lightness = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lightness)
        enhanced = cv2.cvtColor(cv2.merge((lightness, a_channel, b_channel)), cv2.COLOR_LAB2RGB)
    elif algorithm == "filter2d":
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]], dtype=np.float32)
        enhanced = cv2.filter2D(rgb, -1, kernel)
    elif algorithm == "bilateral":
        enhanced = cv2.bilateralFilter(rgb, 9, 75, 75)
    elif algorithm == "unsharp":
        blurred = cv2.GaussianBlur(rgb, (0, 0), 2.0)
        enhanced = cv2.addWeighted(rgb, 1.6, blurred, -0.6, 0)
    elif algorithm == "detail":
        enhanced = cv2.detailEnhance(rgb, sigma_s=10, sigma_r=0.15)
    else:
        return img

    result = Image.fromarray(enhanced)
    if alpha is not None:
        result.putalpha(alpha)
    return result


def process_image(source: Path, params: dict) -> Image.Image:
    img = Image.open(source)
    img = normalize_orientation(img)
    img = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img

    rotation = int(float(params.get("rotation", 0) or 0)) % 360
    if rotation:
        img = img.rotate(-rotation, expand=True)

    crop = params.get("crop")
    if crop:
        x, y, w, h = crop["x"], crop["y"], crop["w"], crop["h"]
        img = img.crop((x, y, x + w, y + h))

    resize = params.get("resize")
    if resize and resize.get("w") and resize.get("h"):
        img = img.resize((int(resize["w"]), int(resize["h"])), Image.LANCZOS)

    img = apply_enhancement(img, params.get("enhancement", "none"))

    brightness = float(params.get("brightness", 1.0))
    contrast = float(params.get("contrast", 1.0))
    exposure = float(params.get("exposure", 1.0))
    whites = float(params.get("whites", 1.0))
    blacks = float(params.get("blacks", 1.0))
    shadows = float(params.get("shadows", 1.0))
    saturation = float(params.get("saturation", 1.0))
    vibrance = float(params.get("vibrance", 1.0))
    r = float(params.get("r", 1.0))
    g = float(params.get("g", 1.0))
    b = float(params.get("b", 1.0))

    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if exposure != 1.0:
        img = apply_exposure(img, exposure)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    img = apply_tone_region(img, whites - 1.0, WHITES_WEIGHTS)
    img = apply_tone_region(img, blacks - 1.0, BLACKS_WEIGHTS)
    img = apply_tone_region(img, shadows - 1.0, SHADOWS_WEIGHTS)
    if saturation != 1.0:
        img = ImageEnhance.Color(img).enhance(saturation)
    img = apply_vibrance(img, vibrance - 1.0)
    img = apply_channel_balance(img, r, g, b)

    preview = params.get("preview")
    if preview and preview.get("w") and preview.get("h"):
        max_w = int(preview["w"])
        max_h = int(preview["h"])
        if max_w > 0 and max_h > 0:
            img.thumbnail((max_w, max_h), Image.LANCZOS)

    return img


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("image")
    if not file or file.filename == "":
        return jsonify(error="No file provided"), 400
    if not allowed_file(file.filename):
        return jsonify(error="Unsupported file type"), 400

    clear_working_images()

    ext = file.filename.rsplit(".", 1)[1].lower()
    image_id = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{image_id}_original.{ext}"
    file.save(dest)

    with Image.open(dest) as img:
        corrected = normalize_orientation(img)
        corrected.save(dest, format=img.format or "PNG", exif=b"")
        width, height = corrected.size

    HISTORY[image_id] = []

    return jsonify(
        id=image_id,
        url=f"/image/{image_id}/original",
        width=width,
        height=height,
    )


@app.route("/image/<image_id>/original")
def get_original(image_id):
    return send_file(original_path(image_id))


@app.route("/process/<image_id>", methods=["POST"])
def process(image_id):
    params = request.get_json(force=True) or {}
    img = process_image(current_source_path(image_id), params)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png")


@app.route("/commit/<image_id>", methods=["POST"])
def commit(image_id):
    """Apply the given (incremental) edit to the current source image and
    persist the result as a new history step, which becomes the new source."""
    params = request.get_json(force=True) or {}
    label = params.pop("label", "Edit")
    params.pop("preview", None)  # never bake the preview downscale into a step

    img = process_image(current_source_path(image_id), params)
    entry = add_history_step(image_id, img, label)
    width, height = img.size

    return jsonify(history=HISTORY[image_id], current=entry, width=width, height=height)


@app.route("/revert/<image_id>", methods=["POST"])
def revert(image_id):
    """Make an earlier step (or the original) the current source again,
    discarding the steps that came after it."""
    data = request.get_json(force=True) or {}
    step_id = data.get("step_id") or "original"
    steps = HISTORY.get(image_id, [])
    d = step_dir_path(image_id)

    if step_id == "original":
        for step in steps:
            (d / step["filename"]).unlink(missing_ok=True)
        HISTORY[image_id] = []
        with Image.open(original_path(image_id)) as img:
            width, height = img.size
        return jsonify(history=[], current=None, width=width, height=height)

    idx = next((i for i, s in enumerate(steps) if s["id"] == step_id), None)
    if idx is None:
        abort(404, description="Step not found")

    for step in steps[idx + 1 :]:
        (d / step["filename"]).unlink(missing_ok=True)
    HISTORY[image_id] = steps[: idx + 1]

    with Image.open(d / steps[idx]["filename"]) as img:
        width, height = img.size
    return jsonify(history=HISTORY[image_id], current=HISTORY[image_id][idx], width=width, height=height)


@app.route("/save/<image_id>", methods=["POST"])
def save(image_id):
    source = current_source_path(image_id)
    old_original = original_path(image_id)
    new_original = UPLOAD_DIR / f"{image_id}_original.png"

    with Image.open(source) as img:
        img = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
        saved_name = f"{image_id}.png"
        img.save(SAVED_DIR / saved_name, format="PNG")
        img.save(new_original, format="PNG")

    if old_original != new_original:
        old_original.unlink(missing_ok=True)

    for step in HISTORY.get(image_id, []):
        (step_dir_path(image_id) / step["filename"]).unlink(missing_ok=True)
    HISTORY[image_id] = []

    return jsonify(saved=True, filename=saved_name, download_url=f"/download/{saved_name}")


@app.route("/download/<filename>")
def download(filename):
    dest = SAVED_DIR / filename
    if not dest.exists():
        abort(404, description="Saved file not found")
    return send_file(dest, as_attachment=True, download_name=filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
