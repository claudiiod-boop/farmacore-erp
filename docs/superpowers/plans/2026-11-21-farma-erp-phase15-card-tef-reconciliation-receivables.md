# FarmaCore ERP — Fase 15: Conciliação Automática de Cartões/TEF, Calendário de Recebíveis (D+1 / D+30), Taxas MDR de Adquirentes & Extrato EDI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo completo de Conciliação Financeira de Cartões, Motor de Taxas MDR Contratuais, Auditoria de Divergências e Calendário Preditivo de Recebíveis Bancários (D+1 débito/PIX e D+30 crédito/parcelado):
1. Modelagem relacional e Schema 014 (`acquirer_contracts`, `acquirer_fee_rules`, `card_reconciliation_batches`, `card_settlement_entries`).
2. Motor de Cálculo de Taxas MDR e Projeção Temporal (`CardFeeCalculatorService`).
3. Conciliador Automático de Extratos de Vendas/Pagamentos com detecção de taxas divergentes, chargebacks e liquidação em lote (`CardReconciliationService`).
4. Calendário Preditivo de Recebíveis dia a dia e Relatório Analítico de Divergências para contestação junto às adquirentes.
5. Formatadores Térmicos ESC/POS (48 colunas: Extrato de Divergências de Taxas e Calendário Diário de Depósitos) e Rotas Fastify `/api/card-reconciliation/*` com validação Zod.
6. Interface Frontend React com Painel de Conciliação, Calendário Interativo de Recebíveis, Tabela de Auditoria de Taxas e Gestão de Contratos de Adquirentes.

