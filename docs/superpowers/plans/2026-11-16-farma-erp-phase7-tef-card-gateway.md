# FarmaCore ERP — Fase 7: TEF Integrado / Dedicado (Transferência Eletrônica de Fundos) & Gateway de Adquirentes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo de TEF Integrado/Dedicado (Transferência Eletrônica de Fundos), eliminando máquinas avulsas de cartão e conectando o PDV diretamente ao PinPad físico ou simulador. O sistema gerencia o ciclo completo de pagamentos com cartão (`pay` -> `confirm` -> `undo` -> `cancel`), emite comprovantes térmicos de 48 colunas ESC/POS (Vias Cliente e Estabelecimento), alimenta o grupo fiscal obrigatório `<card>` da NFC-e (SEFAZ 4.00 com `tpIntegra=1`, CNPJ da adquirente, bandeira e autorização), e oferece interface ergonômica de PinPad no caixa.

**Architecture:** Abordagem 1 (Gateway TEF Unificado Multi-Provedor — Padrão InovaFarma / Linx):
- O backend Fastify + SQLite WAL ganha o módulo `src/modules/tef/` contendo o contrato agnóstico `TefProvider`, o simulador oficial `TefMockProvider` (para desenvolvimento e testes unitários 100% offline no Vitest com suporte a cenários determinísticos via centavos e mockScenario), o formatador de Comprovante TEF de 48 colunas `tef-receipt-formatter.ts`, e o orquestrador `TefService`.
- O motor fiscal NFC-e (`src/modules/fiscal/xml-builder.ts`) é estendido para emitir o grupo `<card>` com sanitização de 14 dígitos de CNPJ e tabela expandida de bandeiras/vouchers farmacêuticos.
- O módulo de vendas e caixa (`src/modules/pos/`) é integrado para amarrar transações TEF aos pagamentos (`sale_payments`), confirmar automaticamente ao emitir a NFC-e ou acionar desfazimento imediato (`undo`) caso a venda seja abortada.
- O frontend React/Tailwind ganha o modal interativo de PinPad `TefPinpadModal.tsx` com simulação visual de inserção de cartão, senha e adquirente, atalho `[F8] TEF PinPad` no `PaymentModal`, e visualizador/impressão de comprovantes térmicos em `TefReceiptModal.tsx`.

**Tech Stack:** Node.js 18+, TypeScript (strict mode), Fastify, SQLite WAL (`node:sqlite`), `node:crypto`, React 18, Vite, Tailwind CSS, Lucide React, Vitest 3.2+.

**Spec:** `docs/specs/2026-11-16-farma-erp-phase7-tef-card-gateway.md`

## Global Constraints
- Node.js 18+ e TypeScript em strict mode (`strict: true`, `noUnusedLocals: true`).
- SQLite nativo via `node:sqlite` com modo WAL e transações aninhadas seguras via `SAVEPOINT`.
- PCI-DSS Compliance: Nunca trafegar ou persistir trilha magnética, PAN completo ou CVV. Apenas os últimos 4 dígitos mascarados (`card_last_four`) são armazenados.
- SEFAZ NFC-e Layout 4.00: O grupo `<card>` exige `<tpIntegra>1</tpIntegra>`, `<CNPJ>` limpo com 14 dígitos numéricos, `<tBand>` de 2 dígitos e `<cAut>`.
- Ciclo de Vida: Distinção inequívoca entre Desfazimento Técnico (`undo` / `REVERSED`) e Cancelamento Administrativo pós-venda (`cancel` / `CANCELLED`).

## Review Focus
1. **Desfazimento Automático por Falha:** Se a emissão da NFC-e ou persistência da venda falhar após o cartão ser autorizado, o sistema deve acionar automaticamente `tefService.undo()` liberando a retenção do cartão.
2. **Conformidade Fiscal SEFAZ:** Geração correta do nó `<card>` no XML da NFC-e com CNPJ adquirente sem pontuação e código de bandeira mapeado.
3. **Simulador Determinístico:** `TefMockProvider` deve reproduzir fielmente os cenários de aprovação, senha incorreta, saldo insuficiente e cancelamento pelo cliente.
4. **Comprovante Não Fiscal Vinculado (TEF):** Emissão de 48 colunas com quebras e comandos de corte ESC/POS `\x1b\x69`.
5. **Zero Regressão:** 100% dos 532 testes existentes das Fases 1 a 6 devem continuar passando.

