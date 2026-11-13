import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  FileSpreadsheet,
  Send,
  BookOpen,
  Printer,
  Download,
  Calendar,
  Search,
  AlertCircle,
  CheckCircle,
  FileText,
  User,
  Building,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react';
import { sngpcApi } from '../services/api';
import type {
  SngpcMovement,
  SngpcLivroRegistro,
  SngpcTransmission,
} from '../types';

type SngpcTab = 'MOVIMENTACOES' | 'LIVRO' | 'TRANSMISSAO';

export default function SngpcPage() {
  const [activeTab, setActiveTab] = useState<SngpcTab>('MOVIMENTACOES');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tab 1: Movimentações
  const [movements, setMovements] = useState<SngpcMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [filterType, setFilterType] = useState<string>('TODAS');
  const [filterTransmitted, setFilterTransmitted] = useState<string>('TODOS');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Tab 2: Livro de Registro
  const [livroStartDate, setLivroStartDate] = useState('');
  const [livroEndDate, setLivroEndDate] = useState('');
  const [livroData, setLivroData] = useState<SngpcLivroRegistro | null>(null);
  const [isLoadingLivro, setIsLoadingLivro] = useState(false);

  // Tab 3: Transmissão Semanal
  const [transmissions, setTransmissions] = useState<SngpcTransmission[]>([]);
  const [isLoadingTransmissions, setIsLoadingTransmissions] = useState(false);
  const [isGeneratingXml, setIsGeneratingXml] = useState(false);

  // Pharmacist form
  const [pharmacistName, setPharmacistName] = useState('DR. CARLOS EDUARDO SILVA');
  const [pharmacistCpf, setPharmacistCpf] = useState('12345678901');
  const [pharmacistCrf, setPharmacistCrf] = useState('12345');
  const [pharmacistCrfUf, setPharmacistCrfUf] = useState('SP');
  const [transmissionStartDate, setTransmissionStartDate] = useState('');
  const [transmissionEndDate, setTransmissionEndDate] = useState('');

  const loadMovements = useCallback(async () => {
    setIsLoadingMovements(true);
    setErrorMessage(null);
    try {
      const data = await sngpcApi.getMovements({
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        movementType: filterType !== 'TODAS' ? filterType : undefined,
        isTransmitted:
          filterTransmitted === 'TODOS'
            ? undefined
            : filterTransmitted === 'TRANSMITIDO'
            ? 1
            : 0,
      });
      setMovements(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar movimentações SNGPC.');
    } finally {
      setIsLoadingMovements(false);
    }
  }, [filterStartDate, filterEndDate, filterType, filterTransmitted]);

  const loadTransmissions = useCallback(async () => {
    setIsLoadingTransmissions(true);
    try {
      const data = await sngpcApi.getTransmissions();
      setTransmissions(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao listar transmissões SNGPC.');
    } finally {
      setIsLoadingTransmissions(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'MOVIMENTACOES') {
      loadMovements();
    } else if (activeTab === 'TRANSMISSAO') {
      loadTransmissions();
    }
  }, [activeTab, loadMovements, loadTransmissions]);

  const handleGenerateLivro = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!livroStartDate || !livroEndDate) {
      setErrorMessage('Informe a data inicial e a data final para consultar o livro.');
      return;
    }

    setIsLoadingLivro(true);
    setErrorMessage(null);
    try {
      const data = await sngpcApi.getLivroRegistro({
        startDate: livroStartDate,
        endDate: livroEndDate,
        productId: undefined,
      });
      setLivroData(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao carregar Livro de Registro.');
      setLivroData(null);
    } finally {
      setIsLoadingLivro(false);
    }
  };

  const handlePrintLivro = () => {
    window.print();
  };

  const handleGenerateWeeklyXml = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transmissionStartDate || !transmissionEndDate) {
      setErrorMessage('Informe o período (data inicial e data final) da transmissão.');
      return;
    }

    setIsGeneratingXml(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await sngpcApi.generateWeeklyXml({
        pharmacistName,
        pharmacistCpf,
        pharmacistCrf,
        pharmacistCrfUf,
        startDate: transmissionStartDate,
        endDate: transmissionEndDate,
      });

      setSuccessMessage(
        `Transmissão gerada com sucesso! ID #${result.transmissionId} (${result.movementsCount} movimentações incluídas, Hash: ${result.hashXml.substring(0, 10)}...).`
      );
      loadTransmissions();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar arquivo XML da transmissão SNGPC.');
    } finally {
      setIsGeneratingXml(false);
    }
  };

  const handleDownloadXml = async (id: number) => {
    try {
      const xml = await sngpcApi.downloadTransmissionXml(id);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mensagemSNGPC-${id}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar download do arquivo XML.');
    }
  };

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col overflow-y-auto print:bg-white print:text-black">
      {/* Header Banner - hidden in print */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded">
              ESTAÇÃO F4
            </span>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
              Controle Regulatório SNGPC & Livro de Controlados
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Conformidade com a Portaria SVS/MS nº 344/98 e transmissões semanais para a Anvisa.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'MOVIMENTACOES'}
            onClick={() => setActiveTab('MOVIMENTACOES')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center space-x-2 ${
              activeTab === 'MOVIMENTACOES'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Movimentações</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'LIVRO'}
            onClick={() => setActiveTab('LIVRO')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center space-x-2 ${
              activeTab === 'LIVRO'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Livro de Registro</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'TRANSMISSAO'}
            onClick={() => setActiveTab('TRANSMISSAO')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center space-x-2 ${
              activeTab === 'TRANSMISSAO'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Transmissão Semanal</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full print:p-0 print:m-0 print:max-w-none">
        {/* Messages - hidden in print */}
        {errorMessage && (
          <div className="p-4 bg-red-950/70 border border-red-800 text-red-200 rounded-xl flex items-center justify-between text-sm shadow-md print:hidden">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-950/70 border border-emerald-800 text-emerald-200 rounded-xl flex items-center justify-between text-sm shadow-md print:hidden">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ===================== TAB 1: MOVIMENTAÇÕES ===================== */}
        {activeTab === 'MOVIMENTACOES' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Tipo:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="TODAS">Todas as Movimentações</option>
                    <option value="ENTRADA">Entradas (NF-e)</option>
                    <option value="SAIDA_VENDA">Saídas (Vendas / Receitas)</option>
                    <option value="PERDA">Perdas / Avarias</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Status SNGPC:</span>
                  <select
                    value={filterTransmitted}
                    onChange={(e) => setFilterTransmitted(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  >
                    <option value="TODOS">Todos</option>
                    <option value="NAO_TRANSMITIDO">Pendente de Transmissão</option>
                    <option value="TRANSMITIDO">Transmitido à Anvisa</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">De:</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-xs text-slate-400">Até:</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                onClick={loadMovements}
                disabled={isLoadingMovements}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMovements ? 'animate-spin' : ''}`} />
                <span>Filtrar</span>
              </button>
            </div>

            {/* Movements Grid */}
            <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Reg. Anvisa MS</th>
                    <th className="py-2.5 px-4">Referência / Doc</th>
                    <th className="py-2.5 px-4 text-right">Qtd</th>
                    <th className="py-2.5 px-4 text-center">Status Transmissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoadingMovements ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Carregando movimentações regulatórias...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma movimentação sanitária registrada para o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {mov.movementDate}
                        </td>
                        <td className="py-3 px-4">
                          {mov.movementType === 'ENTRADA' && (
                            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-semibold text-[10px]">
                              ENTRADA
                            </span>
                          )}
                          {mov.movementType === 'SAIDA_VENDA' && (
                            <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded font-semibold text-[10px]">
                              SAIDA_VENDA
                            </span>
                          )}
                          {mov.movementType === 'PERDA' && (
                            <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded font-semibold text-[10px]">
                              PERDA
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-200">
                          {mov.msRegistration}
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                          {mov.referenceType} #{mov.referenceId}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {mov.quantity}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {mov.isTransmitted === 1 ? (
                            <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded-full text-[10px] font-semibold">
                              Transmitido (Lote #{mov.transmissionId})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-800 text-amber-400 border border-slate-700 rounded-full text-[10px] font-semibold">
                              Pendente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: LIVRO DE REGISTRO (PORTARIA 344/98) ===================== */}
        {activeTab === 'LIVRO' && (
          <div className="space-y-6">
            {/* Filter Bar - hidden in print */}
            <form
              onSubmit={handleGenerateLivro}
              className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 print:hidden"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="livro-start-date" className="text-xs text-slate-400 font-semibold">
                    Data Inicial:
                  </label>
                  <input
                    id="livro-start-date"
                    aria-label="Data Inicial"
                    type="date"
                    value={livroStartDate}
                    onChange={(e) => setLivroStartDate(e.target.value)}
                    required
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <label htmlFor="livro-end-date" className="text-xs text-slate-400 font-semibold">
                    Data Final:
                  </label>
                  <input
                    id="livro-end-date"
                    aria-label="Data Final"
                    type="date"
                    value={livroEndDate}
                    onChange={(e) => setLivroEndDate(e.target.value)}
                    required
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleGenerateLivro}
                  disabled={isLoadingLivro}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                >
                  {isLoadingLivro ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Consultar Livro</span>
                </button>

                {livroData && (
                  <button
                    type="button"
                    onClick={handlePrintLivro}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition border border-slate-700 flex items-center space-x-2"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Livro</span>
                  </button>
                )}
              </div>
            </form>

            {/* Print View & Inspection Container */}
            {livroData ? (
              <div className="bg-white text-slate-900 p-8 rounded-xl shadow-lg border border-slate-200 print:shadow-none print:border-none print:p-0 space-y-6">
                {/* Official Header */}
                <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                  <h2 className="text-lg font-bold uppercase tracking-wider">
                    Livro de Registro Específico de Medicamentos Controlados
                  </h2>
                  <p className="text-xs font-semibold text-slate-600">
                    Em conformidade com a Portaria SVS/MS nº 344/1998 e Resolução RDC nº 22/2014 - Anvisa
                  </p>
                  <div className="flex flex-wrap justify-center gap-x-6 text-xs text-slate-700 pt-2 font-mono">
                    <span>
                      <strong>Estabelecimento:</strong> {livroData.pharmacyName}
                    </span>
                    <span>
                      <strong>CNPJ:</strong> {livroData.pharmacyCnpj}
                    </span>
                    <span>
                      <strong>Resp. Técnico:</strong> {livroData.pharmacistName} (CRF-{livroData.pharmacistCrfUf} {livroData.pharmacistCrf})
                    </span>
                  </div>
                </div>

                {/* Opening Term */}
                {livroData.openingTerm && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs leading-relaxed italic text-slate-700">
                    {livroData.openingTerm}
                  </div>
                )}

                {/* Movements Ledger Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                        <th className="py-2 px-2 border border-slate-300">Data</th>
                        <th className="py-2 px-2 border border-slate-300">Doc / NF</th>
                        <th className="py-2 px-2 border border-slate-300">Medicamento / Reg. MS</th>
                        <th className="py-2 px-2 border border-slate-300">Lote</th>
                        <th className="py-2 px-2 border border-slate-300 text-right">Saldo Ant.</th>
                        <th className="py-2 px-2 border border-slate-300 text-right">Entrada</th>
                        <th className="py-2 px-2 border border-slate-300 text-right">Saída</th>
                        <th className="py-2 px-2 border border-slate-300 text-right">Saldo Atual</th>
                        <th className="py-2 px-2 border border-slate-300">Prescritor / Comprador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {livroData.items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-500">
                            Sem movimentações no período selecionado.
                          </td>
                        </tr>
                      ) : (
                        livroData.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2 border border-slate-300 font-mono">{it.date}</td>
                            <td className="py-1.5 px-2 border border-slate-300 font-mono">{it.documentNumber}</td>
                            <td className="py-1.5 px-2 border border-slate-300">
                              <span className="font-bold block">{it.productName}</span>
                              <span className="text-[10px] text-slate-600 font-mono">MS: {it.msRegistration}</span>
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 font-mono">{it.batchNumber}</td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{it.initialBalance}</td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono font-semibold text-emerald-700">
                              {it.entryQuantity > 0 ? it.entryQuantity : '-'}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono font-semibold text-red-700">
                              {it.exitQuantity > 0 ? it.exitQuantity : '-'}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-right font-mono font-bold bg-slate-50">
                              {it.finalBalance}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-[11px]">
                              {it.doctorName && (
                                <div className="text-slate-800">
                                  Méd: {it.doctorName} (CRM-{it.doctorUf} {it.doctorCrm})
                                </div>
                              )}
                              {it.buyerName && (
                                <div className="text-slate-600">
                                  Comp: {it.buyerName} (CPF: {it.buyerCpf})
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Closing Term */}
                {livroData.closingTerm && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs leading-relaxed italic text-slate-700">
                    {livroData.closingTerm}
                  </div>
                )}

                {/* Signatures */}
                <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                  <div>
                    <div className="border-t border-slate-400 pt-1 w-64 mx-auto font-bold">
                      {livroData.pharmacistName}
                    </div>
                    <span className="text-slate-600 block">
                      Farmacêutico(a) Responsável Técnico — CRF-{livroData.pharmacistCrfUf} {livroData.pharmacistCrf}
                    </span>
                  </div>

                  <div>
                    <div className="border-t border-slate-400 pt-1 w-64 mx-auto font-bold">
                      Autoridade Sanitária Local (VISA)
                    </div>
                    <span className="text-slate-600 block">Visto / Fiscalização</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <h3 className="font-semibold text-slate-300">Nenhum livro gerado</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Selecione o período acima e clique em &quot;Consultar Livro&quot; para carregar o extrato
                  com termos oficiais de abertura e encerramento.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: TRANSMISSÃO SEMANAL ANVISA ===================== */}
        {activeTab === 'TRANSMISSAO' && (
          <div className="space-y-6">
            {/* Transmission Generator Form */}
            <div className="bg-slate-950/60 p-6 rounded-xl border border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center space-x-2 mb-4">
                <Send className="w-4 h-4 text-purple-400" />
                <span>Nova Transmissão Semanal Anvisa (SNGPC)</span>
              </h2>

              <form onSubmit={handleGenerateWeeklyXml} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      Nome do Farmacêutico:
                    </label>
                    <input
                      type="text"
                      aria-label="Nome do Farmacêutico"
                      value={pharmacistName}
                      onChange={(e) => setPharmacistName(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">
                      CPF do Farmacêutico:
                    </label>
                    <input
                      type="text"
                      aria-label="CPF do Farmacêutico"
                      value={pharmacistCpf}
                      onChange={(e) => setPharmacistCpf(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">CRF:</label>
                    <input
                      type="text"
                      aria-label="CRF"
                      value={pharmacistCrf}
                      onChange={(e) => setPharmacistCrf(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">UF do CRF:</label>
                    <input
                      type="text"
                      aria-label="UF do CRF"
                      value={pharmacistCrfUf}
                      onChange={(e) => setPharmacistCrfUf(e.target.value)}
                      required
                      maxLength={2}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 uppercase focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Data Inicial:</label>
                    <input
                      type="date"
                      aria-label="Data Inicial"
                      value={transmissionStartDate}
                      onChange={(e) => setTransmissionStartDate(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Data Final:</label>
                    <input
                      type="date"
                      aria-label="Data Final"
                      value={transmissionEndDate}
                      onChange={(e) => setTransmissionEndDate(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateWeeklyXml}
                    disabled={isGeneratingXml}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center space-x-2 shadow-sm"
                  >
                    {isGeneratingXml ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando XML...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Gerar Arquivo SNGPC</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Transmissions History Table */}
            <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300">
                  Histórico de Arquivos XML de Transmissão
                </h3>
                <button
                  onClick={loadTransmissions}
                  className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Atualizar</span>
                </button>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 text-slate-400 font-semibold border-b border-slate-800">
                    <th className="py-2.5 px-4">ID</th>
                    <th className="py-2.5 px-4">Período</th>
                    <th className="py-2.5 px-4">Farmacêutico Responsável</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Hash SHA-1</th>
                    <th className="py-2.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {isLoadingTransmissions ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Carregando transmissões...
                      </td>
                    </tr>
                  ) : transmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma transmissão SNGPC gerada.
                      </td>
                    </tr>
                  ) : (
                    transmissions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">#{t.id}</td>
                        <td className="py-3 px-4 text-slate-200">
                          {t.startDate} a {t.endDate}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-200 block">{t.pharmacistName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            CRF-{t.pharmacistCrfUf} {t.pharmacistCrf}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded font-semibold text-[10px]">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {t.hashXml}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDownloadXml(t.id)}
                            className="px-3 py-1 bg-purple-950 hover:bg-purple-900 text-purple-300 hover:text-white rounded border border-purple-800 transition flex items-center space-x-1 mx-auto text-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download XML</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
