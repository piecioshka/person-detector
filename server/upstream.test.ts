import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllowed } from './upstream.ts';

const MEDIA = 'https://rr1---sn-abc.googlevideo.com/videoplayback/x';
const OTHER_MEDIA = 'https://rr2---sn-def.googlevideo.com/videoplayback/y';

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchAllowed', () => {
  it('returns the response of an allowed URL without redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchAllowed(MEDIA, {});
    expect(await result?.response.text()).toBe('ok');
    expect(result?.url).toBe(MEDIA);
    expect(fetchMock).toHaveBeenCalledWith(MEDIA, expect.objectContaining({ redirect: 'manual' }));
  });

  it('follows redirects between allowed hosts and reports the final URL', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect(OTHER_MEDIA)).mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchAllowed(MEDIA, {});
    expect(result?.url).toBe(OTHER_MEDIA);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never requests a disallowed redirect target', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(redirect('http://127.0.0.1:22/'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAllowed(MEDIA, {})).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never requests a disallowed initial URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAllowed('https://evil.example.com/', {})).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gives up after too many redirects', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(redirect(MEDIA)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchAllowed(MEDIA, {})).toBeNull();
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(6);
  });
});