---

### Task 1: Backend — Migração Schema 006 (`006_tef_card_gateway.sql`) & Tipos de Domínio

**Files:**
- Create: `src/database/migrations/006_tef_card_gateway.sql`
- Create: `src/modules/tef/types.ts`
- Test: `tests/modules/tef/schema.test.ts`

**Interfaces:**
- Produces:
  - `TefConfig`: id, providerId, providerName, environment, terminalId, merchantId, ipAddress, port, isActive, credentialsJson, createdAt, updatedAt.
  - `TefTransaction`: id, transactionUuid, providerId, terminalId, saleId, paymentId, operationType, status, amount, installments, installmentType, brandName, brandCodeSefaz, acquirerName, acquirerCnpj, authorizationCode, nsu, hostNsu, cardLastFour, customerReceipt, merchantReceipt, cancellationReceipt, failureReason, reversalReason, cancellationNsu, cancellationReason, mdrRate, netAmount, expectedSettlementDate, batchNumber, createdAt, confirmedAt, reversedAt, cancelledAt.
  - Colunas adicionadas em `sale_payments`: `tef_transaction_id`, `tef_nsu`.

- [x] **Step 1: Write failing tests for TEF schema 006 & domain types**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement migration `006_tef_card_gateway.sql` and `src/modules/tef/types.ts`**
- [x] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/schema.test.ts"`
Expected: PASS.

---

### Task 2: Backend — Contrato `TefProvider` & Simulador Oficial `TefMockProvider`

**Files:**
- Create: `src/modules/tef/providers/tef-provider.interface.ts`
- Create: `src/modules/tef/providers/tef-mock-provider.ts`
- Test: `tests/modules/tef/tef-mock-provider.test.ts`

**Interfaces:**
- Produces:
  - `TefProvider`: interface com `pay()`, `confirm()`, `undo()`, `cancel()`.
  - `TefMockProvider`: simulador com gatilhos via `mockScenario` e via centavos (.01 sucesso, .02 senha incorreta, .03 saldo insuficiente, .04 cancelamento cliente, .05 timeout).
  - Sanitização de CNPJ para 14 dígitos e De-Para de bandeiras/vouchers SEFAZ.

- [ ] **Step 1: Write failing tests for `TefMockProvider`**

Create `tests/modules/tef/tef-mock-provider.test.ts`:
```ts
describe('TefMockProvider (PinPad & Adquirer Simulator)', () => {
  it('should authorize debit payment with approved status and NSU', async () => {});
  it('should authorize credit payment with installments and correct SEFAZ brand code', async () => {});
  it('should reject payment when mockScenario is WRONG_PIN or amount ends in .02', async () => {});
  it('should reject payment when mockScenario is INSUFFICIENT_FUNDS or amount ends in .03', async () => {});
  it('should reject payment when mockScenario is USER_CANCELLED or amount ends in .04', async () => {});
  it('should confirm transaction and return confirmedAt timestamp', async () => {});
  it('should undo transaction returning reversal status', async () => {});
  it('should cancel transaction generating cancellation receipt and NSU', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/tef-mock-provider.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `TefMockProvider` and provider interface**

1. Implement `src/modules/tef/providers/tef-provider.interface.ts`.
2. Implement `src/modules/tef/providers/tef-mock-provider.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/tef-mock-provider.test.ts"`
Expected: PASS.

---

### Task 3: Backend — Formatador de Comprovante TEF ESC/POS 48 Colunas (`tef-receipt-formatter.ts`)

**Files:**
- Create: `src/modules/tef/tef-receipt-formatter.ts`
- Test: `tests/modules/tef/tef-receipt-formatter.test.ts`

**Interfaces:**
- Produces:
  - `formatTefReceipt(transaction: TefTransaction, storeInfo: StoreInfo): { customerReceipt: string; merchantReceipt: string; fullEscPos: string }`
  - `formatTefCancellationReceipt(transaction: TefTransaction, storeInfo: StoreInfo): { customerReceipt: string; merchantReceipt: string; fullEscPos: string }`
  - Formatação em 48 colunas com separadores, dados da adquirente, bandeira, cartão mascarado, NSU, autorização, valor e corte ESC/POS `\x1b\x69`.

- [ ] **Step 1: Write failing tests for `tef-receipt-formatter.ts`**

