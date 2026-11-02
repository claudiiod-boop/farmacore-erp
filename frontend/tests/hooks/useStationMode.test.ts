import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStationMode, STATION_MODE_STORAGE_KEY } from '../../src/hooks/useStationMode';

class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('useStationMode Hook', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('should default to COUNTER when localStorage is empty', () => {
    const { result } = renderHook(() => useStationMode());

    expect(result.current.mode).toBe('COUNTER');
    expect(result.current.isCounter).toBe(true);
    expect(result.current.isPos).toBe(false);
  });

  it('should read stored station mode from localStorage if present', () => {
    mockStorage.setItem(STATION_MODE_STORAGE_KEY, 'POS');

    const { result } = renderHook(() => useStationMode());

    expect(result.current.mode).toBe('POS');
    expect(result.current.isCounter).toBe(false);
    expect(result.current.isPos).toBe(true);
  });

  it('should accept a custom default mode when no stored value exists', () => {
    const { result } = renderHook(() => useStationMode('POS'));

    expect(result.current.mode).toBe('POS');
    expect(result.current.isPos).toBe(true);
    expect(result.current.isCounter).toBe(false);
  });

  it('should update mode and persist to localStorage when setMode is called', () => {
    const { result } = renderHook(() => useStationMode());

    expect(result.current.mode).toBe('COUNTER');

    act(() => {
      result.current.setMode('POS');
    });

    expect(result.current.mode).toBe('POS');
    expect(result.current.isPos).toBe(true);
    expect(result.current.isCounter).toBe(false);
    expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('POS');

    act(() => {
      result.current.setMode('COUNTER');
    });

    expect(result.current.mode).toBe('COUNTER');
    expect(result.current.isCounter).toBe(true);
    expect(result.current.isPos).toBe(false);
    expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('COUNTER');
  });

  it('should fallback to default if stored value is invalid', () => {
    mockStorage.setItem(STATION_MODE_STORAGE_KEY, 'INVALID_VALUE');

    const { result } = renderHook(() => useStationMode('COUNTER'));

    expect(result.current.mode).toBe('COUNTER');
    expect(result.current.isCounter).toBe(true);
  });
});
