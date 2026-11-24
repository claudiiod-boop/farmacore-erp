# Implementation Plan - Phase 26: DRE Gerencial, Centros de Custos & Lucratividade por Filial/Setor

## Overview
Implementar o motor de DRE Gerencial, Rateio por Centros de Custos Farmacêuticos (Balcão, Manipulação, Perfumaria, Delivery, Clínico, Administrativo), Regimes de Competência e Caixa, Indicadores de Margem Bruta, EBITDA, Ponto de Equilíbrio (Break-Even) e Comparativo entre Filiais da rede FarmaCore.

## User Review Required
> [!NOTE]
> Phase 26 adiciona a migration `025_financial_dre_cost_centers.sql` com as tabelas `cost_centers`, `operational_expenses` e `dre_snapshots`.

---

## Tasks

### Task 1: Migration 025 & Domain Types
- [ ] Criar `src/database/migrations/025_financial_dre_cost_centers.sql`:
  - `cost_centers` (store_id, code, name, department_type, is_active, created_at)
  - `operational_expenses` (store_id, cost_center_id, expense_type, description, amount, due_date, payment_date, status, created_at)
  - `dre_snapshots` (store_id, period_month, regime, gross_revenue, deductions_amount, net_revenue, cmv_amount, gross_profit, gross_margin_percent, operating_expenses_amount, ebitda_amount, ebitda_margin_percent, financial_expenses_amount, net_profit, net_margin_percent, break_even_point, closed_at)
- [ ] Criar `src/modules/dre/dre.types.ts` com interfaces para centros de custo, despesas, filtros e relatórios de DRE.
- [ ] Criar `tests/modules/dre/dre.schema.test.ts` validando criação e relacionamentos do schema.
- [ ] Commit Task 1.

### Task 2: DreService (Motor Contábil & Análise de Centros de Custos)
- [ ] Criar `src/modules/dre/dre.service.ts`:
  - `listCostCenters(storeId?)`, `createCostCenter(input)`
  - `listExpenses(filters)`, `createExpense(input)`, `payExpense(id, paymentDate?)`
  - `generateDreReport(periodMonth, storeId?, regime?)`:
    - Receita Bruta (balcão, manipulação, perfumaria, delivery, clínico)
    - Deduções de venda (descontos, cancelamentos, impostos aproximados)
    - CMV real baseado nos custos dos produtos vendidos
    - Despesas operacionais agrupadas por centro de custo e categoria
    - Comissões integradas do mês (`commission_statements`)
    - Lucro Bruto, Margem Bruta %, EBITDA, Margem EBITDA %, Lucro Líquido, Margem Líquida %
    - Ponto de Equilíbrio (Break-Even)
  - `saveDreSnapshot(periodMonth, storeId, regime)`
  - `listDreSnapshots(storeId?, periodMonth?)`
  - `getBranchProfitabilityRanking(periodMonth)`
- [ ] Criar `tests/modules/dre/dre.service.test.ts` testando todos os cálculos contábeis, regimes e rateios.
- [ ] Commit Task 2.

### Task 3: REST API Routes (Fastify)
- [ ] Criar `src/modules/dre/dre.routes.ts` com endpoints REST para relatórios DRE, snapshots, centros de custo, despesas e ranking.
- [ ] Registrar rotas em `src/api/routes.ts` (`/api/dre`).
- [ ] Criar `tests/api/routes.dre.test.ts` cobrindo todos os endpoints HTTP.
- [ ] Commit Task 3.

### Task 4: Frontend UI (React - DreAnalyticsPage)
- [ ] Criar tipos em `frontend/src/types/dre.ts` e exportar em `frontend/src/types/index.ts`.
- [ ] Atualizar `frontend/src/services/api.ts` com chamadas DRE.
- [ ] Criar `frontend/src/pages/DreAnalyticsPage.tsx`:
  - Cards executivos: Receita Líquida, Lucro Bruto, EBITDA, Lucro Líquido, Ponto de Equilíbrio.
  - Filtros: Mês de Referência, Filial (Todas / Específica), Regime (Competência / Caixa).
  - Abas: "Demonstração DRE", "Centros de Custo & Despesas", "Ranking de Filiais".
  - Modal para lançamento rápido de despesa operacional com centro de custo.
- [ ] Integrar no `frontend/src/App.tsx` com botão `topbar-dre-button` (`BarChart3` ou `PieChart`).
- [ ] Criar `frontend/tests/pages/DreAnalyticsPage.test.tsx` com testes de renderização, filtros, tabs e lançamento.
- [ ] Commit Task 4.

### Task 5: Full Verification & Master Push
- [ ] Executar typecheck `npx.cmd tsc --noEmit`.
- [ ] Executar build de frontend `npm.cmd run build:web`.
- [ ] Executar suíte completa de testes `npm.cmd test`.
- [ ] Orientar o usuário a rodar `git push origin master`.
