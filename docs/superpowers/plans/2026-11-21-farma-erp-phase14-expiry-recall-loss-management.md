# FarmaCore ERP — Fase 14: Central de Validades Preditiva (Painel 30/60/90 Dias), Recall Sanitário Anvisa & Baixa de Perdas/Avarias (Laudo VISA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP a Central de Validades Preditiva, o Motor de Recolhimento Sanitário Compulsório Anvisa (com rastreabilidade reversa de pacientes compradores) e a Baixa Regulatória de Perdas/Avarias com emissão de Laudo Oficial e Manifesto de Resíduos (MTR) para Vigilância Sanitária:
1. Modelagem relacional e Schema 013 (`anvisa_recalls`, `anvisa_recall_items`, `inventory_losses`, `inventory_loss_items`).
2. Gestão Preditiva de Validades: Matriz de risco (Vencidos, 30, 60, 90 dias e Seguro) com apuração a preço de custo e venda, filtros avançados e sugestão de ação (`ExpiryManagementService`).
3. Recall Sanitário Anvisa: Cadastro de Resoluções RE, bloqueio automático de lotes afetados e rastreabilidade reversa de pacientes compradores via histórico de vendas (`AnvisaRecallService`).
4. Baixa Regulatória de Perdas & Laudo VISA: Fluxo de rascunho, aprovação com dedução atômica de estoque, geração de numeração sequencial `PER-YYYYMM-XXXX` e registro de certificado de incineração/MTR (`InventoryLossService`).
5. Formatadores Térmicos ESC/POS (48 colunas: Filipeta de Validades, Relatório de Pacientes de Recall e Laudo Oficial VISA de Descarte) e Rotas Fastify `/api/sanitary/*` com validação Zod.
6. Interface Frontend React com Posto `[F12] Validades & Vigilância Sanitária`, Matriz de Risco interativa, Central de Recalls com rastreabilidade de pacientes e Central de Baixas de Perdas com emissão de laudo.

