const fileInput = document.getElementById("fileInput");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const exportDialog = document.getElementById("exportDialog");
const exportFileName = document.getElementById("exportFileName");
const exportFormat = document.getElementById("exportFormat");
const exportFormatOptionGroups = document.querySelectorAll("[data-export-options]");
const exportPngCompressLevel = document.getElementById("exportPngCompressLevel");
const exportPngOptimize = document.getElementById("exportPngOptimize");
const exportJpegQuality = document.getElementById("exportJpegQuality");
const exportJpegSubsampling = document.getElementById("exportJpegSubsampling");
const exportJpegProgressive = document.getElementById("exportJpegProgressive");
const exportJpegOptimize = document.getElementById("exportJpegOptimize");
const exportWebpLossless = document.getElementById("exportWebpLossless");
const exportWebpQuality = document.getElementById("exportWebpQuality");
const exportWebpMethod = document.getElementById("exportWebpMethod");
const exportTiffCompression = document.getElementById("exportTiffCompression");
const exportTiffQuality = document.getElementById("exportTiffQuality");
const exportTiffQualityField = document.getElementById("exportTiffQualityField");
const exportGifColors = document.getElementById("exportGifColors");
const exportGifOptimize = document.getElementById("exportGifOptimize");
const exportIcoSizeChecks = document.querySelectorAll(".exportIcoSize");
const togglePanelBtn = document.getElementById("togglePanelBtn");
const togglePanelLabel = document.getElementById("togglePanelLabel");
const pendingChangesBanner = document.getElementById("pendingChangesBanner");
const layout = document.querySelector(".layout");
const dropHint = document.getElementById("dropHint");
const imageWrap = document.getElementById("imageWrap");
const preview = document.getElementById("preview");
const previewCropOverlay = document.getElementById("previewCropOverlay");
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
const applyLightBtn = document.getElementById("applyLightBtn");
const resetLightBtn = document.getElementById("resetLightBtn");
const lightPanelItem = document.getElementById("lightPanelItem");
const lightPendingIndicator = document.getElementById("lightPendingIndicator");
const applyColorBtn = document.getElementById("applyColorBtn");
const resetColorBtn = document.getElementById("resetColorBtn");
const colorPanelItem = document.getElementById("colorPanelItem");
const colorPendingIndicator = document.getElementById("colorPendingIndicator");
const grayscaleMethod = document.getElementById("grayscaleMethod");
const grayscaleIntensity = document.getElementById("grayscaleIntensity");
const applyGrayscaleBtn = document.getElementById("applyGrayscaleBtn");
const resetGrayscaleBtn = document.getElementById("resetGrayscaleBtn");
const grayscalePanelItem = document.getElementById("grayscalePanelItem");
const grayscalePendingIndicator = document.getElementById("grayscalePendingIndicator");
const filterPreset = document.getElementById("filterPreset");
const filterIntensity = document.getElementById("filterIntensity");
const applyFilterBtn = document.getElementById("applyFilterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const filtersPanelItem = document.getElementById("filtersPanelItem");
const filtersPendingIndicator = document.getElementById("filtersPendingIndicator");
const isolationHueMin = document.getElementById("isolationHueMin");
const isolationHueMax = document.getElementById("isolationHueMax");
const hueRangeSelected = document.getElementById("hueRangeSelected");
const isolationMinSaturation = document.getElementById("isolationMinSaturation");
const isolationTone = document.getElementById("isolationTone");
const applyIsolationBtn = document.getElementById("applyIsolationBtn");
const resetIsolationBtn = document.getElementById("resetIsolationBtn");
const isolationPanelItem = document.getElementById("isolationPanelItem");
const isolationPendingIndicator = document.getElementById("isolationPendingIndicator");
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

const EXPORT_EXTENSIONS = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  tiff: "tiff",
  bmp: "bmp",
  gif: "gif",
  ico: "ico",
};

