# FarmaCore ERP — Fase 6: Gateway de Convênios Farmacêuticos (PBM) & Farmácia Popular do Brasil (Datasus/MS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo corporativo de Gateway de Convênios Farmacêuticos (PBM) e o programa Aqui Tem Farmácia Popular do Brasil (Ministério da Saúde / Datasus), com suporte a pré-autorização em tempo real, validação de regras regulatórias (intervalo de 30 dias por princípio ativo, dose diária, elegibilidade etária, validade de receita), cálculo preciso de subsídios e co-pagamento, emissão de 2 vias do Cupom Vinculado ESC/POS (auditoria Denasus), integração direta com o PDV (`CONVENIO_PBM`), rotas REST e interface visual ergonômica com atalho `[F6]`.

**Architecture:** Abordagem 1 (Gateway Unificado de Convênios & Subsídios — Padrão InovaFarma / Linx):
- O backend Fastify + SQLite WAL ganha o módulo `src/modules/pbm/` contendo o contrato agnóstico `PbmProvider`, o simulador oficial `DatasusMockProvider` (para desenvolvimento e testes unitários 100% offline no Vitest), o cliente SOAP `DatasusSoapProvider`, o formatador de Cupom Vinculado de 48 colunas `pbm-receipt-formatter.ts`, e o orquestrador `PbmService`.
- O módulo de vendas e caixa (`src/modules/pos/`) é estendido para suportar o meio de pagamento `CONVENIO_PBM`, registrando o crédito subsidiado sem misturar com o numerário físico da gaveta do operador e vinculando o protocolo à NFC-e emitida.
- O frontend React/Tailwind ganha o atalho global `[F6] Convênio / Farmácia Popular` na TopBar, o modal de alta velocidade `PbmModal.tsx` com busca por CPF, validação de receita, cálculo em tempo real de subsídio e botão de impressão rápida das 2 vias do Cupom Vinculado.

**Tech Stack:** Node.js 18+, TypeScript (strict mode), Fastify, SQLite WAL (`node:sqlite`), `node:crypto`, React 18, Vite, Tailwind CSS, Lucide React, Vitest 3.2+.

**Spec:** `docs/specs/2026-11-16-farma-erp-phase6-pbm-farmacia-popular.md`

## Global Constraints
- Node.js 18+ e TypeScript em strict mode (`strict: true`, `noUnusedLocals: true`).
- SQLite nativo via `node:sqlite` com modo WAL e transações aninhadas seguras via `SAVEPOINT`.
- Sintaxe SQLite estrita em CHECK constraints: usar `CHECK (col IS NULL OR col IN (...))` em vez de `col IN (NULL, ...)`.
- Denasus / Portaria MS nº 184/2011: Armazenar todos os campos obrigatórios para auditoria (`patient_birth_date`, `doctor_name`, `doctor_crm`, `doctor_uf`, `prescription_date`, `proxy_name`, `proxy_cpf`, `batch_id`, `daily_dose`, `reference_unit_price`).
- Impressão ESC/POS 48 colunas: A 2ª via (Estabelecimento - guarda de 5 anos) deve conter obrigatoriamente a lista completa dos itens e lotes entregues, dados do médico e termo legal de recebimento com campos de assinatura do paciente e farmacêutico RT.
- Fechamento de Caixa: O meio de pagamento `CONVENIO_PBM` é totalizado em `totalsByMethod`, mas **NUNCA** somado ao dinheiro físico da gaveta (`current_cash` / `expectedCash`).

## Review Focus
1. **Regras Regulatórias do Ministério da Saúde:** Intervalo de 30 dias por princípio ativo (`fp_code`), validade de receita de 180 dias geral e 365 dias para anticoncepcionais, idade mínima ≥ 60 anos para fraldas geriátricas, e gratuidade 100% para beneficiários do Bolsa Família ou programas específicos.
2. **Cálculo Financeiro Exato:** Divisão inequívoca entre Parcela Subsidiada (paga pelo Ministério da Saúde / PBM) e Co-pagamento do Paciente (a pagar no caixa).
3. **Imutabilidade e Rastreabilidade do Cupom Vinculado:** Emissão textual de 48 colunas com quebras corretas e conteúdo fidedigno ao regulamento governamental.
4. **Ciclo de Vida Transacional:** Pré-autorização (`AUTHORIZED`) -> Confirmação atômica no PDV (`CONFIRMED`) -> Estorno/Cancelamento (`CANCELLED`). Bloqueio de vendas órfãs ou cancelamentos fiscais sem estorno do PBM.
5. **Zero Quebra de Compatibilidade:** Manter 100% dos testes das Fases 1 a 5 passando e zero erros no build web.

