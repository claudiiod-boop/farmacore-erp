# Plano de Implementação — Fase 16: Conciliação Bancária OFX, Extratos Multi-Banco & Fluxo de Caixa Realizado vs Projetado

**Data:** 21 de Novembro de 2026  
**Estratégia:** TDD Rigoroso (Test-Driven Development), Validação Contínua de TypeScript e Zero Regressão na Suíte Oficial (1.306 testes).

---

## Estrutura de Tarefas (Tasks)

### Task 1: Migration 015 & Tipos TypeScript de Domínio
- **Arquivos:**
  - `src/database/migrations/015_bank_reconciliation_ofx_cashflow.sql`
  - `src/modules/financial/bank-reconciliation.types.ts`
  - `tests/modules/financial/bank-reconciliation.schema.test.ts`
- **Ações:**
  - Tabelas: `bank_accounts`, `bank_statement_batches`, `bank_statement_entries`, `bank_reconciliation_links`.
  - Índices em `fitid`, `account_id`, `posted_date`, `reconciliation_status`.
  - Tipos completos para contas, extratos OFX, transações e projeções de fluxo de caixa.

### Task 2: Parser Oficial de Extratos Bancários OFX (`OfxParserService`)
- **Arquivos:**
  - `src/modules/financial/ofx-parser.service.ts`
  - `tests/modules/financial/ofx-parser.service.test.ts`
- **Ações:**
  - Parser robusto para OFX 1.x (SGML) e OFX 2.x (XML).
  - Extração de conta bancária (`<ACCTID>`, `<BANKID>`), período (`<DTSTART>`, `<DTEND>`), saldo contábil (`<LEDGERBAL>`) e lista de transações (`<STMTTRN>`).
  - Conversão de datas bancárias `YYYYMMDD...` para ISO `YYYY-MM-DD` e valores numéricos precisos.

### Task 3: Motor de Conciliação Bancária Automática (`BankReconciliationService`)
- **Arquivos:**
  - `src/modules/financial/bank-reconciliation.service.ts`
  - `tests/modules/financial/bank-reconciliation.service.test.ts`
- **Ações:**
  - Gestão de contas correntes (`createBankAccount`, `listBankAccounts`).
  - `importOfxStatement`: parseia OFX, verifica duplicidade por `fitid` (idempotência bancária).
  - Algoritmo de batimento automático em cascata:
    - Depósitos de TEF/Cartão (Fase 15) -> `TEF_SETTLEMENT`.
    - Sangrias de Caixa PDV (Fase 7) -> `CASH_DRAWER`.
    - Pagamento de Fornecedores (Fase 5) -> `PURCHASE_PAYMENT`.
    - Quitações de Crediário (Fase 12) -> `CUSTOMER_CREDIT`.
    - Detecção de Tarifas Bancárias -> `BANK_FEE`.
  - `manualMatchEntry`: vinculação manual pelo operador.

### Task 4: Motor de Fluxo de Caixa Realizado vs Projetado (`CashFlowService`)
- **Arquivos:**
  - `src/modules/financial/cash-flow.service.ts`
  - `tests/modules/financial/cash-flow.service.test.ts`
- **Ações:**
  - Consolidação de saldo real atual em todas as contas bancárias ativas + saldo em dinheiro físico nos caixas.
  - Projeção de entradas futuras (D+1 a D+30 de cartões e duplicatas a vencer).
  - Projeção de saídas futuras (títulos a pagar de notas fiscais de entrada).
  - Relatório diário `CashFlowDailySummary[]` com semáforo de liquidez.

### Task 5: Formatador Térmico ESC/POS & Rotas Fastify (`/api/bank-reconciliation/*`, `/api/cash-flow/*`)
- **Arquivos:**
  - `src/modules/financial/bank-reconciliation-formatter.ts`
  - `src/modules/financial/bank-reconciliation.routes.ts`
  - `src/api/routes.ts`
  - `tests/modules/financial/bank-reconciliation-formatter.test.ts`
  - `tests/api/routes.bank-reconciliation.test.ts`
- **Ações:**
  - Emissão de extrato térmico bancário e resumo diário de fluxo de caixa em 48 colunas.
  - Rotas de upload de OFX, contas bancárias, conciliação manual e fluxo de caixa.

### Task 6: Interface Frontend React (`BankReconciliationPage.tsx`)
- **Arquivos:**
  - `frontend/src/types/bank-reconciliation.ts`
  - `frontend/src/services/api.ts` (`bankReconciliationApi`, `cashFlowApi`)
  - `frontend/src/pages/BankReconciliationPage.tsx`
  - `frontend/src/App.tsx`
  - `frontend/tests/pages/BankReconciliationPage.test.tsx`
- **Ações:**
  - Abas:
    1. Extrato & Conciliação OFX (Upload, listagem e conciliação visual).
    2. Fluxo de Caixa Realizado vs Projetado (Cards de saldo, gráfico e tabela dia a dia).
    3. Contas Bancárias Cadastradas.
  - Integração no `App.tsx` e atalho na barra superior.

### Task 7: Auditoria de Homologação Final da Fase 16
- **Ações:**
  - 100% dos testes passando sem regressão.
  - `npx.cmd tsc --noEmit` (backend) = 0 erros.
  - `npx.cmd tsc -p frontend/tsconfig.json --noEmit` (frontend) = 0 erros.
  - `npm.cmd run build:web` = sucesso.
  - Instruções de push para o repositório oficial.
