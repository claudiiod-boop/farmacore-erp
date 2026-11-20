import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import CustomerCreditPage from '../../src/pages/CustomerCreditPage';
import App from '../../src/App';
import { api } from '../../src/services/api';
import type {
  Customer,
  CorporateAgreement,
  CustomerReceivable,
} from '../../src/types';

const mockAgreements: CorporateAgreement[] = [
  {
    id: 1,
    code: 'EMP-001',
    companyName: 'Metalúrgica Brasil S.A.',
    tradeName: 'Metal Brasil',
    cnpj: '11.222.333/0001-44',
    closingDay: 25,
    dueDay: 5,
    creditLimit: 15000,
    discountPercent: 12,
    isActive: true,
    street: 'Rua das Indústrias',
    number: '500',
    neighborhood: 'Distrito',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
  },
  {
    id: 2,
    code: 'EMP-002',
    companyName: 'Prefeitura Municipal',
    tradeName: 'Servidores Municipais',
    cnpj: '22.333.444/0001-55',
    closingDay: 20,
    dueDay: 10,
    creditLimit: 30000,
    discountPercent: 15,
    isActive: true,
    street: 'Praça da Sé',
    number: '1',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001-000',
  },
];

const mockCustomers: Customer[] = [
  {
    id: 1,
    storeId: 1,
    agreementId: 1,
    name: 'Carlos Alberto Souza',
    cpf: '12345678901',
    rg: '12345678',
    phone: '(11) 98765-4321',
    email: 'carlos@email.com',
    creditLimit: 1000,
    currentDebt: 250,
    status: 'ACTIVE',
    allowDependents: true,
    agreement: mockAgreements[0],
    dependents: [
      {
        id: 101,
        customerId: 1,
        name: 'Mariana Souza',
        cpf: '98765432100',
        relationship: 'CONJUGE',
        isActive: true,
      },
    ],
  },
  {
    id: 2,
    storeId: 1,
    agreementId: null,
    name: 'Beatriz Ferreira Lima',
    cpf: '23456789012',
    rg: '23456789',
    phone: '(11) 91234-5678',
    creditLimit: 800,
    currentDebt: 800,
    status: 'BLOCKED_OVERDUE',
    allowDependents: false,
    agreement: null,
    dependents: [],
  },
];

const mockReceivables: CustomerReceivable[] = [
  {
    id: 1,
    customerId: 1,
    saleId: 501,
    agreementId: 1,
    installmentNumber: 1,
    totalInstallments: 2,
    dueDate: '2026-12-05',
    originalAmount: 125.0,
    paidAmount: 0,
    discountAmount: 0,
    interestAmount: 0,
    status: 'OPEN',
  },
  {
    id: 2,
    customerId: 1,
    saleId: 501,
    agreementId: 1,
    installmentNumber: 2,
    totalInstallments: 2,
    dueDate: '2027-01-05',
    originalAmount: 125.0,
    paidAmount: 0,
    discountAmount: 0,
    interestAmount: 0,
    status: 'OPEN',
  },
];

