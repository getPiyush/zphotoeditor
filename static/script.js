const fileInput = document.getElementById("fileInput");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const downloadBtn = document.getElementById("downloadBtn");
const dropHint = document.getElementById("dropHint");
const imageWrap = document.getElementById("imageWrap");
const preview = document.getElementById("preview");
const initialPreviewText = document.getElementById("initialPreviewText");
const cropBox = document.getElementById("cropBox");
const applyCropBtn = document.getElementById("applyCropBtn");
const clearCropBtn = document.getElementById("clearCropBtn");
const cropDragBtn = document.getElementById("cropDragBtn");
const cropSelectBtn = document.getElementById("cropSelectBtn");
const applyResizeBtn = document.getElementById("applyResizeBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const zoomLevelEl = document.getElementById("zoomLevel");
const resizeW = document.getElementById("resizeW");
const resizeH = document.getElementById("resizeH");
const lockAspect = document.getElementById("lockAspect");
const statusEl = document.getElementById("status");
const historyList = document.getElementById("historyList");
const initialPreviewSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='420' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%23000'/%3E%3C/svg%3E";

const SLIDER_LABELS = {
  brightness: "Brightness",
  exposure: "Exposure",
  contrast: "Contrast",
  whites: "Whites",
  blacks: "Blacks",
  shadows: "Shadows",
  saturation: "Saturation",
  vibrance: "Vibrance",
  r: "Red channel",
  g: "Green channel",
  b: "Blue channel",
};

const sliders = [
  "brightness",
  "exposure",
  "contrast",
  "whites",
  "blacks",
  "shadows",
  "saturation",
  "vibrance",
  "r",
  "g",
  "b",
].map((id) => document.getElementById(id));
const accordionHeaders = document.querySelectorAll(".accordion-header");

accordionHeaders.forEach((header) => {
  header.addEventListener("click", () => {
    const item = header.closest(".accordion-item");
    if (!item) return;
    const isOpen = item.classList.contains("open");
    item.classList.toggle("open", !isOpen);
    header.setAttribute("aria-expanded", String(!isOpen));
  });
});

let state = {
  imageId: null,
  naturalWidth: 0,
  naturalHeight: 0,
  aspectRatio: 1,
  zoom: 1,
  panX: 0,
  panY: 0,
  cropMode: "drag",
  history: [], // committed steps after the original: [{id, timestamp, label}]
  currentStepId: null, // null means the current source is the original
  sliderBaseline: neutralSliderValues(), // value already baked into the current source, per slider
  historySliderValues: {}, // stepId -> the absolute slider values baked in as of that step
};

preview.src = initialPreviewSrc;
preview.classList.add("empty-preview");
initialPreviewText.hidden = false;
imageWrap.hidden = false;
dropHint.hidden = true;

function neutralSliderValues() {
  return Object.fromEntries(sliders.map((s) => [s.id, 1]));
}

function applySliderValues(values) {
  sliders.forEach((s) => {
    const v = values[s.id] ?? 1;
    s.value = v;
    document.querySelector(`[data-out="${s.id}"]`).textContent = v.toFixed(2);
    state.sliderBaseline[s.id] = v;
  });
}

let debounceTimer = null;
let selectionStart = null;
let panStart = null;
let cropInteraction = null;

function setCropBoxPosition(x, y, w, h) {
  cropBox.style.left = `${x}px`;
  cropBox.style.top = `${y}px`;
  cropBox.style.width = `${w}px`;
  cropBox.style.height = `${h}px`;
}

function normalizeRect(rect) {
  const x = Math.min(rect.x, rect.x + rect.w);
  const y = Math.min(rect.y, rect.y + rect.h);
  const w = Math.abs(rect.w);
  const h = Math.abs(rect.h);
  return { x, y, w, h };
}

function getPointerInWrap(e) {
  const rect = imageWrap.getBoundingClientRect();
  return {
    x: clamp(e.clientX - rect.left, 0, rect.width),
    y: clamp(e.clientY - rect.top, 0, rect.height),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function applyPreviewTransform() {
  const zoom = clamp(state.zoom, 1, 6);
  state.zoom = zoom;
  preview.style.transformOrigin = "0 0";
  preview.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${zoom}) rotate(0deg)`;
  preview.style.rotate = "0deg";
  preview.style.cursor = zoom > 1 && state.cropMode === "drag" ? "grab" : "default";
  zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
}

function setCropMode(mode) {
  state.cropMode = mode;
  const isDrag = mode === "drag";
  cropDragBtn.classList.toggle("active", isDrag);
  cropSelectBtn.classList.toggle("active", !isDrag);
  cropBox.hidden = isDrag;
  selectionStart = null;
  panStart = null;
  cropInteraction = null;
  preview.style.cursor = state.zoom > 1 && isDrag ? "grab" : "default";
}

function resetZoomState() {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  applyPreviewTransform();
}

function changeZoom(delta) {
  if (!state.imageId) return;
  const nextZoom = clamp(state.zoom * delta, 1, 6);
  if (nextZoom === state.zoom) return;
  state.zoom = nextZoom;
  applyPreviewTransform();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function fitPreviewToPane() {
  if (!state.naturalWidth || !state.naturalHeight) return;
  const wrapRect = imageWrap.getBoundingClientRect();
  const maxWidth = Math.max(1, wrapRect.width || 1);
  const maxHeight = Math.max(1, wrapRect.height || 1);
  const scale = Math.min(maxWidth / state.naturalWidth, maxHeight / state.naturalHeight);
  const displayWidth = Math.max(1, Math.round(state.naturalWidth * scale));
  const displayHeight = Math.max(1, Math.round(state.naturalHeight * scale));
  preview.style.width = `${displayWidth}px`;
  preview.style.height = `${displayHeight}px`;
  preview.style.maxWidth = "none";
  preview.style.maxHeight = "none";
}

function currentPreviewSize() {
  const wrapRect = imageWrap.getBoundingClientRect();
  const maxWidth = Math.max(1, Math.floor(wrapRect.width || 640));
  const maxHeight = Math.max(1, Math.floor(wrapRect.height || 420));
  return { w: maxWidth, h: maxHeight };
}

function currentParams() {
  // Crop/resize/rotation are committed as history steps immediately, so live
  // preview only ever needs to reflect the sliders' movement since their last commit.
  const params = {
    crop: null,
    resize: null,
    preview: currentPreviewSize(),
    rotation: 0,
  };
  for (const s of sliders) {
    const raw = parseFloat(s.value);
    const baseline = state.sliderBaseline[s.id];
    params[s.id] = raw / baseline;
  }
  return params;
}

async function commitStep(params, label) {
  if (!state.imageId) return;
  setStatus("Applying...");
  const res = await fetch(`/commit/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, label }),
  });
  if (!res.ok) {
    setStatus("Failed to apply");
    return;
  }
  const data = await res.json();
  state.history = data.history;
  state.currentStepId = data.current ? data.current.id : null;
  state.naturalWidth = data.width;
  state.naturalHeight = data.height;
  if (data.current) {
    state.historySliderValues[data.current.id] = Object.fromEntries(
      sliders.map((s) => [s.id, parseFloat(s.value)])
    );
  }
  renderHistory();
  requestPreview();
  setStatus("");
}

