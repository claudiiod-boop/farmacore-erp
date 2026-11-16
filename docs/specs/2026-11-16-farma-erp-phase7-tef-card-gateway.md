# FarmaCore ERP & PDV — Especificação Técnica da Fase 7
## TEF Integrado / Dedicado (Transferência Eletrônica de Fundos) & Gateway de Adquirentes

**Data:** 16 de Novembro de 2026  
**Status:** Revisado & Aprovado pelo Builder-Check  
**Contexto:** Evolução do FarmaCore ERP após o Motor Fiscal NFC-e (Fase 4), SNGPC/Compras (Fase 5) e Gateway de Convênios Farmácia Popular/PBM (Fase 6). Implementação da **Abordagem 1: Gateway TEF Unificado Multi-Provedor (Padrão InovaFarma / Linx)** para transações com cartão em PinPad, conciliação e conformidade fiscal com o grupo `<card>` da SEFAZ.

---

## 1. Visão Geral & Objetivos de Negócio

No varejo farmacêutico brasileiro, mais de 65% das vendas são liquidadas por cartões de débito, crédito ou vouchers (Vale Farmácia). O uso de maquininhas avulsas portáteis (POS sem integração) expõe a drogaria a três riscos graves:
1. **Fraude e Erro Humano:** Digitação manual de valor menor que o total da venda, resultando em quebras de caixa diárias.
2. **Rejeição Fiscal SEFAZ:** A legislação da NFC-e (Ajuste SINIEF e NT 2020.006) exige nos pagamentos com cartão o preenchimento do grupo `<card>` com `tpIntegra = 1` (Integrado), CNPJ limpo de 14 dígitos da credenciadora adquirente, código da bandeira (`tBand`) e número de autorização (`cAut`).
3. **Falta de Conciliação Financeira:** Impossibilidade de conciliar os repasses bancários das adquirentes (Cielo, Rede, Stone, PagBank, Getnet) com os comprovantes de venda.

A **Fase 7** equipa o FarmaCore ERP com um **Gateway TEF Dedicado de Alto Desempenho**, integrando o fluxo de caixa diretamente ao PinPad físico (ou virtual em desenvolvimento):

1. **Gateway Unificado de TEF (`TefProvider`):**
   - Abstração agnóstica para suportar múltiplos autorizadores (SiTef Software Express, PayGo/Linx TEF e simulador oficial de PinPad offline).
   - **Ciclo de Vida Transacional em 4 Fases:**
     - `pay()`: Coleta no PinPad, digitação de senha e autorização da adquirente (`AUTHORIZED`).
     - `confirm()`: Confirmação definitiva da transação vinculada à emissão autorizada da NFC-e (`CONFIRMED`).
     - `undo()`: **Desfazimento Técnico Imediato** executado automaticamente pelo sistema caso a emissão da NFC-e falhe, a impressora trave ou o checkout seja abortado (`REVERSED`).
     - `cancel()`: **Cancelamento Administrativo** executado pelo operador no caixa para vendas já concluídas e faturadas, gerando comprovante de estorno e liberando o crédito na fatura do cliente (`CANCELLED`).

2. **Simulador de PinPad e Adquirente (`TefMockProvider`):**
   - Emulador completo para homologação e testes unitários 100% offline no Vitest:
     - Suporte a gatilhos determinísticos de teste via parâmetro `mockScenario` e via centavos (padrão homologação CliSiTef):
       - `.01` (R$ 10,01): Sucesso Débito
       - `.02` (R$ 10,02): Rejeição por Senha Incorreta
       - `.03` (R$ 10,03): Rejeição por Saldo Insuficiente
       - `.04` (R$ 10,04): Cancelado pelo Cliente no PinPad
       - `.05` (R$ 10,05): Timeout de Rede / Comunicação PinPad
     - Simulação de cartões de débito, crédito à vista e parcelado (loja/administradora).
     - Conformidade estrita com PCI-DSS: persistência e tráfego exclusivo dos 4 últimos dígitos mascarados (`**** **** **** 1234`), sem nunca armazenar PAN completo ou CVV.

3. **Formatador de Comprovante TEF ESC/POS (48 Colunas):**
   - Emissão das 2 vias obrigatórias: **Via do Cliente** e **Via do Estabelecimento**.
   - Emissão da **Via de Cancelamento / Estorno TEF**.
   - Identificação da adquirente, bandeira, últimos dígitos do cartão mascarados, NSU local e host, código de autorização e data/hora.

