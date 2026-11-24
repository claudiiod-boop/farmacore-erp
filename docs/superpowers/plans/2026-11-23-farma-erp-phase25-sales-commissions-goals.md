# Plano de Implementação - Fase 25: Gestão de Comissões Multinível, Metas de Balcão & Campanhas de Venda

## Meta e Escopo
Implementar de ponta a ponta o módulo de Comissões Farmacêuticas, Campanhas de Incentivo por Caixa e Aceleradores de Metas:
1. Migration 024 (`sellers`, `commission_rules`, `commission_campaigns`, `sales_goals`, `commission_statements`).
2. `CommissionService`: regras por categoria farmacêutica, bônus de campanhas por caixa, aceleradores de metas e extrato analítico.
3. Rotas Fastify REST (`/api/commissions/*`).
4. Interface Web React (`CommissionsPage.tsx`), integração no `App.tsx` e atalho de modo de estação.
5. Cobertura de testes unitários e de integração 100% PASS.

---

## Tasks do Plano

### Task 1: Migration 024 & Tipos de Domínio
- Criar `src/database/migrations/024_sales_commissions_goals.sql`.
- Criar `src/modules/commissions/commission.types.ts`.
- Criar testes de schema `tests/modules/commissions/commission.schema.test.ts`.

### Task 2: CommissionService (Motor de Comissões, Campanhas e Aceleradores)
- Criar `src/modules/commissions/commission.service.ts`:
  - `listSellers`, `createSeller`
  - `listRules`, `updateRule`
  - `listCampaigns`, `createCampaign`
  - `setSalesGoal`, `listGoals`
  - `calculateSaleCommissions`
  - `getSellerStatement`
  - `closeMonthlyCommissions`
  - `getCommissionKpis`
- Criar testes unitários `tests/modules/commissions/commission.service.test.ts`.

### Task 3: Rotas REST Fastify do Módulo de Comissões
- Criar `src/modules/commissions/commission.routes.ts`.
- Integrar no `src/api/routes.ts`.
- Criar testes de rotas `tests/api/routes.commissions.test.ts`.

### Task 4: Frontend React (`CommissionsPage.tsx`) & Navegação
- Criar `frontend/src/types/commission.ts`.
- Atualizar `frontend/src/types/index.ts`, `frontend/src/hooks/useStationMode.ts` e `frontend/src/services/api.ts`.
- Criar `frontend/src/pages/CommissionsPage.tsx` com 3 abas funcionais (Extrato & Ranking, Campanhas por Caixa, Regras de Categoria).
- Atualizar `frontend/src/App.tsx` com o botão na barra superior (`topbar-commissions-button`).
- Criar testes de frontend `frontend/tests/pages/CommissionsPage.test.tsx`.

### Task 5: Homologação Completa da Suíte de Testes & Push
- Executar typecheck (`tsc --noEmit`), build web (`npm run build:web`) e suíte completa (`npm test`).
- Limpeza do working tree e entrega de commits.
