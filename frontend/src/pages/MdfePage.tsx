import React, { useState, useEffect, useCallback } from 'react';
import { mdfeApi } from '../services/api';
import type {
  MdfeDocument,
  MdfeKpis,
  MdfeStatus,
} from '../types/mdfe';

export const MdfePage: React.FC = () => {
  const [mdfes, setMdfes] = useState<MdfeDocument[]>([]);
  const [kpis, setKpis] = useState<MdfeKpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal Novo Rascunho
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [ufStart, setUfStart] = useState('SP');
  const [ufEnd, setUfEnd] = useState('RJ');
  const [driverName, setDriverName] = useState('Antônio Carlos');
  const [driverCpf, setDriverCpf] = useState('123.456.789-00');
  const [vehiclePlate, setVehiclePlate] = useState('BRA-2E19');
  const [vehicleRntrc, setVehicleRntrc] = useState('RNTRC-SP-998877');
  const [insuranceName, setInsuranceName] = useState('Porto Seguro Cargas');
  const [insurancePolicy, setInsurancePolicy] = useState('APOLICE-FARMA-2026');
  const [nfeAccessKey, setNfeAccessKey] = useState('35261111222333000144550010000000011000000019');
  const [cargoValue, setCargoValue] = useState('45000.00');
  const [cargoWeight, setCargoWeight] = useState('250.00');
  const [submitting, setSubmitting] = useState(false);

  // Modal DAMDFE
  const [isDamdfeModalOpen, setIsDamdfeModalOpen] = useState(false);
  const [damdfeContent, setDamdfeContent] = useState('');

  // Modal Encerramento
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [targetCloseId, setTargetCloseId] = useState<number | null>(null);
  const [closureReason, setClosureReason] = useState('Descarregamento finalizado e recebimento confirmado na filial');
  const [closing, setClosing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter !== 'TODOS' ? (statusFilter as MdfeStatus) : undefined;
      const [kpisRes, listRes] = await Promise.all([
        mdfeApi.getKpis(1),
        mdfeApi.list({ store_id: 1, status: statusParam })
      ]);

      if (kpisRes.success && kpisRes.data) setKpis(kpisRes.data);
      if (listRes.success && listRes.data) setMdfes(listRes.data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar dados do MDF-e');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Criar Rascunho
  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await mdfeApi.createDraft({
        store_id: 1,
        uf_start: ufStart,
        uf_end: ufEnd,
        driver_name: driverName,
        driver_cpf: driverCpf,
        vehicle_plate: vehiclePlate,
        vehicle_rntrc: vehicleRntrc || undefined,
        insurance_company_name: insuranceName || undefined,
        insurance_policy_number: insurancePolicy || undefined,
        items: [
          {
            nfe_access_key: nfeAccessKey,
            cargo_value_brl: Number(cargoValue),
            weight_kg: Number(cargoWeight)
          }
        ]
      });

      if (res.success && res.data) {
        setSuccessMsg(`Rascunho de MDF-e Nº ${res.data.mdfe_number} criado com sucesso! Carga: R$ ${res.data.total_cargo_value_brl.toFixed(2)}`);
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        setError(res.error || 'Erro ao criar rascunho de MDF-e');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar rascunho');
    } finally {
      setSubmitting(false);
    }
  };

  // Autorizar SEFAZ
  const handleAuthorize = async (id: number) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await mdfeApi.authorize(id);
      if (res.success && res.data) {
        setSuccessMsg(`MDF-e Nº ${res.data.mdfe_number} autorizado pela SEFAZ com sucesso! Protocolo: ${res.data.sefaz_protocol}`);
        await loadData();
      } else {
        setError(res.error || 'Erro ao autorizar MDF-e');
      }
    } catch (err: any) {
      setError(err.message || 'Falha na transmissão SEFAZ');
    } finally {
      setLoading(false);
    }
  };

  // Ver DAMDFE
  const handleViewDamdfe = async (id: number) => {
    setError(null);
    try {
      const res = await mdfeApi.getDamdfe(id);
      if (res.success && res.data) {
        setDamdfeContent(res.data.damdfe_text);
        setIsDamdfeModalOpen(true);
      } else {
        setError(res.error || 'Erro ao carregar DAMDFE');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao buscar DAMDFE');
    }
  };

  // Abrir Modal de Encerramento
  const handleOpenCloseModal = (id: number) => {
    setTargetCloseId(id);
    setIsCloseModalOpen(true);
  };

  // Confirmar Encerramento
  const handleConfirmClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCloseId) return;

    setClosing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await mdfeApi.close(targetCloseId, {
        closure_reason: closureReason
      });

      if (res.success && res.data) {
        setSuccessMsg(`MDF-e Nº ${res.data.mdfe_number} encerrado no destino com sucesso! Veículo liberado para novas viagens.`);
        setIsCloseModalOpen(false);
        setTargetCloseId(null);
        await loadData();
      } else {
        setError(res.error || 'Erro ao encerrar MDF-e');
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar encerramento');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              MDF-e Transporte & Manifesto Fiscal (Modelo 58)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              Ajuste SINIEF 21/2010
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-400 border border-sky-800">
              SEFAZ / ANTT
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Agrupamento de NF-e de transferência, averbação de seguro de carga farmacêutica, emissão de DAMDFE e encerramento obrigatório no destino.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            data-testid="refresh-mdfe-btn"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition cursor-pointer"
          >
            {loading ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
          <button
            type="button"
            data-testid="open-create-mdfe-modal"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-sm transition cursor-pointer"
          >
            + Novo Manifesto de Carga
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div data-testid="mdfe-error-alert" className="p-4 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div data-testid="mdfe-success-alert" className="p-4 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-sm">
          {successMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div data-testid="kpi-total-manifests" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Total de Manifestos</span>
          <div className="text-2xl font-bold text-white mt-1">
            {kpis?.total_manifests ?? 0}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Emitidos no sistema</span>
        </div>

        <div data-testid="kpi-in-transit" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Cargas em Trânsito</span>
          <div className="text-2xl font-bold text-sky-400 mt-1">
            {kpis?.authorized_in_transit ?? 0}
          </div>
          <span className="text-xs text-emerald-400 mt-1 block">Autorizados na SEFAZ</span>
        </div>

        <div data-testid="kpi-closed" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Viagens Encerradas</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {kpis?.closed_count ?? 0}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Descarregamento OK</span>
        </div>

        <div data-testid="kpi-total-cargo" className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-400">Volume Transportado</span>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {(kpis?.total_transported_cargo_brl ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">{(kpis?.total_transported_weight_kg ?? 0).toFixed(2)} kg total</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center space-x-2 text-xs">
        <span className="text-slate-400">Filtrar por Status:</span>
        {['TODOS', 'DRAFT', 'AUTHORIZED', 'CLOSED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded-lg border font-medium transition cursor-pointer ${
              statusFilter === st
                ? 'bg-slate-800 text-white border-slate-600'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Nº / Série</th>
                <th className="px-4 py-3">Chave de Acesso</th>
                <th className="px-4 py-3">Rota</th>
                <th className="px-4 py-3">Condutor & Veículo</th>
                <th className="px-4 py-3">NF-e / Carga</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mdfes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                    Nenhum manifesto eletrônico encontrado. Crie um novo manifesto para agrupar as transferências.
                  </td>
                </tr>
              ) : (
                mdfes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-semibold text-white">
                      MDF-e {String(item.mdfe_number).padStart(6, '0')}
                      <span className="block text-xs font-normal text-slate-400">Série {item.series}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300 max-w-xs truncate" title={item.access_key}>
                      {item.access_key}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-200">{item.uf_start}</span>
                      <span className="text-slate-500 mx-1.5">➔</span>
                      <span className="font-semibold text-slate-200">{item.uf_end}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{item.driver_name}</div>
                      <div className="text-xs font-mono text-slate-400">{item.vehicle_plate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-emerald-400">
                        {item.total_cargo_value_brl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      <div className="text-xs text-slate-400">
                        {item.total_nfe_count} NF-e ({item.total_weight_kg.toFixed(2)} kg)
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          item.status === 'AUTHORIZED'
                            ? 'bg-sky-950 text-sky-300 border border-sky-800'
                            : item.status === 'CLOSED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : item.status === 'CANCELLED'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {item.status === 'DRAFT' && (
                        <button
                          type="button"
                          data-testid={`authorize-btn-${item.id}`}
                          onClick={() => handleAuthorize(item.id)}
                          className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          Transmitir SEFAZ
                        </button>
                      )}
                      {(item.status === 'AUTHORIZED' || item.status === 'CLOSED') && (
                        <button
                          type="button"
                          data-testid={`view-damdfe-btn-${item.id}`}
                          onClick={() => handleViewDamdfe(item.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                        >
                          DAMDFE
                        </button>
                      )}
                      {item.status === 'AUTHORIZED' && (
                        <button
                          type="button"
                          data-testid={`close-mdfe-btn-${item.id}`}
                          onClick={() => handleOpenCloseModal(item.id)}
                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          Encerrar Viagem
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar Rascunho */}
      {isCreateModalOpen && (
        <div data-testid="create-mdfe-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Novo Manifesto de Carga (MDF-e Modelo 58)</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">UF Origem</label>
                  <select
                    data-testid="mdfe-uf-start-select"
                    value={ufStart}
                    onChange={(e) => setUfStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="SP">São Paulo (SP)</option>
                    <option value="RJ">Rio de Janeiro (RJ)</option>
                    <option value="MG">Minas Gerais (MG)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">UF Destino</label>
                  <select
                    data-testid="mdfe-uf-end-select"
                    value={ufEnd}
                    onChange={(e) => setUfEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="RJ">Rio de Janeiro (RJ)</option>
                    <option value="MG">Minas Gerais (MG)</option>
                    <option value="SP">São Paulo (SP)</option>
                    <option value="PR">Paraná (PR)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Condutor</label>
                  <input
                    type="text"
                    data-testid="mdfe-driver-name-input"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">CPF do Condutor</label>
                  <input
                    type="text"
                    data-testid="mdfe-driver-cpf-input"
                    value={driverCpf}
                    onChange={(e) => setDriverCpf(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Placa do Veículo</label>
                  <input
                    type="text"
                    data-testid="mdfe-plate-input"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">RNTRC (ANTT)</label>
                  <input
                    type="text"
                    data-testid="mdfe-rntrc-input"
                    value={vehicleRntrc}
                    onChange={(e) => setVehicleRntrc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">NF-e de Transferência Agrupada</span>
                <div>
                  <label className="block text-[11px] text-slate-400">Chave de Acesso da NF-e (44 dígitos)</label>
                  <input
                    type="text"
                    data-testid="mdfe-nfe-key-input"
                    value={nfeAccessKey}
                    onChange={(e) => setNfeAccessKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 font-mono"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">Valor da Carga (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      data-testid="mdfe-cargo-val-input"
                      value={cargoValue}
                      onChange={(e) => setCargoValue(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">Peso Total (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      data-testid="mdfe-cargo-weight-input"
                      value={cargoWeight}
                      onChange={(e) => setCargoWeight(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-create-mdfe-btn"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {submitting ? 'Salvando...' : 'Salvar Rascunho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal DAMDFE */}
      {isDamdfeModalOpen && (
        <div data-testid="damdfe-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">DAMDFE - Documento Auxiliar do Manifesto</h3>
              <button
                type="button"
                data-testid="close-damdfe-modal-btn"
                onClick={() => setIsDamdfeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <pre data-testid="damdfe-content" className="bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-200 overflow-x-auto max-h-96 whitespace-pre">
              {damdfeContent}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsDamdfeModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Encerramento */}
      {isCloseModalOpen && (
        <div data-testid="close-mdfe-modal" className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Encerrar Viagem de MDF-e</h3>
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmClose} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Motivo do Encerramento</label>
                <textarea
                  data-testid="close-reason-input"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCloseModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  data-testid="confirm-close-btn"
                  disabled={closing}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition cursor-pointer"
                >
                  {closing ? 'Encerrando...' : 'Confirmar Encerramento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MdfePage;
