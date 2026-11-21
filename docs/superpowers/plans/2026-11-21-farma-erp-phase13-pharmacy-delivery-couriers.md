# FarmaCore ERP — Fase 13: Delivery Farmacêutico, Tele-Entrega & Gestão de Motoboys com Acerto no Caixa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo completo de Tele-Entrega Farmacêutica, Central de Pedidos, Gestão de Entregadores (Motoboys), Roteirização por Romaneio e Acerto de Contas com integração na gaveta de caixa do PDV:
1. Modelagem relacional e Schema 012 (`delivery_zones`, `couriers`, `delivery_orders`, `delivery_order_items`, `delivery_dispatches`).
2. Gestão de Pedidos e Ciclo de Vida: `RECEIVED` $\to$ `PREPARING` $\to$ `READY_FOR_PICKUP` $\to$ `DISPATCHED` $\to$ `DELIVERED` / `RETURNED` / `CANCELLED` (`DeliveryOrderService`).
3. Gestão de Entregadores, Comissões, Status em Tempo Real e Tabela de Taxas por Bairro (`CourierService`).
4. Roteirização de Despacho com geração de Romaneio e Acerto de Contas no Caixa PDV com entrada formal em `cash_movements` (`DeliverySettlementService`).
5. Formatadores Térmicos ESC/POS de 48 colunas (Romaneio de Despacho do Motoboy, Etiqueta de Pacote e Recibo de Acerto) e Rotas Fastify `/api/delivery/*` com validação Zod.
6. Interface Frontend React com Posto `[F11] Delivery & Tele-Entrega`, Kanban interativo de pedidos, módulo de despacho de motoboys e tela de acerto financeiro.

