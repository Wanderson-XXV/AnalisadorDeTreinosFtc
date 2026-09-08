import { useMemo } from 'react';
import { normalizeKeyboardShortcuts } from '../lib/keyboardShortcuts';
import { useAuth } from './useAuth';

export function useKeyboardShortcuts() {
  const { scout } = useAuth();
  return useMemo(() => normalizeKeyboardShortcuts(scout?.keyboard_shortcuts), [scout?.keyboard_shortcuts]);
}