const SLIDER_LABELS = {
  brightness: "Brightness",
  exposure: "Exposure",
  contrast: "Contrast",
  alpha: "Alpha (gain)",
  beta: "Beta (bias)",
  gamma: "Gamma",
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

const ADDITIVE_SLIDERS = ["warmth", "vignette", "beta"];

const sliders = [
  "brightness",
  "exposure",
  "contrast",
  "alpha",
  "beta",
  "gamma",
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

// The panels that get a live, viewport-cropped preview plus their own Apply
// button (every panel except Zoom/Crop/Transform/Enhancements, which commit
// their own actions immediately and don't have a "pending" adjustment state).
const LIGHT_SLIDER_IDS = ["brightness", "exposure", "contrast", "alpha", "beta", "gamma", "whites", "blacks", "shadows"];
const COLOR_SLIDER_IDS = ["saturation", "vibrance", "warmth", "pop", "vignette", "r", "g", "b"];

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
  return Object.fromEntries(sliders.map((s) => [s.id, ADDITIVE_SLIDERS.includes(s.id) ? 0 : 1]));
}

function sliderAdjustment(id, raw, baseline) {
  return ADDITIVE_SLIDERS.includes(id) ? raw - baseline : raw / baseline;
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
  // Zooming/panning changes what's visible, so any pending panel's live
  // preview needs to be re-cropped to the new viewport.
  scheduleLivePreviewUpdate();
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

// Zooms while keeping the point at (anchorX, anchorY) — in imageWrap-relative
// coordinates — visually fixed, by solving for the pan that keeps
// anchor = pan + zoom * localPoint constant across the zoom change.
function zoomAtPoint(nextZoom, anchorX, anchorY) {
  const previousZoom = state.zoom;
  const clampedZoom = clamp(nextZoom, minimumZoom(), 6);
  if (clampedZoom === previousZoom) return;
  const ratio = clampedZoom / previousZoom;
  state.panX = anchorX - ratio * (anchorX - state.panX);
  state.panY = anchorY - ratio * (anchorY - state.panY);
  state.zoom = clampedZoom;
  applyPreviewTransform();
}

function changeZoom(delta) {
  if (!state.imageId) return;
  const rect = imageWrap.getBoundingClientRect();
  zoomAtPoint(state.zoom * delta, rect.width / 2, rect.height / 2);
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

// --- Per-panel live preview -------------------------------------------------
// Light/Color/Grayscale/Filters each have their own "pending" adjustment: the
// panel's controls have moved away from their applied state, but nothing has
// been baked into the source image yet. While any panel is pending, only the
// portion of the image currently visible in the viewport is re-rendered with
// every pending panel's settings and shown as an overlay -- so dragging a
// slider stays responsive no matter how large the source photo is. Clicking a
// panel's Apply button bakes just that panel's settings into the real source
// image and adds a history step; other panels stay pending until their own
// Apply is clicked.

function sliderGroupPending(ids) {
  return ids.some((id) => parseFloat(document.getElementById(id).value) !== state.sliderBaseline[id]);
}

function isGrayscalePending() {
  return parseFloat(grayscaleIntensity.value) > 0;
}

function isFiltersPending() {
  return filterPreset.value !== "none";
}

function isIsolationPending() {
  return parseFloat(isolationHueMin.value) > 0 || parseFloat(isolationHueMax.value) < 360;
}

// Keeps the two hue-range thumbs from crossing, and repaints the highlighted
// segment of the spectrum strip to match their current positions.
function updateHueRangeVisual() {
  const min = parseFloat(isolationHueMin.value);
  const max = parseFloat(isolationHueMax.value);
  hueRangeSelected.style.left = `${(min / 360) * 100}%`;
  hueRangeSelected.style.width = `${Math.max(0, (max - min) / 360) * 100}%`;
}

function hasAnyPendingPanel() {
  return PANELS.some((panel) => panel.isPending());
}

// Marks a panel's Apply/Reset pair enabled/disabled, flags its accordion
// header with an asterisk, and lightens its background -- all driven by the
// same "does this panel have an unapplied change" check.
function setPanelPendingUI(applyBtn, resetBtn, panelItem, indicator, pending) {
  applyBtn.disabled = !pending;
  resetBtn.disabled = !pending;
  panelItem.classList.toggle("has-pending", pending);
  indicator.hidden = !pending;
}

// Each panel's Apply/Reset pair is only enabled while that panel actually has
// a pending (not yet Applied) change -- there's nothing to apply or reset otherwise.
function updatePanelButtons() {
  const pendingNames = [];
  for (const panel of PANELS) {
    const pending = Boolean(state.imageId) && panel.isPending();
    setPanelPendingUI(panel.applyBtn, panel.resetBtn, panel.item, panel.indicator, pending);
    if (pending) pendingNames.push(panel.name);
  }
  pendingChangesBanner.hidden = pendingNames.length === 0;
  pendingChangesBanner.textContent = pendingNames.length
    ? `Pending changes in ${pendingNames.join(", ")} (exported image will not have these pending changes applied)`
    : "";
}

function resetGrayscaleControls() {
  grayscaleMethod.value = "luminosity";
  grayscaleIntensity.value = "0";
  document.querySelector('[data-out="grayscaleIntensity"]').textContent = "0.00";
}

function resetFilterControls() {
  filterPreset.value = "none";
  filterIntensity.value = "1";
  document.querySelector('[data-out="filterIntensity"]').textContent = "1.00";
}

function resetIsolationControls() {
  isolationHueMin.value = "0";
  isolationHueMax.value = "360";
  isolationMinSaturation.value = "0";
  isolationTone.value = "0";
  document.querySelector('[data-out="isolationHueMin"]').textContent = "0°";
  document.querySelector('[data-out="isolationHueMax"]').textContent = "360°";
  document.querySelector('[data-out="isolationMinSaturation"]').textContent = "0.00";
  document.querySelector('[data-out="isolationTone"]').textContent = "0.00";
  updateHueRangeVisual();
}

// Discards a panel's in-progress slider movement, putting it back at its
// last-applied (baseline) value rather than at the source image's original state.
function resetSliderPanel(sliderIds) {
  for (const id of sliderIds) {
    const el = document.getElementById(id);
    el.value = state.sliderBaseline[id];
    const output = document.querySelector(`[data-out="${id}"]`);
    if (output) output.textContent = parseFloat(el.value).toFixed(2);
  }
}

function collectPendingParams() {
  const params = {};
  for (const panel of PANELS) {
    if (panel.isPending()) Object.assign(params, panel.collectParams());
  }
  return params;
}

// Maps the portion of the source image currently visible inside imageWrap
// (accounting for the current zoom/pan) back into source-pixel coordinates.
function currentViewportCropRect() {
  if (!state.naturalWidth || !state.naturalHeight) return null;
  const wrapRect = imageWrap.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  if (previewRect.width <= 0 || previewRect.height <= 0) return null;

  const visLeft = Math.max(wrapRect.left, previewRect.left);
  const visTop = Math.max(wrapRect.top, previewRect.top);
  const visRight = Math.min(wrapRect.right, previewRect.right);
  const visBottom = Math.min(wrapRect.bottom, previewRect.bottom);
  if (visRight <= visLeft || visBottom <= visTop) return null;

  const scaleX = state.naturalWidth / previewRect.width;
  const scaleY = state.naturalHeight / previewRect.height;
  const x = Math.round((visLeft - previewRect.left) * scaleX);
  const y = Math.round((visTop - previewRect.top) * scaleY);
  const w = Math.round((visRight - visLeft) * scaleX);
  const h = Math.round((visBottom - visTop) * scaleY);

  return {
    x: clamp(x, 0, state.naturalWidth - 1),
    y: clamp(y, 0, state.naturalHeight - 1),
    w: clamp(w, 1, state.naturalWidth - clamp(x, 0, state.naturalWidth - 1)),
    h: clamp(h, 1, state.naturalHeight - clamp(y, 0, state.naturalHeight - 1)),
  };
}

let cropPreviewDebounce = null;
let cropOverlayObjectUrl = null;
let cropPreviewRequestId = 0;

function hideCropOverlay() {
  clearTimeout(cropPreviewDebounce);
  previewCropOverlay.hidden = true;
  if (cropOverlayObjectUrl) {
    URL.revokeObjectURL(cropOverlayObjectUrl);
    cropOverlayObjectUrl = null;
  }
}

function refreshLivePreviewOverlay() {
  updatePanelButtons();
  if (hasAnyPendingPanel()) scheduleLivePreviewUpdate();
  else hideCropOverlay();
}

function scheduleLivePreviewUpdate() {
  clearTimeout(cropPreviewDebounce);
  cropPreviewDebounce = setTimeout(updateLivePreviewOverlay, 150);
}

async function updateLivePreviewOverlay() {
  if (!state.imageId || !hasAnyPendingPanel()) {
    hideCropOverlay();
    return;
  }

  const cropRect = currentViewportCropRect();
  if (!cropRect) {
    hideCropOverlay();
    return;
  }

  const wrapRect = imageWrap.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const visLeft = Math.max(wrapRect.left, previewRect.left);
  const visTop = Math.max(wrapRect.top, previewRect.top);
  const visRight = Math.min(wrapRect.right, previewRect.right);
  const visBottom = Math.min(wrapRect.bottom, previewRect.bottom);
  const overlayLeft = visLeft - wrapRect.left;
  const overlayTop = visTop - wrapRect.top;
  const overlayWidth = Math.max(1, visRight - visLeft);
  const overlayHeight = Math.max(1, visBottom - visTop);

  const requestId = ++cropPreviewRequestId;
  const res = await fetch(`/process/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...collectPendingParams(),
      preview_crop: cropRect,
      preview: { w: Math.round(overlayWidth), h: Math.round(overlayHeight) },
    }),
  });
  // A newer request already superseded this one (e.g. the user kept dragging
  // or panning); drop this response instead of flashing a stale frame.
  if (requestId !== cropPreviewRequestId || !res.ok) return;

  const blob = await res.blob();
  const nextUrl = URL.createObjectURL(blob);
  const previousUrl = cropOverlayObjectUrl;
  cropOverlayObjectUrl = nextUrl;
  previewCropOverlay.src = nextUrl;
  previewCropOverlay.style.left = `${overlayLeft}px`;
  previewCropOverlay.style.top = `${overlayTop}px`;
  previewCropOverlay.style.width = `${overlayWidth}px`;
  previewCropOverlay.style.height = `${overlayHeight}px`;
  previewCropOverlay.hidden = false;
  if (previousUrl) URL.revokeObjectURL(previousUrl);
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
  refreshLivePreviewOverlay();
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
  refreshLivePreviewOverlay();
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

function committedPreviewParams() {
  // Unlike currentParams(), this never includes a panel's in-progress slider
  // values -- the base preview only ever shows the last *applied* state. Any
  // pending (not yet Applied) adjustment is shown solely by the viewport-cropped
  // overlay in updateLivePreviewOverlay(), not baked into the whole image.
  return {
    crop: null,
    resize: null,
    preview: currentPreviewSize(),
    rotation: 0,
  };
}

function requestPreview() {
  if (!state.imageId) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    setStatus("Rendering...");
    const res = await fetch(`/process/${state.imageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(committedPreviewParams()),
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

// Shows only the compression/quality controls relevant to the format
// currently selected in the export dialog.
function updateExportOptionsVisibility() {
  const format = exportFormat.value;
  exportFormatOptionGroups.forEach((group) => {
    group.hidden = group.dataset.exportOptions !== format;
  });
  exportTiffQualityField.hidden = exportTiffCompression.value !== "jpeg";
}

// Reads the compression/quality controls for the currently selected export
// format into the options payload sent to the backend.
function collectExportOptions(format) {
  switch (format) {
    case "png":
      return {
        compress_level: parseInt(exportPngCompressLevel.value, 10),
        optimize: exportPngOptimize.checked,
      };
    case "jpeg":
      return {
        quality: parseInt(exportJpegQuality.value, 10),
        subsampling: exportJpegSubsampling.value,
        progressive: exportJpegProgressive.checked,
        optimize: exportJpegOptimize.checked,
      };
    case "webp":
      return {
        lossless: exportWebpLossless.checked,
        quality: parseInt(exportWebpQuality.value, 10),
        method: parseInt(exportWebpMethod.value, 10),
      };
    case "tiff":
      return {
        compression: exportTiffCompression.value,
        quality: parseInt(exportTiffQuality.value, 10),
      };
    case "gif":
      return {
        colors: parseInt(exportGifColors.value, 10),
        optimize: exportGifOptimize.checked,
      };
    case "ico":
      return {
        sizes: Array.from(exportIcoSizeChecks)
          .filter((el) => el.checked)
          .map((el) => parseInt(el.value, 10)),
      };
    default:
      return {};
  }
}

async function exportCurrentImage(format, filename) {
  if (!state.imageId) return;

  setStatus("Preparing export...");
  const params = currentParams();
  delete params.preview;
  const options = collectExportOptions(format);
  const res = await fetch(`/export/${state.imageId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params, format, options }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    setStatus(data.error || "Export failed");
    return;
  }

  downloadBlob(await res.blob(), filename);
  setStatus("");
}

function collectAllSliderParams(sliderIds) {
  const params = {};
  for (const id of sliderIds) {
    const raw = parseFloat(document.getElementById(id).value);
    params[id] = sliderAdjustment(id, raw, state.sliderBaseline[id]);
  }
  return params;
}

function sliderPanelChangeLabel(sliderIds) {
  const changed = [];
  for (const id of sliderIds) {
    const raw = parseFloat(document.getElementById(id).value);
    const baseline = state.sliderBaseline[id];
    if (raw !== baseline) changed.push(`${SLIDER_LABELS[id] || id} ${raw.toFixed(2)}`);
  }
  return changed.join(", ");
}

function commitSliderPanelBaseline(sliderIds) {
  for (const id of sliderIds) state.sliderBaseline[id] = parseFloat(document.getElementById(id).value);
}

// Declarative registry of every panel with its own pending/Apply/Reset state.
// Each entry says how to detect a pending (not yet applied) change, how to
// turn the current controls into commit params + a history label, what to do
// to the controls after a successful Apply, and how to reset them. Driving
// updatePanelButtons/collectPendingParams/hasAnyPendingPanel and the
// Apply/Reset click wiring off this one array means adding a new panel is a
// single new entry here instead of an edit to each of those functions.
const PANELS = [
  {
    name: "Light",
    applyBtn: applyLightBtn,
    resetBtn: resetLightBtn,
    item: lightPanelItem,
    indicator: lightPendingIndicator,
    isPending: () => sliderGroupPending(LIGHT_SLIDER_IDS),
    collectParams: () => collectAllSliderParams(LIGHT_SLIDER_IDS),
    buildLabel: () => sliderPanelChangeLabel(LIGHT_SLIDER_IDS),
    afterApply: () => commitSliderPanelBaseline(LIGHT_SLIDER_IDS),
    resetControls: () => resetSliderPanel(LIGHT_SLIDER_IDS),
  },
  {
    name: "Color",
    applyBtn: applyColorBtn,
    resetBtn: resetColorBtn,
    item: colorPanelItem,
    indicator: colorPendingIndicator,
    isPending: () => sliderGroupPending(COLOR_SLIDER_IDS),
    collectParams: () => collectAllSliderParams(COLOR_SLIDER_IDS),
    buildLabel: () => sliderPanelChangeLabel(COLOR_SLIDER_IDS),
    afterApply: () => commitSliderPanelBaseline(COLOR_SLIDER_IDS),
    resetControls: () => resetSliderPanel(COLOR_SLIDER_IDS),
  },
  {
    name: "Grayscale",
    applyBtn: applyGrayscaleBtn,
    resetBtn: resetGrayscaleBtn,
    item: grayscalePanelItem,
    indicator: grayscalePendingIndicator,
    isPending: isGrayscalePending,
    collectParams: () => ({
      grayscale_method: grayscaleMethod.value,
      grayscale_intensity: parseFloat(grayscaleIntensity.value),
    }),
    buildLabel: () => {
      const methodLabel = grayscaleMethod.options[grayscaleMethod.selectedIndex].text;
      const intensity = parseFloat(grayscaleIntensity.value);
      return `Grayscale (${methodLabel}, ${Math.round(intensity * 100)}%)`;
    },
    afterApply: resetGrayscaleControls,
    resetControls: resetGrayscaleControls,
  },
  {
    name: "Filters",
    applyBtn: applyFilterBtn,
    resetBtn: resetFilterBtn,
    item: filtersPanelItem,
    indicator: filtersPendingIndicator,
    isPending: isFiltersPending,
    collectParams: () => ({
      filter_preset: filterPreset.value,
      filter_intensity: parseFloat(filterIntensity.value),
    }),
    buildLabel: () => {
      const label = filterPreset.options[filterPreset.selectedIndex].text;
      const intensity = parseFloat(filterIntensity.value);
      return `${label} filter ${Math.round(intensity * 100)}%`;
    },
    afterApply: resetFilterControls,
    resetControls: resetFilterControls,
  },
  {
    name: "Color Isolation",
    applyBtn: applyIsolationBtn,
    resetBtn: resetIsolationBtn,
    item: isolationPanelItem,
    indicator: isolationPendingIndicator,
    isPending: isIsolationPending,
    collectParams: () => ({
      isolation_hue_min: parseFloat(isolationHueMin.value),
      isolation_hue_max: parseFloat(isolationHueMax.value),
      isolation_min_saturation: parseFloat(isolationMinSaturation.value),
      isolation_tone: parseFloat(isolationTone.value),
    }),
    buildLabel: () => {
      const hueMin = parseFloat(isolationHueMin.value);
      const hueMax = parseFloat(isolationHueMax.value);
      const minSaturation = parseFloat(isolationMinSaturation.value);
      const tone = parseFloat(isolationTone.value);
      return `Hue ${hueMin}°-${hueMax}° isolation (sat min ${minSaturation.toFixed(2)}, tone ${tone.toFixed(2)})`;
    },
    afterApply: resetIsolationControls,
    resetControls: resetIsolationControls,
  },
];

function applyPanelGeneric(panel) {
  if (!state.imageId || !panel.isPending()) return;
  commitStep(panel.collectParams(), panel.buildLabel(), true);
  panel.afterApply();
  updatePanelButtons();
}

function resetPanelGeneric(panel) {
  panel.resetControls();
  updatePanelButtons();
  refreshLivePreviewOverlay();
}

sliders.forEach((s) => {
  s.addEventListener("input", () => {
    const output = document.querySelector(`[data-out="${s.id}"]`);
    if (output) output.textContent = parseFloat(s.value).toFixed(2);
    updatePanelButtons();
    scheduleLivePreviewUpdate();
  });
});

for (const panel of PANELS) {
  panel.applyBtn.addEventListener("click", () => applyPanelGeneric(panel));
  panel.resetBtn.addEventListener("click", () => resetPanelGeneric(panel));
}

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
  resetGrayscaleControls();
  resetFilterControls();
  resetIsolationControls();
  hideCropOverlay();
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
  exportBtn.disabled = false;
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
  grayscaleMethod.disabled = false;
  grayscaleIntensity.disabled = false;
  filterPreset.disabled = false;
  filterIntensity.disabled = false;
  isolationHueMin.disabled = false;
  isolationHueMax.disabled = false;
  isolationMinSaturation.disabled = false;
  isolationTone.disabled = false;
  historyResetBtn.disabled = false;
  importHistoryBtn.disabled = false;
  exportHistoryBtn.disabled = false;
  updatePanelButtons();
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
  resetGrayscaleControls();
  resetFilterControls();
  resetIsolationControls();
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
  if (!state.imageId) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const pointer = getPointerInWrap(e);
  zoomAtPoint(state.zoom * delta, pointer.x, pointer.y);
}, { passive: false });

imageWrap.addEventListener("dragstart", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  if (!state.imageId) return;
  fitPreviewToPane();
  if (state.zoom > 1) applyPreviewTransform();
  else scheduleLivePreviewUpdate();
});
preview.addEventListener("dragstart", (e) => e.preventDefault());

function closeExportDialog() {
  exportDialog.hidden = true;
}

exportBtn.addEventListener("click", () => {
  if (!state.imageId) return;
  exportFileName.value = "edited-image";
  exportFormat.value = "png";
  updateExportOptionsVisibility();
  exportDialog.hidden = false;
});

exportFormat.addEventListener("change", updateExportOptionsVisibility);
exportTiffCompression.addEventListener("change", updateExportOptionsVisibility);

// Keeps each export option range input's numeric readout in sync as it's dragged.
["exportPngCompressLevel", "exportJpegQuality", "exportWebpQuality", "exportWebpMethod", "exportTiffQuality", "exportGifColors"].forEach((id) => {
  document.getElementById(id).addEventListener("input", (e) => {
    document.querySelector(`[data-out="${id}"]`).textContent = e.target.value;
  });
});

exportDialog.addEventListener("click", (event) => {
  if (event.target === exportDialog) {
    closeExportDialog();
    return;
  }
  const mode = event.target.closest("[data-export-mode]")?.dataset.exportMode;
  if (!mode) return;
  const format = exportFormat.value;
  const requestedName = exportFileName.value.trim() || "edited-image";
  const ext = EXPORT_EXTENSIONS[format] || format;
  const filename = requestedName.toLowerCase().endsWith(`.${ext}`) ? requestedName : `${requestedName}.${ext}`;
  closeExportDialog();
  if (mode !== "export") return;
  exportCurrentImage(format, filename);
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
    else scheduleLivePreviewUpdate();
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

    // Resize only moves the dragged side; the opposite side stays put.
    const original = cropInteraction.rect;
    let x = original.x;
    let y = original.y;
    let w = original.w;
    let h = original.h;

    // Strip the "handle-" prefix before checking direction letters — the
    // word "handle" itself contains 'n' and 'e', which would otherwise
    // match every handle regardless of its actual direction.
    const direction = cropInteraction.handle.slice("handle-".length);
    if (direction.includes("e")) w = Math.max(10, original.w + dx);
    if (direction.includes("w")) {
      const newW = Math.max(10, original.w - dx);
      x = original.x + (original.w - newW);
      w = newW;
    }
    if (direction.includes("s")) h = Math.max(10, original.h + dy);
    if (direction.includes("n")) {
      const newH = Math.max(10, original.h - dy);
      y = original.y + (original.h - newH);
      h = newH;
    }

    x = Math.max(0, x);
    y = Math.max(0, y);
    w = Math.min(w, rect.width - x);
    h = Math.min(h, rect.height - y);

    setCropBoxPosition(x, y, w, h);
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
updateHueRangeVisual();

grayscaleIntensity.addEventListener("input", () => {
  document.querySelector('[data-out="grayscaleIntensity"]').textContent = parseFloat(grayscaleIntensity.value).toFixed(2);
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});
grayscaleMethod.addEventListener("change", () => {
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});

filterIntensity.addEventListener("input", () => {
  document.querySelector('[data-out="filterIntensity"]').textContent = parseFloat(filterIntensity.value).toFixed(2);
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});
filterPreset.addEventListener("change", () => {
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});

isolationHueMin.addEventListener("input", () => {
  if (parseFloat(isolationHueMin.value) > parseFloat(isolationHueMax.value)) {
    isolationHueMax.value = isolationHueMin.value;
    document.querySelector('[data-out="isolationHueMax"]').textContent = `${isolationHueMax.value}°`;
  }
  document.querySelector('[data-out="isolationHueMin"]').textContent = `${isolationHueMin.value}°`;
  updateHueRangeVisual();
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});
isolationHueMax.addEventListener("input", () => {
  if (parseFloat(isolationHueMax.value) < parseFloat(isolationHueMin.value)) {
    isolationHueMin.value = isolationHueMax.value;
    document.querySelector('[data-out="isolationHueMin"]').textContent = `${isolationHueMin.value}°`;
  }
  document.querySelector('[data-out="isolationHueMax"]').textContent = `${isolationHueMax.value}°`;
  updateHueRangeVisual();
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});
isolationMinSaturation.addEventListener("input", () => {
  document.querySelector('[data-out="isolationMinSaturation"]').textContent = parseFloat(isolationMinSaturation.value).toFixed(2);
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});
isolationTone.addEventListener("input", () => {
  document.querySelector('[data-out="isolationTone"]').textContent = parseFloat(isolationTone.value).toFixed(2);
  updatePanelButtons();
  scheduleLivePreviewUpdate();
});

