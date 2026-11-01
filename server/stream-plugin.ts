import { execFile } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { once } from 'node:events';
import { promisify } from 'node:util';
import type { Connect, Plugin } from 'vite';
import { vendorMiddleware } from './vendor-middleware.ts';
import { isAllowedMediaUrl, isPlaylistContentType, parseYouTubeVideoId, rewritePlaylist, toProxyUrl } from './hls.ts';

const execFileAsync = promisify(execFile);

// Prefer HLS (live streams expose only HLS), fall back to a progressive mp4 for regular videos.
const FORMAT =
  'bv*[protocol^=m3u8][height<=720]/b[protocol^=m3u8][height<=720]/b[ext=mp4][height<=720]/bv*[ext=mp4][height<=720]';
const CACHE_TTL_MS = 10 * 60 * 1000;
const FORWARDED_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges'];

export interface ResolvedStream {
  title: string;
  live: boolean;
  kind: 'hls' | 'file';
  src: string;
}

const cache = new Map<string, { at: number; stream: ResolvedStream }>();

async function resolveStream(videoId: string): Promise<ResolvedStream> {
  const cached = cache.get(videoId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.stream;
  }
  const { stdout } = await execFileAsync(
    'yt-dlp',
    [
      '--no-warnings',
      '-f',
      FORMAT,
      '--print',
      '%(title)s',
      '--print',
      '%(live_status)s',
      '--print',
      'urls',
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { timeout: 60_000 },
  );
  const [title = '', liveStatus = '', mediaUrl = ''] = stdout.trim().split('\n');
  if (!isAllowedMediaUrl(mediaUrl)) {
    throw new Error('yt-dlp returned an unexpected media URL');
  }
  const stream: ResolvedStream = {
    title,
    live: liveStatus === 'is_live',
    kind: mediaUrl.includes('m3u8') || mediaUrl.includes('hls_playlist') ? 'hls' : 'file',
    src: toProxyUrl(mediaUrl),
  };
  cache.set(videoId, { at: Date.now(), stream });
  return stream;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function handleStream(url: URL, res: ServerResponse): Promise<void> {
  const videoId = parseYouTubeVideoId(url.searchParams.get('url') ?? '');
  if (!videoId) {
    sendJson(res, 400, { error: 'invalid-url' });
    return;
  }
  try {
    sendJson(res, 200, await resolveStream(videoId));
  } catch (error) {
    sendJson(res, 502, { error: 'resolve-failed', detail: error instanceof Error ? error.message : String(error) });
  }
}

async function handleProxy(url: URL, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const target = url.searchParams.get('u') ?? '';
  if (!isAllowedMediaUrl(target)) {
    sendJson(res, 403, { error: 'host-not-allowed' });
    return;
  }
  const headers: Record<string, string> = {};
  if (typeof req.headers.range === 'string') {
    headers.range = req.headers.range;
  }
  const upstream = await fetch(target, { headers, redirect: 'follow' });
  if (!isAllowedMediaUrl(upstream.url)) {
    sendJson(res, 403, { error: 'redirect-not-allowed' });
    return;
  }
  res.statusCode = upstream.status;
  const contentType = upstream.headers.get('content-type');
  if (isPlaylistContentType(contentType)) {
    res.setHeader('content-type', contentType ?? 'application/vnd.apple.mpegurl');
    res.setHeader('cache-control', 'no-store');
    res.end(rewritePlaylist(await upstream.text(), upstream.url));
    return;
  }
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      res.setHeader(name, value);
    }
  }
  await pipeBody(upstream, res);
}

async function pipeBody(upstream: Response, res: ServerResponse): Promise<void> {
  const reader = upstream.body?.getReader();
  if (!reader) {
    res.end();
    return;
  }
  res.on('close', () => void reader.cancel());
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    if (!res.write(chunk.value)) {
      await once(res, 'drain');
    }
  }
  res.end();
}

const middleware: Connect.NextHandleFunction = (req, res, next) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route =
    url.pathname === '/api/stream'
      ? handleStream(url, res)
      : url.pathname === '/api/hls'
        ? handleProxy(url, req, res)
        : null;
  if (!route) {
    next();
    return;
  }
  route.catch((error: unknown) => {
    if (!res.headersSent) {
      sendJson(res, 502, { error: 'upstream-failed', detail: error instanceof Error ? error.message : String(error) });
    } else {
      res.destroy();
    }
  });
};

/** Serves /api/stream (YouTube URL -> playable source) and /api/hls (CORS proxy) in dev and preview. */
export function streamPlugin(): Plugin {
  return {
    name: 'youtube-stream-proxy',
    configureServer(server) {
      server.middlewares.use(vendorMiddleware(server.config.publicDir));
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
