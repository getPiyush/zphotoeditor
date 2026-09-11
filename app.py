import io
import json
import math
import os
import shutil
import threading
import urllib.request
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

# In-memory edit history per image_id: [{"id", "timestamp", "label", "params"}, ...]
HISTORY: dict[str, list[dict]] = {}
ACTIVE_HISTORY_COUNT: dict[str, int] = {}
REALESRGAN_MODEL_URL = (
    "https://huggingface.co/lllyasviel/Annotators/resolve/main/RealESRGAN_x4plus.pth"
)
_realesrgan_lock = threading.Lock()
_realesrgan_upsampler = None


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
    ACTIVE_HISTORY_COUNT.clear()


def add_history_step(image_id: str, params: dict, label: str) -> dict:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    step_id = uuid.uuid4().hex[:8]
    entry = {"id": step_id, "timestamp": timestamp, "label": label, "params": params}
    HISTORY.setdefault(image_id, []).append(entry)
    return entry


def remove_history_steps(image_id: str) -> None:
    HISTORY[image_id] = []
    ACTIVE_HISTORY_COUNT[image_id] = 0
    ACTIVE_HISTORY_COUNT[image_id] = 0


def history_settings(image_id: str) -> dict:
    return {
        "format": "zphotoeditor-settings",
        "version": 1,
        "source_image_id": image_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "steps": [
            {"label": step.get("label", "Edit"), "timestamp": step.get("timestamp", ""), "params": step.get("params", {})}
            for step in HISTORY.get(image_id, [])
        ],
    }


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


def resize_image(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_width, target_height = size
    if target_width >= img.width and target_height >= img.height:
        return img.resize(size, Image.Resampling.LANCZOS)

    channels = np.array(img)
    resized = cv2.resize(channels, size, interpolation=cv2.INTER_AREA)
    return Image.fromarray(resized, mode=img.mode)


def apply_warmth(img: Image.Image, warmth: float) -> Image.Image:
    if warmth == 0:
        return img
    base = img.convert("RGBA") if img.mode == "RGBA" else img.convert("RGB")
    red, green, blue = base.split()[:3]
    red_factor = 1 + warmth * 0.35
    blue_factor = 1 - warmth * 0.35
    red = red.point(lambda p: max(0, min(255, int(p * red_factor))))
    blue = blue.point(lambda p: max(0, min(255, int(p * blue_factor))))
    channels = (red, green, blue)
    if base.mode == "RGBA":
        channels += (base.getchannel("A"),)
    return Image.merge(base.mode, channels)


def apply_vignette(img: Image.Image, amount: float) -> Image.Image:
    if amount <= 0:
        return img
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    base = np.array(img.convert("RGB"), dtype=np.float32)
    height, width = base.shape[:2]
    y, x = np.ogrid[:height, :width]
    distance = np.sqrt(((x - (width - 1) / 2) / max(width / 2, 1)) ** 2 + ((y - (height - 1) / 2) / max(height / 2, 1)) ** 2)
    mask = np.clip((distance - 0.35) / 0.65, 0, 1)
    base *= 1 - (mask[..., None] * min(amount, 1) * 0.75)
    result = Image.fromarray(np.uint8(np.clip(base, 0, 255)))
    if alpha is not None:
        result.putalpha(alpha)
    return result


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


def get_realesrgan_upsampler():
    global _realesrgan_upsampler
    if _realesrgan_upsampler is not None:
        return _realesrgan_upsampler

    with _realesrgan_lock:
        if _realesrgan_upsampler is not None:
            return _realesrgan_upsampler
        try:
            import sys
            import torch
            import torchvision.transforms.functional as functional

            # BasicSR 1.4.2 imports this module name removed by newer TorchVision.
            sys.modules.setdefault("torchvision.transforms.functional_tensor", functional)
            from basicsr.archs.rrdbnet_arch import RRDBNet
            from realesrgan import RealESRGANer
        except ImportError as exc:
            raise RuntimeError(f"Real-ESRGAN dependency import failed: {exc}") from exc

        model_path = Path(
            os.environ.get("REALESRGAN_MODEL_PATH", BASE_DIR / "models" / "RealESRGAN_x4plus.pth")
        )
        if not model_path.exists():
            model_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                urllib.request.urlretrieve(REALESRGAN_MODEL_URL, model_path)
            except OSError as exc:
                model_path.unlink(missing_ok=True)
                raise RuntimeError(f"Could not download Real-ESRGAN weights: {exc}") from exc

        model = RRDBNet(
            num_in_ch=3,
            num_out_ch=3,
            num_feat=64,
            num_block=23,
            num_grow_ch=32,
            scale=4,
        )
        _realesrgan_upsampler = RealESRGANer(
            scale=4,
            model_path=str(model_path),
            model=model,
            tile=0,
            tile_pad=10,
            pre_pad=0,
            half=torch.cuda.is_available(),
        )
        return _realesrgan_upsampler


def initialize_realesrgan() -> None:
    """Download the weights and initialize Real-ESRGAN before serving requests."""
    get_realesrgan_upsampler()


def apply_enhancement(img: Image.Image, algorithm: str, strength: float = 100) -> Image.Image:
    if algorithm == "none":
        return img

    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    rgb = np.array(img.convert("RGB"))

    if algorithm == "clahe":
        lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
        lightness, a_channel, b_channel = cv2.split(lab)
        lightness = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lightness)
        enhanced = cv2.cvtColor(cv2.merge((lightness, a_channel, b_channel)), cv2.COLOR_LAB2RGB)
    elif algorithm == "blur":
        enhanced = cv2.GaussianBlur(rgb, (0, 0), 1.5)
    elif algorithm == "edge":
        laplacian = cv2.Laplacian(rgb, cv2.CV_32F, ksize=3)
        enhanced = np.clip(rgb.astype(np.float32) - 0.7 * laplacian, 0, 255).astype(np.uint8)
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
    elif algorithm == "realesrgan_x4plus":
        enhanced, _ = get_realesrgan_upsampler().enhance(rgb, outscale=4)
    else:
        return img

    if algorithm != "realesrgan_x4plus":
        strength = max(0, min(100, float(strength))) / 100
        enhanced = cv2.addWeighted(rgb, 1 - strength, enhanced, strength, 0)

    result = Image.fromarray(enhanced)
    if alpha is not None:
        result.putalpha(alpha)
    return result


