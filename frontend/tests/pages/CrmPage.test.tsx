import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import CrmPage from '../../src/pages/CrmPage';
import App from '../../src/App';
import PaymentModal from '../../src/components/pos/PaymentModal';
import { api } from '../../src/services/api';
import type {
  LoyaltyProgram,
  LoyaltyWallet,
  LoyaltyTransaction,
  PromotionWithProducts,
  UpcomingRefillItem,
  CartEvaluationResult,
} from '../../src/types/crm';
import type { Customer } from '../../src/types/credit';

const mockLoyaltyProgram: LoyaltyProgram = {
  id: 1,
  name: 'Clube Fidelidade FarmaCore',
  cashbackPercent: 5,
  validityDays: 90,
  minPurchaseAmount: 10,
  minRedeemAmount: 5,
  maxRedeemPercent: 50,
  allowWithPromotions: true,
  isActive: true,
};

const mockCustomer: Customer = {
  id: 10,
  storeId: 1,
  name: 'Maria de Lourdes Silva',
  cpf: '12345678901',
  phone: '(11) 98765-4321',
  email: 'maria@email.com',
  creditLimit: 500,
  currentDebt: 0,
  status: 'ACTIVE',
  allowDependents: false,
};

const mockWallet: LoyaltyWallet = {
  id: 1,
  customerId: 10,
  currentBalance: 35.5,
  totalEarned: 100.0,
  totalRedeemed: 64.5,
  totalExpired: 0.0,
  lastActivityAt: '2026-11-20T10:00:00.000Z',
};

const mockTransactions: LoyaltyTransaction[] = [
  {
    id: 101,
    walletId: 1,
    saleId: 501,
    type: 'EARN',
    amount: 15.0,
    balanceAfter: 50.5,
    createdAt: '2026-11-15T14:30:00.000Z',
    notes: 'Cashback 5% sobre compra #501',
  },
  {
    id: 102,
    walletId: 1,
    saleId: 505,
    type: 'REDEEM',
    amount: 15.0,
    balanceAfter: 35.5,
    createdAt: '2026-11-18T09:20:00.000Z',
    notes: 'Resgate de cashback caixa PDV',
  },
];

const mockPromotions: PromotionWithProducts[] = [
  {
    id: 1,
    name: 'Leve 3 Pague 2 Fraldas Pampers',
    description: 'Compre 3 unidades de fralda e pague apenas 2',
    type: 'TAKE_MORE_PAY_LESS',
    startDate: '2026-11-01',
    endDate: '2026-12-31',
    priority: 10,
    isActive: true,
    appliesTo: 'SPECIFIC_PRODUCTS',
    conditionsJson: JSON.stringify({ takeQuantity: 3, payQuantity: 2 }),
    products: [
      {
        id: 1,
        promotionId: 1,
        productId: 101,
        role: 'BOTH',
      },
    ],
  },
  {
    id: 2,
    name: 'Desconto Progressivo Vitaminas C',
    description: '2 unidades 10%, 3 unidades 15%',
    type: 'PROGRESSIVE_DISCOUNT',
    startDate: '2026-11-01',
    endDate: '2026-12-31',
    priority: 5,
    isActive: true,
    appliesTo: 'CATEGORY',
    targetCategory: 'Vitaminas',
    conditionsJson: JSON.stringify({
      tiers: [
        { minQuantity: 2, discountPercent: 10 },
        { minQuantity: 3, discountPercent: 15 },
      ],
    }),
    products: [],
  },
];

const mockRefills: UpcomingRefillItem[] = [
  {
    treatmentId: 1,
    customerId: 10,
    customerName: 'Maria de Lourdes Silva',
    customerPhone: '(11) 98765-4321',
    productId: 50,
    productName: 'Losartana Potássica 50mg',
    dosage: '50mg',
    dailyDose: 1,
    unitsPerBox: 30,
    boxesPurchased: 1,
    totalDaysSupply: 30,
    startDate: '2026-10-25',
    expectedRefillDate: '2026-11-24',
    daysUntilRefill: 4,
    status: 'ACTIVE',
  },
  {
    treatmentId: 2,
    customerId: 20,
    customerName: 'José Antonio Pereira',
    customerPhone: '(11) 91234-5678',
    productId: 60,
    productName: 'Metformina 850mg',
    dosage: '850mg',
    dailyDose: 2,
    unitsPerBox: 60,
    boxesPurchased: 1,
    totalDaysSupply: 30,
    startDate: '2026-10-23',
    expectedRefillDate: '2026-11-22',
    daysUntilRefill: 2,
    status: 'ACTIVE',
  },
];

