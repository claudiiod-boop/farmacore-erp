# FarmaCore ERP — Fase 4: Motor Fiscal Autônomo (NFC-e Modelo 65) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o motor fiscal autônomo nativo em TypeScript para emissão de NFC-e (Modelo 65, Layout SEFAZ 4.00) no FarmaCore ERP, com cálculo tributário de PIS/COFINS Monofásico (Lei 10.147/2000), ICMS-ST (CFOP 5.405 / CSOSN 500), chave de acesso de 44 dígitos (Módulo 11), assinatura digital XML-DSig A1 (`.pfx`), QR Code SEFAZ v2.00 com CSC, emulador de autorização SEFAZ para testes, contingência offline (`tpEmis = 9`), e DANFE térmico ESC/POS de 48 colunas integrado ao checkout do PDV.

**Architecture:** Abordagem 1 (Motor Fiscal Nativo Embutido / Padrão InovaFarma): O backend Fastify + SQLite WAL ganha o módulo `src/modules/fiscal/` contendo motor de cálculo tributário, gerador de XML canônico, assinador digital com `node:crypto`, construtor de QR Code com hash SHA-1 do CSC e camada pluggable de transmissão (`SefazMockProvider` para testes locais e `SefazSoapProvider` para SEFAZ real). O frontend estende o `SaleReceiptModal` e o checkout do PDV para emitir e imprimir o DANFE NFC-e oficial.

