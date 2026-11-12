import { readFileSync } from 'node:fs';
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
