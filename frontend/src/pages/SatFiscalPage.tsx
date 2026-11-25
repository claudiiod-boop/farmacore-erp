import React, { useState, useEffect, useCallback } from 'react';
import { satFiscalApi } from '../services/api';
import type {
  CfeSatDocument,
  SatFiscalKpis,
  CfeStatus
} from '../types/sat';

export const SatFiscalPage: React.FC = () => {
  const [documents, setDocuments] = useState<CfeSatDocument[]>([]);
  const [kpis, setKpis] = useState<SatFiscalKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Vincular Aparelho SAT
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [posStationId, setPosStationId] = useState('CAIXA_01');
  const [serialNumber, setSerialNumber] = useState('');
  const [deviceModel, setDeviceModel] = useState('BEMATECH_RB2000');
  const [signCode, setSignCode] = useState('FARMACORE_AC_SIGN_2026');
  const [deviceSubmitting, setDeviceSubmitting] = useState(false);

  // Modal Extrato Térmico 80mm
  const [isExtratoModalOpen, setIsExtratoModalOpen] = useState(false);
  const [extratoContent, setExtratoContent] = useState('');
  const [extratoLoading, setExtratoLoading] = useState(false);

  // Modal Cancelar CF-e
  const [cancelTargetCfe, setCancelTargetCfe] = useState<CfeSatDocument | null>(null);
  const [cancelJustification, setCancelJustification] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'TODOS' ? (statusFilter as CfeStatus) : undefined;
      const [listRes, kpisRes] = await Promise.all([
        satFiscalApi.listCfe({ store_id: 1, status: statusParam }),
        satFiscalApi.getKpis(1)
      ]);

      if (listRes.success) {
        setDocuments(listRes.data || []);
      }
      if (kpisRes.success) {
        setKpis(kpisRes.data || null);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do SAT');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Vincular Aparelho SAT
  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await satFiscalApi.registerDevice({
        store_id: 1,
        pos_station_id: posStationId,
        serial_number: serialNumber,
        model: deviceModel,
        sign_code: signCode
      });
      if (res.success) {
        setSuccessMsg(`Módulo SAT serial ${serialNumber} vinculado com sucesso ao ${posStationId}!`);
        setIsDeviceModalOpen(false);
        setSerialNumber('');
        await loadData();
      } else {
        setError(res.error || 'Erro ao vincular aparelho SAT');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado na vinculação');
    } finally {
      setDeviceSubmitting(false);
    }
  };

  // Sincronizar Fila de Contingência Off-line com a SEFAZ
  const handleSyncContingency = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await satFiscalApi.syncContingency(1);
      if (res.success) {
        setSuccessMsg(`Sincronização em lote concluída! ${res.data.transmitted_count} cupom(ns) transmitido(s) à SEFAZ.`);
        await loadData();
      } else {
        setError(res.error || 'Falha na sincronização de contingência');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar à SEFAZ');
    } finally {
      setLoading(false);
    }
  };

  // Visualizar Extrato 80mm
  const handleViewExtrato = async (cfeId: number) => {
    setExtratoLoading(true);
    setError(null);
    try {
      const res = await satFiscalApi.getExtrato(cfeId);
      if (res.success) {
        setExtratoContent(res.data.extrato);
        setIsExtratoModalOpen(true);
      } else {
        setError(res.error || 'Falha ao gerar extrato');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar extrato do SAT');
    } finally {
      setExtratoLoading(false);
    }
  };

  // Cancelar CF-e
  const handleCancelCfe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetCfe) return;
    setCancelSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await satFiscalApi.cancelCfe(cancelTargetCfe.id, cancelJustification);
      if (res.success) {
        setSuccessMsg(`CF-e nº ${cancelTargetCfe.cfe_number} cancelado com sucesso perante a SEFAZ!`);
        setCancelTargetCfe(null);
        setCancelJustification('');
        await loadData();
      } else {
        setError(res.error || 'Erro ao cancelar CF-e');
      }
    } catch (err: any) {
      setError(err.message || 'Falha no cancelamento');
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen" data-testid="sat-fiscal-page">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
              CF-e-SAT SP / MF-e CE
            </span>
            <span className="text-gray-400 text-xs">Portaria CAT 147/2012 & Modelo 59</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Módulo Fiscal SAT & Contingência Off-line
          </h1>
          <p className="text-sm text-gray-600">
            Emissão de Cupons Fiscais Eletrônicos via hardware SAT físico ou emulador, contingência e extrato 80mm.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            data-testid="refresh-sat-button"
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
          <button
            data-testid="sync-contingency-button"
            onClick={handleSyncContingency}
            disabled={loading}
            className="px-4 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-sm font-semibold transition"
          >
            ⚡ Transmitir Contingência
          </button>
          <button
            data-testid="register-device-button"
            onClick={() => setIsDeviceModalOpen(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-sm transition"
          >
            + Vincular Aparelho SAT
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div data-testid="error-alert" className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      {successMsg && (
        <div data-testid="success-alert" className="mt-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm rounded">
          {successMsg}
        </div>
      )}

      {/* KPIs Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Cupons Emitidos</span>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="kpi-total-cfe">
            {kpis?.total_cfe_issued ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Faturamento SAT (Autorizado)</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="kpi-authorized-amount">
            R$ {(kpis?.total_authorized_amount ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Cupons Cancelados</span>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="kpi-cancelled-count">
            {kpis?.total_cancelled_count ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Fila Contingência (Offline)</span>
          <p className="text-2xl font-bold text-amber-600 mt-1" data-testid="kpi-pending-contingency">
            {kpis?.pending_contingency_count ?? 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Módulos SAT Ativos</span>
          <p className="text-2xl font-bold text-blue-600 mt-1" data-testid="kpi-active-devices">
            {kpis?.active_devices_count ?? 0}
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filtrar por Status:</span>
          <select
            data-testid="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-800"
          >
            <option value="TODOS">Todos os Cupons</option>
            <option value="AUTHORIZED">Autorizados SEFAZ</option>
            <option value="SYNC_PENDING">Contingência Off-line</option>
            <option value="CANCELLED">Cancelados</option>
          </select>
        </div>
        <span className="text-xs text-gray-500" data-testid="total-records-count">
          Exibindo {documents.length} cupom(ns) fiscal(is)
        </span>
      </div>

      {/* Tabela de Cupons SAT */}
      <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nº CF-e</th>
                <th className="px-4 py-3 text-left font-semibold">Chave de Acesso (44 dígitos)</th>
                <th className="px-4 py-3 text-center font-semibold">Venda PDV</th>
                <th className="px-4 py-3 text-left font-semibold">Emissão</th>
                <th className="px-4 py-3 text-right font-semibold">Valor Total</th>
                <th className="px-4 py-3 text-center font-semibold">Status SEFAZ</th>
                <th className="px-4 py-3 text-center font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500" data-testid="empty-documents-row">
                    Nenhum Cupom Fiscal Eletrônico CF-e-SAT encontrado.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50" data-testid={`cfe-row-${doc.id}`}>
                    <td className="px-4 py-3 font-bold text-red-600">
                      {String(doc.cfe_number).padStart(6, '0')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">
                      {doc.access_key}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">#{doc.sale_id}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{doc.issued_at?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      R$ {doc.net_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          doc.status === 'AUTHORIZED'
                            ? 'bg-green-100 text-green-800'
                            : doc.status === 'SYNC_PENDING'
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {doc.status === 'AUTHORIZED'
                          ? 'AUTORIZADO'
                          : doc.status === 'SYNC_PENDING'
                          ? 'CONTINGÊNCIA'
                          : 'CANCELADO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          data-testid={`view-extrato-button-${doc.id}`}
                          onClick={() => handleViewExtrato(doc.id)}
                          disabled={extratoLoading}
                          className="px-2.5 py-1 text-xs bg-gray-100 text-gray-800 hover:bg-gray-200 rounded font-medium"
                          title="Visualizar Extrato Térmico 80mm com QR Code"
                        >
                          Extrato 80mm
                        </button>
                        {doc.status === 'AUTHORIZED' && (
                          <button
                            data-testid={`cancel-cfe-button-${doc.id}`}
                            onClick={() => {
                              setCancelTargetCfe(doc);
                              setCancelJustification('');
                            }}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium"
                            title="Cancelar no prazo legal de 30 minutos"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Vincular Aparelho SAT */}
      {isDeviceModalOpen && (
        <div
          data-testid="register-device-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Vincular Módulo Fiscal SAT / MF-e</h3>
            <p className="text-xs text-gray-500 mb-4">
              Informe o número de série e o código de vinculação AC (Software House + Farmácia) para comunicação com a SEFAZ.
            </p>
            <form onSubmit={handleRegisterDevice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Identificador do Caixa (PDV)</label>
                <input
                  type="text"
                  data-testid="device-station-input"
                  value={posStationId}
                  onChange={(e) => setPosStationId(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Número de Série do Aparelho (9 dígitos)</label>
                <input
                  type="text"
                  data-testid="device-serial-input"
                  placeholder="Ex: 900001234"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fabricante / Modelo SAT</label>
                <select
                  data-testid="device-model-select"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                >
                  <option value="BEMATECH_RB2000">Bematech RB-2000</option>
                  <option value="DIMEP_D_SAT">Dimep D-SAT 2.0</option>
                  <option value="ELGIN_SMART">Elgin Smart SAT</option>
                  <option value="SWEDA_SAT">Sweda SS-2000</option>
                  <option value="EMULADOR_SEFAZ">Emulador Homologação SEFAZ SP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Código de Vinculação AC (SignAC)</label>
                <input
                  type="text"
                  data-testid="device-signcode-input"
                  value={signCode}
                  onChange={(e) => setSignCode(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsDeviceModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-register-device-button"
                  disabled={deviceSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
                >
                  {deviceSubmitting ? 'Vinculando...' : 'Salvar Módulo SAT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Extrato Térmico 80mm */}
      {isExtratoModalOpen && (
        <div
          data-testid="extrato-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Extrato Cupom Fiscal Eletrônico (SAT)</h3>
              <button
                onClick={() => setIsExtratoModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="my-4">
              <textarea
                data-testid="extrato-content"
                readOnly
                rows={16}
                value={extratoContent}
                className="w-full font-mono text-xs p-3 bg-gray-900 text-green-300 rounded-lg overflow-x-auto leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsExtratoModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
              <button
                type="button"
                data-testid="print-extrato-button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
              >
                Imprimir Cupom 80mm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar CF-e */}
      {cancelTargetCfe && (
        <div
          data-testid="cancel-cfe-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cancelar Cupom Fiscal SAT</h3>
            <p className="text-xs text-gray-500 mb-4">
              CF-e Nº: <span className="font-semibold text-gray-800">{cancelTargetCfe.cfe_number}</span> |{' '}
              Valor: <span className="font-semibold text-gray-800">R$ {cancelTargetCfe.net_amount.toFixed(2)}</span>
              <br />
              <span className="text-amber-700 font-medium">Prazo regulatório limite: até 30 minutos após emissão.</span>
            </p>
            <form onSubmit={handleCancelCfe} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Motivo do Cancelamento</label>
                <textarea
                  data-testid="cancel-justification-input"
                  rows={3}
                  placeholder="Ex: Desistência do cliente / Erro na forma de pagamento..."
                  value={cancelJustification}
                  onChange={(e) => setCancelJustification(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setCancelTargetCfe(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-cancel-cfe-button"
                  disabled={cancelSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold"
                >
                  {cancelSubmitting ? 'Transmitindo Cancelamento...' : 'Confirmar Cancelamento SEFAZ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SatFiscalPage;
