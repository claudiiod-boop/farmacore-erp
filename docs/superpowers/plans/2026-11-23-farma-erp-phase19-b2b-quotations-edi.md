# Plano de Implementação — Fase 19: Central de Cotação B2B, Reposição Inteligente & EDI Farma

## Task 1: Schema 018 & Tipos de Domínio
- Criar `src/database/migrations/018_b2b_purchasing_quotations_edi.sql` com tabelas:
  - `b2b_suppliers`
  - `b2b_replenishment_rules`
  - `b2b_quotation_campaigns`
  - `b2b_quotation_items`
  - `b2b_quotation_proposals`
  - `b2b_quotation_proposal_items`
  - `b2b_edi_logs`
- Criar `src/modules/b2b/b2b.types.ts` com interfaces completas de domínio.
- Criar `tests/modules/b2b/b2b.schema.test.ts`.

## Task 2: Motor de Reposição Automática (Ponto de Pedido & Giro ABC)
- Criar `src/modules/b2b/replenishment.service.ts`:
  - Cálculo de Consumo Médio Diário (CMD).
  - Determinação de Ponto de Pedido e Estoque de Segurança.
  - Geração de sugestões automáticas de compra filtradas por curva ABC ou criticidade.
- Criar `tests/modules/b2b/replenishment.service.test.ts`.

## Task 3: Motor EDI Farma & Otimizador de Cotação
- Criar `src/modules/b2b/edi-farma.service.ts`:
  - Exportação de espelho de cotação EDI/CSV padrão distribuidoras farmacêuticas.
  - Importação e validação de arquivo de resposta/propostas.
- Criar `src/modules/b2b/quotation-optimizer.service.ts`:
  - Otimização Item a Item (Split Order) respeitando pedido mínimo de fornecedor.
  - Otimização Pedido Fechado (Menor Custo Global).
  - Conversão de cotação em Pedido de Compra oficial no ERP.
- Criar `tests/modules/b2b/edi-farma.service.test.ts` e `tests/modules/b2b/quotation-optimizer.service.test.ts`.

## Task 4: Rotas REST Fastify
- Criar `src/modules/b2b/b2b.routes.ts`:
  - `/api/b2b/replenishment/suggestions`
  - `/api/b2b/suppliers`
  - `/api/b2b/campaigns`
  - `/api/b2b/campaigns/:id`
  - `/api/b2b/campaigns/:id/items`
  - `/api/b2b/campaigns/:id/export-edi`
  - `/api/b2b/campaigns/:id/import-proposals`
  - `/api/b2b/campaigns/:id/optimize`
  - `/api/b2b/campaigns/:id/generate-orders`
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.b2b.test.ts`.

## Task 5: Interface Frontend React (B2bQuotationsPage.tsx)
- Criar `frontend/src/types/b2b.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar métodos `b2bApi` em `frontend/src/services/api.ts`.
- Atualizar `StationMode` e `useStationMode.ts` com `B2B_QUOTATIONS`.
- Criar `frontend/src/pages/B2bQuotationsPage.tsx`.
- Integrar no `frontend/src/App.tsx`.
- Criar `frontend/tests/pages/B2bQuotationsPage.test.tsx` e validar com Vitest.

## Task 6: Auditoria Geral de Homologação & Git Push
- Rodar suíte completa `npm.cmd test`.
- Validar `npx.cmd tsc --noEmit` e `npx.cmd tsc -p frontend/tsconfig.json --noEmit`.
- Validar `npm.cmd run build:web`.
- Instruir `git push origin master`.
