import type { ObjectDetectorResult as DetectionResult } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { computeTiles, mergeBoxes, toPersonBoxes, videoPixelsPerScreenPixel } from './detections';

function detection(categoryName: string, score: number) {
  return {
    categories: [{ categoryName, score, index: 0, displayName: '' }],
    boundingBox: { originX: 10, originY: 20, width: 30, height: 40, angle: 0 },
    keypoints: [],
  };
}

describe('toPersonBoxes', () => {
  it('keeps people above the threshold and drops other classes', () => {
    const result: DetectionResult = {
      detections: [detection('person', 0.9), detection('dog', 0.95), detection('person', 0.2)],
    };
    expect(toPersonBoxes(result, 0.5)).toEqual([{ x: 10, y: 20, width: 30, height: 40, score: 0.9 }]);
  });

  it('skips detections without a bounding box', () => {
    const result: DetectionResult = {
      detections: [{ categories: [{ categoryName: 'person', score: 1, index: 0, displayName: '' }], keypoints: [] }],
    };
    expect(toPersonBoxes(result, 0.5)).toEqual([]);
  });
});

describe('videoPixelsPerScreenPixel', () => {
  it('converts screen pixels to video pixels of a scaled-down overlay', () => {
    expect(videoPixelsPerScreenPixel(1280, 640)).toBe(2);
    expect(videoPixelsPerScreenPixel(1280, 1280)).toBe(1);
  });

  it('falls back to 1 before the video or layout is ready', () => {
    expect(videoPixelsPerScreenPixel(0, 640)).toBe(1);
    expect(videoPixelsPerScreenPixel(1280, 0)).toBe(1);
  });
});

describe('computeTiles', () => {
  it('returns the whole frame for level 1', () => {
    expect(computeTiles(1280, 720, 1)).toEqual([{ x: 0, y: 0, width: 1280, height: 720 }]);
  });

  it('covers the frame edge to edge with overlapping, roughly square tiles', () => {
    const tiles = computeTiles(1280, 720, 3);
    expect(tiles).toHaveLength(3 * 5);
    const right = Math.max(...tiles.map((tile) => tile.x + tile.width));
    const bottom = Math.max(...tiles.map((tile) => tile.y + tile.height));
    expect(right).toBeCloseTo(1280, -1);
    expect(bottom).toBeCloseTo(720, -1);
    const [first, second] = tiles;
    expect(second!.x).toBeLessThan(first!.x + first!.width);
  });
});

describe('mergeBoxes', () => {
  const box = (x: number, y: number, width: number, height: number, score: number) => ({ x, y, width, height, score });

  it('keeps the strongest of heavily overlapping boxes', () => {
    expect(mergeBoxes([box(0, 0, 10, 20, 0.6), box(1, 1, 10, 20, 0.9)])).toEqual([box(1, 1, 10, 20, 0.9)]);
  });

  it('drops a partial box contained in a stronger one (person cut by a tile edge)', () => {
    expect(mergeBoxes([box(0, 0, 10, 40, 0.9), box(0, 0, 10, 15, 0.7)])).toEqual([box(0, 0, 10, 40, 0.9)]);
  });

  it('keeps separate people', () => {
    expect(mergeBoxes([box(0, 0, 10, 20, 0.9), box(30, 0, 10, 20, 0.8)])).toHaveLength(2);
  });
});
