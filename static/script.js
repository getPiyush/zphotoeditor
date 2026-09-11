const fileInput = document.getElementById("fileInput");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const downloadBtn = document.getElementById("downloadBtn");
const togglePanelBtn = document.getElementById("togglePanelBtn");
const togglePanelLabel = document.getElementById("togglePanelLabel");
const layout = document.querySelector(".layout");
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
const applyEnhancementBtn = document.getElementById("applyEnhancementBtn");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const resetZoomBtn = document.getElementById("resetZoomBtn");
const actualSizeBtn = document.getElementById("actualSizeBtn");
const rotateLeftBtn = document.getElementById("rotateLeftBtn");
const rotateRightBtn = document.getElementById("rotateRightBtn");
const flipHorizontalBtn = document.getElementById("flipHorizontalBtn");
const flipVerticalBtn = document.getElementById("flipVerticalBtn");
const zoomLevelEl = document.getElementById("zoomLevel");
const resizeW = document.getElementById("resizeW");
const resizeH = document.getElementById("resizeH");
const lockAspect = document.getElementById("lockAspect");
const enhancement = document.getElementById("enhancement");
const enhancementStrength = document.getElementById("enhancementStrength");
const enhancementStrengthField = document.getElementById("enhancementStrengthField");
const enhancementStrengthOutput = document.getElementById("enhancementStrengthOutput");
const statusEl = document.getElementById("status");
const historyList = document.getElementById("historyList");
const historyBackBtn = document.getElementById("historyBackBtn");
const historyForwardBtn = document.getElementById("historyForwardBtn");
const historyResetBtn = document.getElementById("historyResetBtn");
const importHistoryBtn = document.getElementById("importHistoryBtn");
const exportHistoryBtn = document.getElementById("exportHistoryBtn");
const historyFileInput = document.getElementById("historyFileInput");
const historyImportDialog = document.getElementById("historyImportDialog");
const historyImportMode = document.getElementById("historyImportMode");
const historyImportFilter = document.getElementById("historyImportFilter");
const historyImportExcludeRealesrgan = document.getElementById("historyImportExcludeRealesrgan");
const historyExportDialog = document.getElementById("historyExportDialog");
const historyExportFileName = document.getElementById("historyExportFileName");
const historyExportExcludeRealesrgan = document.getElementById("historyExportExcludeRealesrgan");
const enhanceProgress = document.getElementById("enhanceProgress");
const enhanceProgressText = document.getElementById("enhanceProgressText");
const enhanceProgressFill = document.getElementById("enhanceProgressFill");
const enhanceCancelBtn = document.getElementById("enhanceCancelBtn");

const SLIDER_LABELS = {
  brightness: "Brightness",
  exposure: "Exposure",
  contrast: "Contrast",
  whites: "Whites",
  blacks: "Blacks",
  shadows: "Shadows",
  saturation: "Saturation",
  vibrance: "Vibrance",
  warmth: "Warmth",
  pop: "Pop",
  vignette: "Vignette",
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
  "warmth",
  "pop",
  "vignette",
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
  actualSize: false,
  cropMode: "drag",
  history: [], // committed steps after the original: [{id, timestamp, label}]
  currentStepId: null, // null means the current source is the original
  sliderBaseline: neutralSliderValues(), // value already baked into the current source, per slider
  historySliderValues: {}, // stepId -> the absolute slider values baked in as of that step
  historyUndo: [],
  historyRedo: [],
};

initialPreviewText.hidden = false;
imageWrap.hidden = false;
dropHint.hidden = true;

function neutralSliderValues() {
  return Object.fromEntries(sliders.map((s) => [s.id, ["warmth", "vignette"].includes(s.id) ? 0 : 1]));
}

function sliderAdjustment(id, raw, baseline) {
  return ["warmth", "vignette"].includes(id) ? raw - baseline : raw / baseline;
}