function renderHistory() {
  historyList.innerHTML = "";
  const activeId = state.currentStepId || "original";

  const items = [
    { id: "original", label: "Original" },
    ...state.history.map((h) => ({ id: h.id, label: h.label || "Edit" })),
  ];

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.label;
    li.className = "history-item" + (item.id === activeId ? " active" : "");
    li.addEventListener("click", () => revertTo(item.id));
    historyList.appendChild(li);
  });
}

async function revertTo(stepId) {
  if (!state.imageId) return;
  const activeId = state.currentStepId || "original";
  if (stepId === activeId) return;

  setStatus("Reverting...");
  const res = await fetch(`/revert/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step_id: stepId }),
  });
  if (!res.ok) {
    setStatus("Revert failed");
    return;
  }
  const data = await res.json();
  state.history = data.history;
  state.currentStepId = data.current ? data.current.id : null;
  state.naturalWidth = data.width;
  state.naturalHeight = data.height;
  state.aspectRatio = data.width / data.height;
  resizeW.value = data.width;
  resizeH.value = data.height;
  applySliderValues(stepId === "original" ? neutralSliderValues() : state.historySliderValues[stepId] || neutralSliderValues());
  cropBox.hidden = true;
  renderHistory();
  requestPreview();
  setStatus("");
}

function requestPreview() {
  if (!state.imageId) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    setStatus("Rendering...");
    const res = await fetch(`/process/${state.imageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentParams()),
    });
    if (!res.ok) {
      setStatus("Failed to render preview");
      return;
    }
    const blob = await res.blob();
    const nextUrl = URL.createObjectURL(blob);
    preview.src = nextUrl;
    preview.onload = () => {
      fitPreviewToPane();
      if (state.zoom > 1) {
        applyPreviewTransform();
      }
      setStatus("");
    };
  }, 150);
}

