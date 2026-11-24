# Especificação Técnica - Fase 26: DRE Gerencial, Centros de Custos & Lucratividade por Filial/Setor

## 1. Visão Geral e Fundamentação Contábil
No varejo farmacêutico de alta competitividade, o controle isolado do faturamento bruto do PDV é insuficiente para garantir a saúde financeira da empresa. É imprescindível confrontar a receita operacional líquida com o **Custo das Mercadorias Vendidas (CMV)** e com as **Despesas Operacionais por Centro de Custo**.

A **Fase 26** implementa o **Motor de DRE Gerencial & Rateio por Centros de Custos FarmaCore**:
1. **Regimes Duplos de Apuração:**
   - **Regime de Competência:** Apuração baseada na data de emissão das vendas e competência das despesas.
   - **Regime de Caixa:** Apuração baseada nas entradas financeiras efetivas (dinheiro, TEF liquidado, PIX e recebimento de crediários) e pagamentos de despesas quitadas.
2. **Classificação por Centros de Custos Farmacêuticos:**
   - Balcão de Medicamentos (`BALCAO`);
   - Manipulação Magistral (`MANIPULACAO`);
   - Perfumaria, Cosméticos e Higiene (`PERFUMARIA`);
   - Tele-Entrega & Logística (`DELIVERY`);
   - Consultório Farmacêutico Clínico (`CLINICO`);
   - Administrativo & Geral (`ADMINISTRATIVO`).
3. **Indicadores de Gestão Executiva:**
   - **Margem Bruta (R$ e %):** $(\text{Receita Líquida} - \text{CMV}) / \text{Receita Líquida}$.
   - **EBITDA / LAJIDA:** Lucro Operacional antes de despesas financeiras e impostos sobre lucro.
   - **Ponto de Equilíbrio Contábil (Break-Even Point em R$):** Faturamento mínimo necessário para cobrir todos os custos e despesas fixas.
   - **Lucratividade Líquida e Comparativo entre Filiais:** Identificação de lojas superavitárias e deficitárias na rede.

---

## 2. Modelagem de Dados (Migration 025)

