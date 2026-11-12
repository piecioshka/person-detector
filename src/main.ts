import Hls from 'hls.js';
import { gridSize, videoPixelsPerScreenPixel, type PersonBox } from './detections';
import type { DetectRequest, WorkerResponse } from './worker-protocol';
import { getLang, initialLang, setLang, t, type MessageKey } from './i18n';
import { initTheme } from './theme';
import { initShortcuts } from './shortcuts';

interface StreamResponse {
  title: string;
  live: boolean;
  kind: 'hls' | 'file';
  src: string;
}

function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}

const video = byId('video', HTMLVideoElement);
const overlay = byId('overlay', HTMLCanvasElement);
const form = byId('source-form', HTMLFormElement);
const urlInput = byId('url-input', HTMLInputElement);
const playButton = byId('play-button', HTMLButtonElement);
const fileInput = byId('file-input', HTMLInputElement);
const thresholdInput = byId('threshold', HTMLInputElement);
const thresholdValue = byId('threshold-value', HTMLOutputElement);
const lineWidthInput = byId('line-width', HTMLInputElement);
const lineWidthValue = byId('line-width-value', HTMLOutputElement);
const tilingInput = byId('tiling', HTMLInputElement);
const tilingValue = byId('tiling-value', HTMLOutputElement);
const boxesToggle = byId('boxes-toggle', HTMLInputElement);
const peopleCount = byId('people-count', HTMLElement);
const detectionFps = byId('detection-fps', HTMLElement);
const statusLine = byId('status', HTMLElement);
const langFlag = byId('lang-flag', HTMLElement);

const LINE_WIDTH_STORAGE_KEY = 'person-detector:line-width';
const LABEL_FONT_PX = 12;
const LABEL_PADDING_PX = 3;

const context = overlay.getContext('2d');
const worker = new Worker(new URL('./detection.worker.ts', import.meta.url), { type: 'module' });
let workerReady = false;
let workerBusy = false;
let hls: Hls | null = null;
let objectUrl: string | null = null;
let lastBoxes: PersonBox[] = [];
let statusKey: MessageKey = 'statusLoadingModel';
let statusDetail = '';
const fpsWindow: number[] = [];

function renderStatus(): void {
  statusLine.textContent = statusDetail ? `${t(statusKey)}: ${statusDetail}` : t(statusKey);
  statusLine.dataset.state = statusKey;
}

function setStatus(key: MessageKey, detail = ''): void {
  statusKey = key;
  statusDetail = detail;
  renderStatus();
}

function applyLang(lang: 'pl' | 'en'): void {
  setLang(lang);
  langFlag.textContent = lang === 'pl' ? '🇵🇱' : '🇬🇧';
  renderStatus();
  draw(lastBoxes);
}

function minScore(): number {
  return Number(thresholdInput.value) / 100;
}

function syncCanvasSize(): void {
  if (video.videoWidth && (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight)) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }
}

function draw(boxes: PersonBox[]): void {
  if (!context) {
    return;
  }
  context.clearRect(0, 0, overlay.width, overlay.height);
  if (!boxesToggle.checked) {
    return;
  }
  const scale = videoPixelsPerScreenPixel(overlay.width, overlay.clientWidth);
  const lineWidth = Number(lineWidthInput.value) * scale;
  const fontSize = LABEL_FONT_PX * scale;
  const padding = LABEL_PADDING_PX * scale;
  context.lineWidth = lineWidth;
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = 'top';
  for (const box of boxes) {
    context.strokeStyle = '#22c55e';
    context.strokeRect(box.x, box.y, box.width, box.height);
    // Distant people are a few pixels tall; a label would hide them and their neighbors.
    if (box.height < fontSize * 3) {
      continue;
    }
    const label = `${t('person')} ${Math.round(box.score * 100)}%`;
    const labelWidth = context.measureText(label).width + padding * 2;
    const labelHeight = fontSize + padding * 2;
    const labelY = box.y >= labelHeight ? box.y - labelHeight : box.y;
    context.fillStyle = '#22c55e';
    context.fillRect(box.x - lineWidth / 2, labelY, labelWidth, labelHeight);
    context.fillStyle = '#052e16';
    context.fillText(label, box.x + padding, labelY + padding);
  }
}

function updateFps(now: number): void {
  fpsWindow.push(now);
  while (fpsWindow.length > 0 && now - (fpsWindow[0] ?? now) > 1000) {
    fpsWindow.shift();
  }
  detectionFps.textContent = String(fpsWindow.length);
}

function renderTilingValue(): void {
  const { rows, cols } = gridSize(video.videoWidth || 16, video.videoHeight || 9, Number(tilingInput.value));
  tilingValue.textContent = `${cols}×${rows}`;
}

function showResult(boxes: PersonBox[]): void {
  lastBoxes = boxes;
  peopleCount.textContent = String(boxes.length);
  draw(boxes);
  updateFps(performance.now());
}

