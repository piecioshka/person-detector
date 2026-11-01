const STORAGE_KEY = 'person-detector:theme';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** The initial theme is set by the inline script in index.html; this only handles toggling. */
export function initTheme(button: HTMLButtonElement): void {
  button.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable; the theme still switches for this session.
    }
  });
}