Create `tests/modules/tef/tef-receipt-formatter.test.ts`:
```ts
describe('TEF Receipt Formatter (48 Columns ESC/POS)', () => {
  it('should format 1st copy (Cliente) with masked card, NSU, auth code, and amount', () => {});
  it('should format 2nd copy (Estabelecimento) with NFC-e reference and store control', () => {});
  it('should format cancellation/reversal slip with cancellation NSU and timestamp', () => {});
  it('should respect exact 48 columns limit per line without line overflow', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/tef-receipt-formatter.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `src/modules/tef/tef-receipt-formatter.ts`**

1. Helper de alinhamento e largura máxima de 48 colunas.
2. Formatação da Via do Cliente e Via do Estabelecimento.
3. Formatação da Via de Estorno/Cancelamento.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/tef-receipt-formatter.test.ts"`
Expected: PASS.

---

### Task 4: Backend — Serviço TEF e Orquestração (`TefService`)

**Files:**
- Create: `src/modules/tef/tef.service.ts`
- Test: `tests/modules/tef/tef-service.test.ts`

**Interfaces:**
- Produces:
  - `TefService`: métodos `pay()`, `confirm()`, `undo()`, `cancel()`, `getTransactionByNsu()`, `getTransactionByUuid()`, `listTransactions()`, `getReceiptText()`, `getConfig()`, `updateConfig()`.
  - Persistência atômica no SQLite da tabela `tef_transactions`.
  - Bloqueio de confirmação em transações canceladas/desfeitas e idempotência.

- [ ] **Step 1: Write failing tests for `TefService`**

Create `tests/modules/tef/tef-service.test.ts`:
```ts
describe('TefService Lifecycle', () => {
  it('should authorize TEF transaction and save with status AUTHORIZED', async () => {});
  it('should confirm transaction linking to saleId and updating status to CONFIRMED', async () => {});
  it('should undo authorized transaction updating status to REVERSED', async () => {});
  it('should cancel confirmed transaction generating cancellation NSU and receipt', async () => {});
  it('should reject confirming already confirmed or reversed transaction', async () => {});
  it('should generate printable 48-column receipts for transaction', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/tef-service.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `src/modules/tef/tef.service.ts`**

1. Inicialização de provedores e injeção do `Database`.
2. Métodos `pay`, `confirm`, `undo`, `cancel`, `listTransactions`, `getReceiptText`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/tef/tef-service.test.ts"`
Expected: PASS.

---

### Task 5: Backend — Integração com Motor Fiscal NFC-e (Grupo `<card>`) & Checkout PDV

**Files:**
- Modify: `src/modules/fiscal/types.ts`
- Modify: `src/modules/fiscal/xml-builder.ts`
- Modify: `src/modules/pos/types.ts`
- Modify: `src/modules/pos/pos.service.ts`
- Test: `tests/modules/fiscal/xml-builder-card.test.ts`
- Test: `tests/modules/pos/pos-tef-integration.test.ts`

**Interfaces:**
- Produces:
  - Adição do grupo fiscal `<card>` no XML da NFC-e: `<tpIntegra>1</tpIntegra>`, `<CNPJ>`, `<tBand>`, `<cAut>`.
  - Suporte a `tefTransactionUuid` e dados de cartão em `PaymentItem`.
  - Vinculação de `tef_transaction_id` e `tef_nsu` em `sale_payments`.
  - No checkout: confirmação das transações TEF vinculadas à venda, ou desfazimento automático (`undo`) se o checkout falhar.

- [ ] **Step 1: Write failing tests for NFC-e `<card>` group & POS TEF integration**

1. Create `tests/modules/fiscal/xml-builder-card.test.ts`:
```ts
describe('NFC-e XML Builder - Card Group Integration', () => {
  it('should include <card> group with tpIntegra 1, sanitized 14-digit CNPJ, tBand and cAut when payment has card data', () => {});
  it('should omit <card> group for non-card payments', () => {});
});
```
2. Create `tests/modules/pos/pos-tef-integration.test.ts`:
```ts
describe('POS Checkout with TEF Integration', () => {
  it('should complete checkout with TEF payment, link transaction and confirm automatically', async () => {});
  it('should record tef_transaction_id in sale_payments', async () => {});
  it('should automatically undo TEF transaction if checkout transaction fails', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/xml-builder-card.test.ts tests/modules/pos/pos-tef-integration.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement NFC-e `<card>` builder and POS TEF integration**

1. Atualizar `src/modules/fiscal/types.ts` e `xml-builder.ts`.
2. Atualizar `src/modules/pos/types.ts` e `pos.service.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/xml-builder-card.test.ts tests/modules/pos/pos-tef-integration.test.ts"`
Expected: PASS.

