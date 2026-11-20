# FarmaCore ERP — Fase 12: CRM Farmacêutico, Clube de Fidelidade, Cashback & Motor de Promoções Combinadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP a suíte completa de inteligência de relacionamento, retenção de pacientes e motor de promoções combinadas do varejo farmacêutico padrão Linx Farma / Trier / InovaFarma:
1. Carteira de Fidelidade e Cashback com regras de validade, crédito e resgate no PDV (`LoyaltyService`).
2. Motor de Promoções Combinadas de Alta Performance: Leve 3 Pague 2, Desconto Progressivo por Quantidade, Combos/Cross-sell, Preço Clube da Farmácia e Desconto de Aniversariante (`PromotionEngineService`).
3. Monitoramento e Adesão a Tratamento Contínuo: cálculo de dias de suprimento, projeção de término de caixa e painel de recompra preditiva para contato farmacêutico ativo (`TreatmentAdherenceService`).
4. Extratos de Cashback em impressora térmica ESC/POS de 48 colunas e Rotas Fastify com validação Zod (`/api/crm/*`).
5. Interface Frontend React completa com Posto `[F10] CRM & Campanhas`, integração na tela de pagamento do PDV (resgate de cashback e preço clube) e painel preditivo de tratamentos crônicos.

**Architecture:** Módulo `src/modules/crm/` integrado ao SQLite WAL (Migration 011), rotas Fastify `/api/crm/*` com Zod, e interface React (`CrmPage`, `PromotionModal`, `CashbackRedeemModal`, `RefillContactModal`, extensão do `PaymentModal`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-20-farma-erp-phase12-crm-loyalty-promotions.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 1017 testes anteriores devem continuar passando sem regressão.
- **Teto CMED:** O motor de promoções nunca deve ultrapassar o Preço Máximo ao Consumidor (CMED) e garante margens monetárias não negativas.
- **Transacionalidade:** O resgate e o crédito de cashback são executados em transações atômicas no SQLite.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 011 & Tipos de Domínio do Módulo CRM, Fidelidade e Promoções

**Files:**
- Create: `src/database/migrations/011_crm_loyalty_promotions_treatments.sql`
- Create: `src/modules/crm/types.ts`
- Test: `tests/modules/crm/schema.test.ts`

**Interfaces:**
- Produces:
  - Tabelas: `loyalty_programs`, `loyalty_wallets`, `loyalty_transactions`, `promotions`, `promotion_products`, `patient_treatments`.
  - Índices em `loyalty_transactions(wallet_id)`, `promotions(is_active, start_date, end_date)`, `promotion_products(product_id)`, `patient_treatments(expected_refill_date, status)`.
  - Tipos TypeScript em `src/modules/crm/types.ts`.

- [x] **Step 1: Escrever testes que falham para o Schema 011 e Tipos**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `011_crm_loyalty_promotions_treatments.sql` e `types.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Carteira de Fidelidade e Motor de Cashback (`LoyaltyService`)

**Files:**
- Create: `src/modules/crm/loyalty.service.ts`
- Test: `tests/modules/crm/loyalty.service.test.ts`

**Interfaces:**
- Produces:
  - `getProgramConfig(storeId?: number): LoyaltyProgram`
  - `updateProgramConfig(input: UpdateLoyaltyProgramInput): LoyaltyProgram`
  - `getOrCreateWallet(customerId: number): LoyaltyWallet`
  - `calculateCashback(amount: number, storeId?: number): number`
  - `creditCashback(saleId: number, customerId: number, amount: number): LoyaltyTransaction`
  - `redeemCashback(customerId: number, saleAmount: number, requestedRedeem: number, saleId?: number): LoyaltyTransaction`
  - `getWalletStatement(customerId: number): { wallet: LoyaltyWallet; transactions: LoyaltyTransaction[] }`
  - `expireOverdueCashback(): { expiredCount: number; totalAmount: number }`

- [x] **Step 1: Escrever testes que falham para `loyalty.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/crm/loyalty.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Motor de Promoções Combinadas (`PromotionEngineService`)

**Files:**
- Create: `src/modules/crm/promotion-engine.service.ts`
- Test: `tests/modules/crm/promotion-engine.service.test.ts`

**Interfaces:**
- Produces:
  - `createPromotion(input: CreatePromotionInput): Promotion`
  - `updatePromotion(id: number, input: UpdatePromotionInput): Promotion`
  - `listPromotions(filter?: { activeOnly?: boolean }): PromotionWithProducts[]`
  - `getPromotionById(id: number): PromotionWithProducts | null`
  - `evaluateCart(cartItems: CartItemInput[], customerId?: number, storeId?: number): CartEvaluationResult`
    - Avalia 'TAKE_MORE_PAY_LESS' (Leve 3 Pague 2).
    - Avalia 'PROGRESSIVE_DISCOUNT' (Tiers por quantidade).
    - Avalia 'COMBO_CROSS_SELL' (Compre A ganhe desconto em B).
    - Avalia 'CLUB_SPECIAL_PRICE' (Preço exclusivo do Clube para cliente identificado).
    - Avalia 'BIRTHDAY_DISCOUNT' (Desconto de aniversariante do mês).
    - Retorna itens com preços finais, total de desconto promocional e nome das promoções aplicadas.

- [x] **Step 1: Escrever testes que falham para `promotion-engine.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/crm/promotion-engine.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Adesão a Tratamento Contínuo e Alerta de Recompra Preditiva (`TreatmentAdherenceService`)

**Files:**
- Create: `src/modules/crm/treatment-adherence.service.ts`
- Test: `tests/modules/crm/treatment-adherence.service.test.ts`

**Interfaces:**
- Produces:
  - `registerTreatmentFromSale(saleId: number, customerId: number, items: TreatmentItemInput[]): PatientTreatment[]`
    - Calcula `totalDaysSupply = (unitsPerBox * boxes) / dailyDose`.
    - Projeta `expectedRefillDate = saleDate + totalDaysSupply`.
  - `listUpcomingRefills(options?: { daysAhead?: number; storeId?: number; status?: string }): UpcomingRefillItem[]`
    - Retorna pacientes cuja medicação termina dentro do horizonte de dias configurado (default 5 dias).
  - `markAsContacted(treatmentId: number, notes?: string): PatientTreatment`
  - `recordRefill(treatmentId: number, newSaleId: number): PatientTreatment`

- [x] **Step 1: Escrever testes que falham para `treatment-adherence.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/crm/treatment-adherence.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Formatadores Térmicos ESC/POS e Rotas Fastify (`/api/crm/*`)

**Files:**
- Create: `src/modules/crm/crm-receipt-formatter.ts`
- Create: `src/modules/crm/crm.routes.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/crm/crm-receipt-formatter.test.ts`
- Test: `tests/api/routes.crm.test.ts`

**Interfaces:**
- Produces:
  - `formatCashbackStatement(customer: any, wallet: any, transactions: any[], store: any): { textReceipt: string; fullEscPos: string }`
  - `formatTreatmentRefillSlip(refillItem: any, store: any): { textSlip: string; fullEscPos: string }`
  - Rotas REST Fastify:
    - `/api/crm/loyalty/program` (GET, PUT)
    - `/api/crm/loyalty/wallet/:customerId` (GET)
    - `/api/crm/loyalty/wallet/:customerId/statement` (GET)
    - `/api/crm/loyalty/redeem` (POST)
    - `/api/crm/promotions` (GET, POST)
    - `/api/crm/promotions/:id` (GET, PUT, DELETE)
    - `/api/crm/promotions/evaluate` (POST)
    - `/api/crm/treatments` (GET, POST)
    - `/api/crm/treatments/upcoming` (GET)
    - `/api/crm/treatments/:id/contact` (POST)

- [x] **Step 1: Escrever testes que falham para formatadores e rotas Fastify**
- [x] **Step 2: Executar teste para verificar que falham**
- [x] **Step 3: Implementar formatadores e rotas, conectar a `src/api/routes.ts`**
- [x] **Step 4: Executar teste para verificar que passam**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Posto [F10] CRM, Fidelidade & Campanhas (`CrmPage.tsx`) e Integração no Balcão/PDV

**Files:**
- Create: `frontend/src/types/crm.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/CrmPage.tsx`
- Create: `frontend/src/components/crm/PromotionModal.tsx`
- Create: `frontend/src/components/crm/CashbackRedeemModal.tsx`
- Create: `frontend/src/components/crm/RefillContactModal.tsx`
- Modify: `frontend/src/components/pos/PaymentModal.tsx`
- Modify: `frontend/src/App.tsx` & `frontend/src/hooks/useStationMode.ts`
- Test: `frontend/tests/pages/CrmPage.test.tsx`

**Interfaces:**
- Produces:
  - Adiciona modo `CRM` ("Posto: CRM & Fidelidade") com atalho `F10`.
  - Tela completa `CrmPage` com 3 abas: Clube & Cashback, Campanhas & Promoções, e Tratamentos Contínuos & Recompra Preditiva.
  - No `PaymentModal` do PDV: exibição do saldo de cashback do cliente e botão "Resgatar Cashback".
  - Notificação de promoções aplicadas no carrinho.

- [x] **Step 1: Escrever testes para a página CRM e modais**
- [x] **Step 2: Executar teste para verificar que falham**
- [x] **Step 3: Implementar tipos, API adapter, componentes React e integração PDV**
- [x] **Step 4: Executar teste para verificar que passam e checar TypeScript frontend**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 12

**Files:**
- Test: Suíte completa de testes (`npm.cmd test`)
- Verify: `npx.cmd tsc --noEmit` (backend)
- Verify: `npx.cmd tsc -p frontend/tsconfig.json --noEmit` (frontend)
- Verify: `npm.cmd run build:web` (produção frontend)

- [x] **Step 1: Rodar auditoria completa de testes e checagem de tipos**
- [x] **Step 2: Verificar integridade de ponta a ponta e build de produção**
- [x] **Step 3: Despachar revisor da branch inteira e homologar**
- [ ] **Step 2: Verificar integridade de ponta a ponta e build de produção**
- [ ] **Step 3: Despachar revisor da branch inteira e homologar**