describe('CustomerCreditPage (Posto [F9] Convênios & Crediário)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Mock creditApi
    vi.spyOn(api.credit, 'getAgreements').mockResolvedValue(mockAgreements);
    vi.spyOn(api.credit, 'getCustomers').mockResolvedValue({
      customers: mockCustomers,
      total: 2,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    vi.spyOn(api.credit, 'getCustomerById').mockImplementation(async (id: number) => {
      const found = mockCustomers.find((c) => c.id === id);
      if (found) return found;
      throw new Error('Cliente não encontrado');
    });
    vi.spyOn(api.credit, 'getCustomerByCpf').mockImplementation(async (cpf: string) => {
      const clean = cpf.replace(/\D/g, '');
      const found = mockCustomers.find((c) => c.cpf.replace(/\D/g, '') === clean);
      if (found) return found;
      throw new Error('Cliente não encontrado');
    });
    vi.spyOn(api.credit, 'getReceivables').mockResolvedValue(mockReceivables);
    vi.spyOn(api.credit, 'getAgreementInvoices').mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('should render page header, station mode badge [F9], and all 3 tabs', async () => {
    render(<CustomerCreditPage />);

    expect(screen.getByText(/Posto de Convênios & Crediário/i)).toBeDefined();
    expect(screen.getByText(/\[F9\]/i)).toBeDefined();

    expect(screen.getByTestId('tab-customers')).toBeDefined();
    expect(screen.getByTestId('tab-agreements')).toBeDefined();
    expect(screen.getByTestId('tab-debt')).toBeDefined();

    // Customers tab is active by default
    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Souza')).toBeDefined();
      expect(screen.getByText('Beatriz Ferreira Lima')).toBeDefined();
    });
  });

  it('should render customer list with credit limits and status badges (ACTIVE and BLOCKED_OVERDUE)', async () => {
    render(<CustomerCreditPage />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Souza')).toBeDefined();
    });

    // Badges
    const activeBadge = screen.getByTestId('badge-status-1');
    expect(activeBadge.textContent).toContain('ATIVO');

    const blockedBadge = screen.getByTestId('badge-status-2');
    expect(blockedBadge.textContent).toContain('BLOQUEADO');

    // Values formatted in BRL
    expect(screen.getAllByText(/1000,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/250,00/).length).toBeGreaterThan(0);
  });

  it('should filter customers by search input and reload customer list', async () => {
    const getCustomersSpy = vi.spyOn(api.credit, 'getCustomers');
    render(<CustomerCreditPage />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Souza')).toBeDefined();
    });

    const searchInput = screen.getByTestId('customer-search-input');
    fireEvent.change(searchInput, { target: { value: 'Carlos' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(getCustomersSpy).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'Carlos' })
      );
    });
  });

  it('should open CustomerFormModal when "+ Novo Cliente" is clicked', async () => {
    render(<CustomerCreditPage />);

    const newBtn = screen.getByTestId('new-customer-btn');
    fireEvent.click(newBtn);

    expect(screen.getByText(/Novo Cadastro de Cliente Crediário/i)).toBeDefined();
    expect(screen.getByLabelText(/Nome Completo/i)).toBeDefined();
    expect(screen.getByLabelText(/CPF/i)).toBeDefined();
  });

  it('should switch to Empresas Conveniadas tab and open AgreementFormModal and PayrollInvoiceModal', async () => {
    render(<CustomerCreditPage />);

    // Switch to tab 2
    const agreementsTab = screen.getByTestId('tab-agreements');
    fireEvent.click(agreementsTab);

    await waitFor(() => {
      expect(screen.getByText('Metal Brasil')).toBeDefined();
      expect(screen.getByText('Servidores Municipais')).toBeDefined();
      expect(screen.getByText('EMP-001')).toBeDefined();
    });

    // Open new agreement modal
    const newAgBtn = screen.getByTestId('new-agreement-btn');
    fireEvent.click(newAgBtn);
    expect(screen.getAllByText(/Nova Empresa Conveniada/i).length).toBeGreaterThan(0);

    // Close modal
    fireEvent.click(screen.getByText(/Cancelar/i));

    // Open Invoices / RH modal
    const openInvoicesBtn = screen.getByTestId('open-invoices-1');
    fireEvent.click(openInvoicesBtn);
    expect(screen.getByText(/Gestão de Faturas & Extrato de RH/i)).toBeDefined();
    expect(screen.getByText(/Novo Fechamento de Fatura Mensal/i)).toBeDefined();
  });

  it('should switch to Carnê & Quitação Rápida tab, search customer by CPF, and open DebtPaymentModal', async () => {
    render(<CustomerCreditPage />);

    // Switch to tab 3
    const debtTab = screen.getByTestId('tab-debt');
    fireEvent.click(debtTab);

    expect(screen.getByTestId('debt-cpf-input')).toBeDefined();
    expect(screen.getByTestId('search-cpf-btn')).toBeDefined();

    // Type CPF and search
    const cpfInput = screen.getByTestId('debt-cpf-input');
    fireEvent.change(cpfInput, { target: { value: '12345678901' } });
    fireEvent.click(screen.getByTestId('search-cpf-btn'));

    await waitFor(() => {
      expect(screen.getByText('Carlos Alberto Souza')).toBeDefined();
      expect(screen.getByText('Carnê de Parcelas do Cliente (2)')).toBeDefined();
    });

    // Click to open settlement modal
    const openSettlementBtn = screen.getByTestId('open-debt-payment-btn');
    fireEvent.click(openSettlementBtn);

    expect(screen.getByText(/Recebimento & Quitação de Carnê de Crediário/i)).toBeDefined();
    expect(screen.getByTestId('confirm-settlement-btn')).toBeDefined();
  });

  it('should support switching to [F9] Convênios & Crediário via topbar and keyboard shortcut in App', async () => {
    render(<App />);

    const creditBtn = screen.getByTestId('topbar-credit-button');
    expect(creditBtn).toBeDefined();
    expect(creditBtn.textContent).toContain('[F9] Convênios & Crediário');

    // Click button to switch station
    fireEvent.click(creditBtn);

    await waitFor(() => {
      expect(screen.getByText(/Posto de Convênios & Crediário/i)).toBeDefined();
    });

    // Switch back to Balcão via F1
    fireEvent.keyDown(window, { key: 'F1', code: 'F1' });
    await waitFor(() => {
      expect(screen.queryByText(/Posto de Convênios & Crediário/i)).toBeNull();
    });

    // Switch to Credit via F9
    fireEvent.keyDown(window, { key: 'F9', code: 'F9' });
    await waitFor(() => {
      expect(screen.getByText(/Posto de Convênios & Crediário/i)).toBeDefined();
    });
  });
});
