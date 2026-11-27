import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { AppSplashScreen } from '../../src/components/animations/AppSplashScreen';

describe('AppSplashScreen Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should render splash screen with initial step message and 0% progress', () => {
    render(<AppSplashScreen minDurationMs={1000} />);

    expect(screen.getByTestId('app-splash-screen')).toBeDefined();
    expect(screen.getByTestId('splash-percentage').textContent).toBe('0');
    expect(screen.getAllByText(/MAGNOS/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('splash-status-message').textContent).toContain('Iniciando módulos centrais');
  });

  it('should advance progress and trigger onComplete when 100% is reached', async () => {
    const onComplete = vi.fn();
    render(<AppSplashScreen minDurationMs={1000} onComplete={onComplete} />);

    // Fast-forward 50 steps
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('splash-percentage').textContent).toBe('50');

    // Run all remaining timers (progress to 100% + fade out + completion callback)
    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.getByTestId('splash-percentage').textContent).toBe('100');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
