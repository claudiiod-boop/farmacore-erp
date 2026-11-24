# Especificação Técnica — Fase 31: Reposição Inteligente de Estoque, Ponto de Pedido & Sugestão de Compras

## 1. Visão Geral & Regras de Negócio

No varejo farmacêutico brasileiro, a gestão eficiente do estoque é crucial para:
1. **Evitar a Ruptura (Falta de Medicamento)**: a perda de uma venda de medicamento contínuo frequentemente acarreta a perda do cliente para a concorrência.
2. **Minimizar Capital de Giro Imobilizado**: excesso de estoque de itens de baixo giro gera perdas por expiração de validade e custo financeiro.

A Fase 31 implementa o motor analítico de ressuprimento inteligente do **FarmaCore ERP**:
- **Cálculo da Demanda Média Diária (DMD)** a partir do histórico de vendas nos últimos 30, 60 ou 90 dias.
- **Classificação Curva ABC** dinâmica por faturamento e volume.
- **Parametrização por Produto / Filial**:
  - `lead_time_days`: tempo médio em dias para entrega da distribuidora (padrão: 2 dias).
  - `safety_stock_days`: dias de cobertura de segurança contra oscilações (padrão: 3 dias).
  - `reorder_point` (Ponto de Pedido): `(DMD * lead_time_days) + safety_stock`.
  - `max_stock`: teto ideal de estoque físico.
- **Motor de Sugestão de Compras**:
  - Identifica itens onde `Estoque Atual + Pedidos Pendentes <= Ponto de Pedido`.
  - Calcula a quantidade sugerida de compra: `Qtd = Math.max(0, max_stock - (estoque_atual + pedidos_pendentes))`.
  - Agrupa sugestões por distribuidora preferencial ou laboratório.
- **Geração Atômica de Pedidos de Reposição**:
  - Permite ao comprador revisar as quantidades sugeridas e gerar pedidos de compra pré-cotados.

---

## 2. Arquitetura do Banco de Dados (Migration 030)

### Tabelas:
1. `replenishment_parameters`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `product_id` INTEGER NOT NULL REFERENCES products(id),
   - `store_id` INTEGER NOT NULL DEFAULT 1,
   - `lead_time_days` INTEGER NOT NULL DEFAULT 2,
   - `safety_stock_days` INTEGER NOT NULL DEFAULT 3,
   - `review_cycle_days` INTEGER NOT NULL DEFAULT 7,
   - `min_order_quantity` INTEGER NOT NULL DEFAULT 1,
   - `preferred_distributor_id` INTEGER,
   - `abc_class` TEXT NOT NULL DEFAULT 'B' CHECK(abc_class IN ('A', 'B', 'C')),
   - `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
   - `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP,
   - UNIQUE(product_id, store_id)

2. `replenishment_orders`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `store_id` INTEGER NOT NULL DEFAULT 1,
   - `distributor_name` TEXT,
   - `status` TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED')),
   - `total_items` INTEGER NOT NULL DEFAULT 0,
   - `estimated_total` REAL NOT NULL DEFAULT 0,
   - `notes` TEXT,
   - `created_at` TEXT DEFAULT CURRENT_TIMESTAMP,
   - `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP

3. `replenishment_order_items`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `order_id` INTEGER NOT NULL REFERENCES replenishment_orders(id) ON DELETE CASCADE,
   - `product_id` INTEGER NOT NULL REFERENCES products(id),
   - `suggested_quantity` INTEGER NOT NULL,
   - `order_quantity` INTEGER NOT NULL,
   - `unit_cost` REAL NOT NULL DEFAULT 0,
   - `subtotal` REAL NOT NULL DEFAULT 0,
   - `current_stock` INTEGER NOT NULL DEFAULT 0,
   - `reorder_point` INTEGER NOT NULL DEFAULT 0

---

## 3. Serviços do Módulo (`replenishment.service.ts`)

- `calculateProductDemand(productId, storeId, days = 30)`:
  - Calcula a quantidade total vendida no período e a Demanda Média Diária (DMD).
- `computeReorderParameters(productId, storeId, days = 30)`:
  - Retorna o Ponto de Pedido (PP), Estoque de Segurança (ES), Estoque Máximo, Estoque Atual e Status de Ruptura (`OUT_OF_STOCK`, `CRITICAL`, `REORDER_NEEDED`, `OK`).
- `generatePurchaseSuggestions(storeId, days = 30)`:
  - Analisa o catálogo e retorna todos os produtos que atingiram o Ponto de Pedido, com cálculo de Curva ABC e quantidade sugerida de compra.
- `createReplenishmentOrder(storeId, distributorName, items)`:
  - Cria um pedido formal de reposição a partir da sugestão de compras.
- `listReplenishmentOrders(storeId, status)`:
  - Lista pedidos de compras gerados.
- `getReplenishmentKpis(storeId)`:
  - Métricas em tempo real: itens em ruptura (estoque zero), itens em nível crítico, sugestões pendentes de pedido e valor estimado de reposição.

---

## 4. Frontend React (`SmartReplenishmentPage.tsx`)

- Painel com Abas:
  - **Sugestão de Compras Inteligente**: tabela dinâmica com filtro por status de risco (`Ruptura`, `Crítico`, `Ponto de Pedido`, `Todos`), curva ABC, estoque atual, ponto de pedido, quantidade sugerida e checkbox para seleção.
  - **Pedidos de Reposição Gerados**: histórico de pedidos de compra, status e exportação.
  - **Parâmetros de Estoque**: configuração de Lead Time e Estoque de Segurança por categoria ou produto.