---

### Task 1: Backend — Migração Schema 005 (`005_pbm_farmacia_popular.sql`) & Tipos de Domínio

**Files:**
- Create: `src/database/migrations/005_pbm_farmacia_popular.sql`
- Create: `src/modules/pbm/types.ts`
- Modify: `src/database/migrator.ts` (if needed)
- Test: `tests/modules/pbm/schema.test.ts`

**Interfaces:**
- Consumes: `Database` de `src/database/connection.ts`
- Produces:
  - `PbmConfig`: id, providerId, providerName, environment, isActive, credentialsJson, createdAt, updatedAt.
  - `PbmTransaction`: id, transactionUuid, providerId, saleId, authorizationProtocol, receiptNumber, status, patientCpf, patientName, patientBirthDate, doctorCrm, doctorUf, doctorName, prescriptionDate, proxyName, proxyCpf, fiscalKeyNfce, nfceNumber, totalGrossAmount, subsidyAmount, patientCopayAmount, rejectionReason, cancellationProtocol, cancellationReason, cancelledAt, createdAt, confirmedAt.
  - `PbmTransactionItem`: id, pbmTransactionId, productId, batchId, ean, msRegistration, productName, dailyDose, authorizedQuantity, unitGrossPrice, totalGrossPrice, referenceUnitPrice, subsidyUnitPrice, subsidyTotalPrice, patientUnitPrice, patientTotalPrice, programType, createdAt.
  - Extensões na tabela `products`: `fp_eligible`, `fp_code`, `fp_reference_price`, `fp_type`.

- [x] **Step 1: Write failing tests for PBM schema 005 & domain types**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement migration `005_pbm_farmacia_popular.sql` and `src/modules/pbm/types.ts`**
- [x] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/pbm/schema.test.ts"`
Expected: PASS (4/4 testes passando).

---

### Task 2: Backend — Contrato `PbmProvider` & Simulador Oficial `DatasusMockProvider`

**Files:**
- Create: `src/modules/pbm/providers/pbm-provider.interface.ts`
- Create: `src/modules/pbm/providers/datasus-mock-provider.ts`
- Create: `src/modules/pbm/providers/datasus-soap-provider.ts`
- Test: `tests/modules/pbm/datasus-mock-provider.test.ts`

**Interfaces:**
- Produces:
  - `PbmProvider`: interface com `authorize()`, `confirm()`, `cancel()`.
  - `DatasusMockProvider`: implementação com matriz de 9 cenários regulatórios (gratuidade 100%, co-pagamento 90/10, Bolsa Família, intervalo 30 dias, validade de receita 180/365 dias, idade mínima para fraldas, validação de CPF, cancelamento idempotente).
  - `DatasusSoapProvider`: cliente SOAP WSDL estruturado para ambiente de produção com mTLS.

- [x] **Step 1: Write failing tests for `DatasusMockProvider`**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement `DatasusMockProvider` and `DatasusSoapProvider`**
- [x] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/pbm/datasus-mock-provider.test.ts"`
Expected: PASS (10/10 testes passando).

---

### Task 3: Backend — Formatador do Cupom Vinculado ESC/POS 48 Colunas (`pbm-receipt-formatter.ts`)

**Files:**
- Create: `src/modules/pbm/pbm-receipt-formatter.ts`
- Test: `tests/modules/pbm/pbm-receipt-formatter.test.ts`

**Interfaces:**
- Produces:
  - `formatPbmReceipt(transaction: PbmTransaction, items: PbmTransactionItem[], storeInfo: StoreInfo): { consumerCopy: string; storeCopy: string; fullEscPos: string }`
  - Formatação precisa em 48 colunas de largura, separadores, cabeçalho do Ministério da Saúde, tabela de itens e lote entregue, cálculo de subsídios, e bloco de termos legais com linhas de assinatura do paciente/procurador e do farmacêutico RT (CRF).

