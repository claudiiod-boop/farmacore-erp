# FarmaCore ERP — Especificação Técnica da Fase 8
# Fechamento de Caixa Cego, Conciliação Financeira TEF & DRE / Curva ABC

**Status:** APROVADO  
**Data:** 18 de Novembro de 2026  
**Autor:** Equipe de Arquitetura FarmaCore  
**Contexto:** Padrão ERP Farmacêutico Linx / InovaFarma / Trier

---

## 1. Visão Geral e Objetivos do Módulo

A **Fase 8** do FarmaCore ERP implementa o ecossistema financeiro, gerencial e de controle de caixa da farmácia, dividindo-se em três pilares fundamentais:

1. **Fechamento Cego de Caixa (Blind Cash Closure):**  
   - O operador de caixa, ao encerrar seu turno, é impedido de ver os saldos acumulados no sistema.
   - O operador declara os valores físicos contados: Dinheiro em espécie na gaveta, Comprovantes de Cartão TEF (Crédito e Débito), Tickets/Comprovantes de Convênio/PBM assinados e comprovantes PIX.
   - O sistema registra a declaração com timestamp imutável e calcula a Quebra de Caixa (falta de dinheiro) ou Sobra de Caixa (excesso não justificado).
   - O gerente analisa o comparativo (Declarado vs Esperado), insere justificativa/parecer e homologa o encerramento do turno, emitindo o Comprovante Térmico de Fechamento de Caixa em 48 colunas ESC/POS.

2. **Conciliação Financeira de Cartões & Gateway TEF:**  
   - Mapeamento de todas as vendas via cartão com suas taxas MDR e datas previstas de liquidação bancária (D+1 débito/PIX TEF, D+30 crédito).
   - Previsão de fluxo de caixa futuro de repasses das adquirentes (Cielo, Rede, Stone, PagBank, etc.).
   - Baixa e conciliação bancária: marcação das transações como `SETTLED` (Liquidadas), com suporte a conferência de valor bruto, MDR retido e valor líquido creditado na conta bancária.

3. **DRE Gerencial e Análise de Curva ABC Farmacêutica:**  
   - **Classificação de Produtos Farmacêuticos:** Adição da categoria mercadológica (`REFERENCIA`, `GENERICO`, `SIMILAR`, `PERFUMARIA`, `CORRELATOS_OUTROS`).
   - **Demonstrativo do Resultado do Exercício (DRE):**
     - Receita Bruta de Vendas (Total de vendas `COMPLETED`).
     - (-) Deduções (Descontos concedidos + Cancelamentos + Taxas MDR de Cartões).
     - (=) Receita Líquida de Vendas.
     - (-) Custo das Mercadorias Vendidas (CMV), calculado a partir do custo unitário de compras (`purchase_invoice_items.unit_cost`) ou preço de fábrica (`pf`).
     - (=) Lucro Bruto (Margem de Contribuição).
     - (-) Despesas Operacionais (Sangrias operacionais registradas no período).
     - (=) Resultado Operacional Líquido (EBITDA / Lucro Operacional).
   - **Curva ABC (Princípio de Pareto 80/20):**
     - Ranking de produtos por Faturamento (Receita gerada) e por Quantidade vendida:
       - **Classe A:** Primeiros 80% do faturamento acumulado (produtos de altíssimo giro e valor).
       - **Classe B:** Próximos 15% (80% a 95% do faturamento acumulado).
       - **Classe C:** Últimos 5% (95% a 100% do faturamento acumulado — cauda longa).
     - Cálculo de margem bruta individual e participação relativa percentual no lucro total da farmácia.

---

## 2. Modelagem do Banco de Dados (Migration 007)

