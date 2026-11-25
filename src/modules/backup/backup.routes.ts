import { FastifyInstance } from 'fastify';
import { Database } from '../../database/connection';
import { BackupDisasterRecoveryService } from './backup-disaster-recovery.service';
import type { CreateBackupOptions } from './backup.types';

export async function registerBackupRoutes(app: FastifyInstance, db: Database) {
  const service = new BackupDisasterRecoveryService(db);

  // 1. Criar Backup Manual
  app.post('/api/backup/create', async (request, reply) => {
    try {
      const body = (request.body || {}) as any;
      const options: CreateBackupOptions = {
        backupType: body.backupType || body.backup_type || 'FULL',
        destination: body.destination || 'LOCAL',
        encrypt: body.encrypt !== false,
        operatorName: body.operatorName || body.operator_name || 'Operador',
      };

      const result = service.createBackup(options);
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Erro ao gerar backup' });
    }
  });

  // 2. Listar Backups
  app.get('/api/backup/list', async (request, reply) => {
    try {
      const query = request.query as any;
      const limit = query.limit ? Number(query.limit) : 20;
      const list = service.listBackups(limit);
      return reply.send(list);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 3. Verificar Integridade
  app.post('/api/backup/:id/verify', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = (request.body || {}) as any;
      const backupId = Number(params.id);
      const operatorName = body.operatorName || 'Auditor';

      const result = service.verifyBackupIntegrity(backupId, operatorName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 4. Restaurar Backup
  app.post('/api/backup/:id/restore', async (request, reply) => {
    try {
      const params = request.params as any;
      const body = (request.body || {}) as any;
      const backupId = Number(params.id);
      const operatorName = body.operatorName || 'Administrador TI';

      const result = service.restoreBackup(backupId, operatorName);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 5. Configurações: Obter
  app.get('/api/backup/config', async (_request, reply) => {
    try {
      const config = service.getConfig();
      return reply.send(config);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 6. Configurações: Atualizar
  app.put('/api/backup/config', async (request, reply) => {
    try {
      const body = request.body as any;
      const updated = service.updateConfig(body);
      return reply.send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 7. KPIs de Backup & Disaster Recovery
  app.get('/api/backup/kpis', async (_request, reply) => {
    try {
      const kpis = service.getKpis();
      return reply.send(kpis);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 8. LGPD: Exportar Dossiê do Titular (Art. 18)
  app.get('/api/lgpd/dossier/:cpf', async (request, reply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const cpf = params.cpf;
      const operatorName = query.operatorName || 'DPO / Encarregado';
      const reason = query.reason;

      const dossier = service.exportClientLgpdDossier(cpf, operatorName, reason);
      return reply.send(dossier);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 9. LGPD: Anonimizar Titular
  app.post('/api/lgpd/anonymize', async (request, reply) => {
    try {
      const body = request.body as any;
      const cpf = body.cpf;
      const operatorName = body.operatorName || 'DPO / Encarregado';
      const reason = body.reason || 'Solicitação de esquecimento do titular';

      if (!cpf) return reply.status(400).send({ error: 'CPF é obrigatório' });

      const result = service.anonymizeClient(cpf, operatorName, reason);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 10. LGPD: Listar Logs de Auditoria
  app.get('/api/lgpd/audit-logs', async (request, reply) => {
    try {
      const query = request.query as any;
      const limit = query.limit ? Number(query.limit) : 50;
      const logs = service.listAuditLogs(limit);
      return reply.send(logs);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
