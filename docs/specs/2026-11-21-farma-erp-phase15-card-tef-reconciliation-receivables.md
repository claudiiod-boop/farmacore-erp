# FarmaCore ERP — Especificação Técnica da Fase 15
## Módulo: Conciliação Automática de Cartões/TEF, Calendário de Recebíveis (D+1 / D+30), Taxas MDR de Adquirentes & Extrato EDI

---

### 1. Visão Geral e Contexto de Negócio

No varejo farmacêutico brasileiro, as transações eletrônicas via Cartões de Crédito, Débito e PIX representam entre 70% e 85% do faturamento total de uma drogaria. Esse alto volume expõe as farmácias a dois riscos financeiros severos:
1. **Cobrança Indevida de Taxas MDR (Merchant Discount Rate):** Adquirentes (Cielo, Rede, Stone, PagBank, Getnet, SafraPay) frequentemente alteram unilateralmente ou cobram taxas acima do contratado por troca de maquininha, custo de conectividade, taxa de cancelamento ou aplicação incorreta de tabela de parcelamento. Sem conciliação automatizada, farmácias perdem de 1% a 3% de sua margem líquida sem perceber.
2. **Descasamento de Fluxo de Caixa e Incerteza de Liquidação:** Vendas a débito caem em D+1 dia útil; vendas a crédito à vista em D+30 dias corridos; e parcelamentos caem mensalmente em D+30, D+60, D+90... A falta de um calendário preditivo exato de liquidação bancária compromete o pagamento de distribuidores de medicamentos (boletos com prazo curto de 7 a 28 dias).
3. **Chargebacks e Cancelamentos Ocultos:** Transações canceladas pela operadora ou contestadas por portadores de cartão precisam ser imediatamente identificadas para bloqueio preventivo de crediário ou cobrança administrativa.

A **Fase 15** implementa no FarmaCore ERP o motor industrial de conciliação de recebíveis e cartões:
- Cadastro de contratos de credenciamento por adquirente e matriz de taxas MDR por bandeira/modalidade/parcelas.
- Parser de extratos de vendas e pagamentos (EDI / CSV padronizado).
- Motor de conciliação automatizada com batimento por NSU, código de autorização, data e valor.
- Auditoria de divergência com cálculo do valor a ser contestado/ressarcido pela adquirente.
- Calendário financeiro preditivo de liquidação em conta corrente bancária.

---

### 2. Arquitetura de Dados (Migration 014)

```sql
-- 1. Contratos de Adquirentes Cadastradas
CREATE TABLE IF NOT EXISTS acquirer_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  acquirer_name TEXT NOT NULL, -- Ex: CIELO, REDE, STONE, PAGBANK, GETNET
  acquirer_cnpj TEXT NOT NULL,
  merchant_code TEXT, -- Código do estabelecimento na adquirente
  default_bank_name TEXT NOT NULL,
  default_bank_agency TEXT NOT NULL,
  default_bank_account TEXT NOT NULL,
  debit_settlement_days INTEGER NOT NULL DEFAULT 1, -- D+1
  credit_settlement_days INTEGER NOT NULL DEFAULT 30, -- D+30
  pix_settlement_days INTEGER NOT NULL DEFAULT 0, -- D+0 ou D+1
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, acquirer_name)
);

-- 2. Tabela de Regras de Taxas MDR por Adquirente, Bandeira e Modalidade
CREATE TABLE IF NOT EXISTS acquirer_fee_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES acquirer_contracts(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL, -- VISA, MASTERCARD, ELO, HIPERCARD, AMEX, PIX, OUTROS
  operation_type TEXT NOT NULL CHECK (operation_type IN ('DEBIT', 'CREDIT', 'PIX', 'VOUCHER')),
  installment_min INTEGER NOT NULL DEFAULT 1,
  installment_max INTEGER NOT NULL DEFAULT 1,
  mdr_rate REAL NOT NULL CHECK (mdr_rate >= 0.0 AND mdr_rate <= 100.0), -- Percentual acordado (ex: 1.25)
  fixed_fee REAL NOT NULL DEFAULT 0.0 CHECK (fixed_fee >= 0.0), -- Custo fixo por transação (ex: R$ 0,10)
  settlement_days INTEGER, -- Sobrescreve prazo padrão se preenchido
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, brand_name, operation_type, installment_min, installment_max)
);

-- 3. Lotes de Importação de Extratos de Adquirentes (EDI / Conciliação)
CREATE TABLE IF NOT EXISTS card_reconciliation_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  acquirer_contract_id INTEGER REFERENCES acquirer_contracts(id) ON DELETE SET NULL,
  batch_code TEXT NOT NULL UNIQUE, -- CONC-YYYYMM-XXXX
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('EDI_CONCIL', 'EXTRATO_CSV', 'API_ONLINE')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  total_gross_amount REAL NOT NULL DEFAULT 0.0,
  total_net_amount REAL NOT NULL DEFAULT 0.0,
  total_fee_amount REAL NOT NULL DEFAULT 0.0,
  conciliated_count INTEGER NOT NULL DEFAULT 0,
  divergent_count INTEGER NOT NULL DEFAULT 0,
  chargeback_count INTEGER NOT NULL DEFAULT 0,
  not_found_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSING', 'PROCESSED', 'REVERTED')),
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Itens / Lançamentos do Extrato e Auditoria de Batimento
CREATE TABLE IF NOT EXISTS card_settlement_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES card_reconciliation_batches(id) ON DELETE CASCADE,
  tef_transaction_id INTEGER REFERENCES tef_transactions(id) ON DELETE SET NULL,
  nsu TEXT NOT NULL,
  authorization_code TEXT,
  transaction_date TEXT NOT NULL,
  settlement_date TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  gross_amount REAL NOT NULL,
  charged_mdr_rate REAL NOT NULL,
  charged_fee_amount REAL NOT NULL,
  net_amount REAL NOT NULL,
  contract_mdr_rate REAL,
  expected_fee_amount REAL,
  expected_net_amount REAL,
  divergence_amount REAL NOT NULL DEFAULT 0.0, -- charged_fee - expected_fee
  reconciliation_status TEXT NOT NULL CHECK (reconciliation_status IN (
    'CONCILIATED',
    'DIVERGENT_FEE',
    'CHARGEBACK',
    'NOT_FOUND_IN_ERP',
    'CANCELLED'
  )),
  bank_account TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_acquirer_contracts_store ON acquirer_contracts(store_id, acquirer_name);
CREATE INDEX IF NOT EXISTS idx_acquirer_fee_rules_lookup ON acquirer_fee_rules(contract_id, brand_name, operation_type);
CREATE INDEX IF NOT EXISTS idx_card_settlement_nsu ON card_settlement_entries(nsu, authorization_code);
CREATE INDEX IF NOT EXISTS idx_card_settlement_status ON card_settlement_entries(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_card_settlement_date ON card_settlement_entries(settlement_date);
```

