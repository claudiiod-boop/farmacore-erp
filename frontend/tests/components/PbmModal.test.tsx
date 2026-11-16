import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PbmModal from '../../src/components/pbm/PbmModal';
import { api } from '../../src/services/api';
import type { PbmAuthorizationResult } from '../../src/types';

describe('PbmModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/pbm/providers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 1,
              providerId: 'FARMACIA_POPULAR',
              providerName: 'Aqui Tem Farmácia Popular (Datasus/MS)',
              environment: 'MOCK',
              isActive: 1,
              createdAt: '',
              updatedAt: '',
            },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    }) as any;
  });

  afterEach(() => {
    cleanup();
  });

  it('should not render anything when isOpen is false', () => {
    render(<PbmModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Autorização de Convênio/i)).toBeNull();
  });

  it('should render modal when isOpen is true', () => {
    render(<PbmModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Autorização de Convênio Farmacêutico & Farmácia Popular/i)).toBeDefined();
    expect(screen.getByTestId('patient-cpf-input')).toBeDefined();
    expect(screen.getByTestId('doctor-crm-input')).toBeDefined();
    expect(screen.getByTestId('bolsa-familia-checkbox')).toBeDefined();
    expect(screen.getByTestId('pbm-authorize-button')).toBeDefined();
  });

  it('should calculate subsidy and copay breakdown when items are selected', () => {
    const mockItems = [
      {
        product: {
          id: 1,
          ean: '7891234567890',
          name: 'Losartana Potássica 50mg',
          activeIngredient: 'Losartana',
          msRegistration: '1004300010010',
          stripe: 'SEM_TARJA' as const,
          controlType: 'ISENTO' as const,
          pmc: 20.0,
          pf: 15.0,
          price: 20.0,
          isActive: true,
          createdAt: '',
        },
        quantity: 2,
        dailyDose: 1,
      },
    ];

    render(
      <PbmModal
        isOpen={true}
        onClose={vi.fn()}
        initialItems={mockItems}
      />
    );

    // Total gross = 2 * 20.00 = R$ 40,00
    expect(screen.getAllByText('R$ 40,00').length).toBeGreaterThan(0);

    const subsidyDisplay = screen.getByTestId('subsidy-amount-display');
    expect(subsidyDisplay).toBeDefined();

    // Toggle Bolsa Família
    const bolsaCheckbox = screen.getByTestId('bolsa-familia-checkbox');
    fireEvent.click(bolsaCheckbox);

    expect(subsidyDisplay.textContent).toContain('R$ 40,00');
    const copayDisplay = screen.getByTestId('copay-amount-display');
    expect(copayDisplay.textContent).toContain('R$ 0,00');
  });

  it('should trigger authorization API call on submit', async () => {
    const mockAuthResult: PbmAuthorizationResult = {
      success: true,
      transactionUuid: 'uuid-12345',
      authorizationProtocol: 'FP-20261116-99999',
      providerId: 'FARMACIA_POPULAR',
      patientCpf: '12345678901',
      patientName: 'Maria Silva',
      totalGrossAmount: 40.0,
      subsidyAmount: 36.0,
      patientCopayAmount: 4.0,
      items: [
        {
          productId: 1,
          ean: '7891234567890',
          msRegistration: '1004300010010',
          productName: 'Losartana Potássica 50mg',
          dailyDose: 1,
          authorizedQuantity: 2,
          unitGrossPrice: 20.0,
          totalGrossPrice: 40.0,
          referenceUnitPrice: 20.0,
          subsidyUnitPrice: 18.0,
          subsidyTotalPrice: 36.0,
          patientUnitPrice: 2.0,
          patientTotalPrice: 4.0,
          programType: 'CO_PAGAMENTO',
          status: 'APROVADO',
        },
      ],
    };

    const authorizeSpy = vi.spyOn(api.pbm, 'authorize').mockResolvedValue(mockAuthResult);
    const onAuthorizedMock = vi.fn();

    const mockItems = [
      {
        product: {
          id: 1,
          ean: '7891234567890',
          name: 'Losartana Potássica 50mg',
          activeIngredient: 'Losartana',
          msRegistration: '1004300010010',
          stripe: 'SEM_TARJA' as const,
          controlType: 'ISENTO' as const,
          pmc: 20.0,
          pf: 15.0,
          price: 20.0,
          isActive: true,
          createdAt: '',
        },
        quantity: 2,
        dailyDose: 1,
      },
    ];

    render(
      <PbmModal
        isOpen={true}
        onClose={vi.fn()}
        onAuthorized={onAuthorizedMock}
        initialItems={mockItems}
      />
    );

    fireEvent.change(screen.getByTestId('patient-cpf-input'), {
      target: { value: '12345678901' },
    });
    fireEvent.change(screen.getByTestId('patient-name-input'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByTestId('doctor-crm-input'), {
      target: { value: '123456' },
    });

    const authBtn = screen.getByTestId('pbm-authorize-button');
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(authorizeSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('pbm-success-banner')).toBeDefined();
    });
    expect(screen.getByText(/Prot: FP-20261116-99999/i)).toBeDefined();

    const applyBtn = screen.getByTestId('pbm-apply-button');
    fireEvent.click(applyBtn);

    expect(onAuthorizedMock).toHaveBeenCalledWith(mockAuthResult);
  });

  it('should display rejection error alert when authorization fails', async () => {
    const mockRejection: PbmAuthorizationResult = {
      success: false,
      transactionUuid: 'uuid-fail',
      authorizationProtocol: '',
      providerId: 'FARMACIA_POPULAR',
      patientCpf: '12345678901',
      patientName: 'Maria Silva',
      totalGrossAmount: 0,
      subsidyAmount: 0,
      patientCopayAmount: 0,
      items: [],
      errorMessage: 'Intervalo mínimo de 30 dias entre retiradas não atingido para este princípio ativo',
    };

    vi.spyOn(api.pbm, 'authorize').mockResolvedValue(mockRejection);

    const mockItems = [
      {
        product: {
          id: 1,
          ean: '7891234567890',
          name: 'Losartana 50mg',
          activeIngredient: 'Losartana',
          msRegistration: '1004300010010',
          stripe: 'SEM_TARJA' as const,
          controlType: 'ISENTO' as const,
          pmc: 20.0,
          pf: 15.0,
          price: 20.0,
          isActive: true,
          createdAt: '',
        },
        quantity: 1,
      },
    ];

    render(
      <PbmModal
        isOpen={true}
        onClose={vi.fn()}
        initialItems={mockItems}
      />
    );

    fireEvent.change(screen.getByTestId('patient-cpf-input'), {
      target: { value: '12345678901' },
    });
    fireEvent.change(screen.getByTestId('patient-name-input'), {
      target: { value: 'Maria Silva' },
    });
    fireEvent.change(screen.getByTestId('doctor-crm-input'), {
      target: { value: '123456' },
    });

    const authBtn = screen.getByTestId('pbm-authorize-button');
    fireEvent.click(authBtn);

    await waitFor(() => {
      expect(screen.getByTestId('pbm-error-banner')).toBeDefined();
    });

    expect(screen.getByText(/Intervalo mínimo de 30 dias/i)).toBeDefined();
  });

  it('should close on Escape key', () => {
    const onCloseMock = vi.fn();
    render(<PbmModal isOpen={true} onClose={onCloseMock} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
