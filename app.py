import io
import json
import math
import os
import shutil
import sys
import threading
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, render_template, send_file, abort
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# Pillow's decompression-bomb guard (default ~89.5 megapixels) exists to
# protect public-facing services from malicious uploads; this is a local,
# single-user editor working on the user's own photos, so a legitimate very
# large or wide image (a high-res scan, a panorama) shouldn't be rejected.
Image.MAX_IMAGE_PIXELS = None

BASE_DIR = Path(__file__).resolve().parent


def _user_data_dir() -> Path:
    """Where user data (uploads, saved images, edit history, downloaded
    model weights) lives. A normal checkout keeps this next to app.py like
    before. A single-file frozen executable (PyInstaller --onefile)
    extracts BASE_DIR fresh into a temp folder on every launch and wipes
    it on exit, so user data there would vanish between runs -- it needs
    an OS-appropriate persistent location instead."""
    if not getattr(sys, "frozen", False):
        return BASE_DIR
    if sys.platform == "darwin":
        root = Path.home() / "Library" / "Application Support"
    elif sys.platform == "win32":
        root = Path(os.environ.get("APPDATA", Path.home()))
    else:
        root = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return root / "ZPhotoEditor"


DATA_DIR = _user_data_dir()
UPLOAD_DIR = DATA_DIR / "uploads"
SAVED_DIR = DATA_DIR / "saved"
STEPS_DIR = DATA_DIR / "steps"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "bmp"}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
SAVED_DIR.mkdir(parents=True, exist_ok=True)
STEPS_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
# High-resolution photos (e.g. 8000px+ PNG/TIFF exports) can comfortably exceed
# tens of MB even before any editing; 25 MB was rejecting real uploads with an
# opaque failure, so this is sized for that case rather than typical web images.
app.config["MAX_CONTENT_LENGTH"] = 150 * 1024 * 1024  # 150 MB

# In-memory edit history per image_id: [{"id", "timestamp", "label", "params"}, ...]
HISTORY: dict[str, list[dict]] = {}
ACTIVE_HISTORY_COUNT: dict[str, int] = {}

# Cache of the fully-baked "source" image (original + replayed committed history
# steps, no live-preview params) per image_id, keyed by the tuple of step ids that
# produced it. Avoids replaying the whole history chain on every preview request.
_SOURCE_CACHE: dict[str, tuple[tuple[str, ...], Image.Image]] = {}
REALESRGAN_MODEL_URL = (
    "https://huggingface.co/lllyasviel/Annotators/resolve/main/RealESRGAN_x4plus.pth"
)
REALESRGAN_TILE_SIZE = int(os.environ.get("REALESRGAN_TILE_SIZE", "400"))
# How many same-shaped tiles to run through the model in one batched forward
# call. In principle this uses an accelerator more efficiently (fewer, larger
# ops) at the cost of a coarser cancellation granularity (a cancel waits for
# the whole in-flight batch, not just one tile). In practice, measured on this
# app's dev hardware (Apple MPS, torch 2.8), batching was a *regression*: ~7x
# slower on a 900x1300 image, and 4-tile batches drove MPS to
# "backend out of memory" after enough calls -- its allocator doesn't appear
# to release tile memory between forward passes the way CUDA's does, so a
# larger simultaneous allocation for a real batch dimension is much more
# expensive there than the same work spread across sequential calls. Default
# is 1 (batching disabled) until this is verified to actually help on a real
# CUDA box; raise it only after measuring on the target hardware.
REALESRGAN_BATCH_SIZE = max(1, int(os.environ.get("REALESRGAN_BATCH_SIZE", "1")))
_realesrgan_lock = threading.Lock()
_realesrgan_upsampler = None
# Serializes actual model invocations: RealESRGANer stores per-call state (the
# input/output tensors) on the shared upsampler instance, so two enhancements
# can't safely run at once even though each runs in its own background thread.
_realesrgan_run_lock = threading.Lock()

