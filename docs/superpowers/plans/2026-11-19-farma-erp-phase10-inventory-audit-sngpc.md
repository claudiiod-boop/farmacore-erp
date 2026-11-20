# FarmaCore ERP — Fase 10: Auditoria, Inventário Rotativo / Balanço com Contagem Cega & Ajuste Regulatório SNGPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo completo de governança patrimonial, inventário físico com contagem cega por leitor/coletor de código de barras e ajuste de estoque com conformidade regulatória estrita da Anvisa (SNGPC - Portaria 344/98 e RDC 20/2011):
1. Sessões de Inventário Geral, Rotativo (Categoria/Curva ABC) e Controlados SNGPC (`InventoryAuditService`).
2. Contagem Cega por Código de Barras (EAN + Lote + Validade + Qtd), com recontagem e ocultação de saldos lógicos.
3. Apuração de Divergências (Sobras e Faltas), com exigência de motivo de ajuste (Avaria, Vencimento, Furto, etc.).
4. Ajuste Atômico de Estoque (`batches`) e Geração de Movimentações Regulatórias de Perda/Ajuste no SNGPC.
5. Termo de Balanço Patrimonial e Auditoria (80 colunas ESC/POS e A4) com índice de acurácia e assinaturas.
6. Frontend React com leitor rápido bip-a-bip, tela de conciliação e parecer do Responsável Técnico.

