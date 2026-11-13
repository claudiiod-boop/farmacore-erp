# FarmaCore ERP — Fase 5: Entrada de Mercadorias (Importador XML de NF-e) & Módulo Regulatório SNGPC (Anvisa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP a recepção automatizada de compras via importação de XML de NF-e (Modelo 55, Layout SEFAZ 4.00) com extração de tags de rastreabilidade de medicamentos `<med>`, alimentação atômica de lotes/validade FEFO, verificação do teto PMC da CMED, e o módulo sanitário completo do SNGPC Anvisa (Portaria 344/98 e RDC 20/2011) com escrituração de entradas/saídas, livro de receituário e exportador do XML semanal oficial `mensagemSNGPC`.

**Architecture:** Abordagem 1 (Pipeline Integrado Nativo / Padrão InovaFarma):
- O backend Fastify + SQLite WAL ganha o módulo `src/modules/purchases/` (parser de NF-e 4.00, pré-visualização dry-run, orquestrador de compras e criação de lotes) e `src/modules/sngpc/` (movimentações sanitárias, consolidador do livro de registro específico e gerador do XML canônico `mensagemSNGPC` com SHA-1).
- O módulo de checkout do PDV (`PosService`) é integrado ao `SngpcService` para registrar saídas sanitárias automáticas em vendas de medicamentos controlados com receita médica retida.
- O frontend React/Tailwind ganha uma barra de navegação global com atalhos de teclado (`[F1] Balcão`, `[F2] Caixa`, `[F3] Compras`, `[F4] SNGPC`), tela de conferência de NF-e (`PurchasesPage.tsx`) com upload/dropzone e conciliação de itens, e tela do SNGPC (`SngpcPage.tsx`) com extrato sanitário, livro de registro para impressão e exportador semanal.

**Tech Stack:** Node.js 18+, TypeScript (strict mode), Fastify, SQLite WAL (`node:sqlite`), `node:crypto` (SHA-1), React 18, Vite, Tailwind CSS, Lucide React, Vitest 3.2+.

**Spec:** `docs/specs/2026-11-12-farma-erp-phase5-purchases-sngpc.md`

## Global Constraints
- Node.js 18+ e TypeScript em strict mode (`strict: true`, `noUnusedLocals: true`).
- SQLite nativo via `node:sqlite` com modo WAL e transações aninhadas seguras via `SAVEPOINT`.
- Parser de NF-e Modelo 55: Suportar tanto arquivos com tag raiz `<nfeProc>` quanto `<NFe>` puros, extraindo obrigatoriamente tags de rastreabilidade farmacêutica `<med>` (`cProdANVISA`, `nLote`, `qLote`, `dFab`, `dVal`, `vPMC`).
- Validação CMED: Se o preço de venda cadastrado ou sugerido exceder o PMC da nota da distribuidora, alertar na pré-conferência e auto-ajustar ao teto (`price = Math.min(price, pmc)`).
- Rastreabilidade SNGPC: Compras de controlados (`controlType !== 'ISENTO'`) geram movimentação de `ENTRADA`; vendas de balcão/caixa com receita geram movimentação de `SAIDA_VENDA`.
- XML SNGPC: Geração canônica no namespace `urn:sngpc-schema` com cabeçalho (CNPJ do estabelecimento, CPF do farmacêutico, período), blocos de `<entradaMedicamentos>` e `<saidaMedicamentoVendaAoConsumidor>`, e cálculo do hash SHA-1 do arquivo.

