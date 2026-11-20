# FarmaCore ERP — Especificação Técnica da Fase 11
# Convênios Corporativos, Crediário Próprio (Carnê da Farmácia) & Limite de Crédito

**Status:** APROVADO  
**Data:** 20 de Novembro de 2026  
**Autor:** Equipe de Arquitetura FarmaCore  
**Contexto:** Padrão ERP Farmacêutico Linx Farma / Trier / InovaFarma

---

## 1. Visão Geral e Objetivos do Módulo

A **Fase 11** do FarmaCore ERP implementa o ecossistema de vendas a prazo, convênios corporativos empresariais e crediário próprio (carnê da drogaria). O módulo visa fidelizar clientes recorrentes e atender contratos corporativos (B2B2C com desconto em folha de pagamento), operando em harmonia com o PDV e o fechamento financeiro de caixa.

O módulo estrutura-se em seis pilares:

1. **Gestão de Empresas Conveniadas (`corporate_agreements`):**
   - Cadastro de empresas parceiras que oferecem convênio farmácia aos seus colaboradores.
   - Parâmetros comerciais: Dia de corte do ciclo de faturamento (ex: dia 20), dia de vencimento (ex: dia 05), limite global de crédito da empresa e percentual padrão de desconto corporativo.

2. **Clientes, Dependentes & Gestão de Crédito (`customers` & `customer_dependents`):**
   - Cadastro de clientes conveniados ou de crediário avulso da drogaria.
   - Limite de crédito aprovado, saldo devedor atual e saldo disponível para compras em tempo real.
   - Status de adimplência: `ACTIVE`, `BLOCKED_OVERDUE` (bloqueio automático por inadimplência/parcelas vencidas) ou `INACTIVE`.
   - Cadastro de dependentes autorizados a comprar no convênio com validação de vínculo e CPF.

3. **Venda a Prazo no PDV (`CONVENIO` & `CREDIARIO`):**
   - Suporte aos novos métodos de pagamento na finalização de vendas do PDV.
   - Validação atômica de saldo e bloqueio: impede compras se o cliente estiver inadimplente ou se o valor exceder o limite de crédito disponível.
   - Emissão compulsória da **Nota Promissória / Duplicata de Venda a Prazo em Cupom Térmico (ESC/POS 48/80 colunas)** com termo de confissão de dívida e linha para assinatura do comprador.

4. **Títulos a Receber & Carnê da Farmácia (`customer_receivables`):**
   - Desdobramento automático das compras a prazo em parcelas com datas de vencimento, juros e multas por atraso.
   - Emissão de Carnê de Pagamento para o cliente com lâminas de cobrança.

5. **Faturamento Corporativo & Extrato para o RH da Empresa (`agreement_invoices`):**
   - Fechamento periódico das compras dos colaboradores da empresa conveniada.
   - Geração de Fatura Global para quitação da empresa parceira.
   - Geração do **Extrato de Desconto em Folha** para o departamento de Recursos Humanos (RH) da empresa conveniada, relacionando colaboradores, matrículas e valores a descontar no holerite.

6. **Baixa e Quitação no Caixa PDV (`receiveCustomerPayment`):**
   - Quitação de débitos e carnês diretamente na gaveta do caixa em operação.
   - O operador consulta o CPF, visualiza as parcelas em aberto, recebe em Dinheiro, Cartão ou PIX, e o sistema registra automaticamente um movimento de entrada na sessão de caixa atual (`cash_movements` com `movement_type = 'RECEBIMENTO_CREDIARIO'`).
   - Recomposição instantânea do limite de crédito do cliente e desbloqueio automático caso não haja mais parcelas vencidas.
   - Emissão do Comprovante Térmico de Quitação de Débito.

---

## 2. Modelagem do Banco de Dados (Migration 010)

