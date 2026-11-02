import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PosItemGrid, { PosGridItem } from '../../src/components/pos/PosItemGrid';

const mockItems: PosGridItem[] = [
  {
    id: 'item-1',
    source: 'PRE_SALE',
    productId: 101,
    productName: 'Amoxicilina 500mg',
    stripe: 'VERMELHA',
    controlType: 'ANTIMICROBIANO',
    batchId: 501,
    batchNumber: 'LOTE-AMX-88',
    expirationDate: '2027-05-15T00:00:00.000Z',
    quantity: 2,
    unitPrice: 30.0,
    totalPrice: 60.0,
  },
  {
    id: 'item-2',
    source: 'DIRECT',
    productId: 202,
    productName: 'Protetor Solar FPS 50 200ml',
    stripe: 'SEM_TARJA',
    controlType: 'ISENTO',
    batchId: 602,
    batchNumber: 'LOTE-SOL-99',
    expirationDate: '2028-11-30T00:00:00.000Z',
    quantity: 1,
    unitPrice: 45.0,
    totalPrice: 45.0,
  },
];

describe('PosItemGrid Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render empty state when items array is empty', () => {
    render(<PosItemGrid items={[]} />);

    expect(screen.getByText(/Nenhum item registrado no caixa/i)).toBeDefined();
  });

  it('should render table with #PV badge for pre-sale and Conveniência badge for direct items', () => {
    render(<PosItemGrid items={mockItems} />);

    // Product names
    expect(screen.getByText('Amoxicilina 500mg')).toBeDefined();
    expect(screen.getByText('Protetor Solar FPS 50 200ml')).toBeDefined();

    // Source badges
    expect(screen.getByText(/#PV/i)).toBeDefined();
    expect(screen.getByText(/Conveniência/i)).toBeDefined();

    // Batch and formatted expiration dates
    expect(screen.getByText(/LOTE-AMX-88/i)).toBeDefined();
    expect(screen.getByText(/15\/05\/2027/i)).toBeDefined();
    expect(screen.getByText(/LOTE-SOL-99/i)).toBeDefined();
    expect(screen.getByText(/30\/11\/2028/i)).toBeDefined();

    // Prices and quantities
    expect(screen.getByText('R$ 30,00')).toBeDefined();
    expect(screen.getByText('R$ 60,00')).toBeDefined();
    expect(screen.getAllByText('R$ 45,00').length).toBeGreaterThanOrEqual(1);
  });

  it('should show delete button for DIRECT items and call onRemoveDirectItem when clicked', () => {
    const onRemoveDirectItem = vi.fn();

    render(
      <PosItemGrid
        items={mockItems}
        onRemoveDirectItem={onRemoveDirectItem}
      />
    );

    const directDeleteBtn = screen.getByRole('button', {
      name: /remover.*protetor|remover item de conveniência/i,
    });
    expect(directDeleteBtn).toBeDefined();

    fireEvent.click(directDeleteBtn);
    expect(onRemoveDirectItem).toHaveBeenCalledWith(mockItems[1]);
  });

  it('should disable or not render delete button for PRE_SALE items', () => {
    const onRemoveDirectItem = vi.fn();

    render(
      <PosItemGrid
        items={mockItems}
        onRemoveDirectItem={onRemoveDirectItem}
      />
    );

    // Look for any remove button associated with pre-sale item
    const preSaleDeleteBtn = screen.queryByRole('button', {
      name: /remover.*amoxicilina/i,
    });

    if (preSaleDeleteBtn) {
      expect((preSaleDeleteBtn as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(preSaleDeleteBtn);
      expect(onRemoveDirectItem).not.toHaveBeenCalled();
    } else {
      // If not rendered at all, ensure only 1 delete button exists (for the direct item)
      const allDeleteButtons = screen.getAllByRole('button', { name: /remover/i });
      expect(allDeleteButtons.length).toBe(1);
    }
  });

  it('should trigger onRemoveDirectItem when [F7] key is pressed on selected direct item', () => {
    const onRemoveDirectItem = vi.fn();

    render(
      <PosItemGrid
        items={mockItems}
        selectedItemIndex={1} // mockItems[1] is DIRECT
        onRemoveDirectItem={onRemoveDirectItem}
      />
    );

    fireEvent.keyDown(window, { key: 'F7' });
    expect(onRemoveDirectItem).toHaveBeenCalledWith(mockItems[1]);
  });

  it('should NOT trigger onRemoveDirectItem when [F7] is pressed on selected PRE_SALE item', () => {
    const onRemoveDirectItem = vi.fn();

    render(
      <PosItemGrid
        items={mockItems}
        selectedItemIndex={0} // mockItems[0] is PRE_SALE
        onRemoveDirectItem={onRemoveDirectItem}
      />
    );

    fireEvent.keyDown(window, { key: 'F7' });
    expect(onRemoveDirectItem).not.toHaveBeenCalled();
  });

  it('should call onSelectItemIndex when row is clicked', () => {
    const onSelectItemIndex = vi.fn();

    render(
      <PosItemGrid
        items={mockItems}
        onSelectItemIndex={onSelectItemIndex}
      />
    );

    const firstRowText = screen.getByText('Amoxicilina 500mg');
    fireEvent.click(firstRowText.closest('tr')!);

    expect(onSelectItemIndex).toHaveBeenCalledWith(0);
  });

  it('should calculate and display total items quantity and total price sum', () => {
    render(<PosItemGrid items={mockItems} />);

    // Total quantity: 2 + 1 = 3
    // Total price: 60 + 45 = 105.00
    expect(screen.getByText(/3 item\(s\)|3 itens|3 un/i)).toBeDefined();
    expect(screen.getByText(/R\$\s*105,00/i)).toBeDefined();
  });
});