## Review Focus
1. **Divergência de PMC (CMED) na Importação da NF-e:** Quando o preço de venda de um produto for superior ao PMC (`vPMC`) informado na nota, o importador deve alertar na pré-conferência (`cmedWarning: true`) e ajustar o preço de venda ao teto (`price = Math.min(price, pmc)`), garantindo conformidade sem bloquear a entrada física da nota.
2. **Importação Idempotente de Chave de Acesso:** Tentativa de importar um XML com a mesma chave de acesso (`access_key` de 44 dígitos) deve falhar com erro `PURCHASE_INVOICE_ALREADY_IMPORTED` (HTTP 409) sem duplicar lotes ou dados no estoque.
3. **Múltiplos Lotes para o Mesmo Produto na NF-e:** Quando um produto na NF-e possui múltiplas tags `<med>` ou múltiplos itens com o mesmo EAN e lotes distintos, o parser e importador devem criar e creditar cada lote individualmente no estoque com seu respectivo `nLote`, `qLote` e `dVal`.
4. **Alimentação Sanitária Automática na Venda de Balcão/Caixa:** Ao finalizar uma venda no PDV (`/api/pos/checkout`) contendo item controlado (`controlType !== 'ISENTO'`) e receita médica retida, o sistema deve registrar atomicamente a movimentação de saída (`SAIDA_VENDA`) no SNGPC com CRM, UF, tipo de receita e dados do paciente/comprador.
5. **Geração Canônica do XML Semanal `mensagemSNGPC`:** A exportação do XML deve conter cabeçalho com CNPJ do estabelecimento e CPF do farmacêutico transmissor, entradas e saídas do período, cálculo de hash SHA-1, e marcar as movimentações como transmitidas (`is_transmitted = 1`).

---

### Task 1: Backend — Migração Schema 004 (`004_purchases_sngpc.sql`) & Tipos de Domínio

**Files:**
- Create: `src/database/migrations/004_purchases_sngpc.sql`
- Create: `src/modules/purchases/types.ts`
- Create: `src/modules/sngpc/types.ts`
- Modify: `src/database/migrator.ts` (if needed)
- Test: `tests/modules/purchases/schema.test.ts`

**Interfaces:**
- Consumes: `Database` de `src/database/connection.ts`
- Produces:
  - `PurchaseInvoice`: id, accessKey, invoiceNumber, invoiceSeries, issueDate, supplierCnpj, supplierName, supplierIe, totalInvoiceAmount, totalProductsAmount, totalIcmsSt, xmlContent, createdAt.
  - `PurchaseInvoiceItem`: id, purchaseInvoiceId, productId, batchId, itemIndex, supplierProductCode, ean, productName, ncm, cfop, quantity, unitCost, totalCost, batchNumber, expirationDate, manufacturingDate, anvisaRegistration, pmc.
  - `SngpcMovement`: id, movementType ('ENTRADA' | 'SAIDA_VENDA' | 'PERDA'), productId, batchId, quantity, referenceType ('PURCHASE_INVOICE' | 'SALE' | 'INVENTORY_ADJUSTMENT'), referenceId, movementDate, msRegistration, prescriptionId, isTransmitted, transmissionId.
  - `SngpcTransmission`: id, startDate, endDate, pharmacistName, pharmacistCpf, pharmacistCrf, pharmacistCrfUf, xmlContent, status, hashXml.

- [ ] **Step 1: Write failing tests for purchases & sngpc schema 004**

Create `tests/modules/purchases/schema.test.ts`:
```ts
describe('Purchases & SNGPC Schema 004 & Types', () => {
  it('should apply migration 004 and create purchase_invoices, purchase_invoice_items, sngpc_movements and sngpc_transmissions tables', () => {});
  it('should verify unique constraint on access_key in purchase_invoices', () => {});
  it('should verify prescriptions table has notification_number and buyer_doc_type columns', () => {});
  it('should verify foreign key constraints cascade properly on purchase_invoice_items', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/purchases/schema.test.ts"`
Expected: FAIL (tabelas e migração inexistentes).

- [ ] **Step 3: Implement migration `004_purchases_sngpc.sql` and domain types**

1. Create `src/database/migrations/004_purchases_sngpc.sql`:
   - `purchase_invoices` (access_key UNIQUE, invoice_number, invoice_series, issue_date, supplier_cnpj, supplier_name, supplier_ie, total_invoice_amount, total_products_amount, total_icms_st, xml_content, created_at)
   - `purchase_invoice_items` (purchase_invoice_id REFERENCES purchase_invoices ON DELETE CASCADE, product_id, batch_id, item_index, supplier_product_code, ean, product_name, ncm, cfop, quantity, unit_cost, total_cost, batch_number, expiration_date, manufacturing_date, anvisa_registration, pmc)
   - `sngpc_transmissions` (id, start_date, end_date, pharmacist_name, pharmacist_cpf, pharmacist_crf, pharmacist_crf_uf, xml_content, status CHECK IN ('GERADO', 'TRANSMITIDO', 'CONFIRMADO', 'REJEITADO'), hash_xml, created_at)
   - `sngpc_movements` (movement_type CHECK IN ('ENTRADA', 'SAIDA_VENDA', 'PERDA'), product_id, batch_id, quantity, reference_type CHECK IN ('PURCHASE_INVOICE', 'SALE', 'INVENTORY_ADJUSTMENT'), reference_id, movement_date, ms_registration, prescription_id, is_transmitted, transmission_id)
   - `ALTER TABLE prescriptions ADD COLUMN notification_number TEXT;`
   - `ALTER TABLE prescriptions ADD COLUMN buyer_doc_type TEXT DEFAULT '1';`
