# Especificação Técnica - Fase 25: Gestão de Comissões Multinível, Metas de Balcão & Campanhas de Venda

## 1. Visão Geral e Necessidade de Negócio
No varejo farmacêutico brasileiro (Linx Farma Big, Trier, InovaFarma), a remuneração variável de balconistas e farmacêuticos é um dos principais motores de rentabilidade da drogaria.

Medicamentos de alta margem (Genéricos e Similares/Bonificados) recebem comissões superiores para incentivar a intercambialidade ética e a recomendação qualificada ao cliente, enquanto medicamentos éticos/referência possuem comissão reduzida. Adicionalmente, laboratórios parceiros financiam **campanhas de incentivo por caixa vendida**, e o atingimento de **metas mensais** ativa aceleradores de comissão.

A Fase 25 implementa o motor comercial de **Comissões, Metas e Campanhas de Venda FarmaCore**:
1. **Regras de Comissão Dinâmica por Categoria Farmacêutica:** Genéricos, Similares, Éticos, OTC/MIPs, Perfumaria e Manipulados.
2. **Campanhas de Incentivo por Fabricante / Caixa:** Bônus fixo por unidade dispensada (ex: +R$ 1,50 por caixa vendida de laboratórios parceiros durante o período da campanha).
3. **Gestão de Metas e Aceleradores:** Metas mensais individuais e de filial com cálculo dinâmico de atingimento e aplicação de multiplicador acelerador (ex: >= 100% da meta $\to$ multiplicador 1.25x).
4. **Extrato Analítico e Fechamento de Comissões:** Lançamento atômico das comissões item a item por venda, conferência do balconista e fechamento com status (`PENDING`, `APPROVED`, `PAID`).

---

## 2. Modelagem de Dados (Migration 024)

### 2.1. Tabela `sellers` (Equipe de Balcão, Farmacêuticos e Atendentes)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `name` TEXT NOT NULL
- `cpf` TEXT UNIQUE
- `role` TEXT NOT NULL DEFAULT 'BALCONISTA' CHECK (role IN ('BALCONISTA', 'FARMACEUTICO', 'CAIXA', 'GERENTE'))
- `is_active` INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.2. Tabela `commission_rules`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `category_type` TEXT NOT NULL UNIQUE CHECK (category_type IN ('GENERICO', 'SIMILAR', 'ETICO', 'OTC', 'PERFUMARIA', 'MANIPULADO'))
- `percentage` REAL NOT NULL CHECK (percentage >= 0 AND percentage <= 100)
- `description` TEXT
- `is_active` INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
- `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Tabela `commission_campaigns`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `name` TEXT NOT NULL
- `manufacturer` TEXT
- `product_id` INTEGER REFERENCES products(id) ON DELETE SET NULL
- `bonus_per_unit` REAL NOT NULL DEFAULT 0.0 CHECK (bonus_per_unit >= 0)
- `start_date` TEXT NOT NULL
- `end_date` TEXT NOT NULL
- `is_active` INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.4. Tabela `sales_goals`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `seller_id` INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `period_month` TEXT NOT NULL (YYYY-MM)
- `target_amount` REAL NOT NULL CHECK (target_amount > 0)
- `achieved_amount` REAL NOT NULL DEFAULT 0.0
- `accelerator_multiplier` REAL NOT NULL DEFAULT 1.0 CHECK (accelerator_multiplier >= 1.0)
- `status` TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACHIEVED', 'NOT_ACHIEVED'))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.5. Tabela `commission_statements`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `seller_id` INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE
- `sale_id` INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE
- `sale_item_id` INTEGER REFERENCES sale_items(id) ON DELETE CASCADE
- `product_id` INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
- `category_type` TEXT NOT NULL
- `item_total` REAL NOT NULL
- `base_commission_percent` REAL NOT NULL
- `base_commission_amount` REAL NOT NULL
- `campaign_bonus_amount` REAL NOT NULL DEFAULT 0.0
- `accelerator_multiplier` REAL NOT NULL DEFAULT 1.0
- `final_commission_amount` REAL NOT NULL
- `period_month` TEXT NOT NULL (YYYY-MM)
- `status` TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PAID'))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

---

## 3. Regras de Negócio e Serviços (`CommissionService`)
1. `calculateItemCommission(sellerId, saleId, saleItemId, productId, quantity, itemTotal, saleDate)`:
   - Detecta categoria do produto (Genérico, Similar, Ético, OTC, etc.).
   - Obtém percentual base configurado em `commission_rules`.
   - Verifica se há campanha ativa para o produto ou fabricante em `commission_campaigns` para adicionar bônus por caixa.
   - Verifica se o vendedor possui acelerador de meta ativo para o mês.
   - Registra lançamento atômico em `commission_statements`.
   - Incrementa `achieved_amount` na meta mensal do vendedor em `sales_goals`.
2. `updateSalesGoalProgress(sellerId, periodMonth)`:
   - Calcula se vendedor atingiu a meta (>= 100% $\to$ acelerador 1.25x; >= 80% $\to$ acelerador 1.1x).
3. `closeMonthlyCommissions(sellerId, periodMonth, status: 'APPROVED' | 'PAID')`:
   - Atualiza lote de comissões pendentes para fechamento da folha.
4. `getSellerCommissionSummary(sellerId, periodMonth)`:
   - Resumo consolidado do vendedor: Total Vendido, Meta, % Atingido, Total Comissão Base, Bônus de Campanhas, Comissão Final a Receber.

---

## 4. Endpoints REST Fastify
- `GET /api/commissions/sellers` - Lista vendedores/balconistas.
- `POST /api/commissions/sellers` - Cadastra vendedor.
- `GET /api/commissions/rules` - Lista regras por categoria.
- `PUT /api/commissions/rules` - Atualiza percentuais por categoria.
- `GET /api/commissions/campaigns` - Lista campanhas ativas.
- `POST /api/commissions/campaigns` - Cria campanha por caixa.
- `GET /api/commissions/goals` - Metas mensais.
- `POST /api/commissions/goals` - Define meta mensal para vendedor.
- `POST /api/commissions/calculate-sale` - Apura comissões de uma venda.
- `GET /api/commissions/statements` - Extrato detalhado com filtros.
- `POST /api/commissions/close-period` - Fechamento mensal de comissões (Aprovação / Pagamento).
- `GET /api/commissions/kpis` - Dashboard de KPIs comerciais.

---

## 5. Interface React (`CommissionsPage.tsx`)
- **Dashboard & KPIs:** Total Comissões no Mês, Meta Global da Loja, % Atingimento, Top Vendedor do Mês, Bônus de Campanhas Pagos.
- **Aba 1: Extrato & Ranking de Vendas:** Tabela de vendedores com progresso da meta (barra de progresso), total comissionado e botão de ver extrato item a item.
- **Aba 2: Campanhas por Caixa & Fabricante:** Gestão de campanhas promocionais de laboratórios com bônus por unidade vendida.
- **Aba 3: Regras por Categoria Farmacêutica:** Configuração dos percentuais comissionáveis (Genéricos, Similares, Éticos, OTC, Perfumaria).
