import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import App from '../src/App';
import { STATION_MODE_STORAGE_KEY } from '../src/hooks/useStationMode';
import * as api from '../src/services/api';

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

describe('App Root Component & Station Router', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
    vi.spyOn(api, 'getCurrentSession').mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render the FarmaCore header and counter terminal title when mode is COUNTER (default)', () => {
    render(<App />);
    expect(screen.getByText(/FarmaCore/i)).toBeDefined();
    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
    expect(screen.getByText(/Posto:\s*Balcão/i)).toBeDefined();
  });

  it('should render PosPage when station mode is POS in localStorage', async () => {
    mockStorage.setItem(STATION_MODE_STORAGE_KEY, 'POS');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Frente de Caixa/i)).toBeDefined();
      expect(screen.getByText(/Posto:\s*Caixa PDV/i)).toBeDefined();
    });
  });

  it('should switch mode on station mode toggle button click', async () => {
    render(<App />);

    // Starts in COUNTER
    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
    const toggleBtn = screen.getByRole('button', { name: /Posto:\s*Balcão/i });

    // Click to switch to POS
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Frente de Caixa/i)).toBeDefined();
      expect(screen.getByText(/Posto:\s*Caixa PDV/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('POS');
    });

    // Click again to switch back to COUNTER
    const toggleBackBtn = screen.getByRole('button', { name: /Posto:\s*Caixa PDV/i });
    await act(async () => {
      fireEvent.click(toggleBackBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
      expect(screen.getByText(/Posto:\s*Balcão/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('COUNTER');
    });
  });

  it('should switch mode when Ctrl+Shift+S is pressed', async () => {
    render(<App />);

    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();

    // Press Ctrl+Shift+S
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'S',
          code: 'KeyS',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Frente de Caixa/i)).toBeDefined();
      expect(screen.getByText(/Posto:\s*Caixa PDV/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('POS');
    });
  });
});