4. **Integração com PDV, Caixa e Motor Fiscal NFC-e:**
   - No `PaymentModal`, ao selecionar Cartão (Crédito, Débito ou Voucher), o operador aciona o TEF. O sistema abre o modal interativo do PinPad ("Aproxime ou Insira o Cartão"), coleta a aprovação e preenche automaticamente o meio de pagamento com os dados fiscais.
   - Alimentação automática do grupo `<card>` na montagem do XML da NFC-e em `xml-builder.ts`:
     - `<tpIntegra>1</tpIntegra>`
     - `<CNPJ>01027058000191</CNPJ>` (14 dígitos sanitizados sem máscara)
     - `<tBand>01</tBand>`
     - `<cAut>987654</cAut>`
   - Desfazimento automático: se a venda falhar após o cartão passar, o sistema desfaz no TEF automaticamente.
   - Suporte a múltiplos cartões (split payment) em uma mesma venda.

---

## 2. Modelagem do Banco de Dados (Migração `006_tef_card_gateway.sql`)

```sql
-- Migration 006: TEF Card Gateway & Adquirer Integration

-- 1. Configurações dos Provedores TEF
CREATE TABLE IF NOT EXISTS tef_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL, -- 'SITEF', 'PAYGO', 'MOCK'
  provider_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'MOCK' CHECK (environment IN ('PRODUCAO', 'HOMOLOGACAO', 'MOCK')),
  terminal_id TEXT DEFAULT 'SE000001', -- Código padrão do PinPad
  merchant_id TEXT, -- Código do estabelecimento na adquirente
  ip_address TEXT DEFAULT '127.0.0.1',  -- IP do servidor TEF Dedicado
  port INTEGER DEFAULT 4096,     -- Porta (ex: 4096 para SiTef)
  is_active INTEGER NOT NULL DEFAULT 1,
  credentials_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transações de Cartão TEF
CREATE TABLE IF NOT EXISTS tef_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_uuid TEXT UNIQUE NOT NULL,
  provider_id TEXT NOT NULL REFERENCES tef_configs(provider_id),
  terminal_id TEXT NOT NULL DEFAULT 'SE000001',
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES sale_payments(id) ON DELETE SET NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('DEBITO', 'CREDITO', 'VOUCHER', 'PIX_TEF')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'AUTHORIZED', 'CONFIRMED', 'REVERSED', 'CANCELLED', 'FAILED')),
  amount REAL NOT NULL CHECK (amount > 0),
  installments INTEGER NOT NULL DEFAULT 1,
  installment_type TEXT DEFAULT 'A_VISTA' CHECK (installment_type IN ('A_VISTA', 'PARCELADO_LOJA', 'PARCELADO_ADM')),
  brand_name TEXT NOT NULL,          -- 'VISA', 'MASTERCARD', 'ELO', 'AMEX', 'ALELO', etc.
  brand_code_sefaz TEXT NOT NULL,    -- '01' (Visa), '02' (Master), '06' (Elo), etc.
  acquirer_name TEXT NOT NULL,       -- 'CIELO', 'REDE', 'STONE', 'PAGBANK', etc.
  acquirer_cnpj TEXT NOT NULL,       -- 14 dígitos sem máscara para tag <CNPJ> da NFC-e
  authorization_code TEXT NOT NULL,  -- Código de autorização retornado pela rede
  nsu TEXT NOT NULL,                 -- Número Sequencial Único gerado pelo TEF local
  host_nsu TEXT NOT NULL,            -- NSU da rede adquirente/banco
  card_last_four TEXT,               -- '1234' (apenas 4 dígitos finais)
  customer_receipt TEXT,             -- Texto formatado da Via do Cliente
  merchant_receipt TEXT,             -- Texto formatado da Via da Loja
  cancellation_receipt TEXT,         -- Texto formatado do comprovante de cancelamento/estorno
  failure_reason TEXT,
  reversal_reason TEXT,              -- Justificativa do desfazimento técnico
  cancellation_nsu TEXT,             -- NSU do cancelamento administrativo
  cancellation_reason TEXT,
  mdr_rate REAL DEFAULT 0.0,         -- Taxa da adquirente em % para conciliação financeira
  net_amount REAL,                   -- Valor líquido estimado a receber
  expected_settlement_date TEXT,     -- Data prevista de repasse bancário (YYYY-MM-DD)
  batch_number TEXT,                 -- Lote do TEF para conciliação bancária
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  reversed_at TEXT,
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tef_trans_nsu ON tef_transactions(nsu);
CREATE INDEX IF NOT EXISTS idx_tef_trans_uuid ON tef_transactions(transaction_uuid);
CREATE INDEX IF NOT EXISTS idx_tef_trans_sale ON tef_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_tef_trans_status ON tef_transactions(status);
CREATE INDEX IF NOT EXISTS idx_tef_trans_created ON tef_transactions(created_at);

-- 3. Extensão de sale_payments para vínculo direto com TEF
ALTER TABLE sale_payments ADD COLUMN tef_transaction_id INTEGER REFERENCES tef_transactions(id);
ALTER TABLE sale_payments ADD COLUMN tef_nsu TEXT;
```

