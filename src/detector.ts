import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';

const WASM_PATH = `${import.meta.env.BASE_URL}vendor/mediapipe/wasm`;
const MODEL_PATH = `${import.meta.env.BASE_URL}vendor/models/efficientdet_lite0.tflite`;

export type Delegate = 'GPU' | 'CPU';

async function create(delegate: Delegate): Promise<ObjectDetector> {
  // Runs inside a module worker, so the wasm loader must be the ES module variant.
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH, true);
  return ObjectDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    canvas: new OffscreenCanvas(1, 1),
    runningMode: 'VIDEO',
    categoryAllowlist: ['person'],
    // The UI applies its own threshold; keep the model permissive.
    scoreThreshold: 0.1,
    maxResults: 50,
  });
}

/** EfficientDet-Lite0 (COCO) restricted to the "person" class; falls back to CPU without WebGL. */
export async function createPersonDetector(): Promise<{ detector: ObjectDetector; delegate: Delegate }> {
  try {
    return { detector: await create('GPU'), delegate: 'GPU' };
  } catch {
    return { detector: await create('CPU'), delegate: 'CPU' };
  }
}