**Tech Stack:** Node.js 18+, TypeScript (strict mode), Fastify, SQLite WAL (`node:sqlite`), `node:crypto` (RSA-SHA1/SHA256, PKCS#12 A1), React 18, Vite, Tailwind CSS, Lucide React, Vitest 3.2+ (threads pool).

**Spec:** `docs/specs/2026-11-06-farma-erp-phase4-nfce-fiscal-engine.md`

## Global Constraints
- Node.js 18+ e TypeScript em strict mode (`strict: true`, `noUnusedLocals: true`).
- SQLite nativo via `node:sqlite` com modo WAL e transações aninhadas seguras via `SAVEPOINT`.
- Regras tributárias farmacêuticas: medicamentos com NCM `3003` ou `3004` devem obrigatoriamente sair com **CST PIS/COFINS 04** (Monofásico - Alíquota Zero, Lei 10.147/2000) e **CFOP 5.405 / CSOSN 500** (ICMS-ST retido anteriormente).
- Chave de acesso: 44 dígitos numéricos estritos calculados com Módulo 11 ponderado (pesos 2 a 9). Se resto for 0 ou 1, `cDV = 0`.
- Assinatura digital: Envelope XML-DSig com nó `<Signature>` embutido em `<NFe>`, sem quebra de canonicalização C14N.
- QR Code v2.00 SEFAZ: Concatenação exata de parâmetros e cálculo de hash SHA-1 com CSC do contribuinte.
- DANFE NFC-e: Formatação padrão de 48 colunas ESC/POS para impressoras térmicas contínuas de 80mm/58mm.

## Review Focus
1. **Dígito Verificador da Chave de Acesso (`cDV`):** Chaves geradas devem coincidir com o cálculo do validador oficial da SEFAZ, tratando corretamente os restos 0 e 1 (que devem resultar em `0` e não `10` ou `11`).
2. **PIS/COFINS Monofásico em Medicamentos:** Medicamentos não podem ter alíquota ou valor de PIS/COFINS destacados; os campos `vBC`, `pPIS`, `vPIS`, `vCOFINS` devem ser `0.00` e os CSTs devem ser `'04'`.
3. **Validação do Perfil Fiscal do Emitente:** Tentativa de emitir NFC-e sem perfil fiscal cadastrado ou com CNPJ/IE inválido deve lançar `FISCAL_PROFILE_NOT_CONFIGURED` com código HTTP 400.
4. **Contingência Offline (`tpEmis = 9`):** Deve gerar a chave com `tpEmis = 9`, imprimir 2 vias no DANFE com mensagem obrigatória de contingência, e permitir transmissão posterior sem alterar a chave de acesso.
5. **Cancelamento Fiscal da NFC-e:** Cancelamento deve validar justificativa com no mínimo 15 caracteres (`INVALID_CANCELLATION_REASON`) e só pode ocorrer para notas com status `AUTORIZADA`.

---

### Task 1: Backend — Migração Schema 003 (`003_fiscal_nfce.sql`), Modelos Fiscais & Tipos

**Files:**
- Create: `src/database/migrations/003_fiscal_nfce.sql`
- Create: `src/modules/fiscal/types.ts`
- Modify: `src/database/migrator.ts` (if needed)
- Test: `tests/modules/fiscal/schema.test.ts`

**Interfaces:**
- Consumes: `Database` de `src/database/connection.ts`
- Produces:
  - `FiscalProfile`: CNPJ, IE, Razão Social, Nome Fantasia, CRT (1=Simples, 3=Normal), cUF (35=SP), município, endereço, série, nextNNF, cscToken, cscId, environment ('HOMOLOGACAO' | 'PRODUCAO' | 'SIMULADOR'), certPfxBase64, certPassword.
  - `ProductFiscalData`: ncm, cest, cfop, csosnIcms, cstPis, cstCofins, origin.
  - `NfceInvoice`: id, saleId, chNFe, nNF, serie, tpAmb, tpEmis, status, protocolNumber, protocolDate, xmlSigned, xmlAuthorized, qrCodeUrl, digestValue, cStat, xMotivo.

- [ ] **Step 1: Write failing tests for fiscal schema and profile operations**

Create `tests/modules/fiscal/schema.test.ts`:
```ts
describe('Fiscal Schema 003 & Types', () => {
  it('should apply migration 003 and create fiscal_profiles and nfce_invoices tables', () => {});
  it('should verify products table has ncm, cest, cfop, csosn_icms, cst_pis, cst_cofins columns', () => {});
  it('should enforce unique constraint on ch_nfe in nfce_invoices', () => {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/schema.test.ts"`
Expected: FAIL (tabelas e migração inexistentes).

- [ ] **Step 3: Implement migration `003_fiscal_nfce.sql` and domain types in `types.ts`**

1. Create `src/database/migrations/003_fiscal_nfce.sql`:
   - Table `fiscal_profiles`
   - Alter `products` adding fiscal columns (`ncm`, `cest`, `cfop`, `csosn_icms`, `cst_pis`, `cst_cofins`, `origin`)
   - Table `nfce_invoices` with foreign key to `sales(id)` and unique `ch_nfe`.
2. Create `src/modules/fiscal/types.ts` with all TypeScript interfaces.

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/schema.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/003_fiscal_nfce.sql src/modules/fiscal/types.ts tests/modules/fiscal/schema.test.ts
git commit -m "feat(fiscal): add schema migration 003 for fiscal profiles, product tax data and nfce invoices"
```

---

### Task 2: Backend — Calculadora Tributária Farmacêutica (PIS/COFINS Monofásico, ICMS-ST, IBPT) & Chave de Acesso (Módulo 11)

**Files:**
- Create: `src/modules/fiscal/access-key.ts`
- Create: `src/modules/fiscal/tax-calculator.ts`
- Test: `tests/modules/fiscal/access-key.test.ts`
- Test: `tests/modules/fiscal/tax-calculator.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `Product`, `SaleItem`
- Produces:
  - `generateAccessKey(params: AccessKeyParams): { accessKey: string; cDv: number; cNf: string; formattedKey: string }`
  - `calculateItemTax(product: ProductFiscalData, quantity: number, unitPrice: number, crt: number): CalculatedItemTax`
  - `calculateSaleTaxes(items: (SaleItem & ProductFiscalData)[], crt: number): CalculatedSaleTaxes`

- [ ] **Step 1: Write failing tests for access key generator and tax calculator**

Create `tests/modules/fiscal/access-key.test.ts`:
- Validates 44 digits length.
- Tests Módulo 11 weighted calculation with known SEFAZ access keys.
- Tests rest 0 and rest 1 returning `cDV = 0`.
- Formats in 11 groups of 4 digits.

Create `tests/modules/fiscal/tax-calculator.test.ts`:
- Tests medication with NCM `3004.90.99` receives CST PIS `'04'` and CST COFINS `'04'` with `vBC = 0` and `vPIS = 0` (Monofásico).
- Tests medication under Simples Nacional (`CRT = 1`) receives `CSOSN = '500'` (ICMS-ST) and `CFOP = '5405'`.
- Tests convenience/perfumaria item receives `CSOSN = '102'` and `CFOP = '5102'`.
- Tests IBPT estimate (Lei 12.741/2012) calculation for both categories.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/access-key.test.ts tests/modules/fiscal/tax-calculator.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `access-key.ts` and `tax-calculator.ts`**

1. Implement `generateAccessKey` in `src/modules/fiscal/access-key.ts` using weighted Module 11 (weights 2 to 9 from right to left).
2. Implement `calculateItemTax` and `calculateSaleTaxes` in `src/modules/fiscal/tax-calculator.ts` enforcing Lei 10.147/2000 (PIS/COFINS Monofásico) and Convênio ICMS 142/2018 (ICMS-ST).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/access-key.test.ts tests/modules/fiscal/tax-calculator.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/fiscal/access-key.ts src/modules/fiscal/tax-calculator.ts tests/modules/fiscal/
git commit -m "feat(fiscal): implement 44-digit access key generator and pharmaceutical tax calculator"
```

---

### Task 3: Backend — Construtor de XML SEFAZ 4.00, Assinador Digital XML-DSig A1 & Gerador de QR Code v2.00

**Files:**
- Create: `src/modules/fiscal/xml-builder.ts`
- Create: `src/modules/fiscal/signer.ts`
- Create: `src/modules/fiscal/qrcode-generator.ts`
- Test: `tests/modules/fiscal/xml-builder.test.ts`
- Test: `tests/modules/fiscal/signer.test.ts`
- Test: `tests/modules/fiscal/qrcode-generator.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `access-key.ts`, `tax-calculator.ts`, `node:crypto`
- Produces:
  - `buildNfceXml(params: NfceXmlParams): string`
  - `signXml(xml: string, certPfxBase64: string, password?: string): string`
  - `generateQrCodeV2(params: QrCodeParams): { qrCodeUrl: string; qrCodeHash: string; qrCodeParams: string }`

- [ ] **Step 1: Write failing tests for XML generation, signing, and QR code**

Create `tests/modules/fiscal/xml-builder.test.ts`:
- Generates canonical XML containing `<NFe><infNFe Id="NFe...">`.
- Validates mandatory tags: `<ide>`, `<emit>`, `<dest>` (if CPF provided), `<det>` with items, `<total><ICMSTot>`, `<transp>`, `<pag>`, `<infRespTec>`.
- Validates medication items contain `<med>` block with `<cProdANVISA>`, `<vPMC>` and `<nLote>`, `<qLote>`, `<dVal>`.

Create `tests/modules/fiscal/signer.test.ts`:
- Signs XML using a self-generated test X.509 A1 PKCS#12 certificate (`.pfx`).
- Verifies `<Signature>` node is appended inside `<NFe>`.
- Verifies DigestValue matches SHA-1 of canonicalized `<infNFe>`.
- Verifies SignatureValue verifies with public key.

Create `tests/modules/fiscal/qrcode-generator.test.ts`:
- Generates official SEFAZ v2.00 URL.
- Verifies SHA-1 hash calculation concatenating parameters + CSC token.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/xml-builder.test.ts tests/modules/fiscal/signer.test.ts tests/modules/fiscal/qrcode-generator.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `xml-builder.ts`, `signer.ts`, and `qrcode-generator.ts`**

1. In `xml-builder.ts`, construct layout 4.00 compliant with MOC 7.0 for NFC-e.
2. In `signer.ts`, extract private key and X.509 cert from PKCS#12 via `node:crypto`, canonicalize `<infNFe>` (C14N), compute digest, sign with RSA-SHA1, and append `<Signature>`.
3. In `qrcode-generator.ts`, construct query string and SHA-1 hash with CSC.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/xml-builder.test.ts tests/modules/fiscal/signer.test.ts tests/modules/fiscal/qrcode-generator.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/fiscal/xml-builder.ts src/modules/fiscal/signer.ts src/modules/fiscal/qrcode-generator.ts tests/modules/fiscal/
git commit -m "feat(fiscal): implement SEFAZ 4.00 XML builder, XML-DSig A1 signer and QR code v2 generator"
```

---

### Task 4: Backend — Provedores de Transmissão (Mock & SOAP), `FiscalService` & DANFE Térmico ESC/POS

**Files:**
- Create: `src/modules/fiscal/transmission/provider.interface.ts`
- Create: `src/modules/fiscal/transmission/sefaz-mock.provider.ts`
- Create: `src/modules/fiscal/transmission/sefaz-soap.provider.ts`
- Create: `src/modules/fiscal/danfe-formatter.ts`
- Create: `src/modules/fiscal/fiscal.service.ts`
- Test: `tests/modules/fiscal/fiscal.service.test.ts`
- Test: `tests/modules/fiscal/danfe-formatter.test.ts`

**Interfaces:**
- Consumes: All fiscal components from Tasks 1-3, `Database`, `PosService`
- Produces:
  - `NfceTransmissionProvider`: `transmit(xml)`, `cancel(chNFe, protocol, reason)`.
  - `fiscalService.issueNfce(saleId: number, options?: { offlineContingency?: boolean }): Promise<NfceInvoiceDetails>`
  - `fiscalService.cancelNfce(saleId: number, reason: string): Promise<NfceCancellationResult>`
  - `fiscalService.getNfceBySaleId(saleId: number): NfceInvoiceDetails | null`
  - `formatDanfeNfce(invoice: NfceInvoiceDetails): string` (48 colunas ESC/POS)

- [ ] **Step 1: Write failing tests for fiscal service and thermal DANFE formatter**

Create `tests/modules/fiscal/danfe-formatter.test.ts`:
- Validates 48-column text width limit (`truncateOrFit`).
- Contains "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica".
- Contains formatted 44-digit access key.
- Contains QR Code URL / text block.
- Contains approximate tax breakdown (Lei 12.741/2012).
- Contains contingency message and "EMITIDA EM CONTINGÊNCIA - PENDENTE DE AUTORIZAÇÃO" when `tpEmis === 9`.

Create `tests/modules/fiscal/fiscal.service.test.ts`:
- Issues NFC-e for a completed sale using `SefazMockProvider` -> status `AUTORIZADA`, protocol generated, saves to `nfce_invoices`.
- Issues NFC-e in offline contingency (`tpEmis = 9`) -> status `CONTINGENCIA`, protocol null, ready for deferred transmission.
- Cancels authorized NFC-e with valid reason (>= 15 chars) -> status `CANCELADA`.
- Rejects cancel with reason < 15 chars (`INVALID_CANCELLATION_REASON`).
- Prevents double issuance for the same sale (`NFCE_ALREADY_ISSUED`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/fiscal.service.test.ts tests/modules/fiscal/danfe-formatter.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement `SefazMockProvider`, `FiscalService`, and `danfe-formatter.ts`**

1. Implement transmission provider interface and `SefazMockProvider` simulating SEFAZ authorization (`cStat: 100`) and cancel (`cStat: 135`).
2. Implement `FiscalService`: fetches sale, items, fiscal profile; calculates taxes; builds access key; builds XML; signs XML; generates QR code; transmits or saves contingency; persists in `nfce_invoices`.
3. Implement `danfe-formatter.ts` with 48-column thermal layout.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run tests/modules/fiscal/fiscal.service.test.ts tests/modules/fiscal/danfe-formatter.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/fiscal/transmission/ src/modules/fiscal/fiscal.service.ts src/modules/fiscal/danfe-formatter.ts tests/modules/fiscal/
git commit -m "feat(fiscal): implement transmission providers, fiscal service orchestrator and thermal DANFE formatter"
```

---

### Task 5: Backend — Rotas REST Fastify para NFC-e (`/api/fiscal/*`) & Integração com PDV

**Files:**
- Modify: `src/api/routes.ts`
- Test: `tests/api/routes.fiscal.test.ts`

**Interfaces:**
- Consumes: `FiscalService`, `PosService`
- Produces Fastify Endpoints:
  - `GET /api/fiscal/profile`
  - `PUT /api/fiscal/profile`
  - `POST /api/fiscal/nfce/issue`
  - `GET /api/fiscal/nfce/:saleId`
  - `GET /api/fiscal/nfce/:saleId/xml`
  - `GET /api/fiscal/nfce/:saleId/danfe`
  - `POST /api/fiscal/nfce/:saleId/cancel`

- [ ] **Step 1: Write failing tests for Fastify fiscal routes**

Create `tests/api/routes.fiscal.test.ts`:
- Tests `GET /api/fiscal/profile` and `PUT /api/fiscal/profile`.
- Tests `POST /api/fiscal/nfce/issue` with `{ saleId }` returning 201 with authorized invoice details and DANFE text.
- Tests `POST /api/fiscal/nfce/issue` with `{ saleId, offlineContingency: true }` returning 201 with contingency status.
- Tests `GET /api/fiscal/nfce/:saleId/xml` returning raw XML with `Content-Type: application/xml`.
- Tests `GET /api/fiscal/nfce/:saleId/danfe` returning text with `Content-Type: text/plain`.
- Tests `POST /api/fiscal/nfce/:saleId/cancel` with `{ reason: 'Cancelamento por desistência do cliente' }`.
- Tests error handling: `SALE_NOT_FOUND` (404), `NFCE_ALREADY_ISSUED` (400), `INVALID_CANCELLATION_REASON` (400).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run tests/api/routes.fiscal.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Register fiscal routes in `src/api/routes.ts`**

1. Instantiate `FiscalService` with `db` and register endpoints under `/api/fiscal/*`.
2. Add proper status code mappings and error serialization.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run tests/api/routes.fiscal.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/routes.ts tests/api/routes.fiscal.test.ts
git commit -m "feat(fiscal): add Fastify REST routes for fiscal profile, NFC-e issuance, XML download and cancellation"
```

---

### Task 6: Frontend — Visualizador do DANFE NFC-e com QR Code SVG, Integração no Checkout e Badge Fiscal

**Files:**
- Modify: `frontend/src/services/api.ts`
- Modify: `frontend/src/components/pos/SaleReceiptModal.tsx`
- Modify: `frontend/src/components/pos/PaymentModal.tsx`
- Modify: `frontend/src/pages/PosPage.tsx`
- Test: `frontend/tests/components/SaleReceiptModal.test.tsx`
- Test: `frontend/tests/pages/PosPage.test.tsx`

**Interfaces:**
- Consumes: `/api/fiscal/*` endpoints
- Produces:
  - `SaleReceiptModal` displaying official DANFE NFC-e mode (Chave de Acesso formatada, QR Code SEFAZ escaneável, Protocolo SEFAZ, Tributos IBPT, selo de contingência).
  - `PaymentModal` with checkbox "Emitir NFC-e Fiscal (Modelo 65)" (checked by default).
  - `PosPage` calling `api.issueNfce` after checkout completion and passing fiscal data to `SaleReceiptModal`.

- [ ] **Step 1: Write failing frontend tests for DANFE NFC-e display and checkout emission**

Update `frontend/tests/components/SaleReceiptModal.test.tsx`:
- When `nfceInvoice` is provided, renders "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica".
- Renders 44-digit access key in 11 groups of 4.
- Renders SEFAZ authorization protocol number and timestamp.
- Renders QR Code SVG for smartphone scanning.
- If `tpEmis === 9`, renders prominent "EMITIDA EM CONTINGÊNCIA" banner.
Update `frontend/tests/pages/PosPage.test.tsx`:
- Verifies checkout automatically invokes NFC-e issuance when enabled and passes authorized invoice to receipt modal.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cmd.exe /c "npx vitest run frontend/tests/components/SaleReceiptModal.test.tsx frontend/tests/pages/PosPage.test.tsx"`
Expected: FAIL.

- [ ] **Step 3: Implement frontend fiscal client and DANFE NFC-e view**

1. Update `frontend/src/services/api.ts` with `issueNfce`, `getNfceBySaleId`, `getFiscalProfile`, `NfceInvoice` types.
2. Update `SaleReceiptModal.tsx` with dedicated DANFE NFC-e section, SVG QR Code rendering, access key copy button, and print styling.
3. Update `PaymentModal.tsx` and `PosPage.tsx` to orchestrate automatic NFC-e emission on checkout.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cmd.exe /c "npx vitest run frontend/tests/components/SaleReceiptModal.test.tsx frontend/tests/pages/PosPage.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Full repository verification**

Run:
```bash
cmd.exe /c "npm test"
cmd.exe /c "npx tsc --noEmit && cd frontend && npx tsc --noEmit && cd ../desktop && npx tsc --noEmit"
cmd.exe /c "npm run build:web"
```
Expected: All tests pass, zero TypeScript errors, clean web production bundle.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/components/pos/SaleReceiptModal.tsx frontend/src/components/pos/PaymentModal.tsx frontend/src/pages/PosPage.tsx frontend/tests/
git commit -m "feat(frontend): integrate DANFE NFC-e thermal viewer with QR code, access key and checkout emission"
```
