# FarmaCore ERP — Fase 11: Convênios Corporativos, Crediário Próprio (Carnê da Farmácia) & Limite de Crédito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar no FarmaCore ERP o módulo completo de vendas a prazo, convênios corporativos com empresas parceiras (desconto em folha para RH) e crediário próprio (carnê da farmácia):
1. Cadastro de Empresas Conveniadas com parâmetros de corte, vencimento e desconto (`AgreementService`).
2. Gestão de Clientes, Dependentes, Limites de Crédito e Bloqueio por Inadimplência (`CustomerCreditService`).
3. Venda a Prazo no PDV (`PaymentMethod.CONVENIO` e `PaymentMethod.CREDIARIO`), com emissão compulsória de Nota Promissória / Duplicata em cupom térmico ESC/POS.
4. Títulos a Receber, Carnê da Farmácia e Baixa/Quitação de parcelas na gaveta do Caixa PDV com movimentação de caixa (`ReceivableService`).
5. Fechamento de Faturamento Corporativo e Extrato de Desconto em Folha para o RH das empresas parceiras.
6. Interface Frontend React com Posto `[F9] Convênios & Crediário`, integração na tela de pagamento do PDV e modal de recebimento rápido no caixa.

**Architecture:** Módulo `src/modules/credit/` integrado ao SQLite WAL (Migration 010), rotas Fastify `/api/credit/*` com validação Zod, e interface React (`CustomerCreditPage`, `PromissoryNoteModal`, `DebtPaymentModal`, extensão do `PaymentModal`).

**Tech Stack:** Node.js, TypeScript, SQLite (better-sqlite3), Fastify, Zod, React 19, Tailwind CSS, Lucide React, Vitest.

**Spec:** `docs/specs/2026-11-20-farma-erp-phase11-customer-credit-corporate-agreements.md`

## Global Constraints
- **Preservação de Integridade:** 100% dos 906 testes anteriores devem continuar passando sem regressão.
- **Bloqueio de Inadimplência:** Clientes com parcelas vencidas ou que ultrapassem o limite de crédito aprovado são estritamente impedidos de finalizar compras a prazo.
- **Movimentação de Caixa:** Toda quitação de crediário no caixa PDV gera lançamento formal na sessão de caixa aberta (`RECEBIMENTO_CREDIARIO`).
- **Validade Jurídica do Comprovante:** A Nota Promissória impressa em cupom térmico deve conter os termos legais de confissão de dívida, CPF do comprador e linha para assinatura.
- **Windows Executables:** Utilizar sempre `.cmd` (`npm.cmd`, `npx.cmd`).
- **TDD Rigoroso:** Testes antes do código em todas as tarefas.

---

### Task 1: Schema 010 & Tipos de Domínio de Convênios e Crediário

**Files:**
- Create: `src/database/migrations/010_customer_credit_corporate_agreements.sql`
- Create: `src/modules/credit/types.ts`
- Test: `tests/modules/credit/schema.test.ts`

**Interfaces:**
- Produces:
  - Tabela `corporate_agreements` (id, code, company_name, trade_name, cnpj, ie, phone, email, contact_name, street, number, neighborhood, city, state, zip_code, closing_day, due_day, credit_limit, discount_percent, is_active, created_at, updated_at).
  - Tabela `customers` (id, store_id, agreement_id, name, cpf, rg, birth_date, phone, email, street, number, neighborhood, city, state, zip_code, registration_number, department, credit_limit, current_debt, status, allow_dependents, notes, created_at, updated_at).
  - Tabela `customer_dependents` (id, customer_id, name, cpf, relationship, is_active, created_at).
  - Tabela `customer_receivables` (id, customer_id, sale_id, agreement_id, invoice_id, installment_number, total_installments, due_date, original_amount, paid_amount, discount_amount, interest_amount, status, paid_at, cash_session_id, payment_method, notes, created_at, updated_at).
  - Tabela `agreement_invoices` (id, invoice_number, agreement_id, period_start, period_end, due_date, total_amount, total_sales_count, total_employees_count, status, paid_at, notes, created_at, updated_at).
  - Índices de performance para busca por CPF, empresa conveniada e vencimento.
  - Tipos TypeScript em `src/modules/credit/types.ts`.

