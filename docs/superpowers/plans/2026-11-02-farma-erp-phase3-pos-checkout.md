# FarmaCore ERP — Fase 3: Frente de Caixa (PDV Híbrido) & Checkout Financeiro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o terminal desktop de Frente de Caixa (PDV Híbrido) com resgate de tickets de pré-venda, adição direta de itens de conveniência/perfumaria, gestão de turno (Abertura, Sangria, Suprimento e Fechamento), checkout multi-pagamentos (Dinheiro com troco, Cartão Crédito/Débito, Pix QR Code), baixa atômica de estoque e emissão de cupom térmico ESC/POS.

**Architecture:** Abordagem 2 (PDV Híbrido) com separação limpa: Backend estende `PosService` com tabela `cash_movements` (migração 002) e checkout unificado com transações ACID no SQLite WAL. Frontend React 18 / Tailwind implementa `PosPage.tsx`, modais de pagamento/sessão com atalhos de teclado ágeis (`F2`, `F5`, `F7`, `F8`, `F10`, `F12`, `Esc`) e suporte a postos fixos de trabalho (`farmacore_station_mode`).

**Tech Stack:** Node.js 18+, TypeScript (strict mode), Fastify, SQLite WAL (`node:sqlite`), React 18, Vite, Tailwind CSS, Lucide React, Vitest 3.2+ (threads pool), Testing Library.

**Spec:** `docs/specs/2026-11-02-farma-erp-phase3-pos-checkout.md`

## Global Constraints
- Node.js 18+ e TypeScript em strict mode (`strict: true`, `noUnusedLocals: true`).
- SQLite nativo via `node:sqlite` com modo WAL e transações aninhadas seguras via `SAVEPOINT`.
- Conformidade regulatória sanitária (Portaria Anvisa 344/98 e RDC 20/2011): proibida venda direta de medicamentos controlados no caixa; apenas itens com `controlType === 'ISENTO'` podem ser bipados diretamente na conveniência do PDV.
- Invariante fiscal/financeiro: troco só pode ser gerado a partir de pagamentos em `DINHEIRO` (`EXCESS_NON_CASH_PAYMENT`); pagamentos parciais devem somar exatamente ou mais que o total (`INSUFFICIENT_PAYMENT`).
- Ergonomia de PDV: operação completa por teclado sem necessidade de mouse, com atalhos padrão de drogaria brasileira (`F2`, `F5`, `F7`, `F8`, `F10`, `F12`, `Esc`).

## Review Focus
1. **Tentativa de Bipar Medicamento Controlado no Caixa:** Se o operador escanear o EAN de um medicamento com `controlType !== 'ISENTO'` na conveniência direta do caixa, o sistema deve rejeitar a inclusão e exibir alerta exigindo pré-atendimento no balcão.
2. **Sangria Superior ao Saldo em Gaveta:** Registrar retirada (`SANGRIA`) com valor maior que o saldo em dinheiro disponível (`current_cash`) deve lançar erro `INSUFFICIENT_DRAWER_CASH` e impedir a transação.
3. **Tentativa de Troco com Cartão ou Pix:** Submissão de pagamento onde o total pago excede o total da venda, mas o valor em `DINHEIRO` é menor que o troco resultante, deve lançar `EXCESS_NON_CASH_PAYMENT`.
4. **Fechamento de Caixa com Venda em Andamento ou Caixa Fechado:** Fechar sessão já fechada (`SESSION_NOT_OPEN`) ou tentar nova venda com caixa fechado (`NO_OPEN_SESSION`) deve ser bloqueado na interface e no backend.
5. **Dedução de Estoque Dupla ou Concorrente:** O checkout da pré-venda já reserva os lotes; a finalização deve debitar atomicamente e converter o status da pré-venda para `CONVERTED_TO_SALE`, evitando que o mesmo ticket seja faturado duas vezes.

---

### Task 1: Backend — Movimentações de Caixa (Sangria/Suprimento) & Migração 002

