import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_KEYBOARD_SHORTCUTS, formatShortcutCode, normalizeKeyboardShortcuts } from './keyboardShortcuts.ts';

test('uses Space, Q, Enter and Escape defaults', () => {
  assert.deepEqual(normalizeKeyboardShortcuts(), DEFAULT_KEYBOARD_SHORTCUTS);
});

test('overrides only the configured account shortcut', () => {
  const shortcuts = normalizeKeyboardShortcuts({ toggle_zone: 'KeyZ' });
  assert.equal(shortcuts.toggle_zone, 'KeyZ');
  assert.equal(shortcuts.mark_cycle, 'Space');
});

test('formats browser codes for the scout UI', () => {
  assert.equal(formatShortcutCode('KeyQ'), 'Q');
  assert.equal(formatShortcutCode('Space'), 'Espaço');
});
