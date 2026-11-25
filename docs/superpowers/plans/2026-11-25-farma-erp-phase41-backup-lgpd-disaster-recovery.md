# Plano de Execução — Fase 41: Backup em Nuvem Automatizado, Criptografia LGPD & Disaster Recovery

## Tarefas de Execução

### Task 1: Migration 040 & Tipos de Domínio
- Criar `src/database/migrations/040_backup_disaster_recovery_lgpd.sql`.
- Criar `src/modules/backup/backup.types.ts`.
- Criar teste de schema `tests/modules/backup/backup.schema.test.ts`.

### Task 2: BackupDisasterRecoveryService & Regras de Negócio
- Criar `src/modules/backup/backup-disaster-recovery.service.ts` com métodos de snapshot, SHA-256 hash, AES-256 criptografia, retenção, verificação de integridade, exportação e anonimização LGPD.
- Criar testes unitários `tests/modules/backup/backup-disaster-recovery.service.test.ts`.

### Task 3: Rotas REST Fastify
- Criar `src/modules/backup/backup.routes.ts` com endpoints de backup, integridade, restauração, configuração e LGPD.
- Registrar rotas em `src/api/routes.ts`.
- Criar testes de integração `tests/api/routes.backup.test.ts`.

### Task 4: Frontend React (BackupDisasterRecoveryPage)
- Criar `frontend/src/types/backup.ts`.
- Atualizar `frontend/src/types/index.ts`.
- Atualizar `frontend/src/services/api.ts` com `backupApi`.
- Atualizar `frontend/src/hooks/useStationMode.ts` com modo `BACKUP_DISASTER_RECOVERY`.
- Criar `frontend/src/pages/BackupDisasterRecoveryPage.tsx`.
- Integrar no `frontend/src/App.tsx`.
- Criar testes de interface `frontend/tests/pages/BackupDisasterRecoveryPage.test.tsx`.

### Task 5: Homologação Global, Testes e Sincronização
- Rodar `tsc --noEmit`.
- Rodar `npm run build:web`.
- Rodar suite completa de testes `npm test`.
- Commits atômicos e push para `master`.