2. Create `src/modules/purchases/types.ts`.
3. Create `src/modules/sngpc/types.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/purchases/schema.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/004_purchases_sngpc.sql src/modules/purchases/types.ts src/modules/sngpc/types.ts tests/modules/purchases/schema.test.ts
git commit -m "feat(purchases): add schema migration 004 and domain types for purchases and sngpc"
```

---

### Task 2: Backend — Parser de NF-e Modelo 55 SEFAZ 4.00 (`src/modules/purchases/nfe-parser.ts`)

**Files:**
- Create: `src/modules/purchases/nfe-parser.ts`
- Test: `tests/modules/purchases/nfe-parser.test.ts`

**Interfaces:**
- Consumes: `src/modules/purchases/types.ts`
- Produces:
  - `parseNfeXml(xmlString: string): ParsedNfeInvoice`
  - Extrai:
    - Cabeçalho: `accessKey` (44 dígitos), `invoiceNumber`, `invoiceSeries`, `issueDate` (`YYYY-MM-DD`).
    - Emitente: `supplierCnpj`, `supplierName`, `supplierIe`.
    - Totais: `totalInvoiceAmount`, `totalProductsAmount`, `totalIcmsSt`.
    - Itens (`ParsedNfeItem[]`): `itemIndex`, `supplierProductCode`, `ean`, `productName`, `ncm`, `cfop`, `quantity`, `unitCost`, `totalCost`, e bloco `<med>` se presente (`batchNumber`, `expirationDate`, `manufacturingDate`, `anvisaRegistration`, `pmc`).

- [ ] **Step 1: Write failing tests for NF-e parser**

Create `tests/modules/purchases/nfe-parser.test.ts`:
```ts
describe('NFe 4.00 XML Parser for Purchases', () => {
  it('should parse valid NF-e Modelo 55 with <nfeProc> wrapper and extract header, supplier and totals', () => {});
  it('should parse raw <NFe> without <nfeProc> wrapper', () => {});
  it('should extract pharmaceutical tracking tags <med> (nLote, qLote, dFab, dVal, cProdANVISA, vPMC)', () => {});
  it('should handle items without <med> tag gracefully (e.g., non-medicine products)', () => {});
  it('should parse multiple batches for items having multiple <med> entries', () => {});
  it('should throw INVALID_NFE_XML error on malformed or empty XML', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/purchases/nfe-parser.test.ts"`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `parseNfeXml` in `src/modules/purchases/nfe-parser.ts`**