- [x] **Step 1: Write failing tests for `pbm-receipt-formatter.ts`**

Create `tests/modules/pbm/pbm-receipt-formatter.test.ts`:
```ts
describe('PBM Receipt Formatter (Cupom Vinculado 48 Colunas ESC/POS)', () => {
  it('should format 1st copy (Consumidor) with items, government subsidy and patient copay', () => {});
  it('should format 2nd copy (Estabelecimento - Denasus 5 Anos) with batch info, doctor CRM, and legal signatures', () => {});
  it('should include proxy details if withdrawal was performed by legal proxy', () => {});
  it('should respect exact 48 columns limit per line without breaking layout', () => {});
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/pbm/pbm-receipt-formatter.test.ts"`
Expected: FAIL.

- [x] **Step 3: Implement `src/modules/pbm/pbm-receipt-formatter.ts`**

1. Helper de alinhamento e padding para 48 colunas.
2. Formatação da 1ª Via (Consumidor).
3. Formatação da 2ª Via (Estabelecimento - Auditoria Denasus).
4. Junção com comando de corte ESC/POS `\x1b\x69`.

- [x] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/pbm/pbm-receipt-formatter.test.ts"`
Expected: PASS (4/4 testes passando).

---

### Task 4: Backend — Serviço de PBM e Orquestração (`PbmService`)

**Files:**
- Create: `src/modules/pbm/pbm.service.ts`
- Test: `tests/modules/pbm/pbm-service.test.ts`

**Interfaces:**
- Produces:
  - `PbmService`: métodos `authorize()`, `confirm()`, `cancel()`, `getTransactionByProtocol()`, `listTransactions()`, `getReceiptText()`, `getConfig()`, `updateConfig()`.
  - Persistência atômica no SQLite das tabelas `pbm_transactions` e `pbm_transaction_items`.
  - Validação de regras e concorrência: impedimento de confirmação dupla ou cancelamento de transação já cancelada.

- [x] **Step 1: Write failing tests for `PbmService`**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement `src/modules/pbm/pbm.service.ts`**
- [x] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/pbm/pbm-service.test.ts"`
Expected: PASS (6/6 testes passando).

---

### Task 5: Backend — Integração com PDV / Caixa (`pos.service.ts` & Meio de Pagamento `CONVENIO_PBM`)

**Files:**
- Modify: `src/modules/pos/types.ts`
- Modify: `src/modules/pos/pos.service.ts`
- Modify: `src/modules/fiscal/xml-builder.ts`
- Test: `tests/modules/pos/pos-pbm-integration.test.ts`

**Interfaces:**
- Produces:
  - Adição de `'CONVENIO_PBM'` em `PaymentMethod` e `VALID_METHODS`.
  - Atualização de `calculateSessionSummary`: soma `CONVENIO_PBM` em `totalsByMethod`, mas **NUNCA** soma em `current_cash` nem `expectedCash` (crédito faturado).
  - Regra de troco: `CONVENIO_PBM` não gera troco.
  - Vínculo no checkout: quando uma venda possui transação PBM, confirma automaticamente a autorização vinculando o `saleId` e a chave NFC-e.

- [ ] **Step 1: Write failing tests for PDV & PBM integration**

Create `tests/modules/pos/pos-pbm-integration.test.ts`:
```ts
describe('PDV & PBM Integration (CONVENIO_PBM Payment & Cash Closure)', () => {
  it('should allow checkout with split payment: CONVENIO_PBM (subsidy) + DINHEIRO (copay)', async () => {});
  it('should prevent change generation from CONVENIO_PBM amount', async () => {});
  it('should not add CONVENIO_PBM to physical cash drawer in calculateSessionSummary', async () => {});
  it('should automatically confirm PBM transaction upon checkout completion', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/pos/pos-pbm-integration.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement PDV changes in `pos.service.ts`, `types.ts`, and `xml-builder.ts`**

1. Expandir `PaymentMethod` com `'CONVENIO_PBM'`.
2. Proteger cálculo de gaveta física em `calculateSessionSummary`.
3. Adicionar gancho de confirmação da transação PBM no checkout.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/pos/pos-pbm-integration.test.ts"`
Expected: PASS (4/4 testes passando).

---

