# FarmaCore ERP — Fase 8: Fechamento de Caixa Cego, Conciliação Financeira TEF & DRE / Curva ABC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo financeiro e gerencial completo para farmácias, compreendendo:
1. Fechamento Cego de Caixa (`BlindCashClosureService`): O operador declara os valores físicos contados sem ver os totais do sistema; o sistema apura quebras e sobras e o gerente homologa a conferência com comprovante ESC/POS de 48 colunas.
2. Conciliação Financeira de Cartões & TEF (`TefReconciliationService`): Previsão de repasses das adquirentes (D+1 débito/PIX, D+30 crédito), baixa bancária de transações e conferência de taxas MDR.
3. DRE Gerencial & Curva ABC (`FinancialReportsService`): Demonstrativo do Resultado do Exercício com cálculo de CMV a partir das compras/PF e Curva ABC 80/20 com margens e categorias farmacêuticas (`REFERENCIA`, `GENERICO`, `SIMILAR`, `PERFUMARIA`, `CORRELATOS_OUTROS`).

**Architecture:** Módulo `src/modules/financial/` integrado ao banco SQLite WAL (Migration 007), rotas REST Fastify `/api/financial/*` com validação defensiva Zod, e painéis frontend React (`BlindClosureModal`, `ClosureReviewModal`, `FinancialDashboardPage`).

---

### Task 1: Schema 007 & Tipos de Domínio Financeiro

**Files:**
- Create: `src/database/migrations/007_financial_dre_blind_closure.sql`
- Create: `src/modules/financial/types.ts`
- Test: `tests/modules/financial/schema.test.ts`

**Interfaces:**
- Produces:
  - Tabela `cash_closures` com colunas de contagem cega (`declared_cash`, `declared_credit`, etc.), valores apurados pelo sistema, `cash_difference`, `total_difference`, `difference_status`, e campos de revisão gerencial.
  - Colunas em `tef_transactions`: `settlement_status`, `settled_amount`, `settled_fee`, `settled_at`, `bank_account`.
  - Coluna `category` em `products` com constraint de enum (`REFERENCIA`, `GENERICO`, `SIMILAR`, `PERFUMARIA`, `CORRELATOS_OUTROS`).
  - Tipos TypeScript em `src/modules/financial/types.ts`.

- [ ] **Step 1: Escrever testes que falham para o Schema 007 e Tipos**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `007_financial_dre_blind_closure.sql` e `types.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Serviço de Fechamento Cego de Caixa (`BlindCashClosureService`)

**Files:**
- Create: `src/modules/financial/cash-closure.service.ts`
- Test: `tests/modules/financial/cash-closure.service.test.ts`

**Interfaces:**
- Produces:
  - `declareBlindClosure(params: DeclareBlindClosureParams): CashClosure`
  - `getClosureBySessionId(sessionId: number): CashClosure | null`
  - `getClosureById(closureId: number): CashClosure | null`
  - `reviewClosure(closureId: number, params: ReviewClosureParams): CashClosure`
  - `listClosures(filters?: CashClosureFilters): { closures: CashClosure[]; total: number }`
  - Cálculo preciso de Quebra (`SHORTAGE`), Sobra (`SURPLUS`) e Exato (`EXACT`).

- [ ] **Step 1: Escrever testes que falham para `cash-closure.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/financial/cash-closure.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Formatador de Comprovante de Fechamento 48 Colunas ESC/POS

**Files:**
- Create: `src/modules/financial/closure-receipt-formatter.ts`
- Test: `tests/modules/financial/closure-receipt-formatter.test.ts`

**Interfaces:**
- Produces:
  - `formatCashClosureReceipt(closure: CashClosure, session: CashSession, storeInfo: StoreInfo): { textReceipt: string; fullEscPos: string }`
  - Resumo de abertura, sangrias, suprimentos, vendas brutas, declaração do operador, comparativo com sistema, quebra/sobra e campo de assinatura do gerente em 48 colunas com corte `\x1b\x69`.