async function downloadCurrentImage() {
  if (!state.imageId) return;

  setStatus("Preparing download...");
  const params = currentParams();
  delete params.preview;
  const res = await fetch(`/process/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    setStatus("Download failed");
    return;
  }

  const blobUrl = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = "edited-image.png";
  link.click();
  URL.revokeObjectURL(blobUrl);
  setStatus("");
}

let adjustDebounceTimer = null;

function commitAdjustments() {
  const params = {};
  const changed = [];
  for (const s of sliders) {
    const raw = parseFloat(s.value);
    const baseline = state.sliderBaseline[s.id];
    params[s.id] = raw / baseline;
    if (raw !== baseline) changed.push(`${SLIDER_LABELS[s.id] || s.id} ${raw.toFixed(2)}`);
  }
  if (!changed.length) return;
  commitStep(params, changed.join(", "));
  for (const s of sliders) state.sliderBaseline[s.id] = parseFloat(s.value);
}

sliders.forEach((s) => {
  s.addEventListener("input", () => {
    document.querySelector(`[data-out="${s.id}"]`).textContent = parseFloat(s.value).toFixed(2);
    requestPreview();
  });
  s.addEventListener("change", () => {
    // Batch every adjustment slider (brightness, exposure, contrast, r, g, b)
    // touched in one sitting into a single history step, instead of one per slider.
    clearTimeout(adjustDebounceTimer);
    adjustDebounceTimer = setTimeout(commitAdjustments, 2000);
  });
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  setStatus("Uploading...");
  const form = new FormData();
  form.append("image", file);

  const res = await fetch("/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    setStatus(err.error || "Upload failed");
    return;
  }
  const data = await res.json();

  state = {
    imageId: data.id,
    naturalWidth: data.width,
    naturalHeight: data.height,
    aspectRatio: data.width / data.height,
    zoom: 1,
    panX: 0,
    panY: 0,
    cropMode: "drag",
    history: [],
    currentStepId: null,
    sliderBaseline: neutralSliderValues(),
    historySliderValues: {},
  };

  applySliderValues(neutralSliderValues());
  preview.classList.remove("empty-preview");
  initialPreviewText.hidden = true;
  resizeW.value = data.width;
  resizeH.value = data.height;
  cropBox.hidden = true;

  setCropMode("drag");
  resetZoomState();
  renderHistory();
  dropHint.hidden = true;
  imageWrap.hidden = false;
  fitPreviewToPane();
  requestPreview();
  resetBtn.disabled = false;
  saveBtn.disabled = false;
  applyCropBtn.disabled = false;
  clearCropBtn.disabled = false;
  applyResizeBtn.disabled = false;
  downloadBtn.hidden = false;
  setStatus("");
});

resetBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  revertTo("original");
});

zoomInBtn.addEventListener("click", () => changeZoom(1.2));
zoomOutBtn.addEventListener("click", () => changeZoom(1 / 1.2));
resetZoomBtn.addEventListener("click", resetZoomState);
rotateLeftBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  commitStep({ rotation: -90 }, "Rotate left");
});
rotateRightBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  commitStep({ rotation: 90 }, "Rotate right");
});
cropDragBtn.addEventListener("click", () => setCropMode("drag"));
cropSelectBtn.addEventListener("click", () => setCropMode("select"));

imageWrap.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const previousZoom = state.zoom;
  const nextZoom = clamp(previousZoom * delta, 1, 6);
  if (nextZoom === previousZoom) return;
  state.zoom = nextZoom;
  applyPreviewTransform();
}, { passive: false });

imageWrap.addEventListener("dragstart", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  if (!state.imageId) return;
  fitPreviewToPane();
  if (state.zoom > 1) applyPreviewTransform();
});
preview.addEventListener("dragstart", (e) => e.preventDefault());

saveBtn.addEventListener("click", async () => {
  if (!state.imageId) return;
  const confirmed = window.confirm(
    "Save to project? This finalizes all edits and clears the undo history."
  );
  if (!confirmed) return;

  setStatus("Saving...");
  const res = await fetch(`/save/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    setStatus("Save failed");
    return;
  }
  const data = await res.json();
  downloadBtn.href = data.download_url;
  downloadBtn.hidden = false;
  state.history = [];
  state.currentStepId = null;
  renderHistory();
  setStatus(`Saved as ${data.filename}`);
});

downloadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  downloadCurrentImage();
});

// --- Crop drag selection ---
function handleCropPointerDown(e) {
  const handle = e.target.closest(".crop-handle");
  if (handle) {
    const current = cropBox.getBoundingClientRect();
    const wrapRect = imageWrap.getBoundingClientRect();
    cropInteraction = {
      mode: "resize",
      handle: handle.classList[1],
      startX: e.clientX,
      startY: e.clientY,
      rect: {
        x: current.left - wrapRect.left,
        y: current.top - wrapRect.top,
        w: current.width,
        h: current.height,
      },
    };
    return;
  }

  if (e.target === cropBox) {
    const current = cropBox.getBoundingClientRect();
    const wrapRect = imageWrap.getBoundingClientRect();
    cropInteraction = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      rect: {
        x: current.left - wrapRect.left,
        y: current.top - wrapRect.top,
        w: current.width,
        h: current.height,
      },
    };
    return;
  }

  if (state.cropMode === "drag") {
    panStart = {
      x: e.clientX,
      y: e.clientY,
      panX: state.panX,
      panY: state.panY,
    };
    preview.style.cursor = "grabbing";
    return;
  }

  if (state.cropMode !== "select") return;
  selectionStart = getPointerInWrap(e);
  cropBox.hidden = false;
  setCropBoxPosition(selectionStart.x, selectionStart.y, 0, 0);
}