### 2.1. Tabela `corporate_agreements` (Empresas Conveniadas)
```sql
CREATE TABLE IF NOT EXISTS corporate_agreements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,             -- Ex: 'CONV-001', 'PREFEITURA', 'AMBEV'
  company_name TEXT NOT NULL,            -- Razão Social
  trade_name TEXT NOT NULL,              -- Nome Fantasia
  cnpj TEXT UNIQUE NOT NULL,
  ie TEXT,
  phone TEXT,
  email TEXT,
  contact_name TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  
  -- Regras comerciais de faturamento
  closing_day INTEGER NOT NULL DEFAULT 20, -- Dia de corte do ciclo (1 a 31)
  due_day INTEGER NOT NULL DEFAULT 5,       -- Dia de vencimento da fatura (1 a 31)
  credit_limit REAL NOT NULL DEFAULT 0.0,   -- Limite global de crédito da empresa
  discount_percent REAL NOT NULL DEFAULT 0.0, -- Desconto comercial corporativo (%)
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2. Tabela `customers` (Clientes Titulares de Crédito e Convênio)
```sql
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  agreement_id INTEGER REFERENCES corporate_agreements(id) ON DELETE RESTRICT, -- NULL = Crediário Próprio Avulso
  name TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  rg TEXT,
  birth_date TEXT,
  phone TEXT,
  email TEXT,
  street TEXT,
  number TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  
  -- Vínculo funcional com empresa conveniada
  registration_number TEXT,              -- Matrícula funcional no RH
  department TEXT,                       -- Setor / Departamento
  
  -- Gestão de Limite e Crédito
  credit_limit REAL NOT NULL DEFAULT 0.0, -- Limite aprovado em R$
  current_debt REAL NOT NULL DEFAULT 0.0, -- Saldo devedor total acumulado
  status TEXT NOT NULL DEFAULT 'ACTIVE',  -- 'ACTIVE', 'BLOCKED_OVERDUE', 'INACTIVE'
  allow_dependents INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.3. Tabela `customer_dependents` (Dependentes Autorizados)
```sql
CREATE TABLE IF NOT EXISTS customer_dependents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'OUTRO', -- 'CONJUGE', 'FILHO(A)', 'PAI/MAE', 'OUTRO'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.4. Tabela `customer_receivables` (Parcelas a Receber / Carnês)
```sql
CREATE TABLE IF NOT EXISTS customer_receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
  agreement_id INTEGER REFERENCES corporate_agreements(id) ON DELETE RESTRICT,
  invoice_id INTEGER REFERENCES agreement_invoices(id) ON DELETE SET NULL,
  
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL,                 -- Data de vencimento YYYY-MM-DD
  original_amount REAL NOT NULL,          -- Valor nominal da parcela
  paid_amount REAL NOT NULL DEFAULT 0.0,  -- Valor efetivamente pago
  discount_amount REAL NOT NULL DEFAULT 0.0,
  interest_amount REAL NOT NULL DEFAULT 0.0,
  
  status TEXT NOT NULL DEFAULT 'OPEN',    -- 'OPEN', 'PAID', 'CANCELLED', 'RENEGOTIATED'
  paid_at TEXT,
  cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
  payment_method TEXT,                   -- 'CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'PAYROLL_DEDUCTION'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.5. Tabela `agreement_invoices` (Faturas Globais de Convênio)
```sql
CREATE TABLE IF NOT EXISTS agreement_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE NOT NULL,    -- Ex: 'FAT-202611-0001'
  agreement_id INTEGER NOT NULL REFERENCES corporate_agreements(id) ON DELETE RESTRICT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  due_date TEXT NOT NULL,
  total_amount REAL NOT NULL,
  total_sales_count INTEGER NOT NULL DEFAULT 0,
  total_employees_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN',    -- 'OPEN', 'PAID', 'CANCELLED'
  paid_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
CREATE INDEX IF NOT EXISTS idx_customers_agreement ON customers(agreement_id);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_customer ON customer_receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_receivables_due ON customer_receivables(due_date, status);
CREATE INDEX IF NOT EXISTS idx_agreement_invoices_agreement ON agreement_invoices(agreement_id);
```

---

## 3. Serviços e Regras de Negócio