- [x] **Step 1: Escrever testes que falham para o Schema 010 e Tipos**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `010_customer_credit_corporate_agreements.sql` e `types.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 2: Backend — Gestão de Empresas Conveniadas e Faturamento de RH (`AgreementService`)

**Files:**
- Create: `src/modules/credit/agreement.service.ts`
- Test: `tests/modules/credit/agreement.service.test.ts`

**Interfaces:**
- Produces:
  - `listAgreements(filter?: { activeOnly?: boolean }): CorporateAgreement[]`
  - `getAgreementById(id: number): CorporateAgreement | null`
  - `createAgreement(input: CreateAgreementInput): CorporateAgreement` (valida CNPJ único e código único)
  - `updateAgreement(id: number, input: UpdateAgreementInput): CorporateAgreement`
  - `generateInvoice(agreementId: number, params: GenerateInvoiceParams): AgreementInvoiceWithDetails`
    - Consolida as compras dos colaboradores no período que ainda não foram faturadas.
    - Gera número de fatura `FAT-YYYYMM-XXXX`.
    - Vincula as parcelas à fatura criada.
    - Produz o resumo com total faturado, quantidade de colaboradores e extrato detalhado para o RH.

- [x] **Step 1: Escrever testes que falham para `agreement.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/credit/agreement.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 3: Backend — Clientes, Dependentes & Verificação de Limite de Crédito (`CustomerCreditService`)

**Files:**
- Create: `src/modules/credit/customer-credit.service.ts`
- Test: `tests/modules/credit/customer-credit.service.test.ts`

**Interfaces:**
- Produces:
  - `listCustomers(filters?: CustomerFilters): { customers: Customer[]; total: number }`
  - `getCustomerById(id: number): CustomerWithDependents | null`
  - `getCustomerByCpf(cpf: string): CustomerWithDependents | null`
  - `createCustomer(input: CreateCustomerInput): Customer` (valida CPF único e filial ativa)
  - `updateCustomer(id: number, input: UpdateCustomerInput): Customer`
  - `addDependent(customerId: number, input: CreateDependentInput): CustomerDependent`
  - `removeDependent(dependentId: number): void`
  - `checkCreditEligibility(customerId: number, purchaseAmount: number, buyerCpf?: string): CreditEligibilityResult`
    - Valida status `ACTIVE` (rejeita se `BLOCKED_OVERDUE`).
    - Verifica parcelas vencidas há mais de 5 dias: atualiza para `BLOCKED_OVERDUE` e rejeita a compra.
    - Valida limite: se `currentDebt + purchaseAmount > creditLimit`, rejeita com `CREDIT_LIMIT_EXCEEDED` informando o saldo disponível.
    - Valida dependente se o comprador não for o titular.

