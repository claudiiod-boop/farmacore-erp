import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { BackupDisasterRecoveryPage } from '../../src/pages/BackupDisasterRecoveryPage';
import { backupApi } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  backupApi: {
    getKpis: vi.fn(),
    listBackups: vi.fn(),
    getConfig: vi.fn(),
    listAuditLogs: vi.fn(),
    createBackup: vi.fn(),
    verifyIntegrity: vi.fn(),
    restoreBackup: vi.fn(),
    updateConfig: vi.fn(),
    exportClientDossier: vi.fn(),
    anonymizeClient: vi.fn(),
  },
}));

describe('BackupDisasterRecoveryPage', () => {
  afterEach(() => {
    cleanup();
  });

  const mockKpis = {
    totalBackups: 12,
    lastBackupDate: '2026-11-25T02:00:00Z',
    lastBackupStatus: 'VERIFIED' as const,
    totalStorageBytes: 52428800, // 50 MB
    autoBackupActive: true,
    retentionDays: 30,
    auditLogsCount: 45,
  };

  const mockBackups = [
    {
      id: 1,
      filename: 'farmacore-backup-20261125.sqlite.enc',
      file_path: 'C:/backups/farmacore-backup-20261125.sqlite.enc',
      file_size_bytes: 52428800,
      sha256_hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      backup_type: 'FULL' as const,
      storage_destination: 'LOCAL' as const,
      is_encrypted: 1,
      status: 'VERIFIED' as const,
      duration_ms: 320,
      error_message: null,
      created_at: '2026-11-25T02:00:00Z',
    },
  ];

  const mockConfig = {
    id: 1,
    auto_backup_enabled: 1,
    cron_expression: '0 2 * * *',
    retention_days: 30,
    destination_type: 'LOCAL' as const,
    encryption_enabled: 1,
    notify_email: 'ti@farmacore.com.br',
    last_run_at: '2026-11-25T02:00:00Z',
    next_run_at: '2026-11-26T02:00:00Z',
    updated_at: '2026-11-25T02:00:00Z',
  };

  const mockAuditLogs = [
    {
      id: 1,
      operator_name: 'Farmacêutico RT',
      action: 'VERIFY_INTEGRITY' as const,
      target_document: 'farmacore-backup-20261125.sqlite.enc',
      reason: 'Auditoria de rotina',
      status: 'COMPLETED',
      ip_address: '127.0.0.1',
      created_at: '2026-11-25T02:05:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (backupApi.getKpis as any).mockResolvedValue(mockKpis);
    (backupApi.listBackups as any).mockResolvedValue(mockBackups);
    (backupApi.getConfig as any).mockResolvedValue(mockConfig);
    (backupApi.listAuditLogs as any).mockResolvedValue(mockAuditLogs);
  });

  it('1. Renderiza KPIs de backup e a listagem de snapshots', async () => {
    render(<BackupDisasterRecoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('farmacore-backup-20261125.sqlite.enc')).toBeDefined();
      expect(screen.getByText('12')).toBeDefined();
      expect(screen.getByText('30')).toBeDefined();
      expect(screen.getByText('AES-256')).toBeDefined();
    });
  });

  it('2. Dispara criação manual de backup seguro ao clicar no botão', async () => {
    (backupApi.createBackup as any).mockResolvedValue({
      ...mockBackups[0],
      id: 2,
      filename: 'farmacore-backup-manual.sqlite.enc',
    });

    render(<BackupDisasterRecoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('farmacore-backup-20261125.sqlite.enc')).toBeDefined();
    });

    const createBtn = screen.getByRole('button', { name: /Gerar Backup Seguro Agora/ });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(backupApi.createBackup).toHaveBeenCalled();
      expect(screen.getByText(/Snapshot seguro gerado com sucesso/)).toBeDefined();
    });
  });

  it('3. Executa verificação de integridade SHA-256', async () => {
    (backupApi.verifyIntegrity as any).mockResolvedValue({
      backupId: 1,
      filename: 'farmacore-backup-20261125.sqlite.enc',
      expectedHash: 'a1b2c3',
      calculatedHash: 'a1b2c3',
      hashValid: true,
      sqliteIntegrityOk: true,
      overallStatus: 'VALID',
      message: 'Backup íntegro e autêntico. Hash SHA-256 validado sem adulterações.',
    });

    render(<BackupDisasterRecoveryPage />);

    await waitFor(() => {
      expect(screen.getByText('Verificar Hash')).toBeDefined();
    });

    const verifyBtn = screen.getByText('Verificar Hash');
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(backupApi.verifyIntegrity).toHaveBeenCalledWith(1, 'Auditor de TI');
      expect(screen.getByText(/Hash SHA-256 validado sem adulterações/)).toBeDefined();
    });
  });

  it('4. Alterna para aba LGPD, consulta titular e exibe dados para exportação', async () => {
    (backupApi.exportClientDossier as any).mockResolvedValue({
      cpf: '123.456.789-00',
      name: 'Carlos Alberto Ferreira',
      exportedAt: '2026-11-25T10:00:00Z',
      operatorName: 'DPO',
      salesCount: 4,
      prescriptionsCount: 2,
      adverseReactionsCount: 0,
      details: { sales: [], prescriptions: [], adverseReactions: [] },
    });

    render(<BackupDisasterRecoveryPage />);

    const lgpdTab = screen.getByRole('button', { name: /Privacidade & LGPD/ });
    fireEvent.click(lgpdTab);

    await waitFor(() => {
      expect(screen.getByTestId('lgpd-cpf-input')).toBeDefined();
    });

    fireEvent.change(screen.getByTestId('lgpd-cpf-input'), { target: { value: '123.456.789-00' } });

    const searchBtn = screen.getByRole('button', { name: /Localizar Dossiê/ });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(backupApi.exportClientDossier).toHaveBeenCalledWith('123.456.789-00', 'Encarregado DPO', expect.any(String));
      expect(screen.getByText('Carlos Alberto Ferreira')).toBeDefined();
      expect(screen.getByText('4 registros')).toBeDefined();
      expect(screen.getByText('Baixar Dossiê JSON')).toBeDefined();
    });
  });
});