**Files:**
- Create: `src/database/migrations/002_cash_movements.sql`
- Modify: `src/modules/pos/types.ts`
- Modify: `src/modules/pos/pos.service.ts`
- Test: `tests/modules/pos/pos.service.movements.test.ts`

**Interfaces:**
- Consumes: `Database` de `src/database/connection.ts`
- Produces:
  - `CashMovementType = 'SANGRIA' | 'SUPPLY'`
  - `interface CashMovement { id: number; cashSessionId: number; type: CashMovementType; amount: number; reason: string; operatorName: string; createdAt: string; }`
  - `posService.registerCashMovement(sessionId: number, type: CashMovementType, amount: number, reason: string, operatorName: string): CashMovement`
  - `posService.getCashMovements(sessionId: number): CashMovement[]`
  - `posService.closeCashSession(sessionId: number): CashSessionSummary` (com campos `totalSupplies`, `totalSangrias`, `expectedCash`)

- [ ] **Step 1: Write failing tests for cash movements and drawer balance updates**

Create `tests/modules/pos/pos.service.movements.test.ts`:
```ts
describe('PosService Cash Movements', () => {
  it('should register SUPPLY and increase session current_cash', () => {});
  it('should register SANGRIA and decrease session current_cash', () => {});
  it('should throw INSUFFICIENT_DRAWER_CASH when sangria exceeds current_cash', () => {});
  it('should throw SESSION_NOT_OPEN when registering movement on closed session', () => {});
  it('should calculate expectedCash including supplies and sangrias on closeCashSession', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/pos/pos.service.movements.test.ts"`
Expected: FAIL (tabela `cash_movements` ou métodos inexistentes).

- [ ] **Step 3: Create migration `002_cash_movements.sql` and implement service methods**

1. Create `src/database/migrations/002_cash_movements.sql`:
```sql
CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SANGRIA', 'SUPPLY')),
  amount REAL NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON cash_movements(cash_session_id);
```
2. Update `src/modules/pos/types.ts` with `CashMovement` and updated `CashSessionSummary`.
3. Implement `registerCashMovement`, `getCashMovements`, and updated `closeCashSession` in `src/modules/pos/pos.service.ts` wrapped in SQLite transaction.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/pos/pos.service.movements.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/002_cash_movements.sql src/modules/pos/ tests/modules/pos/pos.service.movements.test.ts
git commit -m "feat(pos): implement cash movements sangria and supply with drawer balance tracking"
```

---

### Task 2: Backend — Checkout Híbrido Unificado & Rotas Fastify

**Files:**
- Modify: `src/modules/pos/types.ts`
- Modify: `src/modules/pos/pos.service.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/pos/pos.service.hybrid-checkout.test.ts`
- Test: `tests/api/routes.pos.test.ts`

**Interfaces:**
- Consumes: `InventoryService`, `PreSaleService`, `PosService`
- Produces:
  - `interface CheckoutParams { cashSessionId: number; preSaleCode?: string; additionalItems?: { productId: number; batchId: number; quantity: number }[]; payments: PaymentItem[]; }`
  - `posService.checkout(params: CheckoutParams): SaleDetails`
  - Fastify routes:
    - `POST /api/pos/sessions/:id/movements`
    - `GET /api/pos/sessions/:id/movements`
    - `GET /api/pos/sessions/:id/summary`
    - `POST /api/pos/checkout` (suporta `preSaleCode` e/ou `additionalItems`)

- [ ] **Step 1: Write failing tests for hybrid checkout and REST routes**

Create `tests/modules/pos/pos.service.hybrid-checkout.test.ts`:
- Test direct sale of convenience items without pre-sale.
- Test combined sale (pre-sale `#PV-XXXX` + additional convenience items).
- Test rejection of controlled drugs in `additionalItems` (`CONTROLLED_DRUG_DIRECT_SALE_FORBIDDEN`).
- Test insufficient stock on additional items.
- Test payment validation and drawer cash update.

