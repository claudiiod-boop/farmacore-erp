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

describe('App Global Navigation & Station Shortcuts', () => {
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

  it('should render the 4 navigation buttons in the topbar ([F1] Balcão, [F2] Caixa, [F3] Compras, [F4] SNGPC)', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /\[F1\]\s*Balcão/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /\[F2\]\s*Caixa/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /\[F3\]\s*Compras/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /\[F4\]\s*SNGPC/i })).toBeDefined();
  });

  it('should navigate between stations when clicking topbar buttons', async () => {
    render(<App />);

    // Starts in COUNTER
    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();

    // Click [F3] Compras
    const purchasesBtn = screen.getByRole('button', { name: /\[F3\]\s*Compras/i });
    await act(async () => {
      fireEvent.click(purchasesBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Entrada de Notas Fiscais/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('PURCHASES');
    });

    // Click [F4] SNGPC
    const sngpcBtn = screen.getByRole('button', { name: /\[F4\]\s*SNGPC/i });
    await act(async () => {
      fireEvent.click(sngpcBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Controle Regulatório SNGPC/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('SNGPC');
    });

    // Click [F2] Caixa
    const posBtn = screen.getByRole('button', { name: /\[F2\]\s*Caixa/i });
    await act(async () => {
      fireEvent.click(posBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Frente de Caixa/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('POS');
    });

    // Click [F1] Balcão
    const counterBtn = screen.getByRole('button', { name: /\[F1\]\s*Balcão/i });
    await act(async () => {
      fireEvent.click(counterBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('COUNTER');
    });
  });

  it('should switch stations using keyboard shortcuts F1, F2, F3, F4', async () => {
    render(<App />);

    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();

    // Press F3
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F3',
          code: 'F3',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Entrada de Notas Fiscais/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('PURCHASES');
    });

    // Press F4
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F4',
          code: 'F4',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Controle Regulatório SNGPC/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('SNGPC');
    });

    // Press F2
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F2',
          code: 'F2',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Frente de Caixa/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('POS');
    });

    // Press F1
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F1',
          code: 'F1',
          bubbles: true,
          cancelable: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
      expect(mockStorage.getItem(STATION_MODE_STORAGE_KEY)).toBe('COUNTER');
    });
  });
});