### 2.1. Tabela `cash_closures` (Fechamento Cego e Conferência)
```sql
CREATE TABLE IF NOT EXISTS cash_closures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_session_id INTEGER NOT NULL UNIQUE REFERENCES cash_sessions(id) ON DELETE RESTRICT,
  operator_name TEXT NOT NULL,
  declared_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Valores declarados pelo operador (contagem cega)
  declared_cash REAL NOT NULL DEFAULT 0.0,
  declared_credit REAL NOT NULL DEFAULT 0.0,
  declared_debit REAL NOT NULL DEFAULT 0.0,
  declared_pix REAL NOT NULL DEFAULT 0.0,
  declared_pbm REAL NOT NULL DEFAULT 0.0,
  total_declared REAL NOT NULL DEFAULT 0.0,
  operator_notes TEXT,
  
  -- Valores apurados pelo sistema no momento do fechamento
  system_cash REAL NOT NULL DEFAULT 0.0,
  system_credit REAL NOT NULL DEFAULT 0.0,
  system_debit REAL NOT NULL DEFAULT 0.0,
  system_pix REAL NOT NULL DEFAULT 0.0,
  system_pbm REAL NOT NULL DEFAULT 0.0,
  system_supplies REAL NOT NULL DEFAULT 0.0,
  system_sangrias REAL NOT NULL DEFAULT 0.0,
  total_system REAL NOT NULL DEFAULT 0.0,
  
  -- Quebra / Sobra
  cash_difference REAL NOT NULL DEFAULT 0.0, -- declared_cash - system_cash
  total_difference REAL NOT NULL DEFAULT 0.0, -- total_declared - total_system
  difference_status TEXT NOT NULL CHECK (difference_status IN ('EXACT', 'SURPLUS', 'SHORTAGE')),
  
  -- Homologação Gerencial
  manager_name TEXT,
  manager_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  reviewed_at TEXT,
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_closures_session ON cash_closures(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_status ON cash_closures(status);
CREATE INDEX IF NOT EXISTS idx_cash_closures_created ON cash_closures(created_at);
```

### 2.2. Extensão da Tabela `tef_transactions` para Conciliação
Adição dos campos de liquidação bancária:
```sql
ALTER TABLE tef_transactions ADD COLUMN settlement_status TEXT DEFAULT 'PENDING' CHECK (settlement_status IN ('PENDING', 'SETTLED', 'DIVERGENT'));
ALTER TABLE tef_transactions ADD COLUMN settled_amount REAL;
ALTER TABLE tef_transactions ADD COLUMN settled_fee REAL;
ALTER TABLE tef_transactions ADD COLUMN settled_at TEXT;
ALTER TABLE tef_transactions ADD COLUMN bank_account TEXT;
```

### 2.3. Extensão da Tabela `products` para Classificação Farmacêutica
```sql
ALTER TABLE products ADD COLUMN category TEXT NOT NULL DEFAULT 'CORRELATOS_OUTROS' CHECK (category IN ('REFERENCIA', 'GENERICO', 'SIMILAR', 'PERFUMARIA', 'CORRELATOS_OUTROS'));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
```

---

## 3. Arquitetura de Serviços Backend

### 3.1. `BlindCashClosureService` (`src/modules/financial/cash-closure.service.ts`)
- **`declareBlindClosure(params: DeclareBlindClosureParams): CashClosure`:**
  - Verifica se a sessão está `OPEN`.
  - Fecha a sessão no SQLite via transação atômica.
  - Calcula todos os totais apurados no sistema (`system_cash`, `system_credit`, `system_debit`, `system_pix`, `system_pbm`, `system_supplies`, `system_sangrias`).
  - Calcula a diferença de caixa: `cash_difference = declared_cash - system_cash` e `total_difference = total_declared - total_system`.
  - Classifica a diferença:
    - Se `|total_difference| < 0.01` -> `'EXACT'`
    - Se `total_difference > 0` -> `'SURPLUS'` (Sobra de caixa)
    - Se `total_difference < 0` -> `'SHORTAGE'` (Quebra de caixa)
  - Persiste na tabela `cash_closures` com status `PENDING_REVIEW`.

- **`reviewClosure(closureId: number, params: ReviewClosureParams): CashClosure`:**
  - Permite ao gerente aprovar ou rejeitar o fechamento com justificativa.
  - Atualiza status para `APPROVED` ou `REJECTED`.

- **`formatClosureReceipt(closureId: number, storeInfo?: StoreInfo): { text: string; escPos: string }`:**
  - Gera comprovante térmico de 48 colunas ESC/POS com demonstrativo completo da sessão, declaração do operador, comparativo, quebra/sobra e assinatura do gerente.

### 3.2. `TefReconciliationService` (`src/modules/financial/tef-reconciliation.service.ts`)
- **`getReceivablesForecast(filters?: ForecastFilters): ReceivablesForecastSummary`:**
  - Agrupa valores a receber por adquirente e por data de repasse bancário (`expected_settlement_date`).
  - Total bruto, taxa MDR estimada e total líquido previsto.