Create `tests/api/routes.pos.test.ts`:
- Test `POST /api/pos/sessions/:id/movements` for SANGRIA and SUPPLY.
- Test `GET /api/pos/sessions/:id/movements`.
- Test `GET /api/pos/sessions/:id/summary`.
- Test `POST /api/pos/checkout` with hybrid payload.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run tests/modules/pos/pos.service.hybrid-checkout.test.ts tests/api/routes.pos.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `posService.checkout` and Fastify routes**

1. In `src/modules/pos/pos.service.ts`, implement `checkout(params: CheckoutParams)`:
   - Validates session is `OPEN`.
   - If `preSaleCode`: retrieves pre-sale, validates `OPEN`, marks `CONVERTED_TO_SALE`.
   - If `additionalItems`: verifies each product has `controlType === 'ISENTO'`; reserves and deducts stock via `inventoryService`.
   - Validates payment totals, change in cash, inserts sale, items, payments, and updates `current_cash`.
2. In `src/api/routes.ts`, register new movement and summary routes, and update `/api/pos/checkout`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run tests/modules/pos/pos.service.hybrid-checkout.test.ts tests/api/routes.pos.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/pos/ src/api/ routes.ts tests/modules/pos/ tests/api/
git commit -m "feat(pos): implement unified hybrid checkout and cash movement REST routes"
```

---

### Task 3: Frontend — Posto Fixo (`useStationMode`) & Modais de Sessão/Movimentação

**Files:**
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/hooks/useStationMode.ts`
- Create: `frontend/src/components/pos/CashSessionModal.tsx`
- Create: `frontend/src/components/pos/CashMovementModal.tsx`
- Test: `frontend/tests/hooks/useStationMode.test.ts`
- Test: `frontend/tests/components/CashSessionModal.test.tsx`
- Test: `frontend/tests/components/CashMovementModal.test.tsx`

**Interfaces:**
- Consumes: `api.ts` endpoints
- Produces:
  - `useStationMode()` returning `{ mode: 'COUNTER' | 'POS', setMode, isCounter, isPos }`
  - `CashSessionModal`: Abertura de Caixa (operador + fundo de troco) e Fechamento de Caixa (resumo consolidado de vendas, sangrias, suprimentos e dinheiro esperado).
  - `CashMovementModal`: Formulário de Sangria e Suprimento com seleção de tipo, valor, motivo e validação em tempo real de saldo na gaveta.

- [ ] **Step 1: Write failing tests for station mode hook and session modals**

Create tests in `frontend/tests/`:
- `useStationMode.test.ts`: reads and writes to `localStorage`, defaults to `COUNTER`.
- `CashSessionModal.test.tsx`: validates operator name, initial cash, calls `openCashSession`; renders summary on close.
- `CashMovementModal.test.tsx`: validates positive amount, reason, checks max sangria bounded by current cash, submits to `registerCashMovement`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run frontend/tests/hooks/useStationMode.test.ts frontend/tests/components/CashSessionModal.test.tsx frontend/tests/components/CashMovementModal.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement `useStationMode`, `CashSessionModal`, and `CashMovementModal`**

1. Update `frontend/src/services/api.ts` with TypeScript types and functions for movements (`registerCashMovement`, `getCashMovements`, `getSessionSummary`) and hybrid checkout (`checkoutSale`).
2. Implement `useStationMode` with `localStorage` persistence.
3. Build `CashSessionModal` with clean UI, hotkey `Esc` to close, and clear financial breakdown.
4. Build `CashMovementModal` with visual distinction between Sangria (vermelho/retirada) e Suprimento (azul/aporte).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run frontend/tests/hooks/useStationMode.test.ts frontend/tests/components/CashSessionModal.test.tsx frontend/tests/components/CashMovementModal.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/hooks/ frontend/src/components/pos/ frontend/tests/
git commit -m "feat(frontend): add station mode hook and cash session and movement modals"
```

---

### Task 4: Frontend — Grade de Itens do PDV, Resgate de Pré-Venda & Scanner de Conveniência

**Files:**
- Create: `frontend/src/components/pos/PreSaleLookupModal.tsx`
- Create: `frontend/src/components/pos/DirectItemInput.tsx`
- Create: `frontend/src/components/pos/PosItemGrid.tsx`
- Test: `frontend/tests/components/PreSaleLookupModal.test.tsx`
- Test: `frontend/tests/components/DirectItemInput.test.tsx`
- Test: `frontend/tests/components/PosItemGrid.test.tsx`

**Interfaces:**
- Consumes: `api.getPreSaleByCode`, `api.getProductByEan`, `api.getAvailableBatches`
- Produces:
  - `PreSaleLookupModal`: Modal com autofocus para digitação/leitor do ticket `#PV-XXXX`, busca e callback `onLoadPreSale(details)`.
  - `DirectItemInput`: Scanner de código de barras no caixa, busca EAN, bloqueia produtos controlados com alerta regulatório, seleciona lote FEFO disponível e emite `onAddDirectItem(product, batch)`.
  - `PosItemGrid`: Tabela unificada exibindo itens da pré-venda (com badge de receita e lote) e itens de conveniência adicionados no caixa, com suporte a cancelamento de item com tecla `[F7]`.

