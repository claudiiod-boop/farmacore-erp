# Plano de Execução — Fase 40: Hub de Marketplaces & Delivery Externo

## Tarefas de Execução

### Task 1: Migration 039 & Tipos de Domínio
- Criar `src/database/migrations/039_marketplace_hub_delivery.sql` com as tabelas de canais, mapeamento de catálogo, pedidos e itens de pedidos.
- Criar `src/modules/marketplaces/marketplace.types.ts`.
- Criar teste de schema `tests/modules/marketplaces/marketplace.schema.test.ts`.

### Task 2: MarketplaceHubService & Regras de Negócio
- Criar `src/modules/marketplaces/marketplace-hub.service.ts` com métodos de gestão de canal, catálogo, ingestão de pedidos, transição de estados e sincronização de estoque.
- Criar testes unitários `tests/modules/marketplaces/marketplace-hub.service.test.ts`.

### Task 3: Rotas REST Fastify
- Criar `src/modules/marketplaces/marketplace.routes.ts` com rotas para webhooks, canais, catálogo, pedidos e métricas.
- Registrar rotas em `src/api/routes.ts`.
- Criar testes de integração `tests/api/routes.marketplaces.test.ts`.

### Task 4: Frontend React (MarketplaceHubPage)
- Criar `frontend/src/types/marketplace.ts`.
- Atualizar `frontend/src/types/index.ts`.
- Atualizar `frontend/src/services/api.ts` com métodos `marketplaceApi`.
- Atualizar `frontend/src/hooks/useStationMode.ts` com o modo `MARKETPLACE_HUB`.
- Criar `frontend/src/pages/MarketplaceHubPage.tsx`.
- Integrar no `frontend/src/App.tsx`.
- Criar testes `frontend/tests/pages/MarketplaceHubPage.test.tsx`.

### Task 5: Homologação Global, Testes e Sincronização
- Rodar `tsc --noEmit`.
- Rodar `npm run build:web`.
- Rodar suite de testes completa `npm test`.
- Commits atômicos e push para `master`.
