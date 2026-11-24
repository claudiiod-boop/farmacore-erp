import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { DigitalPrescriptionModal } from '../../src/components/counter/DigitalPrescriptionModal';
import { digitalPrescriptionsApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  digitalPrescriptionsApi: {
    validate: vi.fn(),
    dispense: vi.fn(),
    getByCode: vi.fn(),
    mockCreate: vi.fn(),
  },
}));

describe('DigitalPrescriptionModal (Validador ICP-Brasil no Balcão)', () => {
  afterEach(() => {
    cleanup();
  });

  const mockValidPrescription = {
    id: 1,
    prescription_code: 'MEM-2026-VAL',
    prescriber_name: 'Dr. Lucas Silveira',
    prescriber_crm: 'CRM-SP 112233',
    prescriber_uf: 'SP',
    patient_name: 'Mariana Souza',
    patient_cpf: '123.456.789-00',
    icp_signature_valid: true,
    icp_cert_issuer: 'AC Syngular / ITI ICP-Brasil',
    icp_signed_at: '2026-11-24T09:00:00Z',
    prescription_type: 'CONTROLLED_C1' as const,
    issued_at: '2026-11-24T09:00:00Z',
    expires_at: '2026-12-24T09:00:00Z',
    status: 'VALID' as const,
    items: [
      {
        medication_name: 'Sertralina 50mg',
        dosage: '50mg',
        quantity_prescribed: 2,
        instructions: '1 comprimido pela manhã',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Não renderiza nada quando isOpen for false', () => {
    const { container } = render(
      <DigitalPrescriptionModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('2. Renderiza modal de validação com campo de QR code / código', () => {
    render(
      <DigitalPrescriptionModal isOpen={true} onClose={() => {}} />
    );

    expect(screen.getByText(/Validador de Receitas Digitais ICP-Brasil/i)).toBeDefined();
    expect(screen.getByTestId('input-prescription-code')).toBeDefined();
    expect(screen.getByTestId('btn-validate-prescription')).toBeDefined();
  });

  it('3. Valida receita digital autêntica e exibe médico, paciente e itens', async () => {
    (digitalPrescriptionsApi.validate as any).mockResolvedValue({
      isValid: true,
      canDispense: true,
      status: 'VALID',
      message: 'Receita digital autêntica ICP-Brasil.',
      prescription: mockValidPrescription,
    });

    render(
      <DigitalPrescriptionModal isOpen={true} onClose={() => {}} />
    );

    const input = screen.getByTestId('input-prescription-code');
    fireEvent.change(input, { target: { value: 'MEM-2026-VAL' } });

    fireEvent.click(screen.getByTestId('btn-validate-prescription'));

    await waitFor(() => {
      expect(digitalPrescriptionsApi.validate).toHaveBeenCalledWith('MEM-2026-VAL');
      expect(screen.getByText('Dr. Lucas Silveira')).toBeDefined();
      expect(screen.getByText('Mariana Souza')).toBeDefined();
      expect(screen.getByText('Sertralina 50mg')).toBeDefined();
      expect(screen.getByTestId('btn-dispense-and-import')).toBeDefined();
    });
  });

  it('4. Exibe banner vermelho de bloqueio contra dupla dispensação', async () => {
    (digitalPrescriptionsApi.validate as any).mockResolvedValue({
      isValid: true,
      canDispense: false,
      status: 'DISPENSED',
      message: 'Receita já dispensada em 24/11/2026 às 08:30 (Filial #1) pelo CRF CRF-SP 55443. Reutilização bloqueada.',
      prescription: {
        ...mockValidPrescription,
        status: 'DISPENSED',
      },
    });

    render(
      <DigitalPrescriptionModal isOpen={true} onClose={() => {}} />
    );

    const input = screen.getByTestId('input-prescription-code');
    fireEvent.change(input, { target: { value: 'MEM-2026-USED' } });
    fireEvent.click(screen.getByTestId('btn-validate-prescription'));

    await waitFor(() => {
      expect(screen.getByText(/Dispensação Bloqueada: Receita Já Utilizada!/i)).toBeDefined();
      expect(screen.queryByTestId('btn-dispense-and-import')).toBeNull();
    });
  });

  it('5. Baixa receita com sucesso ao acionar dispensação com CRF do farmacêutico', async () => {
    (digitalPrescriptionsApi.validate as any).mockResolvedValue({
      isValid: true,
      canDispense: true,
      status: 'VALID',
      message: 'Receita digital autêntica.',
      prescription: mockValidPrescription,
    });

    (digitalPrescriptionsApi.dispense as any).mockResolvedValue({
      ...mockValidPrescription,
      status: 'DISPENSED',
    });

    const onImportMock = vi.fn();

    render(
      <DigitalPrescriptionModal
        isOpen={true}
        onClose={() => {}}
        onImportToPreSale={onImportMock}
      />
    );

    const input = screen.getByTestId('input-prescription-code');
    fireEvent.change(input, { target: { value: 'MEM-2026-VAL' } });
    fireEvent.click(screen.getByTestId('btn-validate-prescription'));

    await waitFor(() => {
      expect(screen.getByTestId('btn-dispense-and-import')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-dispense-and-import'));

    await waitFor(() => {
      expect(digitalPrescriptionsApi.dispense).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MEM-2026-VAL',
          pharmacistCrf: expect.stringContaining('CRF'),
        })
      );
      expect(onImportMock).toHaveBeenCalled();
    });
  });
});
