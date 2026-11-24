import React, { useState, useEffect, useCallback } from 'react';
import {
  Scissors,
  CheckCircle,
  AlertCircle,
  FileText,
  Printer,
  Search,
  Plus,
  RefreshCw,
  Package,
  UserCheck,
  ShieldCheck,
  DollarSign,
  Info,
} from 'lucide-react';
import { fractionationApi } from '../services/api';
import {
  FractionableProduct,
  FractionationRecord,
  FractionationDispensation,
  FractionationKpis,
} from '../types/fractionation';

export const FractionationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fractionate' | 'dispense' | 'catalog'>('fractionate');
  const [kpis, setKpis] = useState<FractionationKpis | null>(null);
  const [records, setRecords] = useState<FractionationRecord[]>([]);
  const [products, setProducts] = useState<FractionableProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form Fracionamento
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');
  const [pharmacistName, setPharmacistName] = useState('Dra. Camila Farmacêutica');
  const [pharmacistCrf, setPharmacistCrf] = useState('99887');
  const [pharmacistCrfUf, setPharmacistCrfUf] = useState('SP');
  const [packagesToOpen, setPackagesToOpen] = useState<number>(1);
  const [fracNotes, setFracNotes] = useState('');

  // Form Dispensação
  const [dispenseRecordId, setDispenseRecordId] = useState<number | ''>('');
  const [patientName, setPatientName] = useState('Sr. José Ferreira');
  const [patientCpf, setPatientCpf] = useState('111.222.333-44');
  const [doctorName, setDoctorName] = useState('Dr. Roberto Santos');
  const [doctorCrm, setDoctorCrm] = useState('11223');
  const [doctorUf, setDoctorUf] = useState('SP');
  const [unitsToDispense, setUnitsToDispense] = useState<number>(10);
  const [posology, setPosology] = useState('Tomar 1 cápsula de 8 em 8 horas por 7 dias');
  const [leafletSupplied, setLeafletSupplied] = useState(true);

  // Modal Rótulo
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [thermalLabelText, setThermalLabelText] = useState('');
  const [lastDispensation, setLastDispensation] = useState<FractionationDispensation | null>(null);

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [kpiRes, recList, prodList] = await Promise.all([
        fractionationApi.getFractionationKpis(),
        fractionationApi.listFractionationRecords(),
        fractionationApi.listFractionableProducts(),
      ]);
      setKpis(kpiRes);
      setRecords(recList);
      setProducts(prodList);
      if (prodList.length > 0 && selectedProductId === '') {
        setSelectedProductId(prodList[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de fracionamento:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProduct = products.find((p) => p.id === Number(selectedProductId));

  // Submit Fracionamento
  const handleFractionate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    try {
      await fractionationApi.fractionateMedicine({
        store_id: 1,
        product_id: Number(selectedProductId),
        original_batch_id: selectedBatchId ? Number(selectedBatchId) : 1,
        pharmacist_name: pharmacistName,
        pharmacist_crf: pharmacistCrf,
        pharmacist_crf_uf: pharmacistCrfUf,
        original_packages_opened: Number(packagesToOpen),
        notes: fracNotes,
      });

      setFracNotes('');
      loadData();
      alert('Fracionamento executado com sucesso e sublote gerado!');
    } catch (err: any) {
      alert(`Erro ao fracionar: ${err.message}`);
    }
  };

  // Submit Dispensação
  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseRecordId) {
      alert('Selecione um sublote para dispensação');
      return;
    }

    try {
      const disp = await fractionationApi.dispenseFractioned({
        fractionation_record_id: Number(dispenseRecordId),
        patient_name: patientName,
        patient_cpf: patientCpf,
        doctor_name: doctorName,
        doctor_crm: doctorCrm,
        doctor_uf: doctorUf,
        units_dispensed: Number(unitsToDispense),
        posology,
        leaflet_supplied: leafletSupplied,
      });

      setLastDispensation(disp);
      const labelRes = await fractionationApi.getOfficialLabel(disp.id);
      setThermalLabelText(labelRes.labelText);
      setIsLabelModalOpen(true);
      loadData();
    } catch (err: any) {
      alert(`Erro na dispensação: ${err.message}`);
    }
  };

  // Toggle Fracionabilidade de Produto
  const handleToggleProduct = async (prod: FractionableProduct) => {
    try {
      const nextStatus = prod.is_fractionable === 1 ? false : true;
      await fractionationApi.toggleProductFractionable(prod.id, {
        isFractionable: nextStatus,
        unitsPerPackage: prod.units_per_package || 1,
        fractionalUnit: prod.fractional_unit || 'COMPRIMIDO',
      });
      loadData();
    } catch (err: any) {
      alert(`Erro ao atualizar produto: ${err.message}`);
    }
  };

  const selectedRecordForDispense = records.find((r) => r.id === Number(dispenseRecordId));

  return (
    <div className="flex-1 bg-slate-50 min-h-screen p-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-700 text-white rounded-xl shadow-md">
              <Scissors className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Fracionamento Farmacêutico em Blíster
              </h1>
              <p className="text-sm text-slate-500">
                Dispensação Individualizada em Quantidade Exata & Conformidade Sanitária RDC 80/2006 ANVISA
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Fracionamentos</span>
            <Scissors className="w-5 h-5 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.totalFractionations ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Lotes desmembrados</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Sublotes em Aberto</span>
            <Package className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.activeSubBatches ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Disponíveis na bancada</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Unidades em Saldo</span>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.totalUnitsAvailable ?? 0}
          </div>
          <div className="text-xs text-emerald-600 mt-1">Comprimidos / Doses</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Dispensações (RDC 80)</span>
            <UserCheck className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis?.totalDispensations ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Com receita e bula</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-sm font-medium">Economia ao Paciente</span>
            <DollarSign className="w-5 h-5 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            R$ {kpis?.estimatedConsumerSavings.toFixed(2) ?? '0.00'}
          </div>
          <div className="text-xs text-teal-600 mt-1">Custo evitado de sobras</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('fractionate')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'fractionate'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Bancada de Fracionamento & Sublotes</span>
        </button>

        <button
          onClick={() => setActiveTab('dispense')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'dispense'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Dispensação & Rótulo Oficial RDC 80</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm border-b-2 transition ${
            activeTab === 'catalog'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Catálogo de Embalagens Fracionáveis</span>
        </button>
      </div>

      {/* TAB 1: BANCADA DE FRACIONAMENTO */}
      {activeTab === 'fractionate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário de Execução */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Scissors className="w-5 h-5 text-sky-600" />
              <span>Novo Fracionamento</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Rompimento controlado da embalagem secundária com preservação da embalagem primária (blíster picotado) e emissão de sublote rastreável.
            </p>

            <form onSubmit={handleFractionate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medicamento com Registro Fracionável
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.units_per_package} {p.fractional_unit}s/caixa)
                    </option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 text-xs text-sky-900 space-y-1">
                  <div><strong>DCB / Substância:</strong> {selectedProduct.active_ingredient || 'Não informada'}</div>
                  <div><strong>Registro MS:</strong> {selectedProduct.ms_registration || 'Isento'}</div>
                  <div><strong>Preço da Caixa:</strong> R$ {selectedProduct.price.toFixed(2)}</div>
                  <div>
                    <strong>Preço Proporcional por Unidade:</strong> R${' '}
                    {(selectedProduct.price / selectedProduct.units_per_package).toFixed(2)}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Caixas a Abrir</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={packagesToOpen}
                    onChange={(e) => setPackagesToOpen(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unidades Geradas</label>
                  <input
                    type="text"
                    readOnly
                    value={`${packagesToOpen * (selectedProduct?.units_per_package || 1)} ${selectedProduct?.fractional_unit || 'un'}`}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-sm font-bold text-slate-700"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="text-xs font-bold text-slate-700 mb-2">Farmacêutico(a) Responsável Técnico</h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome completo do Farmacêutico"
                    value={pharmacistName}
                    onChange={(e) => setPharmacistName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Número CRF"
                      value={pharmacistCrf}
                      onChange={(e) => setPharmacistCrf(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      maxLength={2}
                      required
                      placeholder="UF CRF"
                      value={pharmacistCrfUf}
                      onChange={(e) => setPharmacistCrfUf(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observações da Operação</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Integridade dos alvéolos verificada em bancada limpa..."
                  value={fracNotes}
                  onChange={(e) => setFracNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg shadow-sm text-sm transition"
              >
                Executar Fracionamento & Gerar Sublote
              </button>
            </form>
          </div>

          {/* Lista de Sublotes Ativos */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-md font-bold text-slate-900">Sublotes Fracionados Disponíveis para Dispensação</h3>
              <p className="text-xs text-slate-500">Unidades individualizadas com rastreabilidade total de lote e validade original.</p>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Sublote / Produto</th>
                    <th className="py-3 px-4">Lote Original</th>
                    <th className="py-3 px-4">Validade</th>
                    <th className="py-3 px-4">Saldo em Estoque</th>
                    <th className="py-3 px-4">Farmacêutico RT</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Nenhum fracionamento registrado ainda.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="font-mono text-xs font-bold text-sky-700">{r.sub_batch_code}</div>
                          <div className="font-semibold text-slate-900">{r.product_name}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {r.original_batch_number || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-800">
                          {r.expiry_date}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            r.units_available > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {r.units_available} / {r.units_generated} un
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>{r.pharmacist_name}</div>
                          <div className="text-slate-400">CRF {r.pharmacist_crf}/{r.pharmacist_crf_uf}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setDispenseRecordId(r.id);
                              setActiveTab('dispense');
                            }}
                            disabled={r.units_available === 0}
                            className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-semibold transition"
                          >
                            Dispensar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DISPENSAÇÃO & RÓTULO OFICIAL */}
      {activeTab === 'dispense' && (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Dispensação ao Paciente & Rótulo RDC 80/2006</h2>
              <p className="text-xs text-slate-500">Validação da prescrição, cálculo proporcional e emissão de embalagem secundária inviolável.</p>
            </div>
          </div>

          <form onSubmit={handleDispense} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sublote Fracionado de Origem
              </label>
              <select
                required
                value={dispenseRecordId}
                onChange={(e) => setDispenseRecordId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Selecione o sublote...</option>
                {records
                  .filter((r) => r.units_available > 0)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.sub_batch_code} — {r.product_name} (Saldo: {r.units_available} un | Val: {r.expiry_date})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Paciente</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF do Paciente</label>
                <input
                  type="text"
                  value={patientCpf}
                  onChange={(e) => setPatientCpf(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Médico Prescritor</label>
                <input
                  type="text"
                  required
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CRM</label>
                <input
                  type="text"
                  required
                  value={doctorCrm}
                  onChange={(e) => setDoctorCrm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UF CRM</label>
                <input
                  type="text"
                  maxLength={2}
                  required
                  value={doctorUf}
                  onChange={(e) => setDoctorUf(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantidade Prescrita a Dispensar
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={unitsToDispense}
                  onChange={(e) => setUnitsToDispense(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Posologia Prescrita
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tomar 1 comprimido a cada 12 horas..."
                  value={posology}
                  onChange={(e) => setPosology(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={leafletSupplied}
                  onChange={(e) => setLeafletSupplied(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span className="text-xs font-bold text-amber-900">
                  Compromisso Sanitário: Cópia da bula oficial fornecida ao paciente (RDC 80/2006 Art. 8º)
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg shadow-sm text-sm transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Concluir Dispensação & Emitir Rótulo Térmico</span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CATÁLOGO DE FRACIONÁVEIS */}
      {activeTab === 'catalog' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Medicamentos com Embalagem Fracionável Registrada</h2>
            <p className="text-xs text-slate-500">
              Apenas medicamentos aprovados pela ANVISA com blíster picotado e dados de lote/validade impressos em cada alvéolo podem ser fracionados.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Medicamento</th>
                  <th className="py-3 px-4">DCB / Substância</th>
                  <th className="py-3 px-4">Registro MS</th>
                  <th className="py-3 px-4">Unidades / Caixa</th>
                  <th className="py-3 px-4">Preço Caixa</th>
                  <th className="py-3 px-4">Fracionável</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{p.active_ingredient || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs">{p.ms_registration || '—'}</td>
                    <td className="py-3 px-4">
                      {p.units_per_package} {p.fractional_unit}s
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">R$ {p.price.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        p.is_fractionable === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.is_fractionable === 1 ? 'Habilitado' : 'Desabilitado'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleProduct(p)}
                        className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded text-xs font-medium"
                      >
                        {p.is_fractionable === 1 ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL RÓTULO TÉRMICO */}
      {isLabelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sky-700 font-bold">
                <Printer className="w-5 h-5" />
                <span>Rótulo Térmico Oficial (RDC 80/2006)</span>
              </div>
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                {thermalLabelText}
              </pre>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(thermalLabelText);
                  alert('Rótulo copiado para a área de transferência!');
                }}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-lg text-sm shadow-sm"
              >
                Copiar / Imprimir Térmica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FractionationPage;
