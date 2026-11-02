import { useEffect, useRef } from 'react';

export type ShortcutHandler = (e: KeyboardEvent) => void;

export function useKeyboardShortcuts(shortcuts: Record<string, ShortcutHandler>): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const pressedKey = e.key;

      for (const [key, handler] of Object.entries(shortcutsRef.current)) {
        const normalizedTarget = key.trim().toLowerCase();
        const normalizedPressed = pressedKey.trim().toLowerCase();

        const isMatch =
          normalizedTarget === normalizedPressed ||
          (normalizedTarget === 'esc' && normalizedPressed === 'escape') ||
          (normalizedTarget === 'escape' && normalizedPressed === 'esc');

        if (isMatch) {
          e.preventDefault();
          handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

export default useKeyboardShortcuts;