def process_image(source: Path, params: dict) -> Image.Image:
    with Image.open(source) as source_image:
        return process_image_object(source_image.copy(), params)


def process_image_object(img: Image.Image, params: dict) -> Image.Image:
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
        img = resize_image(img, (int(resize["w"]), int(resize["h"])))

    img = apply_enhancement(
        img,
        params.get("enhancement", "none"),
        params.get("enhancement_strength", 100),
    )

    brightness = float(params.get("brightness", 1.0))
    contrast = float(params.get("contrast", 1.0))
    exposure = float(params.get("exposure", 1.0))
    whites = float(params.get("whites", 1.0))
    blacks = float(params.get("blacks", 1.0))
    shadows = float(params.get("shadows", 1.0))
    saturation = float(params.get("saturation", 1.0))
    vibrance = float(params.get("vibrance", 1.0))
    warmth = float(params.get("warmth", 0.0))
    pop = float(params.get("pop", 1.0))
    vignette = float(params.get("vignette", 0.0))
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
    img = apply_warmth(img, warmth)
    if pop != 1.0:
        img = ImageEnhance.Contrast(img).enhance(pop)
        img = ImageEnhance.Color(img).enhance(1 + (pop - 1) * 0.35)
    img = apply_channel_balance(img, r, g, b)
    img = apply_vignette(img, vignette)

    preview = params.get("preview")
    if preview and preview.get("w") and preview.get("h"):
        max_w = int(preview["w"])
        max_h = int(preview["h"])
        if max_w > 0 and max_h > 0:
            scale = min(max_w / img.width, max_h / img.height, 1)
            if scale < 1:
                img = resize_image(img, (max(1, round(img.width * scale)), max(1, round(img.height * scale))))

    return img


