import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import type { Connect } from 'vite';

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.tflite': 'application/octet-stream',
};

/**
 * Serves public/vendor before Vite's transform pipeline. MediaPipe loads its wasm glue with a
 * runtime import(), which Vite's dev server rewrites to "?import" and rejects for public files.
 */
export function vendorMiddleware(publicDir: string): Connect.NextHandleFunction {
  const vendorDir = join(publicDir, 'vendor');
  return (req, res, next) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!pathname.startsWith('/vendor/')) {
      next();
      return;
    }
    const filePath = normalize(join(publicDir, decodeURIComponent(pathname)));
    if (!filePath.startsWith(vendorDir + sep)) {
      next();
      return;
    }
    stat(filePath)
      .then((info) => {
        if (!info.isFile()) {
          next();
          return;
        }
        res.setHeader('content-type', CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream');
        res.setHeader('content-length', info.size);
        createReadStream(filePath).pipe(res);
      })
      .catch(() => next());
  };
}
