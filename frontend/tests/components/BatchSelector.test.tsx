import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BatchSelector from '../../src/components/BatchSelector';
import { Batch } from '../../src/services/api';

const mockBatches: Batch[] = [
  {
    id: 1,
    productId: 10,
    batchNumber: 'LOTE-A1',
    manufacturingDate: '2025-01-01T00:00:00.000Z',
    expirationDate: '2026-12-31T00:00:00.000Z',
    quantity: 50,
    reservedQuantity: 0,
    availableQuantity: 50,
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    productId: 10,
    batchNumber: 'LOTE-B2',
    expirationDate: '2027-06-30T00:00:00.000Z',
    manufacturingDate: '2025-06-01T00:00:00.000Z',
    quantity: 100,
    reservedQuantity: 10,
    availableQuantity: 90,
    createdAt: '2025-06-01T00:00:00.000Z',
  },
  {
    id: 3,
    productId: 10,
    batchNumber: 'LOTE-ZERADO',
    expirationDate: '2026-06-01T00:00:00.000Z',
    manufacturingDate: '2024-06-01T00:00:00.000Z',
    quantity: 10,
    reservedQuantity: 10,
    availableQuantity: 0,
    createdAt: '2024-06-01T00:00:00.000Z',
  },
];

describe('BatchSelector Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render batch list with batch numbers, formatted expiration dates and stock quantities', () => {
    const onSelect = vi.fn();
    render(<BatchSelector batches={mockBatches} onSelectBatch={onSelect} />);

    expect(screen.getByText('LOTE-A1')).toBeDefined();
    expect(screen.getByText('LOTE-B2')).toBeDefined();
    expect(screen.getByText('LOTE-ZERADO')).toBeDefined();

    // Formatted dates DD/MM/YYYY
    expect(screen.getByText(/31\/12\/2026/)).toBeDefined();
    expect(screen.getByText(/30\/06\/2027/)).toBeDefined();
    expect(screen.getByText(/01\/06\/2026/)).toBeDefined();

    // Quantities
    expect(screen.getAllByText(/50 un/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/90 un/i).length).toBeGreaterThanOrEqual(1);
  });

  it('should highlight the earliest expiration batch with available stock as "FEFO (Recomendado)"', () => {
    // Note: LOTE-ZERADO has expiration 2026-06-01 (earliest) but availableQuantity is 0.
    // Therefore, LOTE-A1 (expiration 2026-12-31 with availableQuantity=50) must be highlighted as FEFO.
    const onSelect = vi.fn();
    render(<BatchSelector batches={mockBatches} onSelectBatch={onSelect} />);

    const fefoBadge = screen.getByText(/FEFO \(Recomendado\)/i);
    expect(fefoBadge).toBeDefined();

    // Ensure the badge is in the container of LOTE-A1
    const loteAContainer = screen.getByText('LOTE-A1').closest('tr, li, div[data-testid="batch-item-1"]');
    expect(loteAContainer).toBeDefined();
    expect(loteAContainer?.textContent).toContain('FEFO (Recomendado)');
  });

  it('should disable selection of batches with availableQuantity <= 0', () => {
    const onSelect = vi.fn();
    render(<BatchSelector batches={mockBatches} onSelectBatch={onSelect} />);

    // Find the select button or row for LOTE-ZERADO
    const zeroBatchBtn = screen.getByTestId('select-batch-3');
    expect(zeroBatchBtn).toBeDefined();
    expect(zeroBatchBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(zeroBatchBtn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should trigger onSelectBatch when an available batch is clicked', () => {
    const onSelect = vi.fn();
    render(<BatchSelector batches={mockBatches} onSelectBatch={onSelect} />);

    const selectBtn = screen.getByTestId('select-batch-1');
    fireEvent.click(selectBtn);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockBatches[0]);
  });

  it('should show visual indication for currently selectedBatchId', () => {
    render(<BatchSelector batches={mockBatches} selectedBatchId={2} onSelectBatch={vi.fn()} />);

    const selectedItem = screen.getByTestId('batch-item-2');
    expect(selectedItem.getAttribute('data-selected')).toBe('true');
  });

  it('should render loading indicator when isLoading is true', () => {
    render(<BatchSelector batches={[]} isLoading={true} onSelectBatch={vi.fn()} />);

    expect(screen.getByText(/Carregando lotes/i)).toBeDefined();
  });

  it('should render error message when error is provided', () => {
    render(
      <BatchSelector
        batches={[]}
        error="Falha na comunicação com o servidor de estoque"
        onSelectBatch={vi.fn()}
      />
    );

    expect(screen.getByText(/Falha na comunicação com o servidor de estoque/i)).toBeDefined();
  });

  it('should render empty state message when batches array is empty and not loading', () => {
    render(<BatchSelector batches={[]} onSelectBatch={vi.fn()} />);

    expect(screen.getByText(/Nenhum lote disponível/i)).toBeDefined();
  });
});
