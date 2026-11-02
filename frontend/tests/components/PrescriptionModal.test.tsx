import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PrescriptionModal, { PrescriptionModalProps } from '../../src/components/PrescriptionModal';
import { PrescriptionDTO, Product, Batch } from '../../src/services/api';
import { CartItem } from '../../src/components/CartTable';

const mockControlledProduct: Product = {
  id: 201,
  ean: '7891234567890',
  name: 'Clonazepam 2mg (Rivotril)',
  activeIngredient: 'Clonazepam',
  msRegistration: '1.0001.0002.001-0',
  stripe: 'PRETA',
  controlType: 'B1',
  pmc: 32.5,
  pf: 20.0,
  price: 28.0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockControlledBatch: Batch = {
  id: 11,
  productId: 201,
  batchNumber: 'LOTE-CNZ-88',
  manufacturingDate: '2025-01-10T00:00:00.000Z',
  expirationDate: '2027-05-31T00:00:00.000Z',
  quantity: 30,
  reservedQuantity: 0,
  availableQuantity: 30,
  createdAt: '2025-01-10T00:00:00.000Z',
};

const mockCartItems: CartItem[] = [
  {
    product: mockControlledProduct,
    batch: mockControlledBatch,
    quantity: 1,
    unitPrice: 28.0,
    totalPrice: 28.0,
  },
];

describe('PrescriptionModal Component', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    render(
      <PrescriptionModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(/Retenção de Receituário/i)).toBeNull();
  });

  it('should render modal when isOpen is true, displaying summary of controlled items', () => {
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        controlledItems={mockCartItems}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Retenção de Receituário/i)).toBeDefined();
    expect(screen.getByText('Clonazepam 2mg (Rivotril)')).toBeDefined();
    expect(screen.getByText(/LOTE-CNZ-88/i)).toBeDefined();
    expect(screen.getByText(/31\/05\/2027/i)).toBeDefined();
    expect(screen.getByText(/Tarja Preta/i)).toBeDefined();
  });

  it('should block confirmation and display validation errors when required fields are empty', () => {
    const onConfirm = vi.fn();
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        controlledItems={mockCartItems}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Receita/i });
    fireEvent.click(confirmBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Nome do prescritor é obrigatório/i)).toBeDefined();
    expect(screen.getByText(/CRM\/Registro é obrigatório/i)).toBeDefined();
    expect(screen.getByText(/UF é obrigatória/i)).toBeDefined();
    expect(screen.getByText(/Tipo de receituário é obrigatório/i)).toBeDefined();
    expect(screen.getByText(/Data da receita é obrigatória/i)).toBeDefined();
    expect(screen.getByText(/Nome do paciente é obrigatório/i)).toBeDefined();
  });

  it('should block confirmation when prescriptionDate is in the future', () => {
    const onConfirm = vi.fn();
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        controlledItems={mockCartItems}
      />
    );

    // Preenche campos válidos
    fireEvent.change(screen.getByLabelText(/Nome do Médico|Prescritor/i), {
      target: { value: 'Dr. Roberto Justus' },
    });
    fireEvent.change(screen.getByLabelText(/CRM|Registro Profissional/i), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByLabelText(/UF do Conselho/i), {
      target: { value: 'SP' },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de Receituário/i), {
      target: { value: 'B1_AZUL' },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Paciente/i), {
      target: { value: 'Paciente Saudável' },
    });

    // Data futura (ex: ano 2099)
    fireEvent.change(screen.getByLabelText(/Data da Receita/i), {
      target: { value: '2099-12-31' },
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Receita/i });
    fireEvent.click(confirmBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/A data da receita não pode ser futura/i)).toBeDefined();
  });

  it('should copy patient name to buyer name when "Mesmo do Paciente" button is clicked', () => {
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const patientInput = screen.getByLabelText(/Nome do Paciente/i) as HTMLInputElement;
    const buyerInput = screen.getByLabelText(/Nome do Comprador/i) as HTMLInputElement;
    const copyBtn = screen.getByRole('button', { name: /Mesmo do Paciente/i });

    fireEvent.change(patientInput, { target: { value: 'Maria Aparecida da Silva' } });
    expect(buyerInput.value).toBe('');

    fireEvent.click(copyBtn);
    expect(buyerInput.value).toBe('Maria Aparecida da Silva');
  });

  it('should call onConfirm with normalized PrescriptionDTO when all fields are valid', () => {
    const onConfirm = vi.fn();
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        controlledItems={mockCartItems}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nome do Médico|Prescritor/i), {
      target: { value: '   Dra. Fernanda Montenegro   ' },
    });
    fireEvent.change(screen.getByLabelText(/CRM|Registro Profissional/i), {
      target: { value: '  987654  ' },
    });
    fireEvent.change(screen.getByLabelText(/UF do Conselho/i), {
      target: { value: 'RJ' },
    });
    fireEvent.change(screen.getByLabelText(/Tipo de Receituário/i), {
      target: { value: 'C1_BRANCA_2VIAS' },
    });
    fireEvent.change(screen.getByLabelText(/Data da Receita/i), {
      target: { value: '2026-05-10' },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Paciente/i), {
      target: { value: '  Carlos Alberto de Nóbrega  ' },
    });
    fireEvent.change(screen.getByLabelText(/Nome do Comprador/i), {
      target: { value: '  Filho do Paciente  ' },
    });
    fireEvent.change(screen.getByLabelText(/CPF do Comprador/i), {
      target: { value: '111.222.333-44' },
    });

    const confirmBtn = screen.getByRole('button', { name: /Confirmar Receita/i });
    fireEvent.click(confirmBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result: PrescriptionDTO = onConfirm.mock.calls[0][0];
    expect(result).toEqual({
      doctorName: 'Dra. Fernanda Montenegro',
      doctorCrm: '987654',
      doctorUf: 'RJ',
      prescriptionType: 'C1_BRANCA_2VIAS',
      prescriptionDate: '2026-05-10',
      patientName: 'Carlos Alberto de Nóbrega',
      buyerName: 'Filho do Paciente',
      buyerCpf: '111.222.333-44',
    });
  });

  it('should populate fields with initialData when provided', () => {
    const initialData: PrescriptionDTO = {
      doctorName: 'Dr. Gregory House',
      doctorCrm: '456789',
      doctorUf: 'MG',
      prescriptionType: 'A1_AMARELA',
      prescriptionDate: '2026-04-01',
      patientName: 'John Doe',
      buyerName: 'Jane Doe',
      buyerCpf: '000.111.222-33',
    };

    render(
      <PrescriptionModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialData={initialData}
      />
    );

    expect((screen.getByLabelText(/Nome do Médico|Prescritor/i) as HTMLInputElement).value).toBe('Dr. Gregory House');
    expect((screen.getByLabelText(/CRM|Registro Profissional/i) as HTMLInputElement).value).toBe('456789');
    expect((screen.getByLabelText(/UF do Conselho/i) as HTMLSelectElement).value).toBe('MG');
    expect((screen.getByLabelText(/Tipo de Receituário/i) as HTMLSelectElement).value).toBe('A1_AMARELA');
    expect((screen.getByLabelText(/Data da Receita/i) as HTMLInputElement).value).toBe('2026-04-01');
    expect((screen.getByLabelText(/Nome do Paciente/i) as HTMLInputElement).value).toBe('John Doe');
    expect((screen.getByLabelText(/Nome do Comprador/i) as HTMLInputElement).value).toBe('Jane Doe');
    expect((screen.getByLabelText(/CPF do Comprador/i) as HTMLInputElement).value).toBe('000.111.222-33');
  });

  it('should call onClose when clicking Cancel button or close button', () => {
    const onClose = vi.fn();
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByTestId('close-prescription-modal');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should call onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <PrescriptionModal
        isOpen={true}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
