import type { ObjectDetectorResult as DetectionResult } from '@mediapipe/tasks-vision';

export interface PersonBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

/** Keeps only "person" detections above the threshold, as plain boxes in video pixels. */
export function toPersonBoxes(result: DetectionResult, minScore: number): PersonBox[] {
  const boxes: PersonBox[] = [];
  for (const detection of result.detections) {
    const person = detection.categories.find((category) => category.categoryName === 'person');
    const box = detection.boundingBox;
    if (person && box && person.score >= minScore) {
      boxes.push({ x: box.originX, y: box.originY, width: box.width, height: box.height, score: person.score });
    }
  }
  return boxes;
}

/**
 * The overlay canvas has the video's resolution but is scaled to fit the page, so sizes
 * meant in screen pixels (line width, label font) must be converted to video pixels.
 */
export function videoPixelsPerScreenPixel(frameWidth: number, displayWidth: number): number {
  return frameWidth > 0 && displayWidth > 0 ? frameWidth / displayWidth : 1;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Splits the frame into overlapping tiles, so small (distant) people stay large enough
 * after the model downsizes its input. Level 1 is the whole frame; level n gives n rows
 * and as many columns as needed to keep tiles roughly square.
 */
export function computeTiles(frameWidth: number, frameHeight: number, level: number, overlap = 0.2): Rect[] {
  if (level <= 1) {
    return [{ x: 0, y: 0, width: frameWidth, height: frameHeight }];
  }
  const { rows, cols } = gridSize(frameWidth, frameHeight, level);
  const width = frameWidth / (cols - (cols - 1) * overlap);
  const height = frameHeight / (rows - (rows - 1) * overlap);
  const tiles: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({
        x: Math.round(col * width * (1 - overlap)),
        y: Math.round(row * height * (1 - overlap)),
        width: Math.round(width),
        height: Math.round(height),
      });
    }
  }
  return tiles;
}

export function gridSize(frameWidth: number, frameHeight: number, level: number): { rows: number; cols: number } {
  return level <= 1
    ? { rows: 1, cols: 1 }
    : { rows: level, cols: Math.max(1, Math.round((level * frameWidth) / frameHeight)) };
}

function area(box: Rect): number {
  return box.width * box.height;
}

function intersection(a: Rect, b: Rect): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * Greedy non-maximum suppression. Besides IoU it also drops a box mostly contained in a
 * stronger one, which is what a person cut in half by a tile edge looks like.
 */
export function mergeBoxes(boxes: PersonBox[], iouThreshold = 0.45, containmentThreshold = 0.8): PersonBox[] {
  const kept: PersonBox[] = [];
  for (const box of [...boxes].sort((a, b) => b.score - a.score)) {
    const overlapsKept = kept.some((other) => {
      const shared = intersection(box, other);
      const iou = shared / (area(box) + area(other) - shared);
      return iou > iouThreshold || shared / Math.min(area(box), area(other)) > containmentThreshold;
    });
    if (!overlapsKept) {
      kept.push(box);
    }
  }
  return kept;
}
