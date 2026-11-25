export type BackupType = 'FULL' | 'INCREMENTAL' | 'LGPD_EXPORT';
export type StorageDestination = 'LOCAL' | 'AWS_S3' | 'GOOGLE_DRIVE' | 'AZURE_BLOB';
export type BackupStatus = 'SUCCESS' | 'FAILED' | 'VERIFIED';
export type LgpdAction = 'EXPORT_CLIENT_DATA' | 'ANONYMIZE_CLIENT' | 'RESTORE_BACKUP' | 'VERIFY_INTEGRITY';

export interface BackupLog {
  id: number;
  filename: string;
  file_path: string;
  file_size_bytes: number;
  sha256_hash: string;
  backup_type: BackupType;
  storage_destination: StorageDestination;
  is_encrypted: number;
  status: BackupStatus;
  duration_ms: number;
  error_message: string | null;
  created_at: string;
}

export interface BackupConfig {
  id: number;
  auto_backup_enabled: number;
  cron_expression: string;
  retention_days: number;
  destination_type: StorageDestination;
  encryption_enabled: number;
  notify_email: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  updated_at: string;
}

export interface LgpdAuditLog {
  id: number;
  operator_name: string;
  action: LgpdAction;
  target_document: string | null;
  reason: string | null;
  status: string;
  ip_address: string | null;
  created_at: string;
}

export interface BackupIntegrityCheckResult {
  backupId: number;
  filename: string;
  expectedHash: string;
  calculatedHash: string;
  hashValid: boolean;
  sqliteIntegrityOk: boolean;
  overallStatus: 'VALID' | 'CORRUPTED';
  message: string;
}

export interface LgpdClientDossier {
  cpf: string;
  name: string;
  exportedAt: string;
  operatorName: string;
  salesCount: number;
  prescriptionsCount: number;
  adverseReactionsCount: number;
  details: {
    sales: any[];
    prescriptions: any[];
    adverseReactions: any[];
  };
}

export interface BackupKpis {
  totalBackups: number;
  lastBackupDate: string | null;
  lastBackupStatus: BackupStatus | null;
  totalStorageBytes: number;
  autoBackupActive: boolean;
  retentionDays: number;
  auditLogsCount: number;
}
