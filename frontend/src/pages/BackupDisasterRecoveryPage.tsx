import React, { useState, useEffect } from 'react';
import {
  BackupLog,
  BackupConfig,
  LgpdAuditLog,
  BackupKpis,
  LgpdClientDossier,
  BackupIntegrityCheckResult,
} from '../types/backup';
import { backupApi } from '../services/api';

export const BackupDisasterRecoveryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BACKUPS' | 'CONFIG' | 'LGPD' | 'AUDIT'>('BACKUPS');
  const [kpis, setKpis] = useState<BackupKpis | null>(null);
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [auditLogs, setAuditLogs] = useState<LgpdAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados de LGPD
  const [searchCpf, setSearchCpf] = useState('');
  const [dossier, setDossier] = useState<LgpdClientDossier | null>(null);
  const [anonymizeReason, setAnonymizeReason] = useState('');
  const [integrityResult, setIntegrityResult] = useState<BackupIntegrityCheckResult | null>(null);

  // Config Form
  const [formConfig, setFormConfig] = useState({
    auto_backup_enabled: 1,
    cron_expression: '0 2 * * *',
    retention_days: 30,
    destination_type: 'LOCAL' as const,
    encryption_enabled: 1,
    notify_email: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiRes, listRes, cfgRes, auditRes] = await Promise.all([
        backupApi.getKpis(),
        backupApi.listBackups(),
        backupApi.getConfig(),
        backupApi.listAuditLogs(),
      ]);
      setKpis(kpiRes);
      setBackups(listRes || []);
      setConfig(cfgRes);
      if (cfgRes) {
        setFormConfig({
          auto_backup_enabled: cfgRes.auto_backup_enabled,
          cron_expression: cfgRes.cron_expression,
          retention_days: cfgRes.retention_days,
          destination_type: cfgRes.destination_type,
          encryption_enabled: cfgRes.encryption_enabled,
          notify_email: cfgRes.notify_email || '',
        });
      }
      setAuditLogs(auditRes || []);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao carregar dados de backup' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const created = await backupApi.createBackup({
        backupType: 'FULL',
        destination: formConfig.destination_type,
        encrypt: Boolean(formConfig.encryption_enabled),
        operatorName: 'Farmacêutico / Admin',
      });
      setFeedbackMsg({
        type: 'success',
        text: `Snapshot seguro gerado com sucesso! Arquivo: ${created.filename} (Hash SHA-256 verificado)`,
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao gerar backup' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async (id: number) => {
    try {
      const res = await backupApi.verifyIntegrity(id, 'Auditor de TI');
      setIntegrityResult(res);
      setFeedbackMsg({
        type: res.overallStatus === 'VALID' ? 'success' : 'error',
        text: res.message,
      });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao verificar integridade' });
    }
  };

  const handleRestoreBackup = async (id: number) => {
    if (!window.confirm('Atenção: A restauração de banco de dados substituirá os dados atuais pelo snapshot. Deseja prosseguir?')) {
      return;
    }
    try {
      const res = await backupApi.restoreBackup(id, 'Administrador FarmaCore');
      setFeedbackMsg({ type: 'success', text: res.message });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao restaurar backup' });
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await backupApi.updateConfig(formConfig);
      setFeedbackMsg({ type: 'success', text: 'Configurações de agendamento e retenção salvas com sucesso!' });
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao salvar configurações' });
    }
  };

  const handleSearchDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchCpf.trim()) return;
    try {
      const res = await backupApi.exportClientDossier(searchCpf, 'Encarregado DPO', 'Consulta aos direitos do titular');
      setDossier(res);
      setFeedbackMsg({ type: 'success', text: `Dossiê LGPD localizado para o titular ${res.name}!` });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao consultar dossiê do titular' });
    }
  };

  const handleAnonymize = async () => {
    if (!dossier) return;
    if (!window.confirm(`Tem certeza que deseja anonimizar irreversivelmente os dados do CPF ${dossier.cpf}? Esta ação é permanente.`)) {
      return;
    }
    try {
      await backupApi.anonymizeClient(dossier.cpf, 'DPO Farmácia', anonymizeReason || 'Solicitação de revogação/esquecimento');
      setFeedbackMsg({
        type: 'success',
        text: `Dados do titular ${dossier.cpf} anonimizados com sucesso nas tabelas de clientes e prescrições.`,
      });
      setDossier(null);
      setSearchCpf('');
      loadData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao anonimizar cliente' });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🛡️</span> Backup em Nuvem Automatizado, Criptografia LGPD & Disaster Recovery
          </h1>
          <p className="text-sm text-gray-500">
            Snapshots seguros com hash SHA-256, criptografia AES-256-GCM em repouso e atendimento ao Art. 18 da LGPD.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium shadow-sm flex items-center gap-1 text-sm disabled:opacity-50"
          >
            <span>💾</span> Gerar Backup Seguro Agora
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded text-sm flex justify-between items-center ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline">
            Fechar
          </button>
        </div>
      )}

      {/* KPIS */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Snapshots Criados</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-gray-900">{kpis.totalBackups}</span>
              <span className="text-xs font-medium text-gray-500">pontos válidos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Armazenamento: {formatBytes(kpis.totalStorageBytes)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Último Backup</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-sm font-bold text-gray-800">
                {kpis.lastBackupDate ? kpis.lastBackupDate.slice(0, 16) : 'Nenhum'}
              </span>
            </div>
            <p className="text-xs text-emerald-600 font-semibold mt-1">Status: {kpis.lastBackupStatus || 'N/A'}</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Política de Retenção</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-blue-600">{kpis.retentionDays}</span>
              <span className="text-xs font-medium text-gray-500">dias</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Expurgo automático de snapshots antigos</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Auditoria LGPD</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-purple-600">{kpis.auditLogsCount}</span>
              <span className="text-xs font-medium text-gray-500">eventos</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Rastreabilidade e governança de dados</p>
          </div>
        </div>
      )}

      {/* ABAS */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('BACKUPS')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'BACKUPS' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🛡️ Snapshots de Banco ({backups.length})
          </button>
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'CONFIG' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚙️ Agendamento & Nuvem
          </button>
          <button
            onClick={() => setActiveTab('LGPD')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'LGPD' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔒 Privacidade & LGPD (Art. 18)
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`pb-3 text-sm font-medium border-b-2 ${
              activeTab === 'AUDIT' ? 'border-emerald-600 text-emerald-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📜 Trilha de Auditoria ({auditLogs.length})
          </button>
        </nav>
      </div>

      {/* CONTEÚDO: ABA SNAPSHOTS */}
      {activeTab === 'BACKUPS' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Arquivo Snapshot</th>
                <th className="px-4 py-3 text-left">Tipo / Destino</th>
                <th className="px-4 py-3 text-left">Tamanho</th>
                <th className="px-4 py-3 text-left">Criptografia / SHA-256</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Data de Criação</th>
                <th className="px-4 py-3 text-right">Ações de Segurança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    Nenhum snapshot de backup gerado ainda.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900">{b.filename}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-semibold text-gray-700">{b.backup_type}</span>
                      <span className="text-gray-400 block">{b.storage_destination}</span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-800">{formatBytes(b.file_size_bytes)}</td>
                    <td className="px-4 py-3 text-xs">
                      {b.is_encrypted ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          AES-256
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">Plano</span>
                      )}
                      <span className="font-mono text-[10px] text-gray-400 block truncate max-w-xs mt-0.5">
                        {b.sha256_hash}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          b.status === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'SUCCESS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {b.status === 'VERIFIED' ? '✓ Íntegro / Verificado' : b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{b.created_at.slice(0, 16)}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleVerifyIntegrity(b.id)}
                        className="px-2 py-1 text-xs font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded border"
                        title="Verificar hash SHA-256 contra adulteração"
                      >
                        Verificar Hash
                      </button>
                      <button
                        onClick={() => handleRestoreBackup(b.id)}
                        className="px-2 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded"
                        title="Restaurar snapshot"
                      >
                        Restaurar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTEÚDO: ABA CONFIGURAÇÃO */}
      {activeTab === 'CONFIG' && (
        <div className="max-w-xl mx-auto bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Configurações de Backup e Nuvem</h2>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_backup"
                checked={Boolean(formConfig.auto_backup_enabled)}
                onChange={(e) => setFormConfig({ ...formConfig, auto_backup_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="auto_backup" className="text-sm font-semibold text-gray-800">
                Ativar Rotina Automática Diária de Backup
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">Horário / Expressão Cron</label>
              <input
                type="text"
                value={formConfig.cron_expression}
                onChange={(e) => setFormConfig({ ...formConfig, cron_expression: e.target.value })}
                className="w-full border rounded p-2 text-sm mt-1"
                placeholder="Ex: 0 2 * * * (todo dia às 02h)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Retenção de Arquivos (Dias)</label>
                <input
                  type="number"
                  value={formConfig.retention_days}
                  onChange={(e) => setFormConfig({ ...formConfig, retention_days: Number(e.target.value) })}
                  className="w-full border rounded p-2 text-sm mt-1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Destino de Armazenamento</label>
                <select
                  value={formConfig.destination_type}
                  onChange={(e) => setFormConfig({ ...formConfig, destination_type: e.target.value as any })}
                  className="w-full border rounded p-2 text-sm mt-1"
                >
                  <option value="LOCAL">Local (Servidor Físico)</option>
                  <option value="AWS_S3">Amazon S3 Nuvem</option>
                  <option value="GOOGLE_DRIVE">Google Drive Cloud</option>
                  <option value="AZURE_BLOB">Microsoft Azure Blob</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="encryption_enabled"
                checked={Boolean(formConfig.encryption_enabled)}
                onChange={(e) => setFormConfig({ ...formConfig, encryption_enabled: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="encryption_enabled" className="text-sm font-semibold text-gray-800">
                Criptografia AES-256 em Repouso
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">E-mail para Alertas de Falha</label>
              <input
                type="email"
                value={formConfig.notify_email}
                onChange={(e) => setFormConfig({ ...formConfig, notify_email: e.target.value })}
                className="w-full border rounded p-2 text-sm mt-1"
                placeholder="suporte@farmacore.com.br"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-sm shadow"
            >
              Salvar Parâmetros de Backup
            </button>
          </form>
        </div>
      )}

      {/* CONTEÚDO: ABA LGPD */}
      {activeTab === 'LGPD' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span>👤</span> Consulta e Exercício dos Direitos do Titular (Art. 18 LGPD)
            </h2>
            <form onSubmit={handleSearchDossier} className="flex gap-2">
              <input
                type="text"
                data-testid="lgpd-cpf-input"
                value={searchCpf}
                onChange={(e) => setSearchCpf(e.target.value)}
                placeholder="Informe o CPF do titular (ex: 123.456.789-00)"
                className="flex-1 border rounded p-2 text-sm"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold text-sm"
              >
                Localizar Dossiê
              </button>
            </form>
          </div>

          {dossier && (
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{dossier.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">CPF: {dossier.cpf}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dossier, null, 2));
                      const a = document.createElement('a');
                      a.href = dataStr;
                      a.download = `dossie-lgpd-${dossier.cpf}.json`;
                      a.click();
                    }}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold"
                  >
                    Baixar Dossiê JSON
                  </button>
                  <button
                    onClick={handleAnonymize}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
                  >
                    Anonimizar Titular
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs bg-gray-50 p-3 rounded">
                <div>
                  <span className="font-semibold block">Compras / Pré-Vendas:</span>
                  <span className="text-gray-800 font-bold">{dossier.salesCount} registros</span>
                </div>
                <div>
                  <span className="font-semibold block">Receitas Retidas:</span>
                  <span className="text-gray-800 font-bold">{dossier.prescriptionsCount} registros</span>
                </div>
                <div>
                  <span className="font-semibold block">Farmacovigilância (RAM):</span>
                  <span className="text-gray-800 font-bold">{dossier.adverseReactionsCount} registros</span>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                A anonimização irreversível atende ao direito de revogação e exclusão, mantendo a integridade fiscal/sanitária de forma descaracterizada.
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO: ABA AUDITORIA */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Data/Hora</th>
                <th className="px-4 py-3 text-left">Operador</th>
                <th className="px-4 py-3 text-left">Ação Realizada</th>
                <th className="px-4 py-3 text-left">Documento / Alvo</th>
                <th className="px-4 py-3 text-left">Motivo / Justificativa</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    Nenhum registro de auditoria registrado até o momento.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{log.created_at.slice(0, 16)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{log.operator_name}</td>
                    <td className="px-4 py-3 text-xs font-mono text-purple-700 font-bold">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.target_document || 'N/A'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{log.reason || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BackupDisasterRecoveryPage;