# In-flight/completed background Real-ESRGAN jobs, keyed by job id. Lets the UI
# poll progress and cancel a running enhancement instead of blocking a request
# for however long the upscale takes.
_ENHANCE_JOBS: dict[str, dict] = {}
_ENHANCE_JOBS_LOCK = threading.Lock()


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
    and every previously saved/exported download, so only the newly uploaded
    photo remains."""
    # Path.glob("*") matches dotfiles too (unlike a shell glob), so this
    # excludes them explicitly -- otherwise repeated uploads silently delete
    # housekeeping files like .gitkeep.
    for f in UPLOAD_DIR.glob("*"):
        if f.is_file() and not f.name.startswith("."):
            f.unlink()
    for d in STEPS_DIR.glob("*"):
        if d.is_dir():
            shutil.rmtree(d)
    for f in SAVED_DIR.glob("*"):
        if f.is_file() and not f.name.startswith("."):
            f.unlink()
    HISTORY.clear()
    ACTIVE_HISTORY_COUNT.clear()
    _SOURCE_CACHE.clear()


def add_history_step(image_id: str, params: dict, label: str) -> dict:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    step_id = uuid.uuid4().hex[:8]
    entry = {"id": step_id, "timestamp": timestamp, "label": label, "params": params}
    HISTORY.setdefault(image_id, []).append(entry)
    return entry


def remove_history_steps(image_id: str) -> None:
    HISTORY[image_id] = []
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


def _apply_color_lut(img: Image.Image, lut: list) -> Image.Image:
    # img.point() needs one 256-entry table per band; apply the curve to color
    # bands only and leave alpha (if any) untouched.
    color_bands = min(len(img.getbands()), 3)
    identity = list(range(256))
    full_lut = lut * color_bands + identity * (len(img.getbands()) - color_bands)
    return img.point(full_lut)


def apply_alpha_beta(img: Image.Image, alpha: float, beta: float) -> Image.Image:
    """Classic OpenCV-style linear correction: output = alpha * input + beta,
    where alpha is the gain (contrast-like) and beta is the bias (brightness-like)."""
    if alpha == 1.0 and beta == 0.0:
        return img
    lut = [max(0, min(255, int(round(i * alpha + beta)))) for i in range(256)]
    return _apply_color_lut(img, lut)


def apply_gamma(img: Image.Image, gamma: float) -> Image.Image:
    """Power-law (gamma) correction: output = 255 * (input / 255) ** (1 / gamma)."""
    if gamma == 1.0:
        return img
    inv_gamma = 1.0 / gamma
    lut = [max(0, min(255, int(round(((i / 255.0) ** inv_gamma) * 255)))) for i in range(256)]
    return _apply_color_lut(img, lut)


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
    return _apply_color_lut(img, lut)


GRAYSCALE_CHANNEL_INDEX = {"red": 0, "green": 1, "blue": 2}


def apply_grayscale(img: Image.Image, method: str, intensity: float) -> Image.Image:
    """Convert to grayscale using the given method, then blend back toward the
    original by (1 - intensity) so partial desaturation is possible."""
    intensity = max(0.0, min(1.0, intensity))
    if intensity <= 0:
        return img

    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    base = img.convert("RGB") if img.mode != "RGB" else img

    if method == "average":
        arr = np.array(base, dtype=np.float32).mean(axis=2, keepdims=True)
        channel = Image.fromarray(np.uint8(np.clip(arr, 0, 255)).squeeze(axis=2))
    elif method in GRAYSCALE_CHANNEL_INDEX:
        channel = base.split()[GRAYSCALE_CHANNEL_INDEX[method]]
    else:  # luminosity (default): ITU-R 601-2 perceptual weighting
        channel = base.convert("L")

    gray = Image.merge("RGB", (channel, channel, channel))
    result = Image.blend(base, gray, intensity)
    if alpha is not None:
        result = result.convert("RGBA")
        result.putalpha(alpha)
    return result


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


# Standard sepia color matrix (each output channel is a fixed weighted mix of
# the input R/G/B), applied as a matrix multiply rather than composed from the
# warmth/tone sliders since it's a well-known, specific transform.
SEPIA_MATRIX = np.array([
    [0.393, 0.769, 0.189],
    [0.349, 0.686, 0.168],
    [0.272, 0.534, 0.131],
], dtype=np.float32)


def apply_sepia(img: Image.Image, intensity: float) -> Image.Image:
    if intensity <= 0:
        return img
    alpha = img.getchannel("A") if img.mode == "RGBA" else None
    base = img.convert("RGB") if img.mode != "RGB" else img
    arr = np.array(base, dtype=np.float32)
    sepia_arr = np.clip(arr @ SEPIA_MATRIX.T, 0, 255)
    sepia = Image.fromarray(np.uint8(sepia_arr))
    result = Image.blend(base, sepia, intensity)
    if alpha is not None:
        result = result.convert("RGBA")
        result.putalpha(alpha)
    return result


# Each preset's "full strength" (intensity 1.0) recipe, expressed in the same
# units as the sliders they reuse: multiplicative factors (1.0 = neutral) for
# contrast/saturation/vibrance, additive amounts (0 = neutral) for warmth and
# vignette, and a 0-1 blend amount for grayscale.
FILTER_PRESETS = {
    "vintage": {"contrast": 0.85, "saturation": 0.7, "warmth": 0.3, "vignette": 0.35},
    "noir": {"grayscale": 1.0, "contrast": 1.3, "vignette": 0.4},
    "vivid": {"saturation": 1.5, "vibrance": 1.3, "contrast": 1.15},
    "cool": {"warmth": -0.35, "saturation": 1.05},
    "warm": {"warmth": 0.35, "saturation": 1.05},
    "fade": {"contrast": 0.75, "saturation": 0.85},
}


def apply_filter_preset(img: Image.Image, preset: str, intensity: float) -> Image.Image:
    intensity = max(0.0, min(1.0, intensity))
    if intensity <= 0:
        return img
    if preset == "sepia":
        return apply_sepia(img, intensity)

    recipe = FILTER_PRESETS.get(preset)
    if not recipe:
        return img

    if "grayscale" in recipe:
        img = apply_grayscale(img, "luminosity", recipe["grayscale"] * intensity)
    if "saturation" in recipe:
        img = ImageEnhance.Color(img).enhance(1.0 + (recipe["saturation"] - 1.0) * intensity)
    if "vibrance" in recipe:
        img = apply_vibrance(img, (recipe["vibrance"] - 1.0) * intensity)
    if "warmth" in recipe:
        img = apply_warmth(img, recipe["warmth"] * intensity)
    if "contrast" in recipe:
        img = ImageEnhance.Contrast(img).enhance(1.0 + (recipe["contrast"] - 1.0) * intensity)
    if "vignette" in recipe:
        img = apply_vignette(img, recipe["vignette"] * intensity)
    return img


def normalize_orientation(img: Image.Image) -> Image.Image:
    corrected = ImageOps.exif_transpose(img)
    exif = corrected.getexif()
    if 274 in exif:
        exif.pop(274)
    corrected.info["exif"] = exif.tobytes() if exif else b""
    return corrected


def _select_realesrgan_device(torch_module):
    """Pick the best available backend without assuming what machine this runs
    on: an explicit REALESRGAN_DEVICE always wins (for the odd box where
    auto-detection guesses wrong, or a multi-GPU host that needs e.g.
    "cuda:1"), otherwise prefer CUDA, then Apple's MPS, then plain CPU.
    `getattr` guards the MPS check because `torch.backends.mps` is only
    present on newer torch builds -- older ones would otherwise raise
    AttributeError here instead of falling back to CPU.
    """
    forced = os.environ.get("REALESRGAN_DEVICE")
    if forced:
        return torch_module.device(forced)
    if torch_module.cuda.is_available():
        return torch_module.device("cuda")
    mps_backend = getattr(torch_module.backends, "mps", None)
    if mps_backend is not None and mps_backend.is_available():
        return torch_module.device("mps")
    return torch_module.device("cpu")


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
            os.environ.get("REALESRGAN_MODEL_PATH", DATA_DIR / "models" / "RealESRGAN_x4plus.pth")
        )
        if not model_path.exists():
            model_path.parent.mkdir(parents=True, exist_ok=True)
            # A frozen build bundles the weights alongside the rest of the
            # app (see desktop/build.py); seed the persistent copy from
            # there once instead of hitting the network on every install.
            bundled_path = BASE_DIR / "models" / "RealESRGAN_x4plus.pth"
            if getattr(sys, "frozen", False) and bundled_path.exists():
                shutil.copyfile(bundled_path, model_path)
            else:
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
        device = _select_realesrgan_device(torch)
        _realesrgan_upsampler = RealESRGANer(
            scale=4,
            model_path=str(model_path),
            model=model,
            # Tiling (rather than one whole-image pass) is what lets a running
            # enhancement report per-tile progress and be stopped between tiles.
            tile=REALESRGAN_TILE_SIZE,
            tile_pad=10,
            pre_pad=0,
            # Half precision is only reliably fast/correct on CUDA; CPU has no
            # real speed benefit from it and MPS's half support is inconsistent
            # across torch versions, so both stay full precision.
            half=device.type == "cuda",
            device=device,
        )
        return _realesrgan_upsampler


def initialize_realesrgan() -> None:
    """Download the weights and initialize Real-ESRGAN before serving requests."""
    get_realesrgan_upsampler()


def _tile_bounds(x: int, y: int, tile_size: int, tile_pad: int, width: int, height: int) -> tuple:
    """Compute a tile's core region (the part it's responsible for in the
    output) and its padded region (the part actually fed to the model, which
    gives the model context beyond the tile edges so the seams blend). Both
    shrink at the image border, where there's no neighboring pixel data to
    pad with -- that's what makes border tiles a different shape from
    interior ones."""
    ofs_x = x * tile_size
    ofs_y = y * tile_size
    input_start_x = ofs_x
    input_end_x = min(ofs_x + tile_size, width)
    input_start_y = ofs_y
    input_end_y = min(ofs_y + tile_size, height)
    return (
        input_start_x,
        input_end_x,
        input_start_y,
        input_end_y,
        max(input_start_x - tile_pad, 0),
        min(input_end_x + tile_pad, width),
        max(input_start_y - tile_pad, 0),
        min(input_end_y + tile_pad, height),
    )


def _write_tile_output(upsampler, bounds: tuple, output_tile) -> None:
    (
        input_start_x, input_end_x, input_start_y, input_end_y,
        input_start_x_pad, _input_end_x_pad, input_start_y_pad, _input_end_y_pad,
    ) = bounds
    scale = upsampler.scale
    output_start_x_tile = (input_start_x - input_start_x_pad) * scale
    output_end_x_tile = output_start_x_tile + (input_end_x - input_start_x) * scale
    output_start_y_tile = (input_start_y - input_start_y_pad) * scale
    output_end_y_tile = output_start_y_tile + (input_end_y - input_start_y) * scale
    upsampler.output[:, :, input_start_y * scale:input_end_y * scale, input_start_x * scale:input_end_x * scale] = (
        output_tile[:, :, output_start_y_tile:output_end_y_tile, output_start_x_tile:output_end_x_tile]
    )


def _realesrgan_enhance(upsampler, rgb: np.ndarray, outscale: float, on_tile=None, should_cancel=None):
    """Run the RealESRGAN model over `rgb` (a plain RGB uint8 array) tile by
    tile, matching what RealESRGANer.enhance() itself does, but exposing
    progress (via on_tile(done, total)) and cooperative cancellation (via
    should_cancel()) between tiles -- a single whole-image forward pass can't
    be interrupted or report partial progress.

    Same-shaped tiles (almost always the interior of the grid -- border tiles
    are shaped differently, see `_tile_bounds`) are grouped into batches of up
    to REALESRGAN_BATCH_SIZE and run through the model as one forward call.
    RRDBNet has no batch-dependent layers (no batchnorm), so this is numerically
    identical to running each tile alone, just far better at keeping a GPU (or
    a multi-core CPU's own internal parallelism) fed -- one forward call over 4
    tiles does more work per Python/dispatch round-trip than 4 separate calls.
    The trade-off is cancellation latency: a cancel now waits for the current
    *batch* to finish rather than the current tile, so REALESRGAN_BATCH_SIZE
    also caps how unresponsive Cancel can get.

    RealESRGANer.enhance() assumes its input is in cv2's BGR channel order (it
    swaps to RGB internally to match how the model was trained, then swaps back
    on the way out), because it's normally fed images loaded via cv2.imread.
    Callers here instead have a true-RGB array from PIL, so it's converted to
    BGR order before the call and the result converted back -- otherwise the
    model runs on red/blue-swapped pixels and produces visibly wrong colors.

    Runs under a module-level lock since the upsampler is a single shared
    instance that stores per-call state (input/output tensors) on itself, so
    two enhancements can't safely run at once. Returns None if cancelled.
    """
    import torch

    with _realesrgan_run_lock:
        if should_cancel and should_cancel():
            return None

        h_input, w_input = rgb.shape[:2]
        bgr = rgb[:, :, ::-1].astype(np.float32) / 255.0
        model_input = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        upsampler.pre_process(model_input)
        batch, channel, height, width = upsampler.img.shape
        tile_size = upsampler.tile_size

        if tile_size <= 0:
            with torch.no_grad():
                upsampler.output = upsampler.model(upsampler.img)
        else:
            tile_pad = upsampler.tile_pad
            tiles_x = math.ceil(width / tile_size)
            tiles_y = math.ceil(height / tile_size)
            total_tiles = tiles_x * tiles_y
            upsampler.output = upsampler.img.new_zeros(
                (batch, channel, height * upsampler.scale, width * upsampler.scale)
            )
            if on_tile:
                on_tile(0, total_tiles)

            full_shape = (tile_size + 2 * tile_pad, tile_size + 2 * tile_pad)
            done = 0
            pending_bounds = []
            pending_inputs = []

            def flush_pending():
                nonlocal done
                if not pending_inputs:
                    return
                with torch.no_grad():
                    batched_output = upsampler.model(torch.cat(pending_inputs, dim=0))
                for i, bounds in enumerate(pending_bounds):
                    _write_tile_output(upsampler, bounds, batched_output[i:i + 1])
                done += len(pending_bounds)
                if on_tile:
                    on_tile(done, total_tiles)
                pending_bounds.clear()
                pending_inputs.clear()

            for y in range(tiles_y):
                for x in range(tiles_x):
                    if should_cancel and should_cancel():
                        return None
                    bounds = _tile_bounds(x, y, tile_size, tile_pad, width, height)
                    _, _, _, _, sx_pad, ex_pad, sy_pad, ey_pad = bounds
                    input_tile = upsampler.img[:, :, sy_pad:ey_pad, sx_pad:ex_pad]

                    if (ey_pad - sy_pad, ex_pad - sx_pad) == full_shape:
                        pending_bounds.append(bounds)
                        pending_inputs.append(input_tile)
                        if len(pending_bounds) >= REALESRGAN_BATCH_SIZE:
                            flush_pending()
                    else:
                        # A border/remainder tile has a different shape than the
                        # pending batch, so it can't be concatenated with it.
                        flush_pending()
                        if should_cancel and should_cancel():
                            return None
                        with torch.no_grad():
                            output_tile = upsampler.model(input_tile)
                        _write_tile_output(upsampler, bounds, output_tile)
                        done += 1
                        if on_tile:
                            on_tile(done, total_tiles)
            if should_cancel and should_cancel():
                return None
            flush_pending()

        output_tensor = upsampler.post_process()
        output_img = output_tensor.data.squeeze().float().cpu().clamp_(0, 1).numpy()
        output_img = np.transpose(output_img[[2, 1, 0], :, :], (1, 2, 0))
        output_bgr = (output_img * 255.0).round().astype(np.uint8)
        if outscale != float(upsampler.scale):
            output_bgr = cv2.resize(
                output_bgr, (int(w_input * outscale), int(h_input * outscale)), interpolation=cv2.INTER_LANCZOS4
            )
        return output_bgr[:, :, ::-1]


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
        enhanced = _realesrgan_enhance(get_realesrgan_upsampler(), rgb, outscale=4)
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
    if params.get("flip_h"):
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if params.get("flip_v"):
        img = img.transpose(Image.FLIP_TOP_BOTTOM)

    crop = params.get("crop")
    if crop:
        x, y, w, h = crop["x"], crop["y"], crop["w"], crop["h"]
        img = img.crop((x, y, x + w, y + h))

    resize = params.get("resize")
    enhancement_algorithm = params.get("enhancement", "none")
    enhancement_strength = params.get("enhancement_strength", 100)

    if enhancement_algorithm == "realesrgan_x4plus":
        # The network always upscales by a fixed 4x, so running it on an
        # already-resized image would blow the output past the requested
        # dimensions and waste most of the compute. Super-resolve at the
        # pre-resize size instead, then resize its output to the exact target.
        img = apply_enhancement(img, enhancement_algorithm, enhancement_strength)
        if resize and resize.get("w") and resize.get("h"):
            img = resize_image(img, (int(resize["w"]), int(resize["h"])))
    else:
        if resize and resize.get("w") and resize.get("h"):
            img = resize_image(img, (int(resize["w"]), int(resize["h"])))
        img = apply_enhancement(img, enhancement_algorithm, enhancement_strength)

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
    alpha = float(params.get("alpha", 1.0))
    beta = float(params.get("beta", 0.0))
    gamma = float(params.get("gamma", 1.0))

    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if exposure != 1.0:
        img = apply_exposure(img, exposure)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if alpha != 1.0 or beta != 0.0:
        img = apply_alpha_beta(img, alpha, beta)
    if gamma != 1.0:
        img = apply_gamma(img, gamma)
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

    grayscale_method = str(params.get("grayscale_method", "luminosity"))
    grayscale_intensity = float(params.get("grayscale_intensity", 0.0))
    img = apply_grayscale(img, grayscale_method, grayscale_intensity)

    filter_preset = params.get("filter_preset")
    if filter_preset and filter_preset != "none":
        img = apply_filter_preset(img, filter_preset, float(params.get("filter_intensity", 1.0)))

    preview = params.get("preview")
    if preview and preview.get("w") and preview.get("h"):
        max_w = int(preview["w"])
        max_h = int(preview["h"])
        if max_w > 0 and max_h > 0:
            scale = min(max_w / img.width, max_h / img.height, 1)
            if scale < 1:
                img = resize_image(img, (max(1, round(img.width * scale)), max(1, round(img.height * scale))))

    return img


def _replay(image: Image.Image, steps: list[dict], start: int, end: int) -> Image.Image:
    for step in steps[start:end]:
        image = process_image_object(image, step.get("params", {}))
    return image


def current_source_image(image_id: str, steps=None) -> Image.Image:
    """Return the original image with committed history steps replayed onto it.

    Replaying the whole history chain on every call is the dominant cost for
    preview requests once a few steps have been committed, since it re-runs every
    prior PIL/OpenCV step just to render the current one. `_SOURCE_CACHE` keeps the
    most recently rendered result per image, keyed by the ordered tuple of step ids
    baked into it, so unrelated calls (e.g. slider preview requests between commits)
    hit the cache instead of replaying, and a new commit only replays the one step
    that was just added.
    """
    all_steps = HISTORY.get(image_id, [])
    replay_steps = steps if steps is not None else all_steps[:ACTIVE_HISTORY_COUNT.get(image_id, len(all_steps))]
    signature = tuple(step["id"] for step in replay_steps)

    cached = _SOURCE_CACHE.get(image_id)
    if cached and cached[0] == signature:
        return cached[1].copy()

    if cached and len(signature) > len(cached[0]) and signature[:len(cached[0])] == cached[0]:
        image = _replay(cached[1].copy(), replay_steps, len(cached[0]), len(signature))
    else:
        with Image.open(original_path(image_id)) as source:
            image = source.copy()
        image = _replay(image, replay_steps, 0, len(signature))

    _SOURCE_CACHE[image_id] = (signature, image)
    return image.copy()


@app.route("/")
def index():
    return render_template("index.html")


@app.errorhandler(413)
def handle_file_too_large(_exc):
    # Without this, an oversized upload gets Werkzeug's default HTML error
    # page, which the frontend's `res.json()` can't parse -- the user just
    # sees a generic "Upload failed" with no indication it was a size issue.
    limit_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
    return jsonify(error=f"File is too large (max {limit_mb} MB)"), 413


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


def _commit_history_step(image_id: str, img: Image.Image, params: dict, label: str) -> dict:
    """Record `img` (already the fully baked result of applying `params` to the
    current source) as a new history step, and seed the source cache with it so
    the next preview/history call doesn't have to replay this step again."""
    entry = add_history_step(image_id, params, label)
    ACTIVE_HISTORY_COUNT[image_id] = len(HISTORY[image_id])
    signature = tuple(step["id"] for step in HISTORY[image_id][:ACTIVE_HISTORY_COUNT[image_id]])
    _SOURCE_CACHE[image_id] = (signature, img)
    return entry


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
    entry = _commit_history_step(image_id, img, params, label)
    width, height = img.size

    return jsonify(history=HISTORY[image_id], current=entry, width=width, height=height)