// Sends the current frame only when the worker is idle, so frames never queue up.
function detectFrame(): void {
  if (workerReady && !workerBusy && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused) {
    syncCanvasSize();
    workerBusy = true;
    createImageBitmap(video)
      .then((frame) => {
        const request: DetectRequest = { frame, level: Number(tilingInput.value), minScore: minScore() };
        worker.postMessage(request, [frame]);
      })
      .catch(() => {
        workerBusy = false;
      });
  }
  video.requestVideoFrameCallback(detectFrame);
}

function resetSource(): void {
  hls?.destroy();
  hls = null;
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  video.removeAttribute('src');
  lastBoxes = [];
  draw(lastBoxes);
}

function playHls(src: string): void {
  if (Hls.isSupported()) {
    hls = new Hls({ liveSyncDurationCount: 3, enableWorker: true });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        setStatus('statusError', data.details);
      }
    });
    hls.loadSource(src);
    hls.attachMedia(video);
  } else {
    // Safari plays HLS natively.
    video.src = src;
  }
}

async function playYouTube(url: string): Promise<void> {
  resetSource();
  setStatus('statusResolving');
  const response = await fetch(`/api/stream?url=${encodeURIComponent(url)}`);
  const body: unknown = await response.json();
  if (!response.ok || !isStreamResponse(body)) {
    const detail = typeof body === 'object' && body !== null && 'error' in body ? String(body.error) : response.status;
    setStatus('statusError', String(detail));
    return;
  }
  if (body.kind === 'hls') {
    playHls(body.src);
  } else {
    video.src = body.src;
  }
  setStatus(body.live ? 'statusLive' : 'statusPlaying', body.title);
  await video.play();
}

function isStreamResponse(value: unknown): value is StreamResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'src' in value &&
    typeof value.src === 'string' &&
    'kind' in value &&
    (value.kind === 'hls' || value.kind === 'file')
  );
}

function togglePlayback(): void {
  if (!video.currentSrc) {
    return;
  }
  if (video.paused) {
    void video.play();
  } else {
    video.pause();
  }
}

function toggleBoxes(): void {
  boxesToggle.checked = !boxesToggle.checked;
  draw(lastBoxes);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  playYouTube(urlInput.value).catch((error: unknown) => {
    setStatus('statusError', error instanceof Error ? error.message : String(error));
  });
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }
  resetSource();
  objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;
  video.loop = true;
  setStatus('statusPlaying', file.name);
  void video.play();
});

thresholdInput.addEventListener('input', () => {
  thresholdValue.textContent = `${thresholdInput.value}%`;
});

function renderLineWidthValue(): void {
  lineWidthValue.textContent = `${lineWidthInput.value} px`;
}

function restoreLineWidth(): void {
  try {
    const stored = localStorage.getItem(LINE_WIDTH_STORAGE_KEY);
    if (stored !== null) {
      lineWidthInput.value = stored;
    }
  } catch {
    // Storage may be unavailable; keep the default.
  }
  renderLineWidthValue();
}

lineWidthInput.addEventListener('input', () => {
  renderLineWidthValue();
  draw(lastBoxes);
  try {
    localStorage.setItem(LINE_WIDTH_STORAGE_KEY, lineWidthInput.value);
  } catch {
    // Storage may be unavailable; the width just won't persist.
  }
});

tilingInput.addEventListener('input', renderTilingValue);
video.addEventListener('loadedmetadata', renderTilingValue);

boxesToggle.addEventListener('change', () => draw(lastBoxes));
video.addEventListener('loadedmetadata', syncCanvasSize);
video.addEventListener('resize', syncCanvasSize);
// The overlay belongs to the frame it was computed for; when looping or seeking, drop stale boxes.
video.addEventListener('emptied', () => draw([]));

byId('lang-toggle', HTMLButtonElement).addEventListener('click', () => {
  applyLang(getLang() === 'pl' ? 'en' : 'pl');
});

initTheme(byId('theme-toggle', HTMLButtonElement));
initShortcuts({
  dialog: byId('shortcuts', HTMLDialogElement),
  onTogglePlayback: togglePlayback,
  onToggleBoxes: toggleBoxes,
  onFocusUrl: () => urlInput.focus(),
});
restoreLineWidth();
applyLang(initialLang());
delete document.documentElement.dataset.i18nPending;
setStatus('statusLoadingModel');
video.requestVideoFrameCallback(detectFrame);

worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
  const message = event.data;
  if (message.type === 'ready') {
    workerReady = true;
    playButton.disabled = false;
    setStatus('statusReady');
  } else if (message.type === 'result') {
    workerBusy = false;
    showResult(message.boxes);
  } else {
    workerBusy = false;
    setStatus('statusError', message.message);
  }
});

// Fires when the worker script itself fails to load (e.g. a stale Vite dep returning 504),
// which otherwise leaves the status stuck on "Loading model…".
worker.addEventListener('error', (event) => {
  event.preventDefault();
  workerBusy = false;
  setStatus('statusError', event.message || 'worker failed to load');
});
