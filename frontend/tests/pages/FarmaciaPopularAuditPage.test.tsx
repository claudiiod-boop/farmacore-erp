import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { FarmaciaPopularAuditPage } from '../../src/pages/FarmaciaPopularAuditPage';
import { fpAuditApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  fpAuditApi: {
    getKpis: vi.fn(),
    listAuditItems: vi.fn(),
    listDossiers: vi.fn(),
    importSettlementBatch: vi.fn(),
    contestGloss: vi.fn(),
    registerDossier: vi.fn(),
    reconcileAuthorizations: vi.fn(),
  }
}));

describe('FarmaciaPopularAuditPage Component', () => {
  const mockKpis = {
    total_batches: 4,
    total_reconciled_items: 120,
    total_credited_amount: 14500.0,
    total_gloss_amount: 320.0,
    gloss_rate_percentage: 2.16,
    pending_dossiers_count: 5,
    archived_dossiers_count: 115
  };

  const mockItems = [
    {
      id: 1,
      settlement_batch_id: 10,
      store_id: 1,
      authorization_code: 'AUTH-FP-TEST-001',
      patient_cpf: '123.456.789-00',
      patient_name: 'Carlos Eduardo Silva',
      prescriber_crm: '12345',
      prescriber_uf: 'SP',
      authorized_ms_amount: 100.0,
      patient_copay_amount: 0.0,
      credited_fns_amount: 100.0,
      gloss_amount: 0.0,
      status: 'APPROVED' as const,
      created_at: '2026-11-25T10:00:00'
    },
    {
      id: 2,
      settlement_batch_id: 10,
      store_id: 1,
      authorization_code: 'AUTH-FP-TEST-002',
      patient_cpf: '987.654.321-99',
      patient_name: 'Mariana Rios',
      prescriber_crm: '54321',
      prescriber_uf: 'RJ',
      authorized_ms_amount: 80.0,
      patient_copay_amount: 0.0,
      credited_fns_amount: 50.0,
      gloss_amount: 30.0,
      gloss_reason: 'Divergência de posologia',
      status: 'PARTIALLY_GLOSSED' as const,
      created_at: '2026-11-25T10:00:00'
    }
  ];

  const mockDossiers = [
    {
      id: 1,
      store_id: 1,
      authorization_code: 'AUTH-FP-TEST-001',
      patient_cpf: '123.456.789-00',
      patient_name: 'Carlos Eduardo Silva',
      dispensation_date: '2026-11-25',
      retention_deadline: '2031-11-25',
      signed_coupon_file_path: '/docs/cupom_001.pdf',
      prescription_file_path: '/docs/receita_001.pdf',
      sha256_integrity_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'ARCHIVED' as const,
      created_at: '2026-11-25T10:00:00'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (fpAuditApi.getKpis as any).mockResolvedValue({
      success: true,
      data: mockKpis
    });
    (fpAuditApi.listAuditItems as any).mockResolvedValue({
      success: true,
      data: mockItems
    });
    (fpAuditApi.listDossiers as any).mockResolvedValue({
      success: true,
      data: mockDossiers
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, normas GM/MS nº 5/2017 e KPIs de repasse e glosas', async () => {
    render(<FarmaciaPopularAuditPage />);

    expect(screen.getByText('Auditoria Farmácia Popular & Prevenção de Glosas')).toBeDefined();
    expect(screen.getByText('Portaria GM/MS nº 5/2017')).toBeDefined();
    expect(screen.getByText('Guarda 5 Anos (DENASUS)')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId('kpi-total-credited').textContent).toContain('14.500,00');
      expect(screen.getByTestId('kpi-total-gloss').textContent).toContain('320,00');
      expect(screen.getByTestId('kpi-gloss-rate').textContent).toContain('2.16 %');
    });
  });

  it('2. Exibe itens auditados na tabela com autorizações e valores glosados', async () => {
    render(<FarmaciaPopularAuditPage />);

    await waitFor(() => {
      expect(screen.getByText('AUTH-FP-TEST-001')).toBeDefined();
      expect(screen.getByText('AUTH-FP-TEST-002')).toBeDefined();
      expect(screen.getByText('Mariana Rios')).toBeDefined();
      expect(screen.getByText('Divergência de posologia')).toBeDefined();
    });
  });

  it('3. Abre modal de contestação administrativa e protocola recurso', async () => {
    (fpAuditApi.contestGloss as any).mockResolvedValue({
      success: true,
      data: {
        id: 2,
        authorization_code: 'AUTH-FP-TEST-002',
        status: 'CONTESTED',
        contest_protocol: 'CONTEST-MS-998811'
      }
    });

    render(<FarmaciaPopularAuditPage />);

    await waitFor(() => {
      expect(screen.getByTestId('contest-gloss-btn-2')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('contest-gloss-btn-2'));

    expect(screen.getByTestId('contest-gloss-modal')).toBeDefined();
    expect(screen.getByText('Contestar Glosa Administrativa')).toBeDefined();

    const confirmBtn = screen.getByTestId('confirm-contest-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fpAuditApi.contestGloss).toHaveBeenCalled();
      expect(screen.getByTestId('fp-audit-success-alert').textContent).toContain('CONTEST-MS-998811');
    });
  });

  it('4. Alterna para aba de Dossiês e exibe retenção legal de 5 anos', async () => {
    render(<FarmaciaPopularAuditPage />);

    const tabDossiers = screen.getByTestId('tab-dossiers');
    fireEvent.click(tabDossiers);

    await waitFor(() => {
      expect(screen.getByText('AUTH-FP-TEST-001')).toBeDefined();
      expect(screen.getByText('2031-11-25')).toBeDefined();
      expect(screen.getByText('ARQUIVADO (5 ANOS)')).toBeDefined();
    });
  });

  it('5. Abre modal de importação de lote FNS e submete com sucesso', async () => {
    (fpAuditApi.importSettlementBatch as any).mockResolvedValue({
      success: true,
      data: {
        id: 20,
        batch_reference: 'FNS-2026-10-LOTE01',
        total_authorized_amount: 120.0,
        total_credited_amount: 90.0,
        total_loss_amount: 30.0,
        status: 'DISCREPANT'
      }
    });

    render(<FarmaciaPopularAuditPage />);

    const openImportBtn = screen.getByTestId('open-import-batch-modal');
    fireEvent.click(openImportBtn);

    expect(screen.getByTestId('import-batch-modal')).toBeDefined();

    const confirmImportBtn = screen.getByTestId('confirm-import-batch-btn');
    fireEvent.click(confirmImportBtn);

    await waitFor(() => {
      expect(fpAuditApi.importSettlementBatch).toHaveBeenCalled();
      expect(screen.getByTestId('fp-audit-success-alert').textContent).toContain('FNS-2026-10-LOTE01');
    });
  });
});
