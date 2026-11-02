import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CartTable, { CartItem } from '../../src/components/CartTable';
import { Product, Batch } from '../../src/services/api';

const mockProduct1: Product = {
  id: 101,
  ean: '7890000000001',
  name: 'Amoxicilina 500mg',
  activeIngredient: 'Amoxicilina',
  msRegistration: '1.0001.0001.001-1',
  stripe: 'VERMELHA',
  controlType: 'ANTIMICROBIANO',
  pmc: 45.0,
  pf: 30.0,
  price: 35.0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockBatch1: Batch = {
  id: 1,
  productId: 101,
  batchNumber: 'LOTE-AMX-01',
  manufacturingDate: '2025-01-01T00:00:00.000Z',
  expirationDate: '2027-01-01T00:00:00.000Z',
  quantity: 20,
  reservedQuantity: 0,
  availableQuantity: 5, // Limite máximo de 5 unidades
  createdAt: '2025-01-01T00:00:00.000Z',
};

const mockProduct2: Product = {
  id: 102,
  ean: '7890000000002',
  name: 'Dipirona 500mg',
  activeIngredient: 'Dipirona Sódica',
  msRegistration: '1.0002.0002.002-2',
  stripe: 'SEM_TARJA',
  controlType: 'ISENTO',
  pmc: 15.0,
  pf: 10.0,
  price: 12.5,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockBatch2: Batch = {
  id: 2,
  productId: 102,
  batchNumber: 'LOTE-DIP-02',
  manufacturingDate: '2025-02-01T00:00:00.000Z',
  expirationDate: '2027-06-30T00:00:00.000Z',
  quantity: 50,
  reservedQuantity: 0,
  availableQuantity: 50,
  createdAt: '2025-02-01T00:00:00.000Z',
};

const mockItems: CartItem[] = [
  {
    product: mockProduct1,
    batch: mockBatch1,
    quantity: 2,
    unitPrice: 35.0,
    totalPrice: 70.0,
  },
  {
    product: mockProduct2,
    batch: mockBatch2,
    quantity: 3,
    unitPrice: 12.5,
    totalPrice: 37.5,
  },
];

describe('CartTable Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render items with product name, stripe badge, batch info, unit price and subtotal', () => {
    render(
      <CartTable
        items={mockItems}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
      />
    );

    // Products
    expect(screen.getByText('Amoxicilina 500mg')).toBeDefined();
    expect(screen.getByText('Dipirona 500mg')).toBeDefined();

    // Stripes
    expect(screen.getByText(/Tarja Vermelha/i)).toBeDefined();
    expect(screen.getByText(/Sem Tarja|Isento/i)).toBeDefined();

    // Batches and formatted expiration dates
    expect(screen.getByText(/LOTE-AMX-01/i)).toBeDefined();
    expect(screen.getByText(/01\/01\/2027/i)).toBeDefined();
    expect(screen.getByText(/LOTE-DIP-02/i)).toBeDefined();
    expect(screen.getByText(/30\/06\/2027/i)).toBeDefined();

    // Prices (Unit and Subtotal in BRL)
    expect(screen.getByText(/R\$\s*35,00/i)).toBeDefined();
    expect(screen.getByText(/R\$\s*70,00/i)).toBeDefined();
    expect(screen.getByText(/R\$\s*12,50/i)).toBeDefined();
    expect(screen.getByText(/R\$\s*37,50/i)).toBeDefined();
  });

  it('should calculate and display general totalizers (total items and total amount)', () => {
    render(
      <CartTable
        items={mockItems}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
      />
    );

    // Total Items: 2 + 3 = 5 items
    expect(screen.getByTestId('cart-total-items').textContent).toContain('5');

    // Total Amount: 70.00 + 37.50 = 107.50
    expect(screen.getByTestId('cart-total-amount').textContent).toContain('107,50');
  });

  it('should increment quantity when + button is clicked without exceeding batch.availableQuantity', () => {
    const onUpdate = vi.fn();
    render(
      <CartTable
        items={mockItems}
        onUpdateQuantity={onUpdate}
        onRemoveItem={vi.fn()}
      />
    );

    // Item 1 has quantity 2 and available 5. Clicking + should request quantity 3.
    const incBtn = screen.getByTestId('qty-inc-101-1');
    fireEvent.click(incBtn);

    expect(onUpdate).toHaveBeenCalledWith(101, 1, 3);
  });

  it('should disable + button when item quantity reaches availableQuantity', () => {
    const atMaxItem: CartItem[] = [
      {
        product: mockProduct1,
        batch: mockBatch1, // availableQuantity = 5
        quantity: 5,
        unitPrice: 35.0,
        totalPrice: 175.0,
      },
    ];

    const onUpdate = vi.fn();
    render(
      <CartTable
        items={atMaxItem}
        onUpdateQuantity={onUpdate}
        onRemoveItem={vi.fn()}
      />
    );

    const incBtn = screen.getByTestId('qty-inc-101-1');
    expect(incBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(incBtn);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('should decrement quantity when - button is clicked, but not below 1', () => {
    const onUpdate = vi.fn();
    render(
      <CartTable
        items={mockItems}
        onUpdateQuantity={onUpdate}
        onRemoveItem={vi.fn()}
      />
    );

    // Item 1 has quantity 2. Clicking - should request quantity 1.
    const decBtn = screen.getByTestId('qty-dec-101-1');
    fireEvent.click(decBtn);

    expect(onUpdate).toHaveBeenCalledWith(101, 1, 1);
  });

  it('should disable - button when quantity is 1', () => {
    const singleQtyItem: CartItem[] = [
      {
        product: mockProduct1,
        batch: mockBatch1,
        quantity: 1,
        unitPrice: 35.0,
        totalPrice: 35.0,
      },
    ];

    const onUpdate = vi.fn();
    render(
      <CartTable
        items={singleQtyItem}
        onUpdateQuantity={onUpdate}
        onRemoveItem={vi.fn()}
      />
    );

    const decBtn = screen.getByTestId('qty-dec-101-1');
    expect(decBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(decBtn);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('should allow direct quantity input bounded by 1 and availableQuantity', () => {
    const onUpdate = vi.fn();
    render(
      <CartTable
        items={mockItems}
        onUpdateQuantity={onUpdate}
        onRemoveItem={vi.fn()}
      />
    );

    const input = screen.getByTestId('qty-input-101-1');
    
    // Changing to valid value 4
    fireEvent.change(input, { target: { value: '4' } });
    expect(onUpdate).toHaveBeenCalledWith(101, 1, 4);

    // Attempting to exceed availableQuantity (5) by entering 10 clamps to 5
    fireEvent.change(input, { target: { value: '10' } });
    expect(onUpdate).toHaveBeenCalledWith(101, 1, 5);

    // Attempting to enter 0 or negative clamps to 1
    fireEvent.change(input, { target: { value: '0' } });
    expect(onUpdate).toHaveBeenCalledWith(101, 1, 1);
  });

  it('should trigger onRemoveItem when delete button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <CartTable
        items={mockItems}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={onRemove}
      />
    );

    const removeBtn = screen.getByTestId('remove-item-101-1');
    fireEvent.click(removeBtn);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(101, 1);
  });

  it('should render an elegant empty state when items is empty', () => {
    render(
      <CartTable
        items={[]}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /carrinho vazio/i })).toBeDefined();
    expect(screen.getByText(/nenhum item no carrinho/i)).toBeDefined();
    expect(screen.queryByTestId('cart-total-items')).toBeNull();
  });
});