def current_source_image(image_id: str, steps=None) -> Image.Image:
    with Image.open(original_path(image_id)) as source:
        image = source.copy()
    replay_steps = steps if steps is not None else HISTORY.get(image_id, [])[:ACTIVE_HISTORY_COUNT.get(image_id, len(HISTORY.get(image_id, [])))]
    for step in replay_steps:
        image = process_image_object(image, step.get("params", {}))
    return image


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
    try:
        img = process_image_object(current_source_image(image_id), params)
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 503

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png")


@app.route("/commit/<image_id>", methods=["POST"])
def commit(image_id):
    """Store settings for an edit; the source is replayed from the original."""
    params = request.get_json(force=True) or {}
    label = params.pop("label", "Edit")
    params.pop("preview", None)  # never bake the preview downscale into a step

    try:
        img = process_image_object(current_source_image(image_id), params)
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 503
    entry = add_history_step(image_id, params, label)
    ACTIVE_HISTORY_COUNT[image_id] = len(HISTORY[image_id])
    width, height = img.size

    return jsonify(history=HISTORY[image_id], current=entry, width=width, height=height)


@app.route("/revert/<image_id>", methods=["POST"])
def revert(image_id):
    """View an earlier step without discarding later settings."""
    data = request.get_json(force=True) or {}
    step_id = data.get("step_id") or "original"
    steps = HISTORY.get(image_id, [])

    if step_id == "original":
        ACTIVE_HISTORY_COUNT[image_id] = 0
        with Image.open(original_path(image_id)) as image:
            width, height = image.size
        return jsonify(history=HISTORY.get(image_id, []), current=None, width=width, height=height)

    idx = next((i for i, s in enumerate(steps) if s["id"] == step_id), None)
    if idx is None:
        abort(404, description="Step not found")

    ACTIVE_HISTORY_COUNT[image_id] = idx + 1

    with current_source_image(image_id) as image:
        width, height = image.size
    return jsonify(history=HISTORY[image_id], current=HISTORY[image_id][idx], width=width, height=height)


def history_state_response(image_id: str):
    steps = HISTORY.get(image_id, [])
    active_count = ACTIVE_HISTORY_COUNT.get(image_id, len(steps))
    current = steps[active_count - 1] if active_count else None
    with current_source_image(image_id) as image:
        width, height = image.size
    return jsonify(history=steps, current=current, width=width, height=height)


@app.route("/history/<image_id>/reorder", methods=["POST"])
def reorder_history(image_id):
    if image_id not in HISTORY:
        abort(404, description="Image not found")
    ids = (request.get_json(force=True) or {}).get("ids", [])
    by_id = {step["id"]: step for step in HISTORY[image_id]}
    if len(ids) != len(by_id) or set(ids) != set(by_id):
        return jsonify(error="History order is invalid"), 400
    HISTORY[image_id] = [by_id[step_id] for step_id in ids]
    ACTIVE_HISTORY_COUNT[image_id] = len(HISTORY[image_id])
    return history_state_response(image_id)


@app.route("/history/<image_id>/delete/<step_id>", methods=["POST"])
def delete_history_step(image_id, step_id):
    if image_id not in HISTORY:
        abort(404, description="Image not found")
    steps = HISTORY[image_id]
    if not any(step["id"] == step_id for step in steps):
        abort(404, description="Step not found")
    HISTORY[image_id] = [step for step in steps if step["id"] != step_id]
    ACTIVE_HISTORY_COUNT[image_id] = len(HISTORY[image_id])
    return history_state_response(image_id)


@app.route("/history/<image_id>/restore", methods=["POST"])
def restore_history(image_id):
    if image_id not in HISTORY:
        abort(404, description="Image not found")
    data = request.get_json(force=True) or {}
    steps = data.get("steps")
    if not isinstance(steps, list) or any(
        not isinstance(step, dict) or not isinstance(step.get("params"), dict) or not step.get("id")
        for step in steps
    ):
        return jsonify(error="Invalid history state"), 400
    HISTORY[image_id] = steps
    active_id = data.get("active_step_id")
    ACTIVE_HISTORY_COUNT[image_id] = next(
        (index + 1 for index, step in enumerate(steps) if step["id"] == active_id),
        len(steps),
    ) if active_id else len(steps)
    return history_state_response(image_id)


