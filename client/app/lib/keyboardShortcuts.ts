import type { KeyboardShortcutAction, KeyboardShortcuts } from './types';

export const DEFAULT_KEYBOARD_SHORTCUTS: KeyboardShortcuts = {
  mark_cycle: 'Space',
  toggle_zone: 'KeyQ',
  confirm_cycle: 'Enter',
  cancel_modal: 'Escape',
};

export const KEYBOARD_SHORTCUT_LABELS: Record<KeyboardShortcutAction, string> = {
  mark_cycle: 'Marcar ciclo',
  toggle_zone: 'Trocar zona',
  confirm_cycle: 'Confirmar ciclo',
  cancel_modal: 'Cancelar modal',
};

export function normalizeKeyboardShortcuts(value?: Partial<KeyboardShortcuts> | null): KeyboardShortcuts {
  return { ...DEFAULT_KEYBOARD_SHORTCUTS, ...(value ?? {}) };
}

export function formatShortcutCode(code: string): string {
  if (code === 'Space') return 'Espaço';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Escape') return 'Esc';
  return code.replace('Arrow', 'Seta ');
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.tagName === 'TEXTAREA') return true;
  if (target.tagName !== 'INPUT') return false;
  const type = (target as HTMLInputElement).type;
  return !['number', 'range', 'checkbox', 'radio', 'button', 'submit'].includes(type);
}