@app.route("/enhance/<image_id>/start", methods=["POST"])
def start_enhance(image_id):
    """Kick off a Real-ESRGAN enhancement in a background thread and return a
    job id immediately, instead of blocking the request for however long the
    upscale takes. The UI polls /enhance/<image_id>/status/<job_id> for
    progress and can stop it early via /enhance/<image_id>/cancel/<job_id>."""
    original_path(image_id)  # 404s if the image doesn't exist
    params = request.get_json(force=True) or {}
    resize = params.get("resize")

    job_id = uuid.uuid4().hex[:8]
    cancel_event = threading.Event()
    job = {
        "image_id": image_id,
        "status": "running",
        "tiles_done": 0,
        "tiles_total": 0,
        "started": time.monotonic(),
        "resize": resize,
        "result": None,
        "error": None,
        "cancel_event": cancel_event,
    }
    with _ENHANCE_JOBS_LOCK:
        _ENHANCE_JOBS[job_id] = job

    def on_tile(done, total):
        job["tiles_done"] = done
        job["tiles_total"] = total

    def run():
        try:
            base = current_source_image(image_id)
            base = base.convert("RGB") if base.mode not in ("RGB", "RGBA") else base
            alpha = base.getchannel("A") if base.mode == "RGBA" else None
            rgb = np.array(base.convert("RGB"))
            output = _realesrgan_enhance(
                get_realesrgan_upsampler(), rgb, outscale=4, on_tile=on_tile, should_cancel=cancel_event.is_set
            )
            if output is None:
                job["status"] = "cancelled"
                return
            result = Image.fromarray(output)
            if alpha is not None:
                result.putalpha(alpha)
            job["result"] = result
            job["status"] = "done"
        except Exception as exc:  # background thread: surface it via job state, not an exception
            job["error"] = str(exc)
            job["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify(job_id=job_id)


@app.route("/enhance/<image_id>/status/<job_id>")
def enhance_status(image_id, job_id):
    job = _ENHANCE_JOBS.get(job_id)
    if not job or job["image_id"] != image_id:
        abort(404, description="Enhancement job not found")
    payload = {
        "status": job["status"],
        "tiles_done": job["tiles_done"],
        "tiles_total": job["tiles_total"],
        "elapsed": time.monotonic() - job["started"],
    }
    if job["status"] == "error":
        payload["error"] = job["error"]
    return jsonify(payload)


@app.route("/enhance/<image_id>/cancel/<job_id>", methods=["POST"])
def cancel_enhance(image_id, job_id):
    job = _ENHANCE_JOBS.get(job_id)
    if not job or job["image_id"] != image_id:
        abort(404, description="Enhancement job not found")
    job["cancel_event"].set()
    return jsonify(status="cancelling")


@app.route("/enhance/<image_id>/finish/<job_id>", methods=["POST"])
def finish_enhance(image_id, job_id):
    """Commit a completed enhancement job's result as a new history step."""
    job = _ENHANCE_JOBS.get(job_id)
    if not job or job["image_id"] != image_id:
        abort(404, description="Enhancement job not found")
    if job["status"] != "done":
        return jsonify(error=f"Enhancement job is not finished (status: {job['status']})"), 409

    img = job["result"]
    resize = job.get("resize")
    if resize and resize.get("w") and resize.get("h"):
        img = resize_image(img, (int(resize["w"]), int(resize["h"])))

    label = (request.get_json(force=True) or {}).get("label", "Enhance")
    params = {"enhancement": "realesrgan_x4plus"}
    if resize:
        params["resize"] = resize
    entry = _commit_history_step(image_id, img, params, label)
    width, height = img.size

    with _ENHANCE_JOBS_LOCK:
        _ENHANCE_JOBS.pop(job_id, None)

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


def _is_realesrgan_step(params: dict) -> bool:
    return params.get("enhancement") == "realesrgan_x4plus"


def _bool_arg(value: str) -> bool:
    return (value or "").strip().lower() in {"true", "1", "on", "yes"}


@app.route("/history/<image_id>/export")
def export_history(image_id):
    if image_id not in HISTORY:
        abort(404, description="Image not found")
    exclude_realesrgan = _bool_arg(request.args.get("exclude_realesrgan"))
    settings = history_settings(image_id)
    if exclude_realesrgan:
        settings["steps"] = [step for step in settings["steps"] if not _is_realesrgan_step(step["params"])]
    exported_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    payload = json.dumps(settings, indent=2).encode("utf-8")
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
    exclude_realesrgan = _bool_arg(request.form.get("exclude_realesrgan"))
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
            if exclude_realesrgan and _is_realesrgan_step(params):
                continue
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


EXPORT_FORMATS = {
    "png": {"pillow_format": "PNG", "mimetype": "image/png", "ext": "png"},
    "jpeg": {"pillow_format": "JPEG", "mimetype": "image/jpeg", "ext": "jpg"},
    "webp": {"pillow_format": "WEBP", "mimetype": "image/webp", "ext": "webp"},
    "tiff": {"pillow_format": "TIFF", "mimetype": "image/tiff", "ext": "tiff"},
    "bmp": {"pillow_format": "BMP", "mimetype": "image/bmp", "ext": "bmp"},
    "gif": {"pillow_format": "GIF", "mimetype": "image/gif", "ext": "gif"},
    "ico": {"pillow_format": "ICO", "mimetype": "image/x-icon", "ext": "ico"},
}


@app.route("/export/<image_id>", methods=["POST"])
def export_image(image_id):
    payload = request.get_json(force=True) or {}
    fmt_key = str(payload.get("format", "png")).lower()
    fmt = EXPORT_FORMATS.get(fmt_key)
    if fmt is None:
        return jsonify(error=f"Unsupported export format: {fmt_key}"), 400

    params = payload.get("params") or {}
    try:
        img = process_image_object(current_source_image(image_id), params)
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 503

    save_kwargs = {}
    # JPEG/BMP have no alpha channel; GIF needs a palettized image.
    if fmt_key in {"jpeg", "bmp"} and img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    elif fmt_key == "gif" and img.mode not in ("P", "L"):
        img = img.convert("P", palette=Image.ADAPTIVE)
    if fmt_key == "jpeg":
        save_kwargs["quality"] = 95

    buf = io.BytesIO()
    img.save(buf, format=fmt["pillow_format"], **save_kwargs)
    buf.seek(0)
    filename = f"edited-image.{fmt['ext']}"
    return send_file(buf, mimetype=fmt["mimetype"], as_attachment=True, download_name=filename)


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
    app.run(debug=debug, port=5000, threaded=True)