---

### 3. Serviços e Regras de Negócio

#### 3.1. `CardFeeCalculatorService` (`src/modules/financial/card-fee-calculator.service.ts`)
- **`matchFeeRule(contractId: number, brand: string, operationType: string, installments: number): AcquirerFeeRule | null`**:
  - Busca a regra de taxa MDR mais específica cadastrada. Se não houver regra específica de bandeira, usa regra curinga `OUTROS`.
- **`calculateTransactionFees(input: CalcTransactionFeeInput): TransactionFeeCalculation`**:
  - Calcula a taxa esperada, valor líquido esperado e data de liquidação prevista considerando dias úteis (para D+1) e parcelas subsequentes (D+30, D+60...).

#### 3.2. `CardReconciliationService` (`src/modules/financial/card-reconciliation.service.ts`)
- **`importStatement(input: ImportStatementInput): ReconciliationBatchResult`**:
  - Recebe o extrato da operadora (em lote CSV ou lista estruturada de lançamentos).
  - Gera número `CONC-YYYYMM-XXXX`.
  - Para cada registro do extrato:
    - Tenta associar à transação TEF correspondente no banco FarmaCore via `(nsu, authorization_code, amount)`.
    - Se encontrar a venda:
      - Compara a taxa cobrada pela operadora com a taxa cadastrada no contrato.
      - Se a taxa cobrada for superior à contratada com margem de tolerância ($\Delta > R\$ 0,02$), classifica como `DIVERGENT_FEE` com `divergence_amount = charged_fee - expected_fee`.
      - Se bater, classifica como `CONCILIATED` e marca a transação TEF como `SETTLED`.
    - Se a operadora registrar estorno/contestação, classifica como `CHARGEBACK`.
    - Se a venda não existir no banco FarmaCore, classifica como `NOT_FOUND_IN_ERP`.
- **`getReceivablesCalendar(storeId?: number, month?: string): ReceivablesCalendarDay[]`**:
  - Agrupa os recebíveis futuros e conciliados dia a dia para visualização em calendário financeiro de liquidação em conta bancária.
- **`getDivergenceReport(filters: DivergenceFilters): DivergenceReport`**:
  - Gera relatório analítico de taxas cobradas indevidamente pelas operadoras para abertura de chamado e contestação administrativa com as adquirentes.

---

### 4. Formatadores Térmicos ESC/POS & Rotas Fastify

- **Formatadores Térmicos (48 colunas):**
  - `formatDivergenceAuditSlip`: Extrato de divergências de taxas para anexar à contestação com a operadora.
  - `formatDailySettlementSlip`: Relatório do dia com previsão de depósitos bancários de cartões por adquirente.
- **Rotas Fastify (`/api/card-reconciliation/*`):**
  - `/api/card-reconciliation/contracts` (GET, POST)
  - `/api/card-reconciliation/contracts/:id` (GET, PUT)
  - `/api/card-reconciliation/contracts/:id/rules` (GET, POST)
  - `/api/card-reconciliation/rules/:id` (DELETE)
  - `/api/card-reconciliation/batches` (GET)
  - `/api/card-reconciliation/batches/:id` (GET)
  - `/api/card-reconciliation/import` (POST)
  - `/api/card-reconciliation/calendar` (GET)
  - `/api/card-reconciliation/divergences` (GET)
  - `/api/card-reconciliation/divergences/slip` (GET)

---

### 5. Frontend React: Painel de Conciliação de Cartões & Calendário de Recebíveis

- **Interface React (`CardReconciliationPage.tsx` ou Integrada ao Financeiro):**
  - Aba 1: *Calendário de Recebíveis (D+1 / D+30):* Calendário interativo com totais líquidos previstos por dia e breakdown por adquirente (Cielo, Rede, Stone, PagBank).
  - Aba 2: *Conciliação Automática & Extratos:* Upload de extrato de vendas/pagamentos, indicador de progresso e estatísticas de conciliação (Conciliadas, Divergentes, Chargebacks).
  - Aba 3: *Auditoria de Divergências de Taxas (MDR):* Tabela detalhada de divergências com cálculo de valores cobrados a mais e botão para emissão de relatório de contestação.
  - Aba 4: *Contratos & Regras de Taxas:* Cadastro de adquirentes, contas de depósito bancário e taxas contratadas por bandeira e quantidade de parcelas.
