import type { PersonBox } from './detections';

export interface DetectRequest {
  frame: ImageBitmap;
  level: number;
  minScore: number;
}

export type WorkerResponse =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'result'; boxes: PersonBox[]; durationMs: number }
  | { type: 'error'; message: string };