---

## 3. Tipos e Contratos do Gateway (`src/modules/tef/types.ts`)

```typescript
export type TefOperationType = 'DEBITO' | 'CREDITO' | 'VOUCHER' | 'PIX_TEF';
export type TefInstallmentType = 'A_VISTA' | 'PARCELADO_LOJA' | 'PARCELADO_ADM';
export type TefTransactionStatus = 'PENDING' | 'AUTHORIZED' | 'CONFIRMED' | 'REVERSED' | 'CANCELLED' | 'FAILED';

export interface TefPayParams {
  providerId?: string;
  terminalId?: string;
  amount: number;
  operationType: TefOperationType;
  installments?: number;
  installmentType?: TefInstallmentType;
  saleId?: number;
  mockScenario?: 'SUCCESS' | 'WRONG_PIN' | 'INSUFFICIENT_FUNDS' | 'TIMEOUT' | 'USER_CANCELLED';
}

export interface TefPayResult {
  success: boolean;
  transactionUuid: string;
  nsu: string;
  hostNsu: string;
  authorizationCode: string;
  brandName: string;
  brandCodeSefaz: string; // '01'=Visa, '02'=Master, '06'=Elo, etc.
  acquirerName: string;
  acquirerCnpj: string;   // 14 dígitos sem formatação
  cardLastFour: string;
  amount: number;
  installments: number;
  customerReceipt: string;
  merchantReceipt: string;
  mdrRate?: number;
  netAmount?: number;
  expectedSettlementDate?: string;
  errorMessage?: string;
}

export interface TefConfirmParams {
  nsu: string;
  saleId: number;
  fiscalKeyNfce?: string;
}

export interface TefConfirmResult {
  success: boolean;
  nsu: string;
  confirmedAt: string;
  errorMessage?: string;
}

export interface TefUndoParams {
  nsu: string;
  reason: string;
}

export interface TefUndoResult {
  success: boolean;
  nsu: string;
  reversedAt: string;
  reversalReason: string;
  errorMessage?: string;
}

export interface TefCancelParams {
  nsu: string;
  reason: string;
}

export interface TefCancelResult {
  success: boolean;
  nsu: string;
  cancellationNsu: string;
  cancelledAt: string;
  cancellationReceipt: string;
  errorMessage?: string;
}

export interface TefProvider {
  providerId: string;
  providerName: string;
  pay(params: TefPayParams): Promise<TefPayResult>;
  confirm(params: TefConfirmParams): Promise<TefConfirmResult>;
  undo(params: TefUndoParams): Promise<TefUndoResult>;
  cancel(params: TefCancelParams): Promise<TefCancelResult>;
}
```

---

## 4. Tabela De-Para Expandida de Bandeiras e Vouchers SEFAZ (Layout NFC-e 4.00)

| Bandeira / Voucher | Código SEFAZ (`tBand`) | Adquirente Padrão | CNPJ Adquirente (14 Dígitos Sanitizados) |
|---|---|---|---|
| Visa | `01` | CIELO | `01027058000191` |
| Mastercard | `02` | REDE | `01425787000104` |
| American Express | `03` | CIELO | `01027058000191` |
| Sorocred | `04` | SOROCRED | `60893303000118` |
| Diners Club | `05` | REDE | `01425787000104` |
| Elo | `06` | STONE | `16501555000157` |
| Hipercard | `07` | REDE | `01425787000104` |
| Aura | `08` | CIELO | `01027058000191` |
| Cabal | `09` | STONE | `16501555000157` |
| Alelo (Voucher) | `10` | CIELO | `01027058000191` |
| BanesCard | `11` | GETNET | `10440482000154` |
| CalCard | `12` | REDE | `01425787000104` |
| Credz | `13` | CIELO | `01027058000191` |
| Discover | `14` | REDE | `01425787000104` |
| GoodCard (Voucher) | `15` | GOODCARD | `04874052000160` |
| GreenCard | `16` | GREENCARD | `92894980000108` |
| Sodexo (Voucher) | `21` | CIELO | `01027058000191` |
| ValeCard (Voucher) | `22` | VALECARD | `25660854000116` |
| Ticket (Voucher) | `25` | CIELO | `01027058000191` |
| Outras | `99` | PAGBANK | `08561701000101` |