@app.route("/history/<image_id>/export")
def export_history(image_id):
    if image_id not in HISTORY:
        abort(404, description="Image not found")
    exported_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    payload = json.dumps(history_settings(image_id), indent=2).encode("utf-8")
    return send_file(
        io.BytesIO(payload),
        mimetype="application/json",
        as_attachment=True,
        download_name=f"zphotoeditor-settings-{exported_at}.json",
    )


@app.route("/history/<image_id>/import", methods=["POST"])
def import_history(image_id):
    if image_id not in HISTORY:
        abort(404, description="Image not found")
    uploaded = request.files.get("history")
    mode = request.form.get("mode", "replace")
    settings_filter = request.form.get("filter", "none")
    if not uploaded or not uploaded.filename:
        return jsonify(error="No history file provided"), 400
    if mode not in {"before", "after", "replace", "save-replace"}:
        return jsonify(error="Invalid history import mode"), 400
    if settings_filter not in {"none", "crop", "resize", "crop-resize"}:
        return jsonify(error="Invalid history settings filter"), 400

    try:
        manifest = json.loads(uploaded.read().decode("utf-8"))
        if manifest.get("format") != "zphotoeditor-settings" or manifest.get("version") != 1:
            raise ValueError("Unsupported settings file")
        manifest_steps = manifest.get("steps", [])
        imported_steps = []
        for step in manifest_steps:
            if not isinstance(step.get("params"), dict):
                raise ValueError("Each history step must contain settings")
            params = dict(step["params"])
            if settings_filter in {"crop", "crop-resize"}:
                params.pop("crop", None)
            if settings_filter in {"resize", "crop-resize"}:
                params.pop("resize", None)
            imported_steps.append({
                "id": uuid.uuid4().hex[:8],
                "timestamp": step.get("timestamp") or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f"),
                "label": step.get("label", "Imported edit"),
                "params": params,
            })
    except (UnicodeDecodeError, ValueError, json.JSONDecodeError, OSError) as exc:
        return jsonify(error=f"Invalid history file: {exc}"), 400

    saved_filename = None
    if mode == "save-replace":
        saved_filename = f"zphotoeditor-settings-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}.json"
        (SAVED_DIR / saved_filename).write_text(json.dumps(history_settings(image_id), indent=2), encoding="utf-8")

    existing_steps = list(HISTORY.get(image_id, []))
    if mode in {"replace", "save-replace"}:
        remove_history_steps(image_id)
        existing_steps = []

    if mode == "before":
        ordered = imported_steps + existing_steps
    elif mode == "after":
        ordered = existing_steps + imported_steps
    else:
        ordered = imported_steps
    HISTORY[image_id] = ordered
    ACTIVE_HISTORY_COUNT[image_id] = len(ordered)

    current = ordered[-1] if ordered else None
    with current_source_image(image_id) as image:
        width, height = image.size
    return jsonify(
        history=ordered,
        current=current,
        width=width,
        height=height,
        saved_download_url=f"/download/{saved_filename}" if saved_filename else None,
    )


@app.route("/save/<image_id>", methods=["POST"])
def save(image_id):
    old_original = original_path(image_id)
    new_original = UPLOAD_DIR / f"{image_id}_original.png"

    with current_source_image(image_id) as img:
        img = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
        saved_name = f"{image_id}.png"
        img.save(SAVED_DIR / saved_name, format="PNG")
        img.save(new_original, format="PNG")

    if old_original != new_original:
        old_original.unlink(missing_ok=True)

    HISTORY[image_id] = []
    ACTIVE_HISTORY_COUNT[image_id] = 0

    return jsonify(saved=True, filename=saved_name, download_url=f"/download/{saved_name}")


@app.route("/download/<filename>")
def download(filename):
    dest = SAVED_DIR / filename
    if not dest.exists():
        abort(404, description="Saved file not found")
    return send_file(dest, as_attachment=True, download_name=filename)


if __name__ == "__main__":
    debug = True
    # Flask's debug reloader starts a parent watcher and a child server.
    # Initialize the model only in the process that serves requests.
    if not debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        initialize_realesrgan()
    app.run(debug=debug, port=5000)
