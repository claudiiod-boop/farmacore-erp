import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ProductSearch from '../../src/components/ProductSearch';
import * as api from '../../src/services/api';
import { Product } from '../../src/services/api';

const mockProducts: Product[] = [
  {
    id: 1,
    ean: '7891234567890',
    name: 'Dipirona Monoidratada 500mg',
    activeIngredient: 'Dipirona Sódica',
    msRegistration: '1.0001.0001.001-1',
    stripe: 'SEM_TARJA',
    controlType: 'ISENTO',
    price: 12.5,
    pmc: 15.0,
    pf: 10.0,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 2,
    ean: '7891234567891',
    name: 'Amoxicilina 500mg 21 Cápsulas',
    activeIngredient: 'Amoxicilina Tri-hidratada',
    msRegistration: '1.0002.0002.002-2',
    stripe: 'VERMELHA',
    controlType: 'ANTIMICROBIANO',
    price: 34.9,
    pmc: 42.0,
    pf: 28.0,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 3,
    ean: '7891234567892',
    name: 'Clonazepam 2mg 30 Comprimidos',
    activeIngredient: 'Clonazepam',
    msRegistration: '1.0003.0003.003-3',
    stripe: 'PRETA',
    controlType: 'B1',
    price: 22.0,
    pmc: 28.5,
    pf: 18.0,
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  },
];

describe('ProductSearch Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render search input with placeholder and F2 shortcut badge', () => {
    const onSelect = vi.fn();
    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    expect(input).toBeDefined();
    expect(screen.getByText('F2')).toBeDefined();
  });

  it('should focus search input when F2 key is pressed globally', () => {
    const onSelect = vi.fn();
    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: 'F2' });
    expect(document.activeElement).toBe(input);
  });

  it('should search with debounce and display products with stripe badges and CMED PMC ceiling', async () => {
    const searchSpy = vi.spyOn(api, 'searchProducts').mockResolvedValue(mockProducts);
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(input, { target: { value: 'Amoxicilina' } });

    // Wait for debounce and API resolution
    await waitFor(() => {
      expect(searchSpy).toHaveBeenCalledWith('Amoxicilina');
    });

    await waitFor(() => {
      expect(screen.getByText(/Amoxicilina 500mg 21 Cápsulas/i)).toBeDefined();
      expect(screen.getByText(/Dipirona Monoidratada/i)).toBeDefined();
      expect(screen.getByText(/Clonazepam 2mg/i)).toBeDefined();
    });

    // Check Stripe Badges
    expect(screen.getByText(/Isento|Sem Tarja/i)).toBeDefined();
    expect(screen.getByText(/Tarja Vermelha/i)).toBeDefined();
    expect(screen.getByText(/Tarja Preta/i)).toBeDefined();

    // Check Price and CMED PMC
    expect(screen.getByText(/R\$\s*34,90/)).toBeDefined();
    expect(screen.getByText(/PMC:\s*R\$\s*42,00/i)).toBeDefined();
  });

  it('should navigate through search results with ArrowDown/ArrowUp and select with Enter', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue(mockProducts);
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(input, { target: { value: 'medicamento' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada/i)).toBeDefined();
    });

    // Arrow down to first item (Dipirona)
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Arrow down to second item (Amoxicilina)
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Press Enter to select
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockProducts[1]);
  });

  it('should select product on mouse click', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue(mockProducts);
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(input, { target: { value: 'Dipirona' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada/i)).toBeDefined();
    });

    const item = screen.getByText(/Dipirona Monoidratada/i);
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('should close dropdown when Escape key is pressed', async () => {
    vi.spyOn(api, 'searchProducts').mockResolvedValue(mockProducts);
    const onSelect = vi.fn();

    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(input, { target: { value: 'Dipirona' } });

    await waitFor(() => {
      expect(screen.getByText(/Dipirona Monoidratada/i)).toBeDefined();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/Dipirona Monoidratada/i)).toBeNull();
    });
  });
});