---

## 5. Atualização no Motor Fiscal NFC-e (`src/modules/fiscal/xml-builder.ts`)

Quando o meio de pagamento for `CARTAO_CREDITO` ou `CARTAO_DEBITO` ou possuir dados do TEF, o gerador XML de NFC-e passa a incluir obrigatoriamente o nó `<card>`:

```xml
<pag>
  <detPag>
    <tPag>03</tPag>
    <vPag>48.50</vPag>
    <card>
      <tpIntegra>1</tpIntegra>
      <CNPJ>01027058000191</CNPJ>
      <tBand>02</tBand>
      <cAut>987654</cAut>
    </card>
  </detPag>
</pag>
```

---

## 6. Formatador de Comprovante TEF ESC/POS 48 Colunas (`tef-receipt-formatter.ts`)

```text
================================================
           COMPROVANTE DE PAGAMENTO TEF
================================================
DROGARIA FARMACORE BRASIL LTDA
CNPJ: 12.345.678/0001-90
RUA DAS FARMACIAS, 123 - CENTRO - CURITIBA/PR
------------------------------------------------
1a VIA - CLIENTE
OPERACAO: CARTAO DE CREDITO A VISTA
BANDEIRA: MASTERCARD
CARTAO: **** **** **** 4321
DATA: 16/11/2026 19:15:20
REDE: CIELO
DOC/NSU: 123456         AUTORIZACAO: 987654
------------------------------------------------
VALOR TOTAL PAGO:                       R$ 48,50
------------------------------------------------
         TRANSACAO APROVADA COM SUCESSO
================================================

[CORTE DE PAPEL]

================================================
           COMPROVANTE DE PAGAMENTO TEF
================================================
2a VIA - ESTABELECIMENTO (CONTROLE INTERNO)
OPERACAO: CARTAO DE CREDITO A VISTA
BANDEIRA: MASTERCARD
CARTAO: **** **** **** 4321
DATA: 16/11/2026 19:15:20
DOC/NSU: 123456         AUTORIZACAO: 987654
VALOR: R$ 48,50
CUPOM FISCAL / NFC-e: 000.012.345
================================================
```

---

## 7. Endpoints REST Fastify (`/api/tef/*`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/tef/providers` | Lista provedores TEF configurados e status |
| `POST` | `/api/tef/pay` | Inicia cobrança com valor no PinPad e aguarda autorização |
| `POST` | `/api/tef/confirm` | Confirma a transação financeira vinculando ao `saleId` |
| `POST` | `/api/tef/undo` | Executa desfazimento técnico imediato de transação pré-autorizada |
| `POST` | `/api/tef/cancel` | Executa estorno/cancelamento administrativo de transação confirmada |
| `GET` | `/api/tef/transactions` | Lista histórico de transações TEF para conciliação |
| `GET` | `/api/tef/transactions/:nsu/receipt` | Retorna o comprovante TEF formatado em 48 colunas |
| `GET` | `/api/tef/config/:providerId` | Consulta configurações do provedor TEF |
| `PUT` | `/api/tef/config/:providerId` | Atualiza parâmetros (IP, porta, terminal, ambiente) |

---

## 8. Interface do Usuário (Frontend React/Tailwind)

1. **Modal Interativo de PinPad (`TefPinpadModal.tsx`):**
   - Disparado pelo operador no Caixa (`PosPage`) ao selecionar pagamento com Cartão via TEF.
   - Estados visuais em tempo real:
     - 💳 *Aguardando Cartão*: "Por favor, insira ou aproxime o cartão no PinPad".
     - 🔒 *Senha*: "Solicitando senha ao cliente no PinPad...".
     - 📡 *Processando*: "Contatando adquirente/banco...".
     - ✅ *Aprovado*: "Transação Aprovada! NSU: 123456 - Mastercard Crédito".
     - ❌ *Recusado*: Exibição clara da recusa ("Saldo Insuficiente", "Senha Incorreta", etc.).
   - Tecla `ESC` para abortar/desfazer no PinPad.
2. **Integração no `PaymentModal.tsx`:**
   - Botão "Pagar com TEF (PinPad) [F8]".
   - Ao aprovar, preenche automaticamente o valor pago, adquirente, bandeira, NSU e comprovante, liberando a finalização da venda.
3. **Modal de Comprovante TEF (`TefReceiptModal.tsx`):**
   - Exibição e impressão das 2 vias (Cliente e Loja) e da via de cancelamento em 48 colunas monoespaçado térmico.
