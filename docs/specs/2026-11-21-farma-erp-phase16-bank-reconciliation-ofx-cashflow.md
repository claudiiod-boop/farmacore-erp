# Especificação Funcional e Técnica — Fase 16: Conciliação Bancária OFX, Extratos Multi-Banco & Fluxo de Caixa Realizado vs Projetado

**Data:** 21 de Novembro de 2026  
**Status:** Aprovado para Implementação  
**Escopo:** FarmaCore ERP & PDV (Padrão Linx Farma / Trier / InovaFarma)

---

## 1. Visão Geral e Contexto de Negócio

No varejo farmacêutico, o fechamento financeiro exige a confirmação de que os valores apurados nos diferentes postos de atendimento realmente ingressaram ou saíram das contas correntes bancárias da farmácia:
1. **Repasses de Cartões/TEF:** Verificação de que os lotes previstos na Fase 15 foram creditados pela adquirente no banco correto com o valor líquido exato.
2. **Sangrias e Depósitos de Espécie do PDV:** Batimento dos depósitos em dinheiro originados dos fechamentos cegos de caixa (Fase 7).
3. **Liquidação de Títulos de Fornecedores:** Débito de boletos pagos de distribuidores farmacêuticos (Fase 5).
4. **Recebimento de Crediário e Convênios:** Quitação de duplicatas e faturas corporativas (Fase 12).
5. **Taxas e Tarifas Bancárias:** Identificação de tarifas de conta, juros, IOF e manutenções bancárias.
6. **Fluxo de Caixa Diário (Realizado vs Projetado):** Visão executiva diária (Saldo Inicial + Entradas Reais - Saídas Reais = Saldo Final Realizado) contrastada com a Projeção Futura (D+1 a D+30).

---

## 2. Requisitos Regulatórios e Técnicos

### 2.1 Padrão de Extrato Bancário OFX (Open Financial Exchange)
- Suporte a extratos bancários `.ofx` gerados pelos principais bancos que operam no varejo brasileiro:
  - Banco do Brasil (001), Bradesco (237), Itaú Unibanco (341), Santander (033), Caixa Econômica (104), Sicoob (756), Sicredi (748), Banco Inter (077).
- Suporte a formatos OFX 1.0 (baseado em cabeçalhos SGML não-fechados) e OFX 2.0 (XML padrão).
- Extração de tags obrigatórias:
  - `<BANKID>`: Código de compensação do banco.
  - `<ACCTID>`: Número da conta corrente / agência.
  - `<DTSTART>`, `<DTEND>`: Período coberto pelo extrato.
  - `<LEDGERBAL><BALAMT>`: Saldo contábil oficial na data do extrato.
  - `<STMTTRN>` (Bloco de transação):
    - `<TRNTYPE>`: `CREDIT`, `DEBIT`, `OTHER`.
    - `<DTPOSTED>`: Data e hora do lançamento bancário (formato `YYYYMMDDHHMMSS`).
    - `<TRNAMT>`: Valor monetário (positivo para créditos, negativo para débitos).
    - `<FITID>`: Identificador único e imutável atribuído pelo banco (chave de idempotência).
    - `<CHECKNUM>`: Número do documento/cheque/autenticação.
    - `<MEMO>` ou `<NAME>`: Histórico / descrição bancária (ex: `DEP DINHEIRO`, `LIQ STONE`, `TED 341.0057`, `PAG BOLETO`).

### 2.2 Algoritmo de Conciliação Automática e Tolerâncias
O conciliador aplica regras heurísticas em cascata com tolerância temporal de até 2 dias úteis:
1. **Regra TEF/Cartões (Crédito):** Casa com `card_settlement_entries` ou `card_reconciliation_batches` onde `valor_liquido == abs(trnamt)` e `acquirer_name` coincide com memo/histórico ou conta bancária vinculada ao contrato.
2. **Regra Sangria/PDV (Crédito):** Casa com movimentação de caixa `DRAWER_BLEED` (sangria) ou depósito registrado do fechamento cego de caixa.
3. **Regra Fornecedor/Boleto (Débito):** Casa com `purchase_invoices` (pagamentos a fornecedores) pelo valor e vencimento.
4. **Regra Crediário/Convênio (Crédito):** Casa com quitações de duplicatas da Fase 12.
5. **Classificação de Tarifas e Despesas:** Lançamentos com memo contendo `TARIFA`, `IOF`, `TAXA MANUT`, `MORA` são automaticamente classificados como `BANK_FEE`.
6. **Lançamentos Não Conciliados:** Marcados como `UNMATCHED` para conferência e vinculação manual pelo operador financeiro.

### 2.3 Fluxo de Caixa Preditivo & Realizado
- Apuração diária:
  - `realized_inflow`: Total de créditos confirmados no extrato.
  - `realized_outflow`: Total de débitos confirmados no extrato.
  - `projected_inflow`: Recebíveis futuros de cartões (D+1/D+30) + duplicatas a vencer de clientes.
  - `projected_outflow`: Boletos de compras de medicamentos a vencer.
  - `projected_balance`: Saldo atual + entradas projetadas - saídas projetadas.

---

## 3. Arquitetura de Dados (Migration 015)

1. `bank_accounts`: Contas correntes cadastradas por filial com banco, agência, conta e saldo inicial.
2. `bank_statement_batches`: Lotes de extratos OFX importados.
3. `bank_statement_entries`: Transações individuais do extrato bancário com FITID único e status de conciliação (`MATCHED`, `UNMATCHED`, `MANUAL_MATCH`, `BANK_FEE`, `IGNORED`).
4. `bank_reconciliation_links`: Rastreabilidade de vínculo entre a entrada bancária e a entidade do ERP (`TEF_SETTLEMENT`, `CASH_DRAWER`, `PURCHASE_PAYMENT`, `CUSTOMER_CREDIT`).
5. Índices de alta performance em `fitid`, `account_id`, `posted_date`, `status`.

---

## 4. API Endpoints e Rotas Fastify

- `POST /api/bank-reconciliation/accounts`: Cadastro de conta bancária.
- `GET /api/bank-reconciliation/accounts`: Listagem de contas.
- `POST /api/bank-reconciliation/upload-ofx`: Upload e processamento de extrato OFX.
- `GET /api/bank-reconciliation/batches/:id`: Detalhes do lote e batimentos.
- `POST /api/bank-reconciliation/entries/:id/manual-match`: Vínculo manual de lançamento não conciliado.
- `GET /api/cash-flow/daily`: Visão do fluxo de caixa diário (realizado vs projetado).
- `GET /api/cash-flow/print`: Comprovante térmico ESC/POS de fechamento financeiro bancário.

---

## 5. Interface React (Frontend)

- **Aba 1: Conciliação OFX & Extratos:** Tabela comparativa extrato bancário vs lançamentos internos, upload de arquivo `.ofx`, status colorido e botão de conciliação rápida.
- **Aba 2: Fluxo de Caixa Realizado vs Projetado:** Gráfico e cards com saldo disponível, entradas/saídas do dia, visão futura de 30 dias com semáforo de liquidez.
- **Aba 3: Contas Bancárias & Saldos:** Gestão de contas correntes da farmácia e saldos bancários conciliados.