function applySliderValues(values) {
  sliders.forEach((s) => {
    const v = values[s.id] ?? neutralSliderValues()[s.id];
    s.value = v;
    const output = document.querySelector(`[data-out="${s.id}"]`);
    if (output) output.textContent = v.toFixed(2);
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

function minimumZoom() {
  const displayedWidth = preview.offsetWidth || preview.getBoundingClientRect().width || state.naturalWidth || 100;
  return Math.min(1, 100 / Math.max(100, displayedWidth));
}

function applyPreviewTransform() {
  const zoom = clamp(state.zoom, minimumZoom(), 6);
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
  state.actualSize = false;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  fitPreviewToPane();
  applyPreviewTransform();
}

function showActualSize() {
  if (!state.imageId || !state.naturalWidth || !state.naturalHeight) return;
  state.actualSize = true;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  preview.style.width = `${state.naturalWidth}px`;
  preview.style.height = `${state.naturalHeight}px`;
  preview.style.maxWidth = "none";
  preview.style.maxHeight = "none";
  applyPreviewTransform();
}

function changeZoom(delta) {
  if (!state.imageId) return;
  const nextZoom = clamp(state.zoom * delta, minimumZoom(), 6);
  if (nextZoom === state.zoom) return;
  state.zoom = nextZoom;
  applyPreviewTransform();
}

function setStatus(text, modal = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("processing-modal", modal && Boolean(text));
}

function fitPreviewToPane() {
  if (!state.naturalWidth || !state.naturalHeight) return;
  if (state.actualSize) {
    preview.style.width = `${state.naturalWidth}px`;
    preview.style.height = `${state.naturalHeight}px`;
    preview.style.maxWidth = "none";
    preview.style.maxHeight = "none";
    return;
  }
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
    params[s.id] = sliderAdjustment(s.id, raw, baseline);
  }
  return params;
}

async function commitStep(params, label, showModal = false) {
  if (!state.imageId) return;
  setStatus("Applying...", showModal);
  const res = await fetch(`/commit/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, label }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setStatus(data.error || "Failed to apply");
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

function historySnapshot() {
  return {
    steps: state.history.map((step) => ({ ...step, params: { ...step.params } })),
    activeStepId: state.currentStepId,
  };
}

function updateHistoryTrackButtons() {
  historyBackBtn.disabled = state.historyUndo.length === 0;
  historyForwardBtn.disabled = state.historyRedo.length === 0;
}

function applyHistoryResponse(data) {
  state.history = data.history;
  state.currentStepId = data.current ? data.current.id : null;
  state.naturalWidth = data.width;
  state.naturalHeight = data.height;
  state.aspectRatio = data.width / data.height;
  resizeW.value = data.width;
  resizeH.value = data.height;
  applySliderValues(neutralSliderValues());
  renderHistory();
  requestPreview();
}

async function restoreHistorySnapshot(snapshot) {
  const res = await fetch(`/history/${state.imageId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps: snapshot.steps, active_step_id: snapshot.activeStepId }),
  });
  if (!res.ok) return false;
  applyHistoryResponse(await res.json());
  return true;
}

function recordHistoryStructureChange() {
  state.historyUndo.push(historySnapshot());
  state.historyRedo = [];
  updateHistoryTrackButtons();
}

function renderHistory() {
  downloadBtn.hidden = state.history.length === 0;
  historyList.innerHTML = "";
  const activeId = state.currentStepId || "original";

  const items = [
    { id: "original", label: "Original" },
    ...state.history.map((h) => ({ id: h.id, label: h.label || "Edit" })),
  ];

  items.forEach((item) => {
    const li = document.createElement("li");
    li.draggable = item.id !== "original";
    li.dataset.historyId = item.id;
    const label = document.createElement("span");
    label.textContent = item.label;
    li.appendChild(label);
    li.className = "history-item" + (item.id === activeId ? " active" : "");
    if (item.id !== "original") {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "history-delete";
      remove.title = `Delete ${item.label}`;
      remove.setAttribute("aria-label", `Delete ${item.label}`);
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteHistoryItem(item.id);
      });
      li.appendChild(remove);
    }
    li.addEventListener("click", (event) => {
      if (!event.target.closest(".history-delete")) revertTo(item.id);
    });
    historyList.appendChild(li);
  });
  updateHistoryTrackButtons();
}

let draggedHistoryId = null;
historyList.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".history-item");
  if (!item || item.dataset.historyId === "original") return;
  draggedHistoryId = item.dataset.historyId;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});
historyList.addEventListener("dragend", (event) => {
  event.target.closest(".history-item")?.classList.remove("dragging");
  draggedHistoryId = null;
});
historyList.addEventListener("dragover", (event) => event.preventDefault());
historyList.addEventListener("drop", async (event) => {
  event.preventDefault();
  const target = event.target.closest(".history-item");
  if (!target || !draggedHistoryId || target.dataset.historyId === "original" || target.dataset.historyId === draggedHistoryId) return;
  const ids = state.history.map((step) => step.id);
  const from = ids.indexOf(draggedHistoryId);
  const to = ids.indexOf(target.dataset.historyId);
  ids.splice(from, 1);
  ids.splice(to, 0, draggedHistoryId);
  await reorderHistory(ids);
});

async function reorderHistory(ids) {
  recordHistoryStructureChange();
  const res = await fetch(`/history/${state.imageId}/reorder`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    state.historyUndo.pop();
    updateHistoryTrackButtons();
    setStatus("Could not reorder history");
    return;
  }
  applyHistoryResponse(await res.json());
}