**Architecture:** Módulo `src/modules/sanitary/` integrado ao SQLite WAL (Migration 013), rotas Fastify `/api/sanitary/*` com validação Zod, e interface React (`SanitaryPage`, modais operacionais e atalho global `F12`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-21-farma-erp-phase14-expiry-recall-loss-management.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 1.229 testes anteriores devem continuar passando sem regressão.
- **Conformidade Regulatória Anvisa:** Bloqueio imediato de lotes afetados (`is_blocked = 1`), identificação reversa de pacientes compradores e rastreabilidade sanitária no descarte com CRF do farmacêutico RT.
- **Movimentação Atômica de Estoque:** Dedução simultânea de `batches.current_quantity` e `products.current_stock` em transação SQLite WAL única ao aprovar uma baixa de perda.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 013 & Tipos de Domínio de Validades, Recall e Baixas Sanitárias

**Files:**
- Create: `src/database/migrations/013_expiry_recall_loss_management.sql`
- Create: `src/modules/sanitary/types.ts`
- Test: `tests/modules/sanitary/schema.test.ts`

**Interfaces:**
- Produces:
  - Tabelas: `anvisa_recalls`, `anvisa_recall_items`, `inventory_losses`, `inventory_loss_items`.
  - Índices de performance para busca por validade, resolução, lote e loja.
  - Tipos TypeScript em `src/modules/sanitary/types.ts`.

- [x] **Step 1: Escrever testes que falham para o Schema 013 e Tipos**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `013_expiry_recall_loss_management.sql` e `types.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Gestão Preditiva de Validades (`ExpiryManagementService`)

**Files:**
- Create: `src/modules/sanitary/expiry-management.service.ts`
- Test: `tests/modules/sanitary/expiry-management.service.test.ts`

**Interfaces:**
- Produces:
  - `getExpiryMatrix(storeId?: number, referenceDate?: string): ExpiryRiskMatrix`
    - Classificação em 5 faixas (`EXPIRED`, `RISK_30_DAYS`, `RISK_60_DAYS`, `RISK_90_DAYS`, `SAFE`).
    - Totais de lotes, unidades, valor financeiro a preço de custo e venda por faixa.
  - `getExpiringBatches(filters: ExpiryFilters): { batches: ExpiringBatchItem[]; total: number }`
    - Listagem detalhada e filtrada de lotes com dados do produto, fabricante, EAN, quantidade, dias restantes e sugestão de ação.
  - `suggestActionForBatch(batch: BatchDetails, supplierReturnDays?: number): BatchActionSuggestion`
    - Sugestão de ação baseada no tempo até o vencimento (`DISPOSE`, `PROMOTION`, `RETURN_TO_SUPPLIER`, `NORMAL`).

- [x] **Step 1: Escrever testes que falham para `expiry-management.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/sanitary/expiry-management.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Recall Sanitário Anvisa & Rastreabilidade Reversa (`AnvisaRecallService`)

**Files:**
- Create: `src/modules/sanitary/anvisa-recall.service.ts`
- Test: `tests/modules/sanitary/anvisa-recall.service.test.ts`

**Interfaces:**
- Produces:
  - `registerRecall(input: RegisterRecallInput): AnvisaRecallWithItems`
    - Cadastro da Resolução RE da Anvisa.
    - Bloqueio imediato dos lotes correspondentes em `batches` (`is_blocked = 1`).
    - Registro dos itens afetados com saldo de estoque bloqueado.
  - `getAffectedPatients(recallId: number): AffectedPatientItem[]`
    - Rastreabilidade reversa a partir de `sale_items`, `sales` e `customers` identificando quem comprou os lotes recolhidos.
  - `resolveRecall(recallId: number, params: ResolveRecallParams): AnvisaRecallWithItems`
    - Atualização para `COMPLETED` com registro do destino final (devolução ao fabricante ou incineração).
  - `listRecalls(filters?: RecallFilters): AnvisaRecallWithItems[]`

- [x] **Step 1: Escrever testes que falham para `anvisa-recall.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/sanitary/anvisa-recall.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Baixa Regulatória de Perdas, Avarias & Descarte (`InventoryLossService`)

**Files:**
- Create: `src/modules/sanitary/inventory-loss.service.ts`
- Test: `tests/modules/sanitary/inventory-loss.service.test.ts`

**Interfaces:**
- Produces:
  - `createLossDraft(input: CreateLossDraftInput): InventoryLossWithItems`
    - Validação de dados do farmacêutico RT (Nome, CRF/UF), motivo (`EXPIRED`, `BROKEN_DAMAGED`, `RECALL_ANVISA`, etc.) e itens.
    - Status inicial `DRAFT`.
  - `approveAndDeductStock(lossId: number, params: ApproveLossParams): InventoryLossWithItems`
    - Validação atômica de saldo e dedução em `batches.current_quantity` e `products.current_stock`.
    - Geração de numeração sequencial padronizada `PER-YYYYMM-XXXX`.
    - Status `APPROVED`.
  - `recordDisposalCertificate(lossId: number, params: DisposalCertificateParams): InventoryLossWithItems`
    - Registro dos dados da empresa de incineração/resíduos, certificado CDF, manifesto MTR e status `DISPOSED`.
  - `getLossById(id: number): InventoryLossWithItems | null`
  - `listLosses(filters?: LossFilters): InventoryLossWithItems[]`

- [x] **Step 1: Escrever testes que falham para `inventory-loss.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/sanitary/inventory-loss.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Formatadores Térmicos ESC/POS & Rotas Fastify (`/api/sanitary/*`)

**Files:**
- Create: `src/modules/sanitary/sanitary-receipt-formatter.ts`
- Create: `src/modules/sanitary/sanitary.routes.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/sanitary/sanitary-receipt-formatter.test.ts`
- Test: `tests/api/routes.sanitary.test.ts`

**Interfaces:**
- Produces:
  - Formatadores Térmicos (48 colunas):
    - `formatExpiryAuditSlip(data: ExpiryAuditSlipData): string`
    - `formatRecallPatientReport(data: RecallPatientReportData): string`
    - `formatDisposalLaudoSlip(data: DisposalLaudoData): string`
  - Rotas Fastify:
    - `/api/sanitary/expiry/matrix` (GET)
    - `/api/sanitary/expiry/batches` (GET)
    - `/api/sanitary/expiry/audit-slip` (GET)
    - `/api/sanitary/recalls` (GET, POST)
    - `/api/sanitary/recalls/:id` (GET, PUT)
    - `/api/sanitary/recalls/:id/patients` (GET)
    - `/api/sanitary/recalls/:id/resolve` (POST)
    - `/api/sanitary/losses` (GET, POST)
    - `/api/sanitary/losses/:id` (GET)
    - `/api/sanitary/losses/:id/approve` (POST)
    - `/api/sanitary/losses/:id/disposal` (POST)
    - `/api/sanitary/losses/:id/laudo` (GET)

- [x] **Step 1: Escrever testes que falham para os formatadores e rotas sanitárias**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar formatadores e rotas Fastify**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Posto [F12] Validades & Vigilância Sanitária (`SanitaryPage.tsx`)

**Files:**
- Create: `frontend/src/types/sanitary.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/SanitaryPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/pages/SanitaryPage.test.tsx`

**Interfaces:**
- Produces:
  - Atalho global `F12` e botão na Topbar (`data-testid="topbar-sanitary-button"`).
  - Aba 1: Painel de Validades Preditiva com Matriz de Risco (Vencidos / 30 / 60 / 90 dias / Seguro), montantes em risco a custo e venda, filtros e botão de conferência física.
  - Aba 2: Recall Sanitário Anvisa com cadastro de resolução, lista de lotes bloqueados e modal de pacientes afetados (rastreabilidade reversa).
  - Aba 3: Baixas por Perdas e Descarte Sanitário com criação de baixa, aprovação atômica, registro de MTR/empresa de incineração e emissão de Laudo VISA.

- [x] **Step 1: Escrever testes que falham para `SanitaryPage.tsx`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar tipos, chamadas de API, página React e atalho F12**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 14

- [x] **Step 1: Executar suite completa de testes backend e frontend (`npm.cmd test`)**
- [x] **Step 2: Validar tipagem TypeScript (`npx.cmd tsc --noEmit` e `frontend/tsconfig.json`)**
- [x] **Step 3: Executar build de produção do frontend (`npm.cmd run build:web`)**
- [x] **Step 4: Commit de finalização e instruções de push para `origin/master`**
