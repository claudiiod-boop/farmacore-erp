import React, { useState, useEffect } from 'react';
import {
  cmedApi,
  type CmedProduct,
  type CmedPricingRule,
  type CmedPricingAuditReport,
  type CmedPriceAuditItem,
} from '../services/api';

type Tab = 'audit' | 'search' | 'rules' | 'import';

export const CmedPricingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('audit');
  const [auditReport, setAuditReport] = useState<CmedPricingAuditReport | null>(null);
  const [icmsRate, setIcmsRate] = useState<number>(18.0);
  const [cmedSearchResults, setCmedSearchResults] = useState<CmedProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pricingRules, setPricingRules] = useState<CmedPricingRule[]>([]);

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State: Nova Regra
  const [selectedCategory, setSelectedCategory] = useState<'GENERICO' | 'SIMILAR' | 'REFERENCIA' | 'MIP' | 'PERFUMARIA'>('GENERICO');
  const [ruleDiscountPmc, setRuleDiscountPmc] = useState('35.0');
  const [ruleMinMargin, setRuleMinMargin] = useState('20.0');

  // Form State: Importação CMED
  const [importVersionCode, setImportVersionCode] = useState('CMED-2026-11');
  const [importCsvText, setImportCsvText] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [icmsRate]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const rep = await cmedApi.runAudit(1, icmsRate);
      setAuditReport(rep);
      const rules = await cmedApi.getRules(1);
      setPricingRules(rules);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCmed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    try {
      setLoading(true);
      setMessage(null);
      const res = await cmedApi.searchCmedProducts(searchTerm.trim(), 50);
      setCmedSearchResults(res);
      if (res.length === 0) {
        setMessage({ type: 'error', text: 'Nenhum medicamento localizado na base CMED ativa.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao consultar base CMED' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      await cmedApi.saveRule({
        storeId: 1,
        categoryType: selectedCategory,
        discountPercentPmc: Number(ruleDiscountPmc) || 0,
        minGrossMarginPercent: Number(ruleMinMargin) || 15,
        enforcePmcCap: true,
      });

      setMessage({
        type: 'success',
        text: `Regra de precificação para ${selectedCategory} salva com sucesso!`,
      });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao salvar regra' });
    } finally {
      setLoading(false);
    }
  };

  // Correção em lote de produtos acima do PMC
  const handleFixAllAbovePmc = async () => {
    if (!auditReport) return;
    const infratores = auditReport.items.filter((i) => i.status === 'ABOVE_PMC');
    if (infratores.length === 0) {
      setMessage({ type: 'success', text: 'Nenhum produto acima do teto PMC no momento!' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const updates = infratores.map((item) => ({
        productId: item.productId,
        newPrice: item.pmcAllowed,
        reason: `Ajuste sanitário obrigatório: redução ao teto PMC (R$ ${item.pmcAllowed.toFixed(2)})`,
      }));

      const res = await cmedApi.applyUpdates(1, updates, 'FARMACEUTICO_RESP');
      setMessage({ type: 'success', text: res.message });
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar preços' });
    } finally {
      setLoading(false);
    }
  };

  // Importar CSV CMED
  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCsvText.trim()) {
      setMessage({ type: 'error', text: 'Cole o conteúdo do CSV oficial da CMED.' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      const res = await cmedApi.importCmedFile({
        versionCode: importVersionCode,
        fileContent: importCsvText,
      });

      setMessage({
        type: 'success',
        text: `Base CMED ${res.versionCode} importada com sucesso: ${res.importedCount} medicamentos carregados!`,
      });
      setImportCsvText('');
      await loadInitialData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao importar arquivo CMED' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Tabela CMED / ANVISA & Precificação</h1>
            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-red-300">
              Trava Sanitária Inviolável (Lei 10.742/2003)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestão regulatória de Preço Máximo ao Consumidor (PMC), Preço Fábrica (PF), enquadramento tributário (PIS/COFINS Monofásico) e regras de margem comercial.
          </p>
        </div>

        {/* Seletor de Alíquota de ICMS Estadual */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-md border border-slate-200">
          <label className="text-xs font-bold text-slate-600 uppercase">ICMS da Loja:</label>
          <select
            className="text-sm font-bold border-slate-300 rounded px-2.5 py-1 bg-white text-slate-700"
            value={icmsRate}
            onChange={(e) => setIcmsRate(Number(e.target.value))}
          >
            <option value={12}>12% (SP genéricos / outros estados)</option>
            <option value={17}>17% (DF, GO, MT, MS, ES, RS, SC)</option>
            <option value={17.5}>17.5% (RO)</option>
            <option value={18}>18% (SP padrão, MG, PR)</option>
            <option value={19}>19% (AC, AL, PA)</option>
            <option value={20}>20% (RJ, CE, PB, PE, RN, SE, TO)</option>
            <option value={20.5}>20.5% (PI, BA)</option>
            <option value={21}>21% (MA)</option>
            <option value={22}>22% (AM)</option>
          </select>
        </div>
      </div>

      {/* Alerta de Feedback */}
      {message && (
        <div
          className={`p-4 rounded-md text-sm font-medium flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-300'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold underline text-xs">
            Fechar
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'audit'
              ? 'border-red-600 text-red-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          1. Auditoria Sanitária & Trava PMC
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'search'
              ? 'border-red-600 text-red-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          2. Consulta Base Oficial CMED / ANVISA
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'rules'
              ? 'border-red-600 text-red-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          3. Regras de Precificação por Categoria
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 px-4 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'import'
              ? 'border-red-600 text-red-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          4. Importador da Tabela CMED (CSV)
        </button>
      </div>

      {/* Conteúdo Aba 1: Auditoria Sanitária & Trava PMC */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Cards de Métricas Sanitárias */}
          {auditReport && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <span className="text-xs font-semibold text-slate-500 uppercase">Total Auditado</span>
                <div className="text-2xl font-bold text-slate-800 mt-1">
                  {auditReport.totalProductsAudited}
                </div>
                <span className="text-[11px] text-slate-400">Produtos no catálogo ativo</span>
              </div>

              <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-300">
                <span className="text-xs font-semibold text-red-700 uppercase">Acima do Teto PMC</span>
                <div className="text-2xl font-bold text-red-700 mt-1">
                  {auditReport.nonCompliantAbovePmcCount}
                </div>
                <span className="text-[11px] text-red-600 font-semibold">Infração Sanitária Gravíssima</span>
              </div>

              <div className="bg-amber-50 p-4 rounded-lg shadow-sm border border-amber-300">
                <span className="text-xs font-semibold text-amber-700 uppercase">Margem Baixa</span>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {auditReport.lowMarginCount}
                </div>
                <span className="text-[11px] text-amber-600">Abaixo da margem pretendida</span>
              </div>

              <div className="bg-emerald-50 p-4 rounded-lg shadow-sm border border-emerald-300">
                <span className="text-xs font-semibold text-emerald-700 uppercase">Em Conformidade</span>
                <div className="text-2xl font-bold text-emerald-700 mt-1">
                  {auditReport.compliantCount}
                </div>
                <span className="text-[11px] text-emerald-600">Preços regulamentados</span>
              </div>
            </div>
          )}

          {/* Ação de Correção em Lote */}
          {auditReport && auditReport.nonCompliantAbovePmcCount > 0 && (
            <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-red-900">
                  Atenção: Existem {auditReport.nonCompliantAbovePmcCount} produto(s) com preço acima do teto regulamentar da CMED!
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  Praticar preço superior ao PMC acarreta autuação pela ANVISA e PROCON com base na Lei 10.742/2003 e CDC.
                </p>
              </div>
              <button
                onClick={handleFixAllAbovePmc}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded shadow-sm whitespace-nowrap"
              >
                Corrigir Todos para o Teto PMC
              </button>
            </div>
          )}

          {/* Tabela de Auditoria */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Diagnóstico de Auditoria do Catálogo da Loja</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="p-3">EAN</th>
                    <th className="p-3">Medicamento</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Lista PIS</th>
                    <th className="p-3 text-right">Preço Atual</th>
                    <th className="p-3 text-right">Teto PMC ({icmsRate}%)</th>
                    <th className="p-3 text-right">Diferença</th>
                    <th className="p-3 text-right">Margem</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditReport?.items.map((item: CmedPriceAuditItem) => (
                    <tr key={item.productId} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-600">{item.ean}</td>
                      <td className="p-3 font-medium text-slate-800">{item.productName}</td>
                      <td className="p-3">{item.productType || '-'}</td>
                      <td className="p-3">
                        <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.listType || 'NEUTRA'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">
                        R$ {item.currentSalePrice.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-slate-700">
                        R$ {item.pmcAllowed.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        {item.priceExcessAmount > 0 ? (
                          <span className="font-bold text-red-600">+R$ {item.priceExcessAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">R$ 0.00</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-700">
                        {item.currentMarginPercent.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            item.status === 'ABOVE_PMC'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : item.status === 'MARGIN_TOO_LOW'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!auditReport || auditReport.items.length === 0) && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400">
                        Nenhum produto cadastrado para auditoria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Aba 2: Consulta Base Oficial CMED */}
      {activeTab === 'search' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <form onSubmit={handleSearchCmed} className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:ring-red-500 focus:border-red-500"
              placeholder="Digite o nome do medicamento, princípio ativo ou código de barras EAN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-red-600 text-white font-semibold px-6 py-2 rounded hover:bg-red-700 shadow-sm text-sm"
            >
              Consultar CMED
            </button>
          </form>

          <div className="overflow-x-auto pt-2">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                  <th className="p-3">EAN</th>
                  <th className="p-3">Medicamento / Apresentação</th>
                  <th className="p-3">Substância Ativa</th>
                  <th className="p-3">Laboratório</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Lista</th>
                  <th className="p-3 text-right">PF ({icmsRate}%)</th>
                  <th className="p-3 text-right">PMC ({icmsRate}%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cmedSearchResults.map((prod) => (
                  <tr key={prod.id || prod.ean} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-600">{prod.ean}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{prod.product_name}</div>
                      <div className="text-[10px] text-slate-500">{prod.presentation}</div>
                    </td>
                    <td className="p-3 text-slate-700">{prod.substance_name}</td>
                    <td className="p-3 text-slate-600">{prod.laboratory_name}</td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-700">{prod.product_type}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          prod.list_type === 'POSITIVA'
                            ? 'bg-blue-100 text-blue-800'
                            : prod.list_type === 'NEGATIVA'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {prod.list_type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-medium text-slate-700">
                      R$ {((prod.pf_18 || 0)).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-red-700">
                      R$ {((prod.pmc_18 || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {cmedSearchResults.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Utilize a barra de pesquisa acima para consultar a base oficial de medicamentos da CMED.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conteúdo Aba 3: Regras de Precificação por Categoria */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveRule} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">Configurar Regra Comercial por Categoria</h2>
              <p className="text-xs text-slate-500">
                Define políticas de desconto médio sobre o PMC e margem mínima garantida sobre o Preço Fábrica (PF).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria de Medicamento *</label>
                <select
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as any)}
                >
                  <option value="GENERICO">Medicamentos Genéricos (Lei 9.787/99)</option>
                  <option value="SIMILAR">Medicamentos Similares</option>
                  <option value="REFERENCIA">Medicamentos de Referência (Marca)</option>
                  <option value="MIP">MIPs (Isentos de Prescrição)</option>
                  <option value="PERFUMARIA">Perfumaria e Cosméticos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Desconto Padrão sobre PMC (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: 35.0"
                  value={ruleDiscountPmc}
                  onChange={(e) => setRuleDiscountPmc(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Margem Bruta Mínima (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder="Ex: 20.0"
                  value={ruleMinMargin}
                  onChange={(e) => setRuleMinMargin(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-red-700 shadow-sm transition-colors text-sm"
              >
                Salvar Política de Precificação
              </button>
            </div>
          </form>

          {/* Listagem de Regras Cadastradas */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3">Políticas Comerciais Ativas na Loja</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Desconto sobre PMC</th>
                    <th className="p-3 text-right">Margem Mínima</th>
                    <th className="p-3 text-center">Trava Sanitária PMC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pricingRules.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{r.categoryType}</td>
                      <td className="p-3 text-right font-medium text-blue-700">
                        {r.discountPercentPmc.toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-medium text-emerald-700">
                        {r.minGrossMarginPercent.toFixed(1)}%
                      </td>
                      <td className="p-3 text-center">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          ATIVADA (OBRIGATÓRIA)
                        </span>
                      </td>
                    </tr>
                  ))}
                  {pricingRules.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-400">
                        Nenhuma política configurada. Utilizando parâmetros padrão da CMED.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Aba 4: Importador da Tabela CMED */}
      {activeTab === 'import' && (
        <form onSubmit={handleImportCsv} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800">Carga da Tabela Mensal da ANVISA (CMED)</h2>
            <p className="text-xs text-slate-500">
              Importação do arquivo oficial disponibilizado mensalmente pela Câmara de Regulação do Mercado de Medicamentos.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Código da Versão / Mês de Referência *</label>
            <input
              type="text"
              className="w-full md:w-64 border border-slate-300 rounded px-3 py-2 text-sm"
              placeholder="Ex: CMED-2026-11"
              value={importVersionCode}
              onChange={(e) => setImportVersionCode(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Conteúdo do Arquivo CSV Oficial da CMED *</label>
            <textarea
              rows={8}
              className="w-full border border-slate-300 rounded p-2.5 font-mono text-xs focus:ring-red-500 focus:border-red-500"
              placeholder={`Exemplo de cabeçalho e registros:\nSUBSTANCIA;CNPJ;LABORATORIO;REGISTRO;EAN_1;PRODUTO;APRESENTACAO;CLASSE_TERAPEUTICA;TIPO_PRODUTO;LISTA_CONCESSAO_CREDITO_TRIBUTARIO;PF_18;PMC_18\nDIPIRONA;11.222.333/0001-99;MEDLEY;1000000000001;7891234567890;DIPIRONA;500MG/ML GOTAS;ANALGESICOS;GENÉRICO;POSITIVA;5,00;10,00`}
              value={importCsvText}
              onChange={(e) => setImportCsvText(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-red-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-red-700 shadow-sm transition-colors text-sm"
            >
              Iniciar Importação e Carga da Base CMED
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default CmedPricingPage;