async function deleteHistoryItem(stepId) {
  recordHistoryStructureChange();
  const res = await fetch(`/history/${state.imageId}/delete/${stepId}`, { method: "POST" });
  if (!res.ok) {
    state.historyUndo.pop();
    updateHistoryTrackButtons();
    setStatus("Could not delete history step");
    return;
  }
  applyHistoryResponse(await res.json());
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function closeHistoryImportDialog() {
  historyImportDialog.hidden = true;
}

function closeHistoryExportDialog() {
  historyExportDialog.hidden = true;
}

async function importHistory(file, mode, filter, excludeRealesrgan) {
  const form = new FormData();
  form.append("history", file);
  form.append("mode", mode);
  form.append("filter", filter);
  form.append("exclude_realesrgan", excludeRealesrgan ? "true" : "false");
  setStatus("Importing history...", true);
  const res = await fetch(`/history/${state.imageId}/import`, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setStatus(data.error || "History import failed");
    return;
  }

  applyHistoryResponse(data);
  state.historyUndo = [];
  state.historyRedo = [];
  if (data.saved_download_url) {
    const saved = await fetch(data.saved_download_url);
    if (saved.ok) downloadBlob(await saved.blob(), "zphotoeditor-existing-settings.json");
  }
  setStatus("");
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
  applyHistoryResponse(data);
  cropBox.hidden = true;
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
    params[s.id] = sliderAdjustment(s.id, raw, baseline);
    if (raw !== baseline) changed.push(`${SLIDER_LABELS[s.id] || s.id} ${raw.toFixed(2)}`);
  }
  if (!changed.length) return;
  commitStep(params, changed.join(", "));
  for (const s of sliders) state.sliderBaseline[s.id] = parseFloat(s.value);
}

