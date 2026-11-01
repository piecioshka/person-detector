import type { ObjectDetector } from '@mediapipe/tasks-vision';
import { computeTiles, mergeBoxes, toPersonBoxes, type PersonBox } from './detections';
import { createPersonDetector } from './detector';
import type { DetectRequest, WorkerResponse } from './worker-protocol';

// Inference takes tens of milliseconds per tile, so it runs here to keep the page responsive.
const tileCanvas = new OffscreenCanvas(1, 1);
const tileContext = tileCanvas.getContext('2d');
let detector: ObjectDetector | null = null;
let lastTimestamp = 0;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

// VIDEO mode needs strictly increasing timestamps, also between tiles of the same frame.
function nextTimestamp(): number {
  lastTimestamp = Math.max(performance.now(), lastTimestamp + 1);
  return lastTimestamp;
}

function detect(activeDetector: ObjectDetector, { frame, level, minScore }: DetectRequest): PersonBox[] {
  const tiles = computeTiles(frame.width, frame.height, level);
  if (tiles.length === 1 || !tileContext) {
    return toPersonBoxes(activeDetector.detectForVideo(frame, nextTimestamp()), minScore);
  }
  const boxes: PersonBox[] = [];
  for (const tile of tiles) {
    tileCanvas.width = tile.width;
    tileCanvas.height = tile.height;
    tileContext.drawImage(frame, tile.x, tile.y, tile.width, tile.height, 0, 0, tile.width, tile.height);
    for (const box of toPersonBoxes(activeDetector.detectForVideo(tileCanvas, nextTimestamp()), minScore)) {
      boxes.push({ ...box, x: box.x + tile.x, y: box.y + tile.y });
    }
  }
  return mergeBoxes(boxes);
}

self.addEventListener('message', (event: MessageEvent<DetectRequest>) => {
  const request = event.data;
  try {
    if (detector) {
      const started = performance.now();
      const boxes = detect(detector, request);
      post({ type: 'result', boxes, durationMs: performance.now() - started });
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  } finally {
    request.frame.close();
  }
});

createPersonDetector()
  .then((created) => {
    detector = created.detector;
    post({ type: 'ready', delegate: created.delegate });
  })
  .catch((error: unknown) => {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  });
