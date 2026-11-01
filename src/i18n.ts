export type Lang = 'pl' | 'en';

const STORAGE_KEY = 'person-detector:lang';

const messages = {
  pl: {
    appName: 'Wykrywacz ludzi',
    switchLanguage: 'Zmień język',
    switchTheme: 'Przełącz motyw',
    sourceCode: 'Kod źródłowy na GitHubie',
    urlLabel: 'Adres filmu lub transmisji z YouTube',
    play: 'Odtwórz',
    localFile: 'Plik z dysku',
    threshold: 'Próg pewności',
    showBoxes: 'Pokaż prostokąty',
    tiling: 'Podział kadru',
    tilingHint: 'Więcej kafelków wykrywa mniejsze postacie, ale działa wolniej',
    people: 'Osoby w kadrze',
    detectionFps: 'Wykrywanie (kl./s)',
    person: 'osoba',
    statusLoadingModel: 'Ładuję model…',
    statusResolving: 'Szukam strumienia…',
    statusReady: 'Gotowe. Podaj adres i kliknij „Odtwórz”',
    statusLive: 'Na żywo',
    statusPlaying: 'Odtwarzam',
    statusError: 'Błąd',
    shortcuts: 'Skróty klawiaturowe',
    close: 'Zamknij',
    keyHelp: 'Ta ściąga',
    keyPlay: 'Pauza / wznowienie',
    keyBoxes: 'Pokaż / ukryj prostokąty',
    keyUrl: 'Przejdź do pola adresu',
    keyClose: 'Zamknij ściągę',
  },
  en: {
    appName: 'Person Detector',
    switchLanguage: 'Switch language',
    switchTheme: 'Toggle theme',
    sourceCode: 'Source code on GitHub',
    urlLabel: 'YouTube video or live stream URL',
    play: 'Play',
    localFile: 'Local file',
    threshold: 'Confidence threshold',
    showBoxes: 'Show boxes',
    tiling: 'Frame tiling',
    tilingHint: 'More tiles find smaller people but run slower',
    people: 'People in frame',
    detectionFps: 'Detection (fps)',
    person: 'person',
    statusLoadingModel: 'Loading model…',
    statusResolving: 'Resolving stream…',
    statusReady: 'Ready. Paste a URL and press “Play”',
    statusLive: 'Live',
    statusPlaying: 'Playing',
    statusError: 'Error',
    shortcuts: 'Keyboard shortcuts',
    close: 'Close',
    keyHelp: 'This cheat sheet',
    keyPlay: 'Pause / resume',
    keyBoxes: 'Show / hide boxes',
    keyUrl: 'Focus the URL field',
    keyClose: 'Close the cheat sheet',
  },
} satisfies Record<Lang, Record<string, string>>;

export type MessageKey = keyof (typeof messages)['pl'];

let current: Lang = 'pl';

function isMessageKey(key: string | undefined): key is MessageKey {
  return key !== undefined && key in messages.pl;
}

function isLang(value: string | null | undefined): value is Lang {
  return value === 'pl' || value === 'en';
}

function readStoredLang(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function initialLang(): Lang {
  const stored = readStoredLang();
  if (isLang(stored)) {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

export function t(key: MessageKey): string {
  return messages[current][key];
}

export function getLang(): Lang {
  return current;
}

/** Applies the language to every element with data-i18n / data-i18n-label. */
export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  document.title = t('appName');
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (isMessageKey(key)) {
      element.textContent = t(key);
    }
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) {
    const key = element.dataset.i18nLabel;
    if (isMessageKey(key)) {
      element.setAttribute('aria-label', t(key));
      element.title = t(key);
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage may be unavailable (private mode); the choice just won't persist.
  }
}
