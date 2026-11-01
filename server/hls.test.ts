import { describe, expect, it } from 'vitest';
import { isAllowedMediaUrl, isPlaylistContentType, parseYouTubeVideoId, rewritePlaylist } from './hls.ts';

describe('isAllowedMediaUrl', () => {
  it('accepts googlevideo hosts over https', () => {
    expect(isAllowedMediaUrl('https://rr1---sn-abc.googlevideo.com/videoplayback/x')).toBe(true);
    expect(isAllowedMediaUrl('https://manifest.googlevideo.com/api/manifest/hls_playlist/x')).toBe(true);
  });

  it('rejects other hosts, plain http and garbage', () => {
    expect(isAllowedMediaUrl('https://evil.example.com/googlevideo.com')).toBe(false);
    expect(isAllowedMediaUrl('https://googlevideo.com.evil.example/')).toBe(false);
    expect(isAllowedMediaUrl('http://rr1.googlevideo.com/x')).toBe(false);
    expect(isAllowedMediaUrl('http://127.0.0.1:22/')).toBe(false);
    expect(isAllowedMediaUrl('not a url')).toBe(false);
  });
});

describe('rewritePlaylist', () => {
  const base = 'https://manifest.googlevideo.com/api/manifest/hls_playlist/id/1/index.m3u8';

  it('routes segment lines through the proxy and keeps tags', () => {
    const input = [
      '#EXTM3U',
      '#EXTINF:5.005,',
      'https://rr1.googlevideo.com/videoplayback/seg1',
      '#EXTINF:5.005,',
      'seg2.ts',
      '',
    ].join('\n');
    const lines = rewritePlaylist(input, base).split('\n');
    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[2]).toBe(`/api/hls?u=${encodeURIComponent('https://rr1.googlevideo.com/videoplayback/seg1')}`);
    expect(lines[4]).toBe(
      `/api/hls?u=${encodeURIComponent('https://manifest.googlevideo.com/api/manifest/hls_playlist/id/1/seg2.ts')}`,
    );
  });

  it('rewrites URI attributes inside tags', () => {
    const output = rewritePlaylist('#EXT-X-MAP:URI="init.mp4"', base);
    expect(output).toBe(
      `#EXT-X-MAP:URI="/api/hls?u=${encodeURIComponent('https://manifest.googlevideo.com/api/manifest/hls_playlist/id/1/init.mp4')}"`,
    );
  });
});

describe('isPlaylistContentType', () => {
  it('detects HLS playlists', () => {
    expect(isPlaylistContentType('application/vnd.apple.mpegurl')).toBe(true);
    expect(isPlaylistContentType('application/x-mpegURL; charset=utf-8')).toBe(true);
    expect(isPlaylistContentType('video/mp2t')).toBe(false);
    expect(isPlaylistContentType(null)).toBe(false);
  });
});

describe('parseYouTubeVideoId', () => {
  it('reads ids from watch, short, live and embed links', () => {
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=03pYP2Nmreo')).toBe('03pYP2Nmreo');
    expect(parseYouTubeVideoId('https://youtu.be/03pYP2Nmreo?t=4')).toBe('03pYP2Nmreo');
    expect(parseYouTubeVideoId('https://www.youtube.com/live/03pYP2Nmreo')).toBe('03pYP2Nmreo');
    expect(parseYouTubeVideoId('https://www.youtube.com/embed/03pYP2Nmreo')).toBe('03pYP2Nmreo');
  });

  it('rejects other hosts and malformed ids', () => {
    expect(parseYouTubeVideoId('https://vimeo.com/watch?v=03pYP2Nmreo')).toBeNull();
    expect(parseYouTubeVideoId('https://www.youtube.com/watch?v=--rm -rf')).toBeNull();
    expect(parseYouTubeVideoId('hello')).toBeNull();
  });
});
