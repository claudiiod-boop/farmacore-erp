# Plano de Implementação - Fase 23: Clube de Assinatura & Reposição Recorrente de Medicamentos

## Meta e Escopo
Implementar de ponta a ponta o módulo industrial de Clube de Assinatura & Reposição de Uso Contínuo do FarmaCore ERP:
1. Migration 022 (`subscriptions`, `subscription_items`, `subscription_cycles`).
2. `SubscriptionService` com motor de cálculo de datas, validação sanitária de receitas, geração atômica de pré-vendas e pedidos de entrega.
3. Rotas Fastify REST (`/api/subscriptions/*`).
4. Interface Web React (`SubscriptionsPage.tsx`), integração no `App.tsx` e atalho de modo de estação.
5. Cobertura de testes unitários e de integração 100% PASS.

---

## Tasks do Plano

### Task 1: Migration 022 & Tipos de Domínio
- Criar `src/database/migrations/022_subscriptions_refill_club.sql`.
- Criar `src/modules/subscriptions/subscription.types.ts`.
- Criar testes de schema `tests/modules/subscriptions/subscription.schema.test.ts`.

### Task 2: SubscriptionService (Motor de Recorrência & Validação Sanitária)
- Criar `src/modules/subscriptions/subscription.service.ts`:
  - `createSubscription`
  - `updateSubscriptionStatus`
  - `addSubscriptionItem`, `removeSubscriptionItem`
  - `renewPrescription`
  - `processScheduledRefills`
  - `getExpiringPrescriptions`
  - `getSubscriptionKpis`
- Criar testes unitários `tests/modules/subscriptions/subscription.service.test.ts`.

### Task 3: Rotas REST Fastify do Módulo de Assinaturas
- Criar `src/modules/subscriptions/subscription.routes.ts`.
- Integrar no `src/api/routes.ts`.
- Criar testes de rotas `tests/api/routes.subscriptions.test.ts`.

### Task 4: Frontend React (`SubscriptionsPage.tsx`) & Navegação
- Criar `frontend/src/types/subscription.ts`.
- Atualizar `frontend/src/types/index.ts`, `frontend/src/hooks/useStationMode.ts` e `frontend/src/services/api.ts`.
- Criar `frontend/src/pages/SubscriptionsPage.tsx` com 3 abas funcionais (Assinaturas, Ciclos & Processamento, Controle de Receitas Médicas).
- Atualizar `frontend/src/App.tsx` com o botão na barra superior (`topbar-subscriptions-button`).
- Criar testes de frontend `frontend/tests/pages/SubscriptionsPage.test.tsx`.

### Task 5: Homologação Completa da Suíte de Testes & Push
- Executar typecheck (`tsc --noEmit`), build web (`npm run build:web`) e suíte completa (`npm test`).
- Limpeza do working tree e entrega de commits.