- [ ] **Step 1: Escrever testes que falham para `closure-receipt-formatter.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/financial/closure-receipt-formatter.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Serviço de Conciliação Financeira TEF (`TefReconciliationService`)

**Files:**
- Create: `src/modules/financial/tef-reconciliation.service.ts`
- Test: `tests/modules/financial/tef-reconciliation.service.test.ts`

**Interfaces:**
- Produces:
  - `getReceivablesForecast(filters?: ForecastFilters): ReceivablesForecastSummary`
  - `settleTransaction(nsu: string, params: SettleTransactionParams): TefTransaction`
  - `listReconciliation(filters?: ReconciliationFilters): { transactions: TefTransaction[]; summary: ReconciliationSummary }`
  - Detecção de taxas divergentes (`DIVERGENT`) quando a adquirente desconta MDR superior ao contratado.

- [ ] **Step 1: Escrever testes que falham para `tef-reconciliation.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/financial/tef-reconciliation.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Motor de DRE Gerencial & Curva ABC (`FinancialReportsService`)

**Files:**
- Create: `src/modules/financial/financial-reports.service.ts`
- Test: `tests/modules/financial/financial-reports.service.test.ts`

**Interfaces:**
- Produces:
  - `generateDre(startDate: string, endDate: string): DreReport`
    - Receita Bruta, Descontos, Cancelamentos, Taxas TEF, Receita Líquida, CMV (Compras/PF), Lucro Bruto, Despesas Operacionais (Sangrias), Lucro Operacional Líquido e Margens %.
  - `generateAbcCurve(startDate: string, endDate: string, categoryFilter?: string): AbcCurveReport`
    - Ranking Pareto 80/20 (Classes A, B, C), Faturamento acumulado, Quantidades, Margem Bruta individual e Distribuição por Categoria Farmacêutica.

- [ ] **Step 1: Escrever testes que falham para `financial-reports.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/financial/financial-reports.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Backend — Rotas REST Fastify (`/api/financial/*`)

**Files:**
- Modify: `src/api/routes.ts`
- Test: `tests/api/routes.financial.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/financial/cash-closure/declare`
  - `GET /api/financial/cash-closure/:sessionId`
  - `POST /api/financial/cash-closure/:closureId/review`
  - `GET /api/financial/cash-closure/:closureId/receipt`
  - `GET /api/financial/reconciliation/forecast`
  - `POST /api/financial/reconciliation/settle`
  - `GET /api/financial/reports/dre`
  - `GET /api/financial/reports/abc-curve`

- [ ] **Step 1: Escrever testes que falham para rotas `/api/financial/*`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar rotas em `src/api/routes.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Frontend React — Modais de Fechamento Cego, Auditoria e Dashboard Financeiro

**Files:**
- Create: `frontend/src/types/financial.ts`
- Modify: `frontend/src/services/api.ts` (adicionar `financialApi`)
- Create: `frontend/src/components/pos/BlindClosureModal.tsx`
- Create: `frontend/src/components/pos/ClosureReviewModal.tsx`
- Create: `frontend/src/pages/FinancialDashboardPage.tsx`
- Modify: `frontend/src/pages/PosPage.tsx` (atalho e fluxo de Fechamento Cego)
- Test: `frontend/tests/components/BlindClosureModal.test.tsx`
- Test: `frontend/tests/pages/FinancialDashboardPage.test.tsx`

**Interfaces:**
- Produces:
  - Modal onde o operador digita a contagem física às cegas.
  - Modal de auditoria e homologação de quebra/sobra com visualização e impressão de comprovante.
  - Dashboard Financeiro com abas de DRE Gerencial, Curva ABC (com gráfico de Pareto e badges) e Agenda de Recebíveis TEF.

- [ ] **Step 1: Escrever testes frontend que falham**
- [ ] **Step 2: Executar testes frontend para verificar que falham**
- [ ] **Step 3: Implementar componentes frontend e integrar no PDV e navegação**
- [ ] **Step 4: Executar testes frontend para verificar que passam**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 8: Verificação Completa da Fase 8, Zero Regressões e Build Web

**Files:**
- Execução completa da suíte de testes (`npm test`)
- Checagem estrita de TypeScript (`npx tsc --noEmit`)
- Build de produção do Vite (`npm run build:web`)
- Auditoria Whole-Branch por subagente revisor

- [ ] **Step 1: Executar suíte completa de testes**
- [ ] **Step 2: Executar build web e typecheck**
- [ ] **Step 3: Auditoria final por subagente Whole-Branch Reviewer**
- [ ] **Step 4: Git commit e orientação de push para a branch `master`**
