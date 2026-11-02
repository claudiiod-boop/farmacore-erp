import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../src/hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts Hook', () => {
  it('should trigger callback and call preventDefault when shortcut key is pressed', () => {
    const f2Handler = vi.fn();
    const escHandler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        F2: f2Handler,
        Escape: escHandler,
      })
    );

    const f2Event = new KeyboardEvent('keydown', { key: 'F2', cancelable: true });
    const preventDefaultSpy = vi.spyOn(f2Event, 'preventDefault');
    window.dispatchEvent(f2Event);

    expect(f2Handler).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(escHandler).not.toHaveBeenCalled();
  });

  it('should support Esc as alias for Escape', () => {
    const escHandler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        Esc: escHandler,
      })
    );

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(escapeEvent);

    expect(escHandler).toHaveBeenCalledTimes(1);
  });

  it('should be case-insensitive (e.g. f2 matches F2)', () => {
    const f2Handler = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        f2: f2Handler,
      })
    );

    const event = new KeyboardEvent('keydown', { key: 'F2', cancelable: true });
    window.dispatchEvent(event);

    expect(f2Handler).toHaveBeenCalledTimes(1);
  });

  it('should clean up event listener when unmounted', () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        F2: handler,
      })
    );

    unmount();

    const event = new KeyboardEvent('keydown', { key: 'F2', cancelable: true });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });
});