const mockCartEvaluation: CartEvaluationResult = {
  items: [
    {
      productId: 1,
      quantity: 3,
      originalUnitPrice: 25.0,
      finalUnitPrice: 16.67,
      discountAmount: 25.0,
      appliedPromotionId: 1,
      appliedPromotionName: 'Leve 3 Pague 2',
      appliedPromotionType: 'TAKE_MORE_PAY_LESS',
    },
  ],
  subtotal: 75.0,
  totalDiscount: 25.0,
  finalTotal: 50.0,
  appliedPromotions: [
    {
      id: 1,
      name: 'Leve 3 Pague 2 Fraldas Pampers',
      type: 'TAKE_MORE_PAY_LESS',
      totalDiscount: 25.0,
    },
  ],
};

describe('CrmPage & CRM Integrations (Posto [F10])', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock CRM APIs
    vi.spyOn(api.crm, 'getLoyaltyProgram').mockResolvedValue(mockLoyaltyProgram);
    vi.spyOn(api.crm, 'getWallet').mockResolvedValue(mockWallet);
    vi.spyOn(api.crm, 'getWalletStatement').mockResolvedValue({
      wallet: mockWallet,
      transactions: mockTransactions,
      textReceipt: '=== EXTRATO CLUBE FARMACORE ===\nCliente: Maria de Lourdes\nSaldo: R$ 35,50',
      fullEscPos: 'esc-pos-bytes',
    });
    vi.spyOn(api.crm, 'redeemCashback').mockResolvedValue({
      id: 103,
      walletId: 1,
      type: 'REDEEM',
      amount: 10.0,
      balanceAfter: 25.5,
      createdAt: '2026-11-20T12:00:00.000Z',
    });
    vi.spyOn(api.crm, 'getPromotions').mockResolvedValue(mockPromotions);
    vi.spyOn(api.crm, 'evaluateCart').mockResolvedValue(mockCartEvaluation);
    vi.spyOn(api.crm, 'getUpcomingRefills').mockResolvedValue(mockRefills);
    vi.spyOn(api.crm, 'getTreatmentSlip').mockResolvedValue({
      treatment: mockRefills[0],
      textReceipt: '=== ATENCAO FARMACEUTICA ===\nMedicamento: Losartana 50mg\nPrevisao de Termino: 24/11/2026',
      fullEscPos: 'esc-pos-bytes',
    });
    vi.spyOn(api.crm, 'markTreatmentContacted').mockResolvedValue({
      id: 1,
      customerId: 10,
      productId: 50,
      dailyDose: 1,
      unitsPerBox: 30,
      boxesPurchased: 1,
      totalDaysSupply: 30,
      startDate: '2026-10-25',
      expectedRefillDate: '2026-11-24',
      status: 'CONTACTED',
    });

    // Mock Credit API for customer search
    vi.spyOn(api.credit, 'getCustomerByCpf').mockResolvedValue(mockCustomer);
    vi.spyOn(api.credit, 'getCustomers').mockResolvedValue({
      customers: [mockCustomer],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    vi.spyOn(api.credit, 'checkCreditEligibility').mockResolvedValue({
      isEligible: true,
      customer: mockCustomer,
      availableLimit: 500,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Posto [F10] CRM header, program summary, and all 3 operational tabs', async () => {
    render(<CrmPage />);

    expect(screen.getByText(/Posto \[F10\] CRM, Fidelidade & Campanhas/i)).toBeDefined();
    expect(screen.getByTestId('tab-loyalty')).toBeDefined();
    expect(screen.getByTestId('tab-promotions')).toBeDefined();
    expect(screen.getByTestId('tab-treatments')).toBeDefined();

    // Default tab is Loyalty
    expect(screen.getByText(/Consulta de Carteira & Saldo do Cliente/i)).toBeDefined();
  });

  it('allows searching customer wallet by CPF in Tab 1 (Loyalty & Cashback)', async () => {
    render(<CrmPage />);

    const cpfInput = screen.getByTestId('loyalty-search-cpf');
    fireEvent.change(cpfInput, { target: { value: '123.456.789-01' } });

    const searchBtn = screen.getByTestId('loyalty-search-btn');
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.getByText('Maria de Lourdes Silva')).toBeDefined();
    });

    expect(screen.getByTestId('wallet-current-balance').textContent).toContain('35,50');
    expect(screen.getByTestId('loyalty-transactions-table')).toBeDefined();
    expect(screen.getByText(/Cashback 5% sobre compra #501/i)).toBeDefined();
  });

  it('switches between Tab 2 (Promotions) and Tab 3 (Treatments)', async () => {
    render(<CrmPage />);

    // Click on Tab 2: Promotions
    const promoTab = screen.getByTestId('tab-promotions');
    fireEvent.click(promoTab);

    await waitFor(() => {
      expect(screen.getByTestId('new-promotion-btn')).toBeDefined();
      expect(screen.getByText('Leve 3 Pague 2 Fraldas Pampers')).toBeDefined();
      expect(screen.getByText('Desconto Progressivo Vitaminas C')).toBeDefined();
    });

    // Run Cart Simulator in Tab 2
    const simBtn = screen.getByTestId('sim-cart-evaluate-btn');
    fireEvent.click(simBtn);

    await waitFor(() => {
      expect(screen.getByTestId('sim-cart-result')).toBeDefined();
      expect(screen.getByText(/Total Final com Promoções/i)).toBeDefined();
    });

    // Click on Tab 3: Treatments
    const treatTab = screen.getByTestId('tab-treatments');
    fireEvent.click(treatTab);

    await waitFor(() => {
      expect(screen.getByTestId('refills-table')).toBeDefined();
      expect(screen.getByText('Losartana Potássica 50mg')).toBeDefined();
      expect(screen.getByText('Metformina 850mg')).toBeDefined();
    });
  });

  it('opens RefillContactModal from treatments table and displays contact options and thermal slip', async () => {
    render(<CrmPage />);

    // Go to treatments tab
    fireEvent.click(screen.getByTestId('tab-treatments'));

    await waitFor(() => {
      expect(screen.getByTestId('refills-table')).toBeDefined();
    });

    // Click on "Registrar Contato" for the first patient
    const contactBtns = screen.getAllByTestId('open-contact-modal-btn');
    fireEvent.click(contactBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('refill-contact-modal')).toBeDefined();
    });

    // Register contact
    const notesInput = screen.getByTestId('contact-notes-input');
    fireEvent.change(notesInput, { target: { value: 'Paciente orientado sobre tomada contínua' } });

    const confirmContactBtn = screen.getByTestId('confirm-contact-btn');
    fireEvent.click(confirmContactBtn);

    await waitFor(() => {
      expect(screen.getByTestId('contact-success-banner')).toBeDefined();
    });

    // Switch to thermal slip tab inside modal
    const slipTab = screen.getByTestId('tab-slip-button');
    fireEvent.click(slipTab);

    await waitFor(() => {
      expect(screen.getByTestId('refill-slip-text')).toBeDefined();
      expect(screen.getByTestId('refill-slip-text').textContent).toContain('ATENCAO FARMACEUTICA');
    });
  });

  it('renders topbar button [F10] in App and switches to CRM station mode', async () => {
    render(<App />);

    const crmBtn = screen.getByTestId('topbar-crm-button');
    expect(crmBtn).toBeDefined();

    fireEvent.click(crmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Posto \[F10\] CRM, Fidelidade & Campanhas/i)).toBeDefined();
    });
  });

  it('displays cashback wallet card in PaymentModal and allows quick redeem when customer has balance', async () => {
    const onConfirmPayments = vi.fn();

    render(
      <PaymentModal
        isOpen={true}
        onClose={vi.fn()}
        totalAmount={100.0}
        onConfirmPayments={onConfirmPayments}
      />
    );

    // Switch to Convênio/Crediário or search CPF to identify customer
    fireEvent.click(screen.getByText('Convênio Empresa'));

    const cpfInput = screen.getByTestId('credit-cpf-input');
    fireEvent.change(cpfInput, { target: { value: '12345678901' } });

    const searchBtn = screen.getByTestId('check-credit-btn');
    fireEvent.click(searchBtn);

    // Once customer is identified, wallet is loaded and cashback card should appear
    await waitFor(() => {
      expect(screen.getByTestId('cashback-wallet-card')).toBeDefined();
    });

    expect(screen.getAllByText(/Maria de Lourdes Silva/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/35,50/).length).toBeGreaterThan(0);

    // Click "Resgatar Cashback" button
    const redeemBtn = screen.getByTestId('quick-redeem-cashback-btn');
    fireEvent.click(redeemBtn);

    // Amount input in payment modal should now receive the available cashback (35.50)
    const amountInput = screen.getByDisplayValue('35.50');
    expect(amountInput).toBeDefined();
  });
});