### Task 6: Backend — Rotas REST Fastify (`src/api/routes/pbm.ts`)

**Files:**
- Create: `src/api/routes/pbm.ts`
- Modify: `src/server.ts`
- Test: `tests/api/pbm-routes.test.ts`

**Interfaces:**
- Produces:
  - Endpoints REST `/api/pbm/providers`, `/api/pbm/authorize`, `/api/pbm/confirm`, `/api/pbm/cancel`, `/api/pbm/transactions`, `/api/pbm/transactions/:id/coupon`, `/api/pbm/config`.

- [ ] **Step 1: Write failing tests for PBM API routes**

Create `tests/api/pbm-routes.test.ts`:
```ts
describe('PBM Fastify API Routes', () => {
  it('GET /api/pbm/providers should return active providers', async () => {});
  it('POST /api/pbm/authorize should return authorization protocol and subsidy breakdown', async () => {});
  it('POST /api/pbm/confirm should confirm authorization with saleId', async () => {});
  it('POST /api/pbm/cancel should cancel authorization', async () => {});
  it('GET /api/pbm/transactions should list transactions', async () => {});
  it('GET /api/pbm/transactions/:id/coupon should return 48-column printable text', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/api/pbm-routes.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `src/api/routes/pbm.ts` and register in `src/server.ts`**

1. Implementar rotas com validação de payload Fastify.
2. Registrar plugin no `src/server.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/api/pbm-routes.test.ts"`
Expected: PASS (6/6 testes passando).

---

### Task 7: Frontend React — TopBar `[F6] Convênio`, Modal `PbmModal.tsx` & Cupom Vinculado

**Files:**
- Create: `frontend/src/components/pbm/PbmModal.tsx`
- Create: `frontend/src/components/pbm/PbmReceiptModal.tsx`
- Modify: `frontend/src/components/layout/TopBar.tsx`
- Modify: `frontend/src/pages/CounterPage.tsx`
- Modify: `frontend/src/pages/PosPage.tsx`
- Modify: `frontend/src/services/api.ts`
- Test: `frontend/src/components/pbm/PbmModal.test.tsx` (or Vitest suite)

**Interfaces:**
- Produces:
  - Atalho global `[F6] Convênio / Farmácia Popular`.
  - Modal `PbmModal`: seleção do provedor, busca por CPF, dados do médico e receita, seleção de medicamentos elegíveis, prévia de subsídios (Verde: Governo / Azul: Paciente) e botão `[F10] Autorizar Convênio`.
  - Integração com carrinho do Balcão e Caixa do PDV: lançamento da cota subsidiada e saldo a pagar.
  - Modal `PbmReceiptModal` para visualização e impressão ESC/POS do Cupom Vinculado.

- [ ] **Step 1: Write failing frontend tests for `PbmModal`**

Create `frontend/src/components/pbm/PbmModal.test.tsx`:
```tsx
describe('PbmModal Component', () => {
  it('should render modal when isOpen is true', () => {});
  it('should calculate subsidy and copay breakdown when items are selected', () => {});
  it('should trigger authorization API call on submit', async () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npm run test -- frontend/src/components/pbm/PbmModal.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement Frontend Components & API Client**

1. Atualizar `frontend/src/services/api.ts` com métodos `pbmApi`.
2. Criar `PbmModal.tsx` e `PbmReceiptModal.tsx`.
3. Adicionar atalho `[F6]` e botão na `TopBar.tsx`.
4. Conectar o modal em `CounterPage.tsx` e `PosPage.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npm run test -- frontend/src/components/pbm/PbmModal.test.tsx"`
Expected: PASS.

---

### Task 8: Verificação Completa, Regressão Zero & Build Web

**Files:**
- Full test suite run (`npm test`)
- TypeScript check (`npm run build:web` / root typecheck)

- [ ] **Step 1: Run complete backend & frontend test suite**

Run: `cmd.exe /c "npm test"`
Expected: 100% dos testes passando (todas as fases anteriores 1 a 5 + fase 6).

- [ ] **Step 2: Run web build and typecheck**

Run: `cmd.exe /c "npm run build:web"`
Expected: Build concluído com sucesso sem erros de TypeScript ou bundle.

- [ ] **Step 3: Git commit with semantic message**

Run: `cmd.exe /c "git status"`