- [ ] **Step 1: Write failing tests for lookup modal, direct scanner, and item grid**

Create tests in `frontend/tests/components/`:
- `PreSaleLookupModal.test.tsx`: searches pre-sale by code, handles 404, handles already closed pre-sales, emits loaded pre-sale.
- `DirectItemInput.test.tsx`: reads barcode EAN-13, auto-adds OTC item with FEFO batch, blocks controlled medicine with explicit Portaria 344/98 alert.
- `PosItemGrid.test.tsx`: renders table with pre-sale items and direct convenience items, removes direct item when delete clicked or F7 hotkey used.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run frontend/tests/components/PreSaleLookupModal.test.tsx frontend/tests/components/DirectItemInput.test.tsx frontend/tests/components/PosItemGrid.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement `PreSaleLookupModal`, `DirectItemInput`, and `PosItemGrid`**

1. Build `PreSaleLookupModal` with barcode formatting (auto-prefix `#` if omitted).
2. Build `DirectItemInput` with EAN query, FEFO auto-selection, and regulatory guard against `controlType !== 'ISENTO'`.
3. Build `PosItemGrid` with line numbers, badges, unit/total prices, and keyboard navigation.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run frontend/tests/components/PreSaleLookupModal.test.tsx frontend/tests/components/DirectItemInput.test.tsx frontend/tests/components/PosItemGrid.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pos/ frontend/tests/components/
git commit -m "feat(frontend): implement pre-sale lookup modal direct convenience scanner and pos item grid"
```

---

### Task 5: Frontend — Modal de Faturamento Multi-Pagamento & Cupom Térmico PDV

**Files:**
- Create: `frontend/src/components/pos/PaymentModal.tsx`
- Create: `frontend/src/components/pos/SaleReceiptModal.tsx`
- Test: `frontend/tests/components/PaymentModal.test.tsx`
- Test: `frontend/tests/components/SaleReceiptModal.test.tsx`

**Interfaces:**
- Consumes: `PaymentItem`, `PaymentMethod`, `SaleDetails`
- Produces:
  - `PaymentModal`: Gerenciador de formas de pagamento (Dinheiro com troco e botões rápidos de cédulas, Cartão de Crédito/Débito, Pix com QR Code dinâmico SVG simulado e código copia-e-cola). Valida valores totais, impede troco indevido, e emite `onConfirmPayments(payments)`.
  - `SaleReceiptModal`: Emissor de cupom térmico padrão ESC/POS (48 colunas) com cabeçalho da loja, itens com lotes, forma de pagamento, troco, atalho `[Enter]` para impressão térmica e `[Esc]` para novo atendimento.

- [ ] **Step 1: Write failing tests for PaymentModal and SaleReceiptModal**

Create tests in `frontend/tests/components/`:
- `PaymentModal.test.tsx`:
  - Adds single payment in cash with change calculation.
  - Splits payment between Cash and Pix.
  - Disallows submitting when `totalPaid < totalAmount`.
  - Disallows change when paying by Card/Pix (`EXCESS_NON_CASH_PAYMENT`).
  - Displays dynamic Pix QR code and copy-paste key.
- `SaleReceiptModal.test.tsx`:
  - Renders thermal layout with `#VENDA-XXXXX`, cashier name, items with lots, payment breakdown.
  - Calls `window.print()` on print button or Enter key.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run frontend/tests/components/PaymentModal.test.tsx frontend/tests/components/SaleReceiptModal.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement `PaymentModal` and `SaleReceiptModal`**