### 3.1. `AgreementService` (Empresas Conveniadas)
- `listAgreements(filter?: { activeOnly?: boolean }): CorporateAgreement[]`
- `getAgreementById(id: number): CorporateAgreement | null`
- `createAgreement(input: CreateAgreementInput): CorporateAgreement` (Valida CNPJ único e código único)
- `updateAgreement(id: number, input: UpdateAgreementInput): CorporateAgreement`
- `generateInvoice(agreementId: number, period: { startDate: string; endDate: string; dueDate: string }): AgreementInvoiceWithDetails`
  - Consolida todas as parcelas de convênio do período ainda não faturadas.
  - Gera número `FAT-YYYYMM-XXXX`.
  - Vincula as parcelas à fatura criada.
  - Produz o Extrato de Desconto em Folha para o RH.

### 3.2. `CustomerCreditService` (Clientes, Crédito & Validações)
- `listCustomers(filters?: CustomerFilters): { customers: Customer[]; total: number }`
- `getCustomerById(id: number): CustomerWithDependents | null`
- `getCustomerByCpf(cpf: string): CustomerWithDependents | null`
- `createCustomer(input: CreateCustomerInput): Customer` (Valida CPF único, limites e filial)
- `updateCustomer(id: number, input: UpdateCustomerInput): Customer`
- `addDependent(customerId: number, input: CreateDependentInput): CustomerDependent`
- `removeDependent(dependentId: number): void`
- `checkCreditEligibility(customerId: number, purchaseAmount: number, buyerCpf?: string): CreditEligibilityResult`
  - Verifica se o cliente existe e se o status é `ACTIVE`.
  - Verifica parcelas vencidas há mais de $N$ dias (tolerância padrão 5 dias): se houver, atualiza cliente para `BLOCKED_OVERDUE` e rejeita a venda.
  - Verifica se `currentDebt + purchaseAmount <= creditLimit`. Se exceder, rejeita com `CREDIT_LIMIT_EXCEEDED` informando o saldo disponível.
  - Se `buyerCpf` for informado e diferente do titular: valida se é dependente ativo com `allowDependents = true`.

### 3.3. `ReceivableService` (Contas a Receber, Parcelamento & Quitação no Caixa)
- `createReceivablesForSale(saleId: number, customerId: number, amount: number, installmentsCount = 1, agreementId?: number): CustomerReceivable[]`
  - Gera as parcelas em `customer_receivables`.
  - Incrementa atomicamente `customers.current_debt += amount`.
- `getCustomerReceivables(customerId: number, status?: 'OPEN' | 'PAID' | 'ALL'): CustomerReceivable[]`
- `receivePayment(params: ReceivePaymentParams): PaymentReceiptResult`
  - Executado em transação atômica SQLite:
    - Baixa as parcelas selecionadas (`status = 'PAID'`, `paid_amount`, `paid_at`, `cash_session_id`, `payment_method`).
    - Deduz `customers.current_debt -= totalPaid`.
    - Se o cliente estava em `BLOCKED_OVERDUE` e não possui mais parcelas vencidas, restaura o status para `ACTIVE`.
    - Insere registro em `cash_movements` na sessão de caixa aberta (`movement_type = 'RECEBIMENTO_CREDIARIO'`, `amount = totalPaid`), garantindo conferência no Fechamento Cego de Caixa.
    - Retorna o recibo de pagamento formatado para impressão térmica ESC/POS.

### 3.4. Formatadores de Comprovantes Térmicos (`credit-receipt-formatter.ts`)
- **`formatPromissoryNote(sale: Sale, customer: Customer, items: CustomerReceivable[], store: Store, buyerName?: string): { textNote: string; fullEscPos: string }`**
  - Duplicata / Nota Promissória de venda a prazo (80/48 colunas).
  - Inclui declaração jurídica de confissão de dívida, vencimentos, dados do comprador e linha formal para assinatura.
- **`formatPaymentReceipt(customer: Customer, paidItems: CustomerReceivable[], totalPaid: number, store: Store, operatorName: string): { textReceipt: string; fullEscPos: string }`**
  - Comprovante de quitação de débitos com discriminação das parcelas pagas, saldo devedor remanescente e limite liberado.
