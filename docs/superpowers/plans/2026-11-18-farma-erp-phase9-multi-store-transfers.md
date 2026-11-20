# FarmaCore ERP — Fase 9: Gestão Multi-Loja & Transferência entre Filiais (Matriz / Rede de Drogarias) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP a arquitetura corporativa multi-empresa para redes de drogarias (Matriz e Filiais), compreendendo:
1. Cadastro e Gestão de Lojas/Filiais (`StoreService`): Suporte a Matriz e Filiais com dados fiscais completos, inicialização com Loja Matriz Padrão (Loja 1) e retrocompatibilidade com todas as fases anteriores.
2. Segregação de Estoque Físico e FEFO por Loja (`batches.store_id`): Estoque isolado por filial com controle independente de validade e reservas.
3. Consulta de Estoque em Rede em Tempo Real (`NetworkStockLookup`): Visibilidade instantânea no Balcão e PDV de saldos físicos e disponíveis em todas as filiais vizinhas para salvar vendas.
4. Transferências de Mercadorias entre Filiais (`TransferService`): Ciclo de vida completo (`DRAFT` -> `REQUESTED` -> `IN_TRANSIT` -> `RECEIVED` / `CANCELLED`), dedução e incorporação atômica de lotes FEFO e estorno seguro em caso de cancelamento.
5. Romaneio de Transferência & Integração Fiscal NF-e Modelo 55: Romaneio documental para transporte/conferência e emissão de NF-e com CFOP 5.152 (estadual) ou 6.152 (interestadual).
6. Frontend Multi-Loja React: Contexto global `StoreContext`, seletor de loja ativa no Topbar, modal de consulta de estoque em rede no Balcão e página completa de Gestão de Filiais e Transferências.