- **`settleTransaction(nsu: string, params: SettleParams): TefTransaction`:**
  - Marca transação como `SETTLED`.
  - Valida se o valor líquido creditado confere com o esperado. Se a taxa cobrada divergir mais de 0.5%, marca como `DIVERGENT`.
- **`listReconciliation(filters?: ReconciliationFilters): { transactions: TefTransaction[]; summary: ReconciliationSummary }`:**
  - Listagem com filtros de status (`PENDING`, `SETTLED`, `DIVERGENT`), adquirente e período.

### 3.3. `FinancialReportsService` (`src/modules/financial/financial-reports.service.ts`)
- **`generateDre(startDate: string, endDate: string): DreReport`:**
  - Consulta vendas finalizadas (`COMPLETED`) no período.
  - Calcula Receita Bruta, Deduções (descontos + taxas TEF), Receita Líquida.
  - Apura o CMV de cada item vendido buscando prioritariamente o `unit_cost` em `purchase_invoice_items`, com fallback em `products.pf`.
  - Deduz Despesas Operacionais (sangrias operacionais do período).
  - Calcula Margem Bruta (%), Margem Líquida (%) e Lucro Operacional Líquido.
- **`generateAbcCurve(startDate: string, endDate: string, categoryFilter?: string): AbcCurveReport`:**
  - Agrupa vendas por produto ordenando por faturamento decrescente.
  - Calcula percentual individual, percentual acumulado e atribui Classe A (até 80%), Classe B (80% a 95%) ou Classe C (95% a 100%).
  - Retorna também margem de lucro por produto e curva por categoria farmacêutica.

---

## 4. Rotas da API Fastify (`/api/financial/*`)

1. `POST /api/financial/cash-closure/declare`: Submete contagem cega e encerra sessão.
2. `GET /api/financial/cash-closure/:sessionId`: Consulta o fechamento e comparativo da sessão.
3. `POST /api/financial/cash-closure/:closureId/review`: Homologação gerencial de quebra/sobra.
4. `GET /api/financial/cash-closure/:closureId/receipt`: Comprovante de fechamento 48 colunas ESC/POS.
5. `GET /api/financial/reconciliation/forecast`: Previsão de recebíveis futuros de cartão TEF.
6. `POST /api/financial/reconciliation/settle`: Baixa e liquidação bancária de transações TEF.
7. `GET /api/financial/reports/dre`: Relatório DRE com análise vertical e horizontal.
8. `GET /api/financial/reports/abc-curve`: Curva ABC de produtos e categorias com margens.

---

## 5. Interface do Usuário (Frontend React)

1. **`BlindClosureModal.tsx`:** Modal no PDV acionado ao encerrar turno (`[F10] Fechar Caixa Cego`). O operador apenas digita o dinheiro contado, comprovantes TEF, PBM e PIX, sem ver os números do sistema.
2. **`CashClosureReviewPage.tsx` ou Modal Gerencial:** Exibe a auditoria do caixa lado a lado: Declarado vs Sistema, Quebra/Sobra calculada, campo para observação do gerente e botão de homologação e impressão.
3. **`FinancialDashboardPage.tsx`:**
   - Aba 1: **DRE Gerencial** com seletor de período, cards de KPI (Receita, CMV, Margem de Contribuição, Lucro Líquido) e tabela de DRE.
   - Aba 2: **Curva ABC** com gráfico de Pareto e tabela com badges A, B, C, lucratividade e filtro por categoria (Referência, Genérico, Similar, Perfumaria).
   - Aba 3: **Conciliação de Cartões TEF** com agenda de recebíveis futuros, extrato de liquidação e alertas de taxas divergentes.

---

## 6. Critérios de Aceite e Garantia de Qualidade

1. **Regressão Zero:** Os 653 testes unitários e de integração existentes continuam passando com 100% de sucesso.
2. **Conformidade Contábil:** O cálculo do DRE segue a fórmula oficial da legislação contábil e as práticas do varejo farmacêutico (Abrafarma / Sebrae).
3. **Imutabilidade e Segurança:** Uma sessão com fechamento cego não pode sofrer novas vendas ou movimentações retroativas.
4. **Precisão Numérica:** Arredondamento estrito de 2 casas decimais em todas as somas financeiras, evitando erros de ponto flutuante.
5. **Tipagem e Build:** 0 erros no TypeScript (`tsc --noEmit`) e build de produção Vite gerado com sucesso.