- **`formatPayrollReport(invoice: AgreementInvoice, agreement: CorporateAgreement, details: EmployeePayrollItem[]): string`**
  - Extrato formatado para o RH da empresa parceira efetuar o desconto em folha.

---

## 4. Endpoints da API REST (Fastify)

### 4.1. Convênios (`/api/credit/agreements`)
- `GET /api/credit/agreements`: Lista empresas parceiras.
- `GET /api/credit/agreements/:id`: Detalhes da empresa.
- `POST /api/credit/agreements`: Cadastra nova empresa parceira.
- `PUT /api/credit/agreements/:id`: Atualiza empresa parceira.
- `POST /api/credit/agreements/:id/invoices`: Gera fatura e extrato do período para o RH.
- `GET /api/credit/agreements/:id/invoices`: Lista faturas emitidas da empresa.

### 4.2. Clientes & Limites (`/api/credit/customers`)
- `GET /api/credit/customers`: Lista clientes com filtros (busca por nome, CPF, empresa, status).
- `GET /api/credit/customers/:id`: Detalhes do cliente, saldo, limite e dependentes.
- `GET /api/credit/customers/by-cpf/:cpf`: Busca rápida por CPF.
- `POST /api/credit/customers`: Cadastra novo cliente de crédito/convênio.
- `PUT /api/credit/customers/:id`: Atualiza dados e limite de crédito.
- `POST /api/credit/customers/:id/dependents`: Adiciona dependente autorizado.
- `DELETE /api/credit/customers/dependents/:id`: Remove dependente.
- `POST /api/credit/customers/:id/check-eligibility`: Consulta elegibilidade e limite em tempo real.

### 4.3. Recebíveis & Baixa no Caixa (`/api/credit/receivables`)
- `GET /api/credit/receivables/customer/:customerId`: Lista parcelas do cliente (abertas e pagas).
- `POST /api/credit/receivables/pay`: Baixa e quitação de parcelas no caixa PDV (registra na gaveta).
- `GET /api/credit/receivables/sale/:saleId/promissory`: Gera Nota Promissória / Duplicata da venda a prazo.

---

## 5. Interface com o Usuário (Frontend React)

1. **Posto de Convênios & Crediário (`[F9] Convênios & Crediário`):**
   - Integrado ao roteador de estações no topo com hotkey `F9` e ícone `Handshake` / `CreditCard`.
   - Aba 1: **Clientes & Crédito** (Cartões de clientes com saldo devedor, barra de progresso do limite utilizado, histórico de compras e dependentes).
   - Aba 2: **Empresas Conveniadas** (Painel de empresas, regras comerciais e fechamento de fatura para RH com exportação de extrato).
   - Aba 3: **Recebimento de Carnês no Caixa** (Busca rápida por CPF, seleção de parcelas e quitação com emissão de recibo).
2. **Integração no PDV (`PaymentModal`):**
   - Habilita botões `Convênio Empresa` e `Crediário Próprio`.
   - Ao selecionar, abre campo de busca por CPF do titular ou dependente.
   - Exibe visualmente o limite disponível em verde e bloqueia a finalização se o valor exceder o limite.
   - Ao finalizar com sucesso, abre automaticamente o modal de impressão da Nota Promissória / Duplicata para assinatura do cliente.

---

## 6. Critérios de Aceite e Homologação
1. **Bloqueio Rigoroso de Inadimplência:** Clientes com débitos vencidos ou que ultrapassem o limite de crédito aprovado não conseguem finalizar compras a prazo no PDV.
2. **Entrada na Gaveta do Caixa:** Toda quitação de débitos no PDV gera movimento de entrada em dinheiro/cartão/PIX na sessão de caixa atual, refletindo no fechamento cego de caixa.
3. **Validade Jurídica do Comprovante:** A Nota Promissória emitida em cupom térmico contém os termos legais de confissão de dívida, CPF do comprador e linha para assinatura.
4. **Extrato para RH:** Fechamento corporativo agrupa corretamente todas as compras do ciclo de faturamento por colaborador.
5. **Zero Regressões:** Todos os 906 testes das 10 fases anteriores continuam passando com 100% de sucesso.