**Architecture:** Módulos `src/modules/stores/` e `src/modules/transfers/` integrados ao banco SQLite WAL (Migration 008), rotas REST Fastify `/api/stores/*` e `/api/transfers/*` com validação defensiva Zod, e interface React no frontend (`StoreContext`, `StoreSelector`, `NetworkStockModal`, `MultiStorePage`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-18-farma-erp-phase9-multi-store-transfers.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 726 testes anteriores devem continuar passando sem regressão.
- **Retrocompatibilidade:** A Loja 1 ('MATRIZ') deve ser criada como Matriz padrão e todos os lotes legados associados a ela.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 008 & Tipos de Domínio Multi-Loja & Transferências

**Files:**
- Create: `src/database/migrations/008_multi_store_transfers.sql`
- Create: `src/modules/stores/types.ts`
- Create: `src/modules/transfers/types.ts`
- Test: `tests/modules/stores/schema.test.ts`

**Interfaces:**
- Produces:
  - Tabela `stores` (id, code, name, company_name, cnpj, ie, is_headquarters, phone, email, street, number, neighborhood, city, state, zip_code, ibge_code, tax_regime, is_active, created_at, updated_at).
  - Loja Matriz Padrão inserida automaticamente no Seed/Migration (id=1, code='LJ01', name='FarmaCore Matriz Centro', cnpj='12.345.678/0001-90', is_headquarters=1).
  - Alteração nas tabelas `batches`, `pre_sales`, `sales`, `cash_sessions` adicionando a coluna `store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id)`.
  - Tabela `transfers` (id, transfer_number, source_store_id, target_store_id, status, requested_by, dispatched_by, received_by, carrier_name, tracking_code, notes, nfe_key, nfe_protocol, cfop, dispatched_at, received_at, created_at, updated_at).
  - Tabela `transfer_items` (id, transfer_id, product_id, source_batch_id, batch_number, expiration_date, manufacturing_date, requested_quantity, shipped_quantity, received_quantity, unit_cost, total_cost, created_at).
  - Índices de performance para multi-loja e transferências.
  - Tipos TypeScript em `src/modules/stores/types.ts` e `src/modules/transfers/types.ts`.

- [ ] **Step 1: Escrever testes que falham para o Schema 008 e Tipos**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `008_multi_store_transfers.sql` e arquivos de tipos**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Serviço de Gestão de Lojas & Consulta de Estoque em Rede (`StoreService`)

**Files:**
- Create: `src/modules/stores/store.service.ts`
- Test: `tests/modules/stores/store.service.test.ts`

**Interfaces:**
- Produces:
  - `listStores(filter?: { activeOnly?: boolean }): Store[]`
  - `getStoreById(id: number): Store | null`
  - `createStore(data: CreateStoreInput): Store` (valida CNPJ único e regra de unicidade de Matriz)
  - `updateStore(id: number, data: UpdateStoreInput): Store`
  - `getNetworkProductStock(productId: number): NetworkStockItem[]` (retorna saldo total, reservado e disponível por loja na rede, com validade mais próxima)

- [ ] **Step 1: Escrever testes que falham para `store.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/stores/store.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Serviço de Transferência entre Filiais (`TransferService`)

**Files:**
- Create: `src/modules/transfers/transfer.service.ts`
- Test: `tests/modules/transfers/transfer.service.test.ts`

**Interfaces:**
- Produces:
  - `createTransfer(input: CreateTransferInput): Transfer`
  - `dispatchTransfer(transferId: number, dispatchedBy: string, carrierInfo?: CarrierInfo): Transfer`
    - Deduz quantidade por FEFO do estoque da loja de origem.
    - Atualiza status para `IN_TRANSIT` e registra `dispatched_at`.
  - `receiveTransfer(transferId: number, receivedBy: string, itemsConfirmed?: ReceiveItemInput[]): Transfer`
    - Cria ou incrementa os lotes na loja de destino com exatos dados do lote de origem (número, validade, fabricante).
    - Atualiza status para `RECEIVED` e registra `received_at`.
  - `cancelTransfer(transferId: number, reason: string): Transfer`
    - Se estava `IN_TRANSIT`, estorna o estoque de volta para os lotes da loja de origem.
    - Atualiza status para `CANCELLED`.
  - `getTransferById(id: number): TransferWithItems | null`
  - `listTransfers(filters?: TransferFilters): { transfers: TransferWithItems[]; total: number }`

- [ ] **Step 1: Escrever testes que falham para `transfer.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/transfers/transfer.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Romaneio de Transferência e Emissão de NF-e Mod. 55 de Transferência

**Files:**
- Create: `src/modules/transfers/transfer-slip-formatter.ts`
- Create: `src/modules/transfers/transfer-fiscal.service.ts`
- Test: `tests/modules/transfers/transfer-slip.test.ts`
- Test: `tests/modules/transfers/transfer-fiscal.test.ts`

**Interfaces:**
- Produces:
  - `formatTransferSlip(transfer: TransferWithItems, sourceStore: Store, targetStore: Store): string` (Romaneio formatado com dados da carga, lotes, validades e canhoto de recebimento)
  - `emitTransferNfe(transferId: number): Promise<FiscalInvoiceTransferResult>` (Emissão de NF-e Mod. 55 com CFOP 5.152 estadual ou 6.152 interestadual)

- [ ] **Step 1: Escrever testes que falham para Romaneio e NF-e de Transferência**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar `transfer-slip-formatter.ts` e `transfer-fiscal.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passam**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Rotas REST Fastify (`/api/stores/*` e `/api/transfers/*`)

**Files:**
- Create: `src/modules/stores/store.routes.ts`
- Create: `src/modules/transfers/transfer.routes.ts`
- Modify: `src/server.ts` (ou `src/app.ts`)
- Test: `tests/modules/stores/store.routes.test.ts`
- Test: `tests/modules/transfers/transfer.routes.test.ts`

**Interfaces:**
- Endpoints:
  - `GET /api/stores`, `GET /api/stores/:id`, `POST /api/stores`, `PUT /api/stores/:id`
  - `GET /api/stores/network-stock/:productId`
  - `GET /api/transfers`, `GET /api/transfers/:id`, `POST /api/transfers`
  - `POST /api/transfers/:id/dispatch`, `POST /api/transfers/:id/receive`, `POST /api/transfers/:id/cancel`
  - `GET /api/transfers/:id/slip`, `POST /api/transfers/:id/emit-nfe`

- [ ] **Step 1: Escrever testes de integração para as rotas com Fastify inject**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar `store.routes.ts`, `transfer.routes.ts` e registrar no server**
- [ ] **Step 4: Executar teste para verificar que passam (status 200, 201, 400, 404, 409)**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Contexto Multi-Loja, Seletor no Topbar, Modal de Estoque em Rede no Balcão e Página de Transferências

**Files:**
- Create: `frontend/src/contexts/StoreContext.tsx`
- Create: `frontend/src/components/NetworkStockModal.tsx`
- Create: `frontend/src/pages/MultiStorePage.tsx`
- Modify: `frontend/src/components/Navbar.tsx` (ou componente de cabeçalho do app)
- Modify: `frontend/src/pages/CounterPage.tsx`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/pages/MultiStorePage.test.tsx` (ou testes vitest)

**Interfaces:**
- Produces:
  - `StoreContext`: Provê `currentStore`, `setCurrentStore`, `stores`, `loadingStores`.
  - Dropdown elegante de seleção de filial no Topbar com persistência no `localStorage`.
  - Botão "Rede de Lojas" no Balcão (`CounterPage`) abrindo `NetworkStockModal` com saldo de outras filiais.
  - Página completa `MultiStorePage` com abas: Lojas Cadastradas, Gestão de Transferências e Consulta Global de Estoque.
  - Modais para Criar Transferência, Visualizar Romaneio e Acompanhar Status.

- [ ] **Step 1: Escrever testes para o StoreContext e MultiStorePage**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar componentes, contexto, API adapter e telas React**
- [ ] **Step 4: Executar teste para verificar que passam e checar TypeScript frontend**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 9

**Files:**
- Test: Suíte completa de testes (`npm.cmd test`)
- Verify: `npx.cmd tsc --noEmit` (backend)
- Verify: `npx.cmd tsc -p frontend/tsconfig.json --noEmit` (frontend)
- Verify: `npm.cmd run build:web` (produção frontend)

- [ ] **Step 1: Rodar auditoria completa de testes e checagem de tipos**
- [ ] **Step 2: Corrigir qualquer aviso ou inconsistência de regressão**
- [ ] **Step 3: Garantir 100% de testes passando e build web limpo**
- [ ] **Step 4: Git commit final da Fase 9 e instruções de push para o usuário**