---

### Task 6: Backend — Rotas REST Fastify (`/api/tef/*`)

**Files:**
- Create: `src/api/routes.tef.ts` (ou adicionar em `src/api/routes.ts`)
- Modify: `src/api/routes.ts`
- Test: `tests/api/routes.tef.test.ts`

**Interfaces:**
- Produces:
  - Endpoints REST Fastify `/api/tef/providers`, `/api/tef/pay`, `/api/tef/confirm`, `/api/tef/undo`, `/api/tef/cancel`, `/api/tef/transactions`, `/api/tef/transactions/:nsu/receipt`, `/api/tef/config`.

- [ ] **Step 1: Write failing tests for TEF REST routes**

Create `tests/api/routes.tef.test.ts`:
```ts
describe('Fastify TEF Routes (/api/tef/*)', () => {
  it('POST /api/tef/pay should authorize payment and return NSU and receipt', async () => {});
  it('POST /api/tef/confirm should confirm transaction with saleId', async () => {});
  it('POST /api/tef/undo should undo transaction', async () => {});
  it('POST /api/tef/cancel should cancel transaction and return cancellation NSU', async () => {});
  it('GET /api/tef/transactions should list transactions with filters', async () => {});
  it('GET /api/tef/transactions/:nsu/receipt should return 48-column printable slips', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/api/routes.tef.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement TEF REST routes in Fastify**

1. Adicionar rotas com validação Zod.
2. Injetar `TefService` em `routes.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/api/routes.tef.test.ts"`
Expected: PASS.

---

### Task 7: Frontend React — Modal do PinPad (`TefPinpadModal.tsx`), Comprovante & Integração no Caixa

**Files:**
- Create: `frontend/src/types/tef.ts`
- Create: `frontend/src/components/tef/TefPinpadModal.tsx`
- Create: `frontend/src/components/tef/TefReceiptModal.tsx`
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/components/pos/PaymentModal.tsx`
- Modify: `frontend/src/components/pos/SaleReceiptModal.tsx`
- Modify: `frontend/src/pages/PosPage.tsx`
- Test: `frontend/tests/components/TefPinpadModal.test.tsx`

**Interfaces:**
- Produces:
  - `tefApi` em `frontend/src/services/api.ts`.
  - `TefPinpadModal.tsx`: modal com simulação de PinPad (Inserir Cartão, Senha, Processando, Aprovado/Recusado).
  - Botão `[F8] Pagar com TEF (PinPad)` em `PaymentModal.tsx`.
  - Botão de impressão de comprovante TEF em `SaleReceiptModal.tsx`.

- [ ] **Step 1: Write failing frontend tests for `TefPinpadModal`**

Create `frontend/tests/components/TefPinpadModal.test.tsx`:
```tsx
describe('TefPinpadModal Component', () => {
  it('should render modal with waiting card message when isOpen is true', () => {});
  it('should trigger pay API and advance through PinPad states to approved', async () => {});
  it('should display error when payment is rejected', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npm run test -- frontend/tests/components/TefPinpadModal.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement Frontend TEF Components & Integration**

1. Implementar `frontend/src/types/tef.ts` e `tefApi` em `api.ts`.
2. Implementar `TefPinpadModal.tsx` e `TefReceiptModal.tsx`.
3. Integrar no `PaymentModal.tsx` e `SaleReceiptModal.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npm run test -- frontend/tests/components/TefPinpadModal.test.tsx"`
Expected: PASS.

---

### Task 8: Verificação Completa, Regressão Zero & Build Web

**Files:**
- Full test suite run (`npm test`)
- TypeScript check (`npx tsc --noEmit` & `npm run build:web`)

- [ ] **Step 1: Run complete test suite**

Run: `cmd.exe /c "npm test"`
Expected: 100% dos testes passando (Fases 1 a 6 + Fase 7).

- [ ] **Step 2: Run web build and typecheck**

Run: `cmd.exe /c "npm run build:web && npx tsc --noEmit"`
Expected: Build concluído com sucesso e 0 erros de TypeScript.

- [ ] **Step 3: Git commit with semantic message**

Run: `cmd.exe /c "git status"`