Implementação nativa com regex e extratores XML robustos para tags padrão SEFAZ:
- `<infNFe Id="NFe([0-9]{44})">`
- `<ide>`: `<nNF>`, `<serie>`, `<dhEmi>` / `<dEmi>`
- `<emit>`: `<CNPJ>`, `<xNome>`, `<IE>`
- `<total><ICMSTot>`: `<vNF>`, `<vProd>`, `<vST>`
- `<det nItem="X">`:
  - `<prod>`: `<cProd>`, `<cEAN>`, `<xProd>`, `<NCM>`, `<CFOP>`, `<qCom>`, `<vUnCom>`, `<vProd>`
  - `<med>`: `<cProdANVISA>`, `<nLote>`, `<qLote>`, `<dFab>`, `<dVal>`, `<vPMC>`

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/purchases/nfe-parser.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/purchases/nfe-parser.ts tests/modules/purchases/nfe-parser.test.ts
git commit -m "feat(purchases): implement robust NF-e 4.00 XML parser with pharmaceutical med tags"
```

---

### Task 3: Backend — Orquestrador de Compras (`src/modules/purchases/purchase.service.ts`)

**Files:**
- Create: `src/modules/purchases/purchase.service.ts`
- Test: `tests/modules/purchases/purchase.service.test.ts`

**Interfaces:**
- Consumes: `Database`, `parseNfeXml`, `CatalogService`, `InventoryService`, `SngpcService` (stub/interface)
- Produces:
  - `previewNfeXml(xmlString: string): Promise<PurchasePreviewResult>`
  - `importNfeXml(xmlString: string, options?: PurchaseImportOptions): Promise<PurchaseImportResult>`
  - `getInvoices(): PurchaseInvoiceSummary[]`
  - `getInvoiceById(id: number): PurchaseInvoiceDetails | null`

- [ ] **Step 1: Write failing tests for PurchaseService**

Create `tests/modules/purchases/purchase.service.test.ts`:
```ts
describe('PurchaseService (Preview, Import, Batches FEFO & CMED)', () => {
  it('previewNfeXml: should cross EANs with catalog and flag existing vs new products', () => {});
  it('previewNfeXml: should flag cmedWarning when current or suggested price exceeds vPMC', () => {});
  it('importNfeXml: should reject already imported access key (PURCHASE_INVOICE_ALREADY_IMPORTED)', () => {});
  it('importNfeXml: should auto-register new products when autoRegisterProducts is true', () => {});
  it('importNfeXml: should auto-cap product selling price to PMC when price > vPMC (CMED ceiling compliance)', () => {});
  it('importNfeXml: should create stock batches with FEFO expiration date and correct quantities', () => {});
  it('importNfeXml: should register SNGPC entry movement for controlled products (controlType !== ISENTO)', () => {});
  it('getInvoices & getInvoiceById: should retrieve invoice summaries and item details with batch info', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/purchases/purchase.service.test.ts"`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implement `PurchaseService` in `src/modules/purchases/purchase.service.ts`**

- `previewNfeXml`: Dry-run sem modificação de estado, cruza EANs com `products`, extrai lotes, calcula alertas CMED.
- `importNfeXml`: Executa dentro de transação atômica (`SAVEPOINT`).
  - Checa duplicação da chave de acesso.
  - Insere em `purchase_invoices`.
  - Para cada item: cria/encontra produto, ajusta preço ao teto CMED se necessário, cria registro em `batches`, insere em `purchase_invoice_items`, e aciona `sngpcService.recordEntryMovement` se controlado.
- Métodos de consulta `getInvoices` e `getInvoiceById`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/purchases/purchase.service.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/purchases/purchase.service.ts tests/modules/purchases/purchase.service.test.ts
git commit -m "feat(purchases): implement PurchaseService with preview dry-run, atomic import, FEFO batches and CMED compliance"
```

---

### Task 4: Backend — Módulo Regulatório SNGPC & Livro de Receituário (`src/modules/sngpc/`)

**Files:**
- Create: `src/modules/sngpc/sngpc-xml-builder.ts`
- Create: `src/modules/sngpc/sngpc.service.ts`
- Modify: `src/modules/pos/pos.service.ts` (integração para registrar saída sanitária de vendas com receita)
- Test: `tests/modules/sngpc/sngpc-xml-builder.test.ts`
- Test: `tests/modules/sngpc/sngpc.service.test.ts`

**Interfaces:**
- Consumes: `Database`, `sngpc_movements`, `sngpc_transmissions`, `prescriptions`, `products`, `batches`
- Produces:
  - `SngpcService.recordEntryMovement(entryData)`
  - `SngpcService.recordSaleMovement(saleData)`
  - `SngpcService.getMovements(filter)`
  - `SngpcService.getLivroRegistro(filter)`: estrutura consolidada de entradas, saídas, perdas e saldos por produto/substância.
  - `SngpcService.generateWeeklyXml(params)`: gera `mensagemSNGPC.xml`, grava transmissão com hash SHA-1 e atualiza `is_transmitted = 1`.
  - `buildSngpcXml(data: SngpcXmlData): { xml: string; hash: string }`

- [ ] **Step 1: Write failing tests for SNGPC XML Builder and SngpcService**

Create `tests/modules/sngpc/sngpc-xml-builder.test.ts` and `tests/modules/sngpc/sngpc.service.test.ts`:
```ts
describe('SNGPC XML Builder (mensagemSNGPC Schema)', () => {
  it('should generate official mensagemSNGPC XML with header and correct xmlns urn:sngpc-schema', () => {});
  it('should build <entradaMedicamentos> with nota fiscal and supplier details', () => {});
  it('should build <saidaMedicamentoVendaAoConsumidor> with prescriber, patient and buyer details', () => {});
  it('should calculate valid SHA-1 hash of generated XML content', () => {});
});

describe('SngpcService (Regulatory Movements & Prescription Book)', () => {
  it('should record entry movement from purchase invoice', () => {});
  it('should record sale movement when sale has retained prescription', () => {});
  it('should consolidate movements into Portaria 344/98 Livro de Registro format', () => {});
  it('should generate weekly XML transmission and mark movements as transmitted', () => {});
  it('should integrate with PosService hybrid checkout to automatically record SNGPC sale movements', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/sngpc/"`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implement `sngpc-xml-builder.ts`, `sngpc.service.ts` and integrate with `PosService`**

1. Create `src/modules/sngpc/sngpc-xml-builder.ts`:
   - Constrói a árvore canônica `<mensagemSNGPC xmlns="urn:sngpc-schema">`
   - Bloco `<cabecalho>` com CNPJ da farmácia e CPF do farmacêutico.
   - Blocos `<medicamentos><entradaMedicamentos>` e `<saidaMedicamentoVendaAoConsumidor>`.
   - Gera hash SHA-1 via `node:crypto`.
2. Create `src/modules/sngpc/sngpc.service.ts`:
   - `recordEntryMovement`, `recordSaleMovement`, `getMovements`, `getLivroRegistro`, `generateWeeklyXml`.
3. In `src/modules/pos/pos.service.ts`:
   - Ao completar o checkout de itens com prescrição médica retida, chama `sngpcService.recordSaleMovement` para registrar a saída sanitária automaticamente.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/sngpc/"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/sngpc/ src/modules/pos/pos.service.ts tests/modules/sngpc/
git commit -m "feat(sngpc): implement SNGPC regulatory service, official XML builder and POS sanitary sale integration"
```

---

### Task 5: Backend — Endpoints Fastify REST (`/api/purchases/*` e `/api/sngpc/*`)

**Files:**
- Modify: `src/api/routes.ts`
- Test: `tests/api/routes.purchases.test.ts`
- Test: `tests/api/routes.sngpc.test.ts`

**Interfaces:**
- Consumes: `PurchaseService`, `SngpcService`, Fastify
- Produces:
  - `POST /api/purchases/preview-xml`: `{ xmlContent }` -> `PurchasePreviewResult`
  - `POST /api/purchases/import-xml`: `{ xmlContent, autoRegisterProducts, itemClassifications }` -> `PurchaseImportResult`
  - `GET /api/purchases/invoices`: lista notas fiscais
  - `GET /api/purchases/invoices/:id`: detalhes da nota fiscal
  - `GET /api/sngpc/movements`: lista movimentações
  - `GET /api/sngpc/livro`: dados do Livro de Registro
  - `POST /api/sngpc/generate-xml`: gera transmissão semanal
  - `GET /api/sngpc/transmissions`: lista transmissões
  - `GET /api/sngpc/transmissions/:id/xml`: download do XML com `Content-Type: application/xml`

- [ ] **Step 1: Write failing tests for Purchases and SNGPC API endpoints**

Create `tests/api/routes.purchases.test.ts` and `tests/api/routes.sngpc.test.ts`:
```ts
describe('Purchases API Endpoints (/api/purchases/*)', () => {
  it('POST /api/purchases/preview-xml should return 200 with preview and cmed warnings', () => {});
  it('POST /api/purchases/import-xml should import invoice and return 201 with created batches', () => {});
  it('POST /api/purchases/import-xml should return 409 for already imported access key', () => {});
  it('GET /api/purchases/invoices should return list of imported invoices', () => {});
  it('GET /api/purchases/invoices/:id should return 404 for nonexistent invoice', () => {});
});

describe('SNGPC API Endpoints (/api/sngpc/*)', () => {
  it('GET /api/sngpc/movements should return list of regulatory movements', () => {});
  it('GET /api/sngpc/livro should return consolidated prescription book data', () => {});
  it('POST /api/sngpc/generate-xml should generate transmission and return XML metadata', () => {});
  it('GET /api/sngpc/transmissions/:id/xml should return application/xml file download', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/api/routes.purchases.test.ts tests/api/routes.sngpc.test.ts"`
Expected: FAIL (rotas inexistentes).

- [ ] **Step 3: Implement endpoints in `src/api/routes.ts`**

Adicionar as rotas no Fastify com validação Zod e injeção do `PurchaseService` e `SngpcService`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/api/routes.purchases.test.ts tests/api/routes.sngpc.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes.ts tests/api/routes.purchases.test.ts tests/api/routes.sngpc.test.ts
git commit -m "feat(api): expose REST endpoints for purchase XML import and SNGPC regulatory management"
```

---

### Task 6: Frontend — Navegação Global, Tela de Compras (`PurchasesPage.tsx`) e Tela SNGPC (`SngpcPage.tsx`)

**Files:**
- Create: `frontend/src/pages/PurchasesPage.tsx`
- Create: `frontend/src/pages/SngpcPage.tsx`
- Modify: `frontend/src/App.tsx` (topbar de navegação global com abas F1, F2, F3, F4)
- Modify: `frontend/src/services/api.ts` (métodos de compras e sngpc)
- Modify: `frontend/src/types/index.ts` (interfaces frontend de compras e sngpc)
- Test: `frontend/tests/pages/PurchasesPage.test.tsx`
- Test: `frontend/tests/pages/SngpcPage.test.tsx`
- Test: `frontend/tests/App.navigation.test.tsx`

**Interfaces:**
- Consumes: `/api/purchases/*`, `/api/sngpc/*`, React, Tailwind CSS, Lucide React
- Produces:
  - Navegação entre modos: `'COUNTER' | 'POS' | 'PURCHASES' | 'SNGPC'` com atalhos `[F1]`, `[F2]`, `[F3]`, `[F4]`.
  - `PurchasesPage`: Dropzone de XML, modal de pré-conferência com alertas CMED e conferência de lotes, tabela de notas importadas.
  - `SngpcPage`: Abas de "Movimentações", "Livro de Registro (Portaria 344/98)" com layout para impressão, e "Transmissão Semanal" com download de XML.

- [ ] **Step 1: Write failing frontend tests**

Create `frontend/tests/pages/PurchasesPage.test.tsx`, `frontend/tests/pages/SngpcPage.test.tsx` and `frontend/tests/App.navigation.test.tsx`:
```tsx
describe('App Global Navigation & Topbar', () => {
  it('should render navigation tabs for Balcão (F1), Caixa (F2), Compras (F3), SNGPC (F4)', () => {});
  it('should switch views when clicking tabs or pressing F1-F4 keyboard shortcuts', () => {});
});

describe('PurchasesPage Component', () => {
  it('should render XML upload dropzone and recent invoices list', () => {});
  it('should open pre-conference modal upon XML upload showing items, batches and CMED warnings', () => {});
  it('should submit import on confirm and refresh invoices list', () => {});
});

describe('SngpcPage Component', () => {
  it('should render movements list, prescription book view and transmission generator', () => {});
  it('should trigger weekly XML generation with pharmacist details', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npm run test:frontend"`
Expected: FAIL (componentes e rotas não implementados).

- [ ] **Step 3: Implement frontend pages and global navigation**

1. Update `frontend/src/services/api.ts` with purchases and sngpc endpoints.
2. Update `frontend/src/types/index.ts`.
3. Create `frontend/src/pages/PurchasesPage.tsx`.
4. Create `frontend/src/pages/SngpcPage.tsx`.
5. Update `frontend/src/App.tsx` with unified top navigation bar and global hotkeys.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npm run test:frontend"`
Expected: PASS.

- [ ] **Step 5: Run full test suite & production build**

Run: `cmd.exe /c "npm test && npm run build:web && npx tsc --noEmit"`
Expected: 100% tests passing, clean TypeScript check and successful web bundle build.

- [ ] **Step 6: Commit**

```bash
git add frontend/ src/ tests/
git commit -m "feat(ui): add global navigation topbar, purchases XML intake page and SNGPC regulatory console"
```