**Architecture:** Módulo `src/modules/financial/card-reconciliation/` ou integrado ao financeiro com SQLite WAL (Migration 014), rotas Fastify `/api/card-reconciliation/*` com validação Zod, e interface React (`CardReconciliationPage`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-21-farma-erp-phase15-card-tef-reconciliation-receivables.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 1.274 testes anteriores devem continuar passando sem regressão.
- **Precisão Centesimal Financeira:** Cálculos de taxas MDR, valor líquido e divergências com arredondamento monetário preciso a duas casas decimais.
- **Rastreabilidade Bancária:** Vinculação estrita entre vendas TEF do PDV, lançamentos do extrato da adquirente e conta corrente bancária de depósito.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 014 & Tipos de Domínio de Contratos de Adquirentes, Taxas MDR e Conciliação

**Files:**
- Create: `src/database/migrations/014_card_reconciliation_contracts_fees.sql`
- Create: `src/modules/financial/card-reconciliation.types.ts`
- Test: `tests/modules/financial/card-reconciliation.schema.test.ts`

**Interfaces:**
- Produces:
  - Tabelas: `acquirer_contracts`, `acquirer_fee_rules`, `card_reconciliation_batches`, `card_settlement_entries`.
  - Índices de performance para busca por adquirente, NSU, status e data de liquidação.
  - Tipos TypeScript em `src/modules/financial/card-reconciliation.types.ts`.

- [ ] **Step 1: Escrever testes que falham para o Schema 014 e Tipos**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `014_card_reconciliation_contracts_fees.sql` e `card-reconciliation.types.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Motor de Regras e Cálculo de Taxas MDR & Projeção D+1 / D+30 (`CardFeeCalculatorService`)

**Files:**
- Create: `src/modules/financial/card-fee-calculator.service.ts`
- Test: `tests/modules/financial/card-fee-calculator.service.test.ts`

**Interfaces:**
- Produces:
  - `matchFeeRule(contractId: number, brand: string, operationType: string, installments: number): AcquirerFeeRule | null`
  - `calculateTransactionFees(input: CalcTransactionFeeInput): TransactionFeeCalculation`
    - Cálculo de taxa esperada, valor líquido esperado e data prevista de liquidação considerando dias úteis (débito/PIX) e calendário de parcelamento (crédito).

- [ ] **Step 1: Escrever testes que falham para `card-fee-calculator.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/financial/card-fee-calculator.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Conciliador Automático de Extratos & Auditoria de Divergências (`CardReconciliationService`)

**Files:**
- Create: `src/modules/financial/card-reconciliation.service.ts`
- Test: `tests/modules/financial/card-reconciliation.service.test.ts`

**Interfaces:**
- Produces:
  - `createAcquirerContract(input: CreateContractInput): AcquirerContract`
  - `addFeeRule(input: CreateFeeRuleInput): AcquirerFeeRule`
  - `importStatement(input: ImportStatementInput): ReconciliationBatchResult`
    - Cruzamento com transações TEF por NSU / autorização / valor.
    - Detecção de taxas divergentes (`DIVERGENT_FEE`), chargebacks e vendas não registradas no PDV (`NOT_FOUND_IN_ERP`).
    - Liquidação atômica das transações conciliadas.

- [ ] **Step 1: Escrever testes que falham para `card-reconciliation.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/financial/card-reconciliation.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Calendário Preditivo de Recebíveis & Relatório de Contestação

**Files:**
- Modify: `src/modules/financial/card-reconciliation.service.ts`
- Test: `tests/modules/financial/card-reconciliation-calendar.test.ts`

**Interfaces:**
- Produces:
  - `getReceivablesCalendar(filters: CalendarFilters): ReceivablesCalendarDay[]`
    - Totalização de valores a receber dia a dia por adquirente e banco.
  - `getDivergenceReport(filters: DivergenceFilters): DivergenceReport`
    - Relação analítica de cobranças indevidas de MDR com valor acumulado para pedido de ressarcimento.

- [ ] **Step 1: Escrever testes que falham para calendário e relatório de divergências**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar métodos de calendário e relatório**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Formatadores Térmicos ESC/POS & Rotas Fastify (`/api/card-reconciliation/*`)

**Files:**
- Create: `src/modules/financial/card-reconciliation-formatter.ts`
- Create: `src/modules/financial/card-reconciliation.routes.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/financial/card-reconciliation-formatter.test.ts`
- Test: `tests/api/routes.card-reconciliation.test.ts`

**Interfaces:**
- Produces:
  - Formatadores Térmicos:
    - `formatDivergenceAuditSlip(data: DivergenceSlipData): string`
    - `formatDailySettlementSlip(data: DailySettlementSlipData): string`
  - Rotas Fastify:
    - `/api/card-reconciliation/contracts` (GET, POST)
    - `/api/card-reconciliation/contracts/:id/rules` (GET, POST)
    - `/api/card-reconciliation/batches` (GET)
    - `/api/card-reconciliation/import` (POST)
    - `/api/card-reconciliation/calendar` (GET)
    - `/api/card-reconciliation/divergences` (GET)
    - `/api/card-reconciliation/divergences/slip` (GET)

- [ ] **Step 1: Escrever testes que falham para formatadores e rotas**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar formatadores e rotas Fastify**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Painel de Conciliação de Cartões & Calendário de Recebíveis (`CardReconciliationPage.tsx`)

**Files:**
- Create: `frontend/src/types/card-reconciliation.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/CardReconciliationPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/pages/CardReconciliationPage.test.tsx`

**Interfaces:**
- Produces:
  - Atalho global `F13` ou acesso no menu Topbar (`data-testid="topbar-reconciliation-button"`).
  - Aba 1: Calendário Preditivo de Recebíveis com valores líquidos D+1 / D+30 por adquirente.
  - Aba 2: Importação e Auditoria Automática de Extratos com badges de status.
  - Aba 3: Relatório de Divergências de Taxas com botão de emissão de comprovante.
  - Aba 4: Gestão de Contratos de Adquirentes e Matriz de Taxas MDR.

- [ ] **Step 1: Escrever testes que falham para `CardReconciliationPage.tsx`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar tipos, chamadas de API, página React e navegação**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 15

- [ ] **Step 1: Executar suite completa de testes backend e frontend (`npm.cmd test`)**
- [ ] **Step 2: Validar tipagem TypeScript (`npx.cmd tsc --noEmit` e `frontend/tsconfig.json`)**
- [ ] **Step 3: Executar build de produção do frontend (`npm.cmd run build:web`)**
- [ ] **Step 4: Commit de finalização e instruções de push para `origin/master`**
