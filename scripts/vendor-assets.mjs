// Copies MediaPipe wasm runtime and downloads the detection model into public/vendor,
// so the app never loads code or models from a CDN at runtime.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'public', 'vendor');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
const modelPath = join(vendorDir, 'models', 'efficientdet_lite0.tflite');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

await cp(join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'), join(vendorDir, 'mediapipe', 'wasm'), {
  recursive: true,
});

if (!(await exists(modelPath))) {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`Model download failed: HTTP ${response.status}`);
  }
  await mkdir(dirname(modelPath), { recursive: true });
  await writeFile(modelPath, Buffer.from(await response.arrayBuffer()));
}

console.log('vendor-assets: MediaPipe wasm and model ready in public/vendor');