- [x] **Step 1: Escrever testes que falham para `customer-credit.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/credit/customer-credit.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 4: Backend — Parcelamento a Prazo, Quitação no Caixa PDV e Movimentação de Gaveta (`ReceivableService`)

**Files:**
- Create: `src/modules/credit/receivable.service.ts`
- Test: `tests/modules/credit/receivable.service.test.ts`

**Interfaces:**
- Produces:
  - `createReceivablesForSale(saleId: number, customerId: number, amount: number, installmentsCount?: number, agreementId?: number): CustomerReceivable[]`
    - Gera as parcelas em `customer_receivables` com data de vencimento.
    - Incrementa atomicamente `customers.current_debt += amount`.
  - `getCustomerReceivables(customerId: number, status?: 'OPEN' | 'PAID' | 'ALL'): CustomerReceivable[]`
  - `receivePayment(params: ReceivePaymentParams): PaymentReceiptResult`
    - Executado em transação atômica SQLite:
      - Baixa as parcelas selecionadas (`status = 'PAID'`, `paid_amount`, `paid_at`, `cash_session_id`, `payment_method`).
      - Deduz o saldo devedor do cliente (`current_debt -= totalPaid`).
      - Se o cliente estava em `BLOCKED_OVERDUE` e quitou todas as parcelas vencidas, restaura o status para `ACTIVE`.
      - Registra entrada na sessão de caixa atual (`cash_movements` com `movement_type = 'RECEBIMENTO_CREDIARIO'`, `amount = totalPaid`).

- [x] **Step 1: Escrever testes que falham para `receivable.service.ts`**
- [x] **Step 2: Executar teste para verificar que falha**
- [x] **Step 3: Implementar `src/modules/credit/receivable.service.ts`**
- [x] **Step 4: Executar teste para verificar que passa**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 5: Backend — Formatadores Térmicos ESC/POS (Nota Promissória, Recibo de Quitação, Extrato RH) & Rotas Fastify (`/api/credit/*`)

**Files:**
- Create: `src/modules/credit/credit-receipt-formatter.ts`
- Create: `src/modules/credit/credit.routes.ts`
- Modify: `src/api/routes.ts`
- Test: `tests/modules/credit/credit-receipt-formatter.test.ts`
- Test: `tests/api/routes.credit.test.ts`

**Interfaces:**
- Produces:
  - `formatPromissoryNote(sale: any, customer: any, items: any[], store: any, buyerName?: string): { textNote: string; fullEscPos: string }`
  - `formatPaymentReceipt(customer: any, paidItems: any[], totalPaid: number, store: any, operatorName: string): { textReceipt: string; fullEscPos: string }`
  - `formatPayrollReport(invoice: any, agreement: any, details: any[]): string`
  - Rotas REST Fastify:
    - `/api/credit/agreements` (GET, POST, GET /:id, PUT /:id, POST /:id/invoices, GET /:id/invoices)
    - `/api/credit/customers` (GET, POST, GET /:id, GET /by-cpf/:cpf, PUT /:id, POST /:id/dependents, DELETE /dependents/:id, POST /:id/check-eligibility)
    - `/api/credit/receivables` (GET /customer/:customerId, POST /pay, GET /sale/:saleId/promissory)

- [x] **Step 1: Escrever testes que falham para formatadores e rotas Fastify**
- [x] **Step 2: Executar teste para verificar que falham**
- [x] **Step 3: Implementar formatadores e rotas, conectar a `src/api/routes.ts`**
- [x] **Step 4: Executar teste para verificar que passam (200, 201, 400, 404, 409)**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 6: Frontend React — Posto de Convênios [F9], Integração no PDV (`PaymentModal`), Modal de Promissória e Quitação

**Files:**
- Create: `frontend/src/types/credit.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/CustomerCreditPage.tsx`
- Create: `frontend/src/components/credit/PromissoryNoteModal.tsx`
- Create: `frontend/src/components/credit/DebtPaymentModal.tsx`
- Modify: `frontend/src/components/PaymentModal.tsx`
- Modify: `frontend/src/App.tsx` & `frontend/src/hooks/useStationMode.ts`
- Test: `frontend/tests/pages/CustomerCreditPage.test.tsx`

**Interfaces:**
- Produces:
  - Adiciona modo `CREDIT` ("Posto: Convênios & Crediário") com atalho `F9`.
  - Tela completa `CustomerCreditPage` com 3 abas: Clientes & Limites, Empresas Conveniadas e Quitação no Caixa.
  - No `PaymentModal` do PDV: inclusão de opções "Convênio Empresa" e "Crediário Próprio", com consulta rápida de CPF, exibição do limite disponível em verde e bloqueio se insuficiente.
  - Ao concluir venda a prazo, abre automaticamente `PromissoryNoteModal` para impressão térmica com linha de assinatura.
  - Botão no Caixa para "Receber Crediário / Carnê" abrindo `DebtPaymentModal`.

- [x] **Step 1: Escrever testes para a página de crédito e modais**
- [x] **Step 2: Executar teste para verificar que falham**
- [x] **Step 3: Implementar tipos, API adapter, componentes React e integração PDV**
- [x] **Step 4: Executar teste para verificar que passam e checar TypeScript frontend**
- [x] **Step 5: Git commit com mensagem semântica**

---

### Task 7: Auditoria Completa de Integração & Homologação Final da Fase 11

**Files:**
- Test: Suíte completa de testes (`npm.cmd test`)
- Verify: `npx.cmd tsc --noEmit` (backend)
- Verify: `npx.cmd tsc -p frontend/tsconfig.json --noEmit` (frontend)
- Verify: `npm.cmd run build:web` (produção frontend)

- [x] **Step 1: Rodar auditoria completa de testes e checagem de tipos**
- [x] **Step 2: Verificar integridade de ponta a ponta e build de produção**
- [x] **Step 3: Despachar revisor da branch inteira e homologar**
- [ ] **Step 2: Corrigir qualquer aviso ou inconsistência de regressão**
- [ ] **Step 3: Garantir 100% de testes passando e build web limpo**
- [ ] **Step 4: Git commit final da Fase 11 e instruções de push para o usuário**
