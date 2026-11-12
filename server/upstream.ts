import { isAllowedMediaUrl } from './hls.ts';

const MAX_REDIRECTS = 5;

export interface AllowedResponse {
  response: Response;
  /** URL of the last hop; relative URIs in a playlist resolve against it. */
  url: string;
}

function isRedirect(status: number): boolean {
  return status >= 300 && status < 400;
}

/**
 * Follows redirects by hand so every hop is checked against the allowlist before it is
 * requested (SSRF guard). Returns null when a hop is not allowed or redirects never end.
 */
export async function fetchAllowed(
  target: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<AllowedResponse | null> {
  let url = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedMediaUrl(url)) {
      return null;
    }
    const response = await fetch(url, { headers, redirect: 'manual', signal });
    const location = response.headers.get('location');
    if (!isRedirect(response.status) || !location) {
      return { response, url };
    }
    await response.body?.cancel();
    url = new URL(location, url).href;
  }
  return null;
}
