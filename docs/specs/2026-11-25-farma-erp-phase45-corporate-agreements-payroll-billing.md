# Especificação Técnica — Fase 45: Gestão de Convênios Empresariais & Faturamento em Lote para Empresas (B2B Desconto em Folha)

## 1. Contexto & Necessidade de Negócio
No varejo farmacêutico brasileiro, parcerias com indústrias, prefeituras, órgãos públicos e empresas locais são uma das principais fontes de faturamento recorrente ("Convênio Farmácia" ou "Desconto em Folha").
Os colaboradores da empresa parceira compram medicamentos e produtos de higiene na drogaria apresentando sua matrícula funcional e documento com foto, sem desembolso imediato no caixa (venda faturada em convênio).
Ao final do ciclo mensal (ex: dia 20 de cada mês), a farmácia realiza o **Fechamento de Convênio em Lote**:
1. Consolida todas as vendas realizadas para cada colaborador.
2. Gera o **Espelho de Desconto em Folha para o RH** da empresa (arquivo contendo matrícula, CPF, nome do funcionário e valor a ser debitado no holerite).
3. Emite a **Fatura Consolidada de Duplicata Mercantil** contra a empresa parceira com data de vencimento (ex: dia 05 ou dia 10 do mês subsequente).
4. Aplica bloqueio preventivo automático para colaboradores caso a empresa parceira esteja em atraso financeiro superior à carência permitida.

---

## 2. Requisitos de Regras de Negócio & Arquitetura
1. **Fechamento Mensal em Lote (`CorporateAgreementsBilling`):**
   - Varredura de vendas no período por empresa conveniada (`corporate_agreements`).
   - Apuração do total consumido, quantidade de vendas e quantidade de colaboradores beneficiados.
   - Criação da fatura (`agreement_invoices`) e detalhamento por item/venda (`agreement_invoice_items`).
2. **Geração do Arquivo de Folha para o RH da Empresa:**
   - Exportação em formato estruturado (CSV / JSON) contendo:
     - Matrícula Funcional do Colaborador
     - CPF do Colaborador
     - Nome do Colaborador
     - Quantidade de Compras no Período
     - Valor Total a Descontar em Folha
3. **Regras de Bloqueio & Limites de Crédito:**
   - Limite de crédito individual por colaborador (`customers.credit_limit`).
   - Limite de crédito global corporativo da empresa conveniada (`corporate_agreements.credit_limit`).
   - Trava imediata de novas autorizações no balcão/PDV caso a empresa possua faturas em aberto após o vencimento (`OVERDUE`).
4. **Liquidação e Baixa de Fatura Corporativa:**
   - Quitação integral com baixa automática nas duplicatas e no contas a receber da farmácia.
   - Registro de juros, multas ou eventuais glosas acordadas com o RH.

---

## 3. Arquitetura de Dados
### Tabela `agreement_invoice_items`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `invoice_id` (INTEGER NOT NULL REFERENCES agreement_invoices(id) ON DELETE CASCADE)
- `sale_id` (INTEGER NOT NULL REFERENCES sales(id))
- `customer_id` (INTEGER NOT NULL REFERENCES customers(id))
- `employee_code` (TEXT NOT NULL)
- `customer_name` (TEXT NOT NULL)
- `customer_cpf` (TEXT NOT NULL)
- `sale_date` (TEXT NOT NULL)
- `sale_amount` (REAL NOT NULL)
- `created_at` (TEXT NOT NULL)

### Tabela `agreement_payroll_exports`
- `id` (TEXT PRIMARY KEY)
- `invoice_id` (INTEGER NOT NULL REFERENCES agreement_invoices(id) ON DELETE CASCADE)
- `agreement_id` (INTEGER NOT NULL REFERENCES corporate_agreements(id))
- `export_date` (TEXT NOT NULL)
- `period_start` (TEXT NOT NULL)
- `period_end` (TEXT NOT NULL)
- `total_employees` (INTEGER NOT NULL)
- `total_amount` (REAL NOT NULL)
- `file_content_csv` (TEXT NOT NULL)
- `created_at` (TEXT NOT NULL)
