# Especificação Técnica — Fase 43: Conciliação Automática de Boletos Bancários & Débito Direto Autorizado (DDA)

## 1. Contexto & Necessidade Farmacêutica
No varejo farmacêutico brasileiro, farmácias recebem dezenas a centenas de pedidos semanais de grandes distribuidoras de medicamentos (ex: Panpharma, Profarma, SantaCruz, Dislab, Medcom), cada um faturado em boletos bancários com prazos escalonados (ex: 28/35/42 dias).
A conciliação manual desses boletos com as notas fiscais de entrada (`purchases` / `accounts_payable`) consome horas diárias e gera riscos de:
1. Pagamento de boletos fraudulentos ou em duplicidade.
2. Inadimplência por extravio de boletos físicos ou e-mails de cobrança não lidos.
3. Descasamento de centavos entre o boleto recebido e o espelho da NF-e de entrada.

O **Débito Direto Autorizado (DDA)** e a leitura de arquivos bancários CNAB 240/400 permitem que a farmácia capture eletronicamente todos os boletos emitidos contra o seu CNPJ no sistema bancário nacional (CIP / Febraban), conferindo automaticamente contra as contas a pagar geradas pelas notas de entrada de medicamentos.

---

## 2. Requisitos Regulatórios & Financeiros
1. **Padrão Febraban / CIP DDA:**
   - Captura de títulos registrados contra o CNPJ da drogaria.
   - Leitura de linha digitável (47 dígitos) e código de barras (44 dígitos).
   - Identificação do cedente/favorecido (CNPJ distribuidora, Razão Social), sacado (farmácia), data de emissão, vencimento, valor nominal, juros, multa e abatimentos.
2. **Conciliação Inteligente com NF-e de Entrada (`purchases`):**
   - Comparação por CNPJ do fornecedor + valor exato do título ou parcela + data aproximada de vencimento.
   - Status de conciliação:
     - `MATCHED` (Conciliado com precisão com contas a pagar / compra).
     - `PARTIAL_VALUE_MISMATCH` (Fornecedor bate, mas valor do boleto difere da parcela por frete/desconto financeiro).
     - `UNMATCHED_NO_PURCHASE` (Boleto DDA presente no banco, mas nenhuma NF de compra correspondente registrada no ERP — alerta de segurança/risco de fraude).
     - `MANUAL_RECONCILED` (Conciliado manualmente pelo gestor financeiro).
3. **Agendamento & Liquidação Automatizada:**
   - Autorização de pagamento direto ou exportação de remessa CNAB de pagamentos.
   - Baixa automática no contas a pagar (`accounts_payable`) com registro de juros, multas ou descontos concedidos pela distribuidora.

---

## 3. Arquitetura de Dados
### Tabela `dda_invoices` (Boletos DDA Eletrônicos)
- `id` (TEXT PRIMARY KEY)
- `store_id` (TEXT NOT NULL)
- `bank_code` (TEXT NOT NULL) -- ex: '001', '237', '341', '104'
- `bank_name` (TEXT NOT NULL)
- `barcode` (TEXT NOT NULL) -- 44 dígitos numéricos
- `digitable_line` (TEXT NOT NULL) -- 47 ou 48 dígitos
- `beneficiary_cnpj` (TEXT NOT NULL) -- CNPJ do fornecedor / distribuidora
- `beneficiary_name` (TEXT NOT NULL) -- Razão Social
- `payer_cnpj` (TEXT NOT NULL) -- CNPJ da drogaria
- `due_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `issue_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `nominal_amount` (REAL NOT NULL)
- `discount_amount` (REAL NOT NULL DEFAULT 0.0)
- `interest_amount` (REAL NOT NULL DEFAULT 0.0)
- `final_amount` (REAL NOT NULL)
- `status` (TEXT NOT NULL DEFAULT 'PENDING') -- 'PENDING', 'MATCHED', 'MISMATCH_VALUE', 'UNMATCHED', 'PAID', 'CANCELLED'
- `matched_purchase_id` (TEXT) -- FK purchases(id)
- `matched_payable_id` (TEXT) -- FK accounts_payable(id)
- `reconciled_at` (TEXT)
- `reconciled_by` (TEXT)
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

---

## 4. Endpoints REST
- `POST /api/v1/dda/import-file`: Upload e processamento de arquivo bancário CNAB DDA ou lote JSON.
- `GET /api/v1/dda/invoices`: Listagem com filtros por status (`PENDING`, `MATCHED`, `UNMATCHED`), período de vencimento e fornecedor.
- `POST /api/v1/dda/reconcile-auto`: Executa o motor de conciliação automática contra `purchases` e `accounts_payable`.
- `POST /api/v1/dda/invoices/:id/manual-match`: Vinculação manual forçada a uma conta a pagar.
- `POST /api/v1/dda/invoices/:id/settle`: Baixa e quitação do boleto DDA atualizando o contas a pagar.
- `GET /api/v1/dda/kpis`: Total de títulos DDA, valor total pendente, taxa de conciliação automática e alertas de títulos não reconhecidos.
