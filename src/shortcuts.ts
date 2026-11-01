interface ShortcutHandlers {
  dialog: HTMLDialogElement;
  onTogglePlayback: () => void;
  onToggleBoxes: () => void;
  onFocusUrl: () => void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'range', 'file', 'button', 'submit'].includes(target.type);
  }
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
}

export function initShortcuts({ dialog, onTogglePlayback, onToggleBoxes, onFocusUrl }: ShortcutHandlers): void {
  let returnFocus: HTMLElement | null = null;

  dialog.addEventListener('close', () => {
    returnFocus?.focus();
    returnFocus = null;
  });

  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || dialog.open || isTyping(event.target)) {
      return;
    }
    const actions: Record<string, () => void> = {
      '?': () => {
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      },
      ' ': onTogglePlayback,
      b: onToggleBoxes,
      '/': onFocusUrl,
    };
    const action = actions[event.key.toLowerCase()];
    if (action) {
      event.preventDefault();
      action();
    }
  });
}