function handleCropPointerMove(e) {
  if (cropInteraction) {
    const rect = imageWrap.getBoundingClientRect();
    const dx = e.clientX - cropInteraction.startX;
    const dy = e.clientY - cropInteraction.startY;

    if (cropInteraction.mode === "move") {
      const nextX = Math.max(0, Math.min(cropInteraction.rect.x + dx, rect.width - cropInteraction.rect.w));
      const nextY = Math.max(0, Math.min(cropInteraction.rect.y + dy, rect.height - cropInteraction.rect.h));
      setCropBoxPosition(nextX, nextY, cropInteraction.rect.w, cropInteraction.rect.h);
      return;
    }

    const original = cropInteraction.rect;
    let x = original.x;
    let y = original.y;
    let w = original.w;
    let h = original.h;

    if (cropInteraction.handle.includes("e")) w = Math.max(10, original.w + dx);
    if (cropInteraction.handle.includes("s")) h = Math.max(10, original.h + dy);
    if (cropInteraction.handle.includes("w")) {
      const newW = Math.max(10, original.w - dx);
      x = original.x + (original.w - newW);
      w = newW;
    }
    if (cropInteraction.handle.includes("n")) {
      const newH = Math.max(10, original.h - dy);
      y = original.y + (original.h - newH);
      h = newH;
    }

    const clamped = normalizeRect({ x, y, w, h });
    const maxW = rect.width - clamped.x;
    const maxH = rect.height - clamped.y;
    clamped.w = Math.min(clamped.w, maxW);
    clamped.h = Math.min(clamped.h, maxH);
    setCropBoxPosition(clamped.x, clamped.y, clamped.w, clamped.h);
    return;
  }

  if (panStart) {
    if (state.cropMode !== "drag") {
      panStart = null;
      return;
    }
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    state.panX = panStart.panX + dx;
    state.panY = panStart.panY + dy;
    applyPreviewTransform();
    return;
  }

  if (!selectionStart || state.cropMode !== "select") return;
  const point = getPointerInWrap(e);
  const x = Math.min(selectionStart.x, point.x);
  const y = Math.min(selectionStart.y, point.y);
  const w = Math.abs(point.x - selectionStart.x);
  const h = Math.abs(point.y - selectionStart.y);
  setCropBoxPosition(x, y, w, h);
}

function handleCropPointerUp() {
  if (panStart) {
    panStart = null;
    preview.style.cursor = state.zoom > 1 ? "grab" : "default";
  }
  if (cropInteraction) {
    cropInteraction = null;
  }
  selectionStart = null;
}

imageWrap.addEventListener("mousedown", handleCropPointerDown);
window.addEventListener("mousemove", handleCropPointerMove);
window.addEventListener("mouseup", handleCropPointerUp);

applyCropBtn.addEventListener("click", () => {
  if (!state.imageId || cropBox.hidden) return;

  const boxRect = cropBox.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  if (boxRect.width < 5 || boxRect.height < 5) {
    setStatus("Selection too small");
    return;
  }

  const previewWidth = state.naturalWidth || 1;
  const previewHeight = state.naturalHeight || 1;

  const leftInImage = clamp(boxRect.left - previewRect.left, 0, previewRect.width);
  const topInImage = clamp(boxRect.top - previewRect.top, 0, previewRect.height);
  const rightInImage = clamp(boxRect.right - previewRect.left, 0, previewRect.width);
  const bottomInImage = clamp(boxRect.bottom - previewRect.top, 0, previewRect.height);

  const widthInImage = Math.max(1, rightInImage - leftInImage);
  const heightInImage = Math.max(1, bottomInImage - topInImage);

  const x = Math.round((leftInImage / Math.max(1, previewRect.width)) * previewWidth);
  const y = Math.round((topInImage / Math.max(1, previewRect.height)) * previewHeight);
  const w = Math.round((widthInImage / Math.max(1, previewRect.width)) * previewWidth);
  const h = Math.round((heightInImage / Math.max(1, previewRect.height)) * previewHeight);

  resizeW.value = w;
  resizeH.value = h;
  state.aspectRatio = w / h;
  cropBox.hidden = true;
  resetZoomState();
  commitStep({ crop: { x, y, w, h } }, `Crop ${w}×${h}`);
});

clearCropBtn.addEventListener("click", () => {
  cropBox.hidden = true;
});

// --- Resize ---
resizeW.addEventListener("input", () => {
  if (lockAspect.checked && resizeW.value) {
    resizeH.value = Math.round(resizeW.value / state.aspectRatio);
  }
});

resizeH.addEventListener("input", () => {
  if (lockAspect.checked && resizeH.value) {
    resizeW.value = Math.round(resizeH.value * state.aspectRatio);
  }
});

applyResizeBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  const w = parseInt(resizeW.value, 10);
  const h = parseInt(resizeH.value, 10);
  if (!w || !h) return;
  commitStep({ resize: { w, h } }, `Resize ${w}×${h}`);
});
