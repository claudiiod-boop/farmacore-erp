import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { SanitaryAuditDossierPage } from '../../src/pages/SanitaryAuditDossierPage';
import { sanitaryAuditApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  sanitaryAuditApi: {
    getDashboard: vi.fn(),
    getHistory: vi.fn(),
    getAuditById: vi.fn(),
    runScan: vi.fn(),
    getDossier: vi.fn(),
    updateActionPlan: vi.fn()
  }
}));

describe('SanitaryAuditDossierPage Component', () => {
  const mockDashboard = {
    last_audit_score: 95.0,
    last_audit_status: 'EXCELLENT' as const,
    last_audit_date: '2026-11-25',
    total_audits_performed: 3,
    pending_corrective_actions: 0,
    category_health: {
      cold_chain: 20,
      sngpc: 25,
      pops_certificates: 15,
      pgrss: 15,
      injectables: 15,
      pharmacovigilance: 5
    }
  };

  const mockAudit = {
    id: 'audit-123',
    store_id: '1',
    audit_date: '2026-11-25',
    responsible_pharmacist_crf: 'CRF-SP 45.678',
    responsible_pharmacist_name: 'Dra. Vanessa Farmacêutica RT',
    overall_score: 95.0,
    compliance_status: 'EXCELLENT' as const,
    cold_chain_score: 20,
    sngpc_score: 25,
    pops_certificates_score: 15,
    pgrss_score: 15,
    injectables_score: 15,
    pharmacovigilance_score: 5,
    dossier_summary_json: '{}',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      {
        id: 'item-1',
        audit_id: 'audit-123',
        category: 'COLD_CHAIN' as const,
        item_description: 'Controle diário de temperatura e umidade',
        status: 'COMPLIANT' as const,
        evidence_text: 'Medições registradas na data de hoje.',
        created_at: new Date().toISOString()
      },
      {
        id: 'item-2',
        audit_id: 'audit-123',
        category: 'PHARMACOVIGILANCE' as const,
        item_description: 'Notificações NOTIVISA',
        status: 'WARNING_EXPIRING' as const,
        evidence_text: '1 ocorrência aguardando finalização.',
        corrective_action: 'Finalizar transmissão ao NOTIVISA em 24h.',
        created_at: new Date().toISOString()
      }
    ]
  };

  const mockDossier = {
    audit: mockAudit,
    dossierSummary: {
      storeName: 'Drogaria Magnos Farma Matriz',
      cnpj: '98.765.432/0001-88',
      crf: 'CRF-SP 45.678',
      auditDate: '2026-11-25',
      score: 95.0,
      status: 'EXCELLENT' as const,
      totalItems: 2,
      compliantItems: 1,
      nonCompliantItems: 0,
      warningItems: 1,
      pillars: []
    },
    items: mockAudit.items,
    officialReportText: 'DOSSIÊ OFICIAL DE AUTOINSPEÇÃO SANITÁRIA — ANVISA\nFarmacêutico: Dra. Vanessa Farmacêutica RT\nScore: 95%'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sanitaryAuditApi.getDashboard).mockResolvedValue({
      success: true,
      data: mockDashboard
    });
    vi.mocked(sanitaryAuditApi.getHistory).mockResolvedValue({
      success: true,
      data: [mockAudit]
    });
    vi.mocked(sanitaryAuditApi.getAuditById).mockResolvedValue({
      success: true,
      data: mockAudit
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('1. Renderiza cabeçalho, score geral de saúde sanitária e checklist', async () => {
    render(<SanitaryAuditDossierPage />);

    expect(screen.getByText(/Auditoria Sanitária & Dossiê de Autoinspeção/i)).toBeDefined();
    await waitFor(() => {
      expect(screen.getByTestId('display-overall-score').textContent).toBe('95%');
      expect(screen.getByTestId('badge-compliance-status').textContent).toContain('Excelente');
    });

    expect(screen.getByText('Controle diário de temperatura e umidade')).toBeDefined();
    expect(screen.getByText('Notificações NOTIVISA')).toBeDefined();
    expect(screen.getByText(/Finalizar transmissão ao NOTIVISA/i)).toBeDefined();
  });

  it('2. Abre modal de execução de nova autoinspeção RT e submete', async () => {
    vi.mocked(sanitaryAuditApi.runScan).mockResolvedValue({
      success: true,
      data: mockAudit
    });

    render(<SanitaryAuditDossierPage />);

    await waitFor(() => {
      expect(screen.getByTestId('display-overall-score').textContent).toBe('95%');
    });

    const openScanBtn = screen.getByTestId('btn-run-scan-modal');
    fireEvent.click(openScanBtn);

    await waitFor(() => {
      expect(screen.getByTestId('modal-run-scan')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Iniciar Varredura/i }));

    await waitFor(() => {
      expect(sanitaryAuditApi.runScan).toHaveBeenCalledWith({
        store_id: '1',
        responsible_pharmacist_crf: 'CRF-SP 45.678',
        responsible_pharmacist_name: 'Dra. Vanessa Farmacêutica RT'
      });
      expect(screen.getByTestId('alert-feedback-message')).toBeDefined();
    });
  });

  it('3. Abre modal do Dossiê Oficial em 1 clique e exibe texto formatado ANVISA', async () => {
    vi.mocked(sanitaryAuditApi.getDossier).mockResolvedValue({
      success: true,
      data: mockDossier
    });

    render(<SanitaryAuditDossierPage />);

    await waitFor(() => {
      expect(screen.getByTestId('display-overall-score').textContent).toBe('95%');
    });

    await waitFor(() => {
      expect(screen.getByTestId('btn-open-dossier')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-open-dossier'));

    await waitFor(() => {
      expect(sanitaryAuditApi.getDossier).toHaveBeenCalledWith('audit-123');
      expect(screen.getByTestId('modal-official-dossier')).toBeDefined();
      expect(screen.getByText(/Farmacêutico: Dra. Vanessa Farmacêutica RT/i)).toBeDefined();
    });
  });

  it('4. Filtra itens do checklist por status', async () => {
    render(<SanitaryAuditDossierPage />);

    await waitFor(() => {
      expect(screen.getByText('Controle diário de temperatura e umidade')).toBeDefined();
    });

    // Filtra por avisos
    fireEvent.click(screen.getByTestId('filter-audit-warning_expiring'));

    expect(screen.getByText('Notificações NOTIVISA')).toBeDefined();
    expect(screen.queryByText('Controle diário de temperatura e umidade')).toBeNull();
  });
});