1. Build `PaymentModal` with number formatting (BRL), quick bill buttons (R$ 10, R$ 20, R$ 50, R$ 100), card brand selector, Pix QR Code SVG generator with animated waiting indicator.
2. Build `SaleReceiptModal` with `@media print` styling, ESC/POS 48-column font simulation, and keyboard triggers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run frontend/tests/components/PaymentModal.test.tsx frontend/tests/components/SaleReceiptModal.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pos/ frontend/tests/components/
git commit -m "feat(frontend): implement multi-payment modal and 48-column thermal sale receipt modal"
```

---

### Task 6: Frontend — Integração do Terminal `PosPage.tsx`, Atalhos de Caixa e Alternador de Posto em `App.tsx`

**Files:**
- Create: `frontend/src/pages/PosPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/pages/PosPage.test.tsx`
- Test: `frontend/tests/App.test.tsx`

**Interfaces:**
- Consumes: Todos os componentes de `src/components/pos/`, `useStationMode`, `useKeyboardShortcuts`
- Produces:
  - `PosPage.tsx`: Terminal completo de Frente de Caixa com fluxo ponta a ponta (Verifica sessão aberta -> Resgate de pré-venda ou bip direto -> Checkout F8 -> Impressão do cupom -> Retorno ao estado livre para o próximo cliente).
  - `App.tsx`: Roteador de posto fixo (`COUNTER` renderiza `CounterPage`, `POS` renderiza `PosPage`, atalho `Ctrl+Shift+S` abre diálogo de troca de posto).

- [ ] **Step 1: Write failing integration tests for PosPage and App station router**

Create `frontend/tests/pages/PosPage.test.tsx`:
- Full cashier shift lifecycle:
  1. Opens cash session with R$ 100 operator initial cash.
  2. Rescues pre-sale `#PV-8801` via F5 shortcut.
  3. Scans direct convenience item (shampoo EAN).
  4. Triggers F8 for payment, splits R$ 50 cash + remaining in card.
  5. Completes checkout, verifies receipt modal displayed.
  6. Resets to ready state for next customer on Esc.
  7. Performs Sangria of R$ 50 via F10.
  8. Closes cash session via F12, verifying summary numbers.
Update `frontend/tests/App.test.tsx`:
- Verifies rendering of CounterPage when station mode is `COUNTER`.
- Verifies rendering of PosPage when station mode is `POS`.
- Verifies switching station mode via `Ctrl+Shift+S`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run frontend/tests/pages/PosPage.test.tsx frontend/tests/App.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement `PosPage.tsx` and integrate in `App.tsx`**

1. Build `PosPage.tsx` with full state machine (Session check, Ready, PreSale loaded, Direct items, Payment modal, Receipt modal, Movement modal).
2. Wire up global hotkeys: `F2`, `F5`, `F7`, `F8`, `F10`, `F12`, `Esc` using `useKeyboardShortcuts`.
3. Update `App.tsx` with station switcher pill in header / shortcut dialog.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run frontend/tests/pages/PosPage.test.tsx frontend/tests/App.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Full verification across entire repository**

Run:
```bash
cmd.exe /c "npm test"
cmd.exe /c "npx tsc --noEmit && cd frontend && npx tsc --noEmit && cd ../desktop && npx tsc --noEmit"
cmd.exe /c "npm run build:web"
```
Expected: All tests pass, zero TypeScript errors, clean production bundle.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PosPage.tsx frontend/src/App.tsx frontend/tests/
git commit -m "feat(pos): complete integrated POS terminal page keyboard shortcuts and station router"
```