**Architecture:** Módulo `src/modules/delivery/` integrado ao SQLite WAL (Migration 012), rotas Fastify `/api/delivery/*` com validação Zod, e interface React (`DeliveryPage`, `NewDeliveryOrderModal`, `DispatchModal`, `SettlementModal`, `CourierModal`, `ZoneModal`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-21-farma-erp-phase13-pharmacy-delivery-couriers.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 1.112 testes anteriores devem continuar passando sem regressão.
- **Movimentação Financeira no Caixa:** Todo acerto de dinheiro recebido por motoboy é integrado formalmente na sessão de caixa aberta (`cash_movements` com `type = 'SUPPLY'` e motivo `ACERTO_DELIVERY`).
- **Validade Jurídica e Rastreabilidade:** Toda tele-entrega armazena carimbos temporais de cada transição, identificação do motoboy e itens conferidos.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 012 & Tipos de Domínio de Delivery, Entregadores e Romaneios

**Files:**
- Create: `src/database/migrations/012_delivery_couriers_dispatches.sql`
- Create: `src/modules/delivery/types.ts`
- Test: `tests/modules/delivery/schema.test.ts`

**Interfaces:**
- Produces:
  - Tabelas: `delivery_zones`, `couriers`, `delivery_orders`, `delivery_order_items`, `delivery_dispatches`.
  - Índices de performance para busca por status, entregador, despacho, cliente e bairros.
  - Tipos TypeScript em `src/modules/delivery/types.ts`.

- [ ] **Step 1: Escrever testes que falham para o Schema 012 e Tipos**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `012_delivery_couriers_dispatches.sql` e `types.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Gestão de Pedidos de Tele-Entrega e Máquina de Estados (`DeliveryOrderService`)

**Files:**
- Create: `src/modules/delivery/delivery-order.service.ts`
- Test: `tests/modules/delivery/delivery-order.service.test.ts`

**Interfaces:**
- Produces:
  - `createDeliveryOrder(input: CreateDeliveryOrderInput): DeliveryOrderWithItems`
    - Gera numeração `DEL-YYYYMM-XXXX`.
    - Calcula taxa de entrega automaticamente por bairro (`delivery_zones`) ou aplica frete grátis se atingir valor mínimo.
    - Valida troco se a forma de pagamento for `DINHEIRO` (`change_for >= total_amount`).
    - Salva itens do pedido com lote e validade.
  - `updateOrderStatus(id: number, targetStatus: DeliveryOrderStatus, options?: UpdateStatusOptions): DeliveryOrderWithItems`
    - Máquina de estados: `RECEIVED` $\to$ `PREPARING` $\to$ `READY_FOR_PICKUP` $\to$ `DISPATCHED` $\to$ `DELIVERED` / `RETURNED` / `CANCELLED`.
    - Validações de pré-requisitos e gravação de timestamps.
  - `getDeliveryOrderById(id: number): DeliveryOrderWithItems | null`
  - `listDeliveryOrders(filters?: DeliveryOrderFilters): { orders: DeliveryOrderWithItems[]; total: number }`
  - `cancelDeliveryOrder(id: number, reason: string): DeliveryOrderWithItems`

- [ ] **Step 1: Escrever testes que falham para `delivery-order.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/delivery/delivery-order.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Cadastro e Gestão de Entregadores & Zonas de Entrega (`CourierService`)

**Files:**
- Create: `src/modules/delivery/courier.service.ts`
- Test: `tests/modules/delivery/courier.service.test.ts`

**Interfaces:**
- Produces:
  - `createCourier(input: CreateCourierInput): Courier` (validação de CPF único, CNH e defaults)
  - `updateCourier(id: number, input: UpdateCourierInput): Courier`
  - `getCourierById(id: number): Courier | null`
  - `listCouriers(filters?: CourierFilters): Courier[]`
  - `createDeliveryZone(input: CreateZoneInput): DeliveryZone`
  - `updateDeliveryZone(id: number, input: UpdateZoneInput): DeliveryZone`
  - `listDeliveryZones(storeId?: number): DeliveryZone[]`
  - `calculateDeliveryFee(neighborhood: string, city: string, subtotal: number, storeId?: number): { fee: number; estimatedMinutes: number; isFree: boolean }`

- [ ] **Step 1: Escrever testes que falham para `courier.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/delivery/courier.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Roteirização, Despacho e Acerto de Contas no Caixa PDV (`DeliverySettlementService`)

**Files:**
- Create: `src/modules/delivery/delivery-settlement.service.ts`
- Test: `tests/modules/delivery/delivery-settlement.service.test.ts`

**Interfaces:**
- Produces:
  - `createDispatch(storeId: number, courierId: number, orderIds: number[]): DeliveryDispatchWithOrders`
    - Agrupa pedidos `READY_FOR_PICKUP`.
    - Gera numeração `ROM-YYYYMM-XXXX`.
    - Transição atômica dos pedidos para `DISPATCHED` vinculando `courier_id` e `dispatch_id`.
    - Atualiza status do entregador para `ON_DELIVERY`.
    - Totaliza valores a cobrar e troco que o motoboy deve portar.
  - `settleDispatch(dispatchId: number, params: SettleDispatchParams): SettlementResult`
    - Executado em transação atômica SQLite:
      - Confere pedidos entregues (`DELIVERED`) e pedidos não entregues (`RETURNED`).
      - Totaliza por forma de pagamento: Dinheiro, Cartão e PIX.
      - Se houver `DINHEIRO` e fornecido `cashSessionId`, insere registro em `cash_movements` com `type = 'SUPPLY'` e motivo detalhado de acerto de delivery, alimentando o caixa.
      - Calcula comissão total do entregador (`totalDelivered * commissionPerDelivery + dailyAllowance`).
      - Atualiza o romaneio para `SETTLED` com carimbo temporal e operador.
      - Restaura status do motoboy para `AVAILABLE`.
      - Retorna `SettlementResult` com comprovante textual de acerto.
  - `getDispatchById(id: number): DeliveryDispatchWithOrders | null`
  - `listDispatches(filters?: DispatchFilters): DeliveryDispatchWithOrders[]`

- [ ] **Step 1: Escrever testes que falham para `delivery-settlement.service.ts`**
- [ ] **Step 2: Executar teste para verificar que falha**
- [ ] **Step 3: Implementar `src/modules/delivery/delivery-settlement.service.ts`**
- [ ] **Step 4: Executar teste para verificar que passa**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Formatadores Térmicos ESC/POS (Romaneio, Etiqueta, Recibo) & Rotas Fastify (`/api/delivery/*`)

**Files:**
- Create: `src/modules/delivery/delivery-receipt-formatter.ts`
- Create: `src/modules/delivery/delivery.routes.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/delivery/delivery-receipt-formatter.test.ts`
- Test: `tests/api/routes.delivery.test.ts`

**Interfaces:**
- Produces:
  - `formatDeliveryDispatchSlip(dispatch: any, courier: any, orders: any[], store: any): { textSlip: string; fullEscPos: string }`
  - `formatDeliveryOrderSlip(order: any, store: any): { textSlip: string; fullEscPos: string }`
  - `formatCourierSettlementReceipt(settlement: any, courier: any, store: any): { textReceipt: string; fullEscPos: string }`
  - Rotas REST Fastify:
    - `/api/delivery/orders` (GET, POST)
    - `/api/delivery/orders/:id` (GET, PUT)
    - `/api/delivery/orders/:id/status` (PATCH)
    - `/api/delivery/orders/:id/slip` (GET)
    - `/api/delivery/couriers` (GET, POST, GET /:id, PUT /:id)
    - `/api/delivery/zones` (GET, POST, PUT /:id, DELETE /:id)
    - `/api/delivery/zones/calculate-fee` (POST)
    - `/api/delivery/dispatches` (POST, GET, GET /:id)
    - `/api/delivery/dispatches/:id/slip` (GET)
    - `/api/delivery/dispatches/:id/settle` (POST)

- [ ] **Step 1: Escrever testes que falham para formatadores e rotas Fastify**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar formatadores e rotas, conectar a `src/api/routes.ts`**
- [ ] **Step 4: Executar teste para verificar que passam**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Posto [F11] Delivery & Tele-Entrega (`DeliveryPage.tsx`), Kanban, Despacho e Modais

**Files:**
- Create: `frontend/src/types/delivery.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/DeliveryPage.tsx`
- Create: `frontend/src/components/delivery/NewDeliveryOrderModal.tsx`
- Create: `frontend/src/components/delivery/DispatchModal.tsx`
- Create: `frontend/src/components/delivery/SettlementModal.tsx`
- Create: `frontend/src/components/delivery/CourierModal.tsx`
- Create: `frontend/src/components/delivery/ZoneModal.tsx`
- Modify: `frontend/src/App.tsx` & `frontend/src/hooks/useStationMode.ts`
- Test: `frontend/tests/pages/DeliveryPage.test.tsx`

**Interfaces:**
- Produces:
  - Adiciona modo `DELIVERY` ("Posto: Delivery & Tele-Entrega") com atalho `F11`.
  - Tela completa `DeliveryPage` com 4 abas:
    1. *Central de Pedidos (Kanban de Entregas)*: Colunas visuais interativas, busca, novo pedido e avanço de status.
    2. *Roteirização & Despacho de Motoboys*: Seleção de pedidos prontos, escolha de motoboy e emissão de romaneio térmico.
    3. *Acerto de Contas no Caixa*: Conferência ao retornar à loja, baixa por forma de pagamento e entrada na gaveta.
    4. *Gestão de Entregadores & Zonas*: Cadastro de motoboys e tabela de taxas por bairro com frete grátis.
  - Modais operacionais com impressão de comprovantes térmicos.

- [ ] **Step 1: Escrever testes para a página Delivery e modais**
- [ ] **Step 2: Executar teste para verificar que falham**
- [ ] **Step 3: Implementar tipos, API adapter, componentes React e integração App**
- [ ] **Step 4: Executar teste para verificar que passam e checar TypeScript frontend**
- [ ] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 13

**Files:**
- Test: Suíte completa de testes (`npm.cmd test`)
- Verify: `npx.cmd tsc --noEmit` (backend)
- Verify: `npx.cmd tsc -p frontend/tsconfig.json --noEmit` (frontend)
- Verify: `npm.cmd run build:web` (produção frontend)

- [ ] **Step 1: Rodar auditoria completa de testes e checagem de tipos**
- [ ] **Step 2: Verificar integridade de ponta a ponta e build de produção**
- [ ] **Step 3: Despachar revisor da branch inteira e homologar**
