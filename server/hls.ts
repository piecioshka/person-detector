export const PROXY_PATH = '/api/hls';

const ALLOWED_HOST_SUFFIXES = ['.googlevideo.com', '.youtube.com'];
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

/** Only YouTube media hosts may be fetched through the proxy (SSRF guard). */
export function isAllowedMediaUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}

export function toProxyUrl(absoluteUrl: string): string {
  return `${PROXY_PATH}?u=${encodeURIComponent(absoluteUrl)}`;
}

function rewriteUriAttributes(line: string, baseUrl: string): string {
  return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${toProxyUrl(new URL(uri, baseUrl).href)}"`);
}

/** Rewrites every URI in an HLS playlist so the browser fetches it through the proxy. */
export function rewritePlaylist(playlist: string, playlistUrl: string): string {
  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === '') {
        return line;
      }
      if (trimmed.startsWith('#')) {
        return rewriteUriAttributes(line, playlistUrl);
      }
      return toProxyUrl(new URL(trimmed, playlistUrl).href);
    })
    .join('\n');
}

export function isPlaylistContentType(contentType: string | null): boolean {
  return contentType !== null && /mpegurl/i.test(contentType);
}

/** Extracts the 11-character video id from common YouTube URL shapes. */
export function parseYouTubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }
  const candidate =
    url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : (url.searchParams.get('v') ?? url.pathname.match(/^\/(?:live|shorts|embed)\/([^/]+)/)?.[1] ?? '');
  return VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}