**Architecture:** Módulo `src/modules/inventory/` (integrado a `src/modules/sngpc/` e `src/modules/stores/`), SQLite WAL (Migration 009), rotas Fastify `/api/inventory/*` com validação Zod, e interface React (`InventoryPage`, `BlindCountingPanel`, `ReconciliationPanel`, `InventorySlipModal`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-19-farma-erp-phase10-inventory-audit-sngpc.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 823 testes anteriores devem continuar passando sem regressão.
- **Contagem Cega:** Nenhum saldo esperado do sistema deve ser revelado na interface de contagem durante o status `OPEN`.
- **Validação Regulatória SNGPC:** Divergências em medicamentos controlados exigem obrigatoriamente CRF e UF do Farmacêutico RT.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 009 & Tipos de Domínio de Inventário / Balanço

**Files:**
- Create: `src/database/migrations/009_inventory_audit_sngpc.sql`
- Create: `src/modules/inventory/audit-types.ts`
- Test: `tests/modules/inventory/audit-schema.test.ts`

**Interfaces:**
- Produces:
  - Tabela `inventory_sessions` (id, session_code, store_id, inventory_type, category_filter, status, opened_by, applied_by, responsible_pharmacist_crf, responsible_pharmacist_uf, notes, total_products_expected, total_products_counted, total_batches_expected, total_batches_counted, accuracy_rate, total_surplus_cost, total_shortage_cost, net_financial_difference, started_at, closed_at, created_at, updated_at).
  - Tabela `inventory_items` (id, session_id, product_id, batch_id, batch_number, expiration_date, manufacturing_date, expected_quantity, counted_quantity, recount_quantity, difference_quantity, difference_status, unit_cost, total_cost_difference, adjustment_reason, notes, sngpc_adjusted, created_at, updated_at).
  - Índices: `idx_inventory_sessions_store_status`, `idx_inventory_items_session`, `idx_inventory_items_product_batch`.
  - Tipos TypeScript em `src/modules/inventory/audit-types.ts`.

- [ ] **Step 1: Escrever testes que falham para o Schema 009 e Tipos**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `009_inventory_audit_sngpc.sql` e `audit-types.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Criação de Sessão e Snapshot Lógico de Estoque (`InventoryAuditService.createSession`)

**Files:**
- Create: `src/modules/inventory/audit.service.ts`
- Test: `tests/modules/inventory/audit.service.snapshot.test.ts`

**Interfaces:**
- Produces:
  - `createSession(input: CreateInventorySessionInput): InventorySessionWithItems`
    - Cria sessão com código `INV-YYYYMMDD-XXXX`.
    - Captura o snapshot lógico dos lotes ativos na loja (`batches.store_id == storeId`) com filtro por tipo/categoria.
    - Insere itens em `inventory_items` com `expected_quantity = batches.quantity - batches.reserved_quantity`.
  - `getSessionById(id: number): InventorySessionWithItems | null`
  - `listSessions(filters?: InventorySessionFilters): { sessions: InventorySessionWithItems[]; total: number }`

- [ ] **Step 1: Escrever testes que falham para criação de sessão e snapshot**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `createSession`, `getSessionById` e `listSessions` em `audit.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Contagem Cega, Recontagem e Apuração de Divergências (`addCount`, `recountItem`, `finishCounting`)

**Files:**
- Update: `src/modules/inventory/audit.service.ts`
- Test: `tests/modules/inventory/audit.service.counting.test.ts`

**Interfaces:**
- Produces:
  - `addCount(sessionId: number, input: AddCountInput): InventoryItem` (registra contagem física, suporta bip incremental ou quantidade direta)
  - `recountItem(sessionId: number, itemId: number, recountQuantity: number): InventoryItem` (permite recontagem de lote divergente)
  - `finishCounting(sessionId: number): InventorySessionWithItems` (transição OPEN -> COUNTED, consolida diferenças e calcula acurácia patrimonial)

- [ ] **Step 1: Escrever testes que falham para contagem cega e consolidação de divergências**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar métodos de contagem e finalização em `audit.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Aplicação Atômica de Ajustes de Estoque & Integração Regulatória SNGPC (`applyAdjustments`, `cancelSession`)

**Files:**
- Update: `src/modules/inventory/audit.service.ts`
- Test: `tests/modules/inventory/audit.service.apply.test.ts`

**Interfaces:**
- Produces:
  - `applyAdjustments(sessionId: number, params: ApplyAdjustmentsParams): InventorySessionWithItems`
    - Transição COUNTED -> APPLIED.
    - Atualização atômica de `batches.quantity`.
    - Integração regulatória com `sngpc_movements` (gera movimentação oficial Anvisa com motivo de perda/ajuste e CRF do RT para medicamentos controlados da Portaria 344/98 e antimicrobianos).
    - Marcação `sngpc_adjusted = 1`.
  - `cancelSession(sessionId: number, reason: string): InventorySessionWithItems` (cancela sessão sem alterar estoque)

- [ ] **Step 1: Escrever testes que falham para aplicação atômica e SNGPC**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar `applyAdjustments` e `cancelSession` em `audit.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passam**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Formatador de Termo de Balanço e Rotas REST Fastify (`/api/inventory/*`)

**Files:**
- Create: `src/modules/inventory/balance-slip-formatter.ts`
- Create: `src/modules/inventory/audit.routes.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/inventory/balance-slip-formatter.test.ts`
- Test: `tests/api/routes.inventory.test.ts`

**Interfaces:**
- Produces:
  - `formatBalanceSlip(session: InventorySessionWithItems, store: Store): { textSlip: string; fullEscPos: string }`
  - Rotas REST Fastify:
    - `GET /api/inventory/sessions`, `GET /api/inventory/sessions/:id`, `POST /api/inventory/sessions`
    - `POST /api/inventory/sessions/:id/count`, `PUT /api/inventory/sessions/:id/items/:itemId/recount`
    - `POST /api/inventory/sessions/:id/finish-count`, `POST /api/inventory/sessions/:id/apply`
    - `POST /api/inventory/sessions/:id/cancel`, `GET /api/inventory/sessions/:id/report`

- [ ] **Step 1: Escrever testes que falham para o formatador de romaneio e rotas REST**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar `balance-slip-formatter.ts`, `audit.routes.ts` e registrar no Fastify**
- [ ] **Step 4: Executar teste para verificar que passam (200, 201, 400, 404, 409)**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Módulo de Inventário, Contagem Cega Bip-a-Bip e Parecer Regulatório SNGPC

**Files:**
- Create: `frontend/src/types/inventory.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/InventoryPage.tsx`
- Create: `frontend/src/components/inventory/BlindCountingPanel.tsx`
- Create: `frontend/src/components/inventory/ReconciliationPanel.tsx`
- Create: `frontend/src/components/inventory/InventorySlipModal.tsx`
- Modify: `frontend/src/App.tsx` (Adiciona Posto/Atalho ou Aba de Inventário)
- Test: `frontend/tests/pages/InventoryPage.test.tsx`

**Interfaces:**
- Produces:
  - Interface visual completa de Inventário com 3 etapas:
    1. Painel de Sessões e Abertura (Geral, Categoria, SNGPC).
    2. Painel de Contagem Cega com modo bip contínuo de leitor de código de barras.
    3. Painel de Conciliação com motivos de divergência e parecer do Farmacêutico RT.
  - Modal do Termo de Balanço com impressão e cópia.

- [ ] **Step 1: Escrever testes para a página de Inventário e contagem cega**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar tipos, API adapter, componentes React e rotas**
- [ ] **Step 4: Executar teste para verificar que passam e checar TypeScript frontend**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 10

**Files:**
- Test: Suíte completa de testes (`npm.cmd test`)
- Verify: `npx.cmd tsc --noEmit` (backend)
- Verify: `npx.cmd tsc -p frontend/tsconfig.json --noEmit` (frontend)
- Verify: `npm.cmd run build:web` (produção frontend)

- [ ] **Step 1: Rodar auditoria completa de testes e checagem de tipos**
- [ ] **Step 2: Corrigir qualquer aviso ou inconsistência de regressão**
- [ ] **Step 3: Garantir 100% de testes passando e build web limpo**
- [ ] **Step 4: Git commit final da Fase 10 e instruções de push para o usuário**