sliders.forEach((s) => {
  s.addEventListener("input", () => {
    const output = document.querySelector(`[data-out="${s.id}"]`);
    if (output) output.textContent = parseFloat(s.value).toFixed(2);
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
    actualSize: false,
    cropMode: "drag",
    history: [],
    currentStepId: null,
    sliderBaseline: neutralSliderValues(),
    historySliderValues: {},
    historyUndo: [],
    historyRedo: [],
  };

  applySliderValues(neutralSliderValues());
  initialPreviewText.hidden = true;
  preview.hidden = false;
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
  applyEnhancementBtn.disabled = false;
  sliders.forEach((slider) => { slider.disabled = false; });
  zoomInBtn.disabled = false;
  zoomOutBtn.disabled = false;
  resetZoomBtn.disabled = false;
  actualSizeBtn.disabled = false;
  rotateLeftBtn.disabled = false;
  rotateRightBtn.disabled = false;
  flipHorizontalBtn.disabled = false;
  flipVerticalBtn.disabled = false;
  cropDragBtn.disabled = false;
  cropSelectBtn.disabled = false;
  resizeW.disabled = false;
  resizeH.disabled = false;
  lockAspect.disabled = false;
  enhancement.disabled = false;
  enhancementStrength.disabled = false;
  historyResetBtn.disabled = false;
  importHistoryBtn.disabled = false;
  exportHistoryBtn.disabled = false;
  setStatus("");
});

resetBtn.addEventListener("click", async () => {
  if (!state.imageId) return;
  const confirmed = window.confirm(
    "Revert to original? This clears all edit history and cannot be undone."
  );
  if (!confirmed) return;

  setStatus("Reverting...");
  const res = await fetch(`/history/${state.imageId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps: [] }),
  });
  if (!res.ok) {
    setStatus("Revert failed");
    return;
  }
  applyHistoryResponse(await res.json());
  state.historyUndo = [];
  state.historyRedo = [];
  updateHistoryTrackButtons();
  cropBox.hidden = true;
  setStatus("");
});

zoomInBtn.addEventListener("click", () => changeZoom(1.2));
zoomOutBtn.addEventListener("click", () => changeZoom(1 / 1.2));
resetZoomBtn.addEventListener("click", resetZoomState);
actualSizeBtn.addEventListener("click", showActualSize);
rotateLeftBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  commitStep({ rotation: -90 }, "Rotate left");
});
rotateRightBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  commitStep({ rotation: 90 }, "Rotate right");
});
flipHorizontalBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  commitStep({ flip_h: true }, "Flip horizontal");
});
flipVerticalBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  commitStep({ flip_v: true }, "Flip vertical");
});
cropDragBtn.addEventListener("click", () => setCropMode("drag"));
cropSelectBtn.addEventListener("click", () => setCropMode("select"));

imageWrap.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const previousZoom = state.zoom;
  const nextZoom = clamp(previousZoom * delta, minimumZoom(), 6);
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
  state.history = [];
  state.currentStepId = null;
  renderHistory();
  setStatus(`Saved as ${data.filename}`);
});

downloadBtn.addEventListener("click", (e) => {
  e.preventDefault();
  downloadCurrentImage();
});

importHistoryBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  historyFileInput.click();
});

historyFileInput.addEventListener("change", () => {
  const file = historyFileInput.files[0];
  historyFileInput.value = "";
  if (!file) return;
  historyImportDialog.hidden = false;
  historyImportMode.value = "replace";
  historyImportFilter.value = "none";
  historyImportExcludeRealesrgan.checked = true;
  historyImportDialog.dataset.fileName = file.name;
  historyImportDialog._file = file;
});

historyImportDialog.addEventListener("click", (event) => {
  if (event.target === historyImportDialog) {
    closeHistoryImportDialog();
    return;
  }
  const mode = event.target.closest("[data-history-mode]")?.dataset.historyMode;
  if (!mode) return;
  const file = historyImportDialog._file;
  closeHistoryImportDialog();
  if (mode === "import" && file) {
    importHistory(file, historyImportMode.value, historyImportFilter.value, historyImportExcludeRealesrgan.checked);
  }
});

exportHistoryBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  historyExportFileName.value = "zphotoeditor-settings.json";
  historyExportExcludeRealesrgan.checked = true;
  historyExportDialog.hidden = false;
});

historyExportDialog.addEventListener("click", async (event) => {
  if (event.target === historyExportDialog) {
    closeHistoryExportDialog();
    return;
  }
  const mode = event.target.closest("[data-history-mode]")?.dataset.historyMode;
  if (!mode) return;
  const requestedName = historyExportFileName.value.trim() || "zphotoeditor-settings.json";
  const excludeRealesrgan = historyExportExcludeRealesrgan.checked;
  closeHistoryExportDialog();
  if (mode !== "export") return;

  const filename = requestedName.toLowerCase().endsWith(".json") ? requestedName : `${requestedName}.json`;
  setStatus("Exporting history...");
  const res = await fetch(`/history/${state.imageId}/export?exclude_realesrgan=${excludeRealesrgan}`);
  if (!res.ok) {
    setStatus("History export failed");
    return;
  }
  downloadBlob(await res.blob(), filename);
  setStatus("");
});

historyBackBtn.addEventListener("click", async () => {
  const previous = state.historyUndo.pop();
  if (!previous) return;
  state.historyRedo.push(historySnapshot());
  if (!await restoreHistorySnapshot(previous)) {
    state.historyRedo.pop();
    state.historyUndo.push(previous);
    setStatus("Could not step back");
  }
  updateHistoryTrackButtons();
});

historyForwardBtn.addEventListener("click", async () => {
  const next = state.historyRedo.pop();
  if (!next) return;
  state.historyUndo.push(historySnapshot());
  if (!await restoreHistorySnapshot(next)) {
    state.historyUndo.pop();
    state.historyRedo.push(next);
    setStatus("Could not step forward");
  }
  updateHistoryTrackButtons();
});

historyResetBtn.addEventListener("click", () => {
  state.historyUndo = [];
  state.historyRedo = [];
  updateHistoryTrackButtons();
});

togglePanelBtn.addEventListener("click", () => {
  const isCollapsed = layout.classList.toggle("panel-collapsed");
  togglePanelBtn.setAttribute("aria-pressed", String(isCollapsed));
  togglePanelBtn.title = isCollapsed ? "Show adjustments panel" : "Hide adjustments panel";
  togglePanelBtn.setAttribute("aria-label", togglePanelBtn.title);
  togglePanelLabel.textContent = isCollapsed ? "Show panel" : "Hide panel";
  requestAnimationFrame(() => {
    if (!state.imageId) return;
    fitPreviewToPane();
    if (state.zoom > 1) applyPreviewTransform();
  });
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
  commitStep({ crop: { x, y, w, h } }, `Crop ${w}×${h}`, true);
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

// --- Real-ESRGAN: runs as a polled background job so its progress can be
// shown and the run can be cancelled, instead of blocking on one long request.
let activeEnhanceJobId = null;

async function runRealesrganEnhance(w, h, label) {
  enhanceProgress.hidden = false;
  enhanceProgressFill.style.width = "0%";
  enhanceProgressText.textContent = "Starting Real-ESRGAN…";

  const startRes = await fetch(`/enhance/${state.imageId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resize: { w, h } }),
  });
  if (!startRes.ok) {
    enhanceProgress.hidden = true;
    setStatus("Failed to start enhancement");
    return;
  }
  const { job_id: jobId } = await startRes.json();
  activeEnhanceJobId = jobId;

  const poll = async () => {
    if (activeEnhanceJobId !== jobId) return;
    const res = await fetch(`/enhance/${state.imageId}/status/${jobId}`);
    if (!res.ok) {
      activeEnhanceJobId = null;
      enhanceProgress.hidden = true;
      setStatus("Lost track of the enhancement job");
      return;
    }
    const data = await res.json();

    if (data.status === "running") {
      const pct = data.tiles_total ? Math.round((data.tiles_done / data.tiles_total) * 100) : 0;
      enhanceProgressFill.style.width = `${pct}%`;
      enhanceProgressText.textContent = data.tiles_total
        ? `Running Real-ESRGAN… tile ${data.tiles_done}/${data.tiles_total} (${data.elapsed.toFixed(1)}s)`
        : `Running Real-ESRGAN… (${data.elapsed.toFixed(1)}s)`;
      setTimeout(poll, 2000);
      return;
    }

    if (data.status === "cancelled") {
      activeEnhanceJobId = null;
      enhanceProgress.hidden = true;
      setStatus("Enhancement cancelled");
      return;
    }

    if (data.status === "error") {
      activeEnhanceJobId = null;
      enhanceProgress.hidden = true;
      setStatus(data.error || "Enhancement failed");
      return;
    }

    // done: hand the result off to be committed as a history step
    enhanceProgressFill.style.width = "100%";
    enhanceProgressText.textContent = "Finishing…";
    const finishRes = await fetch(`/enhance/${state.imageId}/finish/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    activeEnhanceJobId = null;
    enhanceProgress.hidden = true;
    if (!finishRes.ok) {
      const errData = await finishRes.json().catch(() => ({}));
      setStatus(errData.error || "Failed to apply enhancement");
      return;
    }
    const finishData = await finishRes.json();
    state.history = finishData.history;
    state.currentStepId = finishData.current ? finishData.current.id : null;
    state.naturalWidth = finishData.width;
    state.naturalHeight = finishData.height;
    renderHistory();
    requestPreview();
    setStatus("");
  };
  poll();
}

enhanceCancelBtn.addEventListener("click", () => {
  if (!activeEnhanceJobId || !state.imageId) return;
  const jobId = activeEnhanceJobId;
  const imageId = state.imageId;
  // Close the modal immediately; the job is left to wind down on the server
  // (it stops between tiles) without the UI waiting on that confirmation.
  activeEnhanceJobId = null;
  enhanceProgress.hidden = true;
  setStatus("Enhancement cancelled");
  fetch(`/enhance/${imageId}/cancel/${jobId}`, { method: "POST" });
});

applyResizeBtn.addEventListener("click", () => {
  if (!state.imageId || activeEnhanceJobId) return;
  const w = parseInt(resizeW.value, 10);
  const h = parseInt(resizeH.value, 10);
  if (!w || !h) return;
  commitStep({ resize: { w, h } }, `Resize ${w}×${h}`, true);
});

applyEnhancementBtn.addEventListener("click", () => {
  if (!state.imageId || activeEnhanceJobId) return;
  const algorithm = enhancement.value;
  if (algorithm === "none") return;
  const strength = parseInt(enhancementStrength.value, 10);
  const label = enhancement.options[enhancement.selectedIndex].text;

  if (algorithm === "realesrgan_x4plus") {
    // No explicit resize target here (that's the Resize section's job) -- keep
    // the current dimensions, so this acts as a detail-recovering sharpen
    // rather than also upscaling the output.
    runRealesrganEnhance(state.naturalWidth, state.naturalHeight, label);
  } else {
    commitStep({ enhancement: algorithm, enhancement_strength: strength }, `${label} ${strength}%`, true);
  }
  enhancement.value = "none";
  enhancementStrength.value = "100";
  enhancementStrengthOutput.textContent = "100%";
  updateEnhancementStrengthVisibility();
});

function updateEnhancementStrengthVisibility() {
  const isRealESRGAN = enhancement.value === "realesrgan_x4plus";
  enhancementStrengthField.hidden = isRealESRGAN;
  enhancementStrength.disabled = isRealESRGAN || !state.imageId;
}

enhancement.addEventListener("change", updateEnhancementStrengthVisibility);
enhancementStrength.addEventListener("input", () => {
  enhancementStrengthOutput.textContent = `${enhancementStrength.value}%`;
});
updateEnhancementStrengthVisibility();