### 2.1. Tabela `cost_centers`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER REFERENCES stores(id) ON DELETE CASCADE
- `code` TEXT NOT NULL UNIQUE
- `name` TEXT NOT NULL
- `department_type` TEXT NOT NULL CHECK (department_type IN ('BALCAO', 'MANIPULACAO', 'PERFUMARIA', 'DELIVERY', 'CLINICO', 'ADMINISTRATIVO'))
- `is_active` INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.2. Tabela `operational_expenses`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `cost_center_id` INTEGER NOT NULL REFERENCES cost_centers(id) ON DELETE RESTRICT
- `expense_type` TEXT NOT NULL CHECK (expense_type IN ('PESSOAL', 'ADMINISTRATIVA', 'VENDAS_LOGISTICA', 'TRIBUTARIA', 'FINANCEIRA', 'OPERACIONAL_OUTRAS'))
- `description` TEXT NOT NULL
- `amount` REAL NOT NULL CHECK (amount > 0)
- `due_date` TEXT NOT NULL
- `payment_date` TEXT
- `status` TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED'))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Tabela `dre_snapshots`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER REFERENCES stores(id) ON DELETE CASCADE
- `period_month` TEXT NOT NULL (YYYY-MM)
- `regime` TEXT NOT NULL DEFAULT 'COMPETENCIA' CHECK (regime IN ('COMPETENCIA', 'CAIXA'))
- `gross_revenue` REAL NOT NULL
- `deductions_amount` REAL NOT NULL
- `net_revenue` REAL NOT NULL
- `cmv_amount` REAL NOT NULL
- `gross_profit` REAL NOT NULL
- `gross_margin_percent` REAL NOT NULL
- `operating_expenses_amount` REAL NOT NULL
- `ebitda_amount` REAL NOT NULL
- `ebitda_margin_percent` REAL NOT NULL
- `financial_expenses_amount` REAL NOT NULL
- `net_profit` REAL NOT NULL
- `net_margin_percent` REAL NOT NULL
- `break_even_point` REAL NOT NULL
- `closed_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
- UNIQUE(store_id, period_month, regime)

---

## 3. Regras de Negócio e Serviços (`DreService`)
1. `generateDreReport(periodMonth, storeId?, regime: 'COMPETENCIA' | 'CAIXA')`:
   - Apura **Receita Bruta**:
     - Vendas de produtos agrupadas por centro de custo (Medicamentos, Perfumaria, etc.);
     - Receita de serviços farmacêuticos clínicos;
     - Receita de manipulação magistral;
     - Taxas de tele-entrega faturadas.
   - Apura **Deduções**:
     - Descontos comerciais concedidos no PDV;
     - Devoluções e cancelamentos de cupons fiscais;
     - Estimativa de impostos sobre vendas (ICMS / PIS / COFINS).
   - Apura **CMV (Custo das Mercadorias Vendidas)**:
     - Custo médio / PF líquido dos itens vendidos no período.
   - Apura **Despesas Operacionais**:
     - Despesas lançadas em `operational_expenses` agrupadas por centro de custos e tipo de despesa (Pessoal, Aluguel, TEF, Logística).
     - Comissões comerciais de balcão apuradas em `commission_statements`.
   - Calcula **EBITDA, Lucro Líquido e Margem Líquida %**.
   - Calcula **Break-Even Point**: $\text{Despesas Fixas} / \text{Margem de Contribuição \%}$.
2. `saveDreSnapshot(periodMonth, storeId, regime)`:
   - Grava snapshot oficial do fechamento contábil mensal para compliance e auditoria.
3. `createExpense(input)` / `listExpenses(filters)`:
   - Gestão de contas e despesas operacionais da drogaria.
4. `getBranchProfitabilityRanking(periodMonth)`:
   - Compara faturamento, EBITDA e margem líquida de cada filial da rede.

---

## 4. Endpoints REST Fastify
- `GET /api/dre/report` - Emite relatório consolidado de DRE (por mês, filial e regime).
- `POST /api/dre/snapshot` - Congela e salva o snapshot contábil oficial do mês.
- `GET /api/dre/snapshots` - Histórico de fechamentos salvos.
- `GET /api/dre/cost-centers` - Lista centros de custos cadastrados.
- `POST /api/dre/cost-centers` - Cria centro de custo.
- `GET /api/dre/expenses` - Lista despesas operacionais com filtros.
- `POST /api/dre/expenses` - Cadastra despesa operacional vinculada a centro de custo.
- `PATCH /api/dre/expenses/:id/pay` - Marca despesa como quitada (baixa de caixa).
- `GET /api/dre/branch-ranking` - Ranking de rentabilidade e EBITDA por filial.
- `GET /api/dre/kpis` - Indicadores de alto nível do DRE.

---

## 5. Interface React (`DreAnalyticsPage.tsx`)
- **Dashboard Executivo DRE:** Seletor de Mês, Seletor de Filial (Todas ou Loja Específica), Toggle Competência / Caixa.
- **Cards de Indicadores Principais:** Receita Líquida, Lucro Bruto (Margem %), EBITDA (LAJIDA %), Lucro Líquido Final, Ponto de Equilíbrio (Break-Even).
- **Aba 1: Demonstração Contábil (DRE Estruturado):** Visualização tabular clássica com linhas destacadas e porcentagens sobre a receita líquida (Padrão Contábil Brasileiro).
- **Aba 2: Despesas por Centro de Custo:** Distribuição gráfica e tabular dos custos por departamento (Balcão, Manipulação, Perfumaria, Delivery, Administrativo) com botão "Lançar Despesa".
- **Aba 3: Comparativo de Filiais (Rede):** Tabela comparativa de performance, receita líquida, custos e margem EBITDA entre todas as lojas da rede.
