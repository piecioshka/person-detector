import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));

// In dev, Vite injects CSS imported from JS only after the module runs, which flashes unstyled content.
describe('index.html (no flash of unstyled content)', () => {
  it('links the stylesheet in <head>', () => {
    expect(head).toContain('<link rel="stylesheet" href="/src/styles.css" />');
  });

  it('does not import the stylesheet from main.ts', () => {
    const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8');
    expect(main).not.toMatch(/import\s+['"]\.\/styles\.css['"]/);
  });
});

// Google Search ignores SVG favicons and link previews need absolute Open Graph URLs.
describe('index.html (icons and link previews)', () => {
  it.each(['/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png', '/apple-touch-icon.png'])(
    'links %s and ships it in public/',
    (path) => {
      expect(head).toContain(`href="${path}"`);
      expect(existsSync(new URL(`../public${path}`, import.meta.url))).toBe(true);
    },
  );

  it.each(['og:title', 'og:description', 'og:url', 'og:image'])('has an absolute or non-empty %s', (property) => {
    const match = head.match(new RegExp(`property="${property}"\\s+content="([^"]+)"`));
    expect(match?.[1]).toBeTruthy();
    if (property === 'og:url' || property === 'og:image') {
      expect(match?.[1]).toMatch(/^https:\/\//);
    }
  });

  it('has a Twitter card and a canonical URL', () => {
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(head).toMatch(/<link rel="canonical" href="https:\/\/[^"]+" \/>/);
  });
});
