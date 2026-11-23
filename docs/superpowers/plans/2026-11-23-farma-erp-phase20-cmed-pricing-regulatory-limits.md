# Plano de Implementação — Fase 20: Tabela Oficial CMED / ANVISA & Gestão de Precificação Farmacêutica

## Task 1: Schema 019 & Tipos de Domínio
- Criar `src/database/migrations/019_cmed_pricing_regulatory_limits.sql`:
  - `cmed_table_versions`
  - `cmed_products`
  - `cmed_pricing_rules`
  - `cmed_price_audit_logs`
- Criar `src/modules/cmed/cmed.types.ts`.
- Criar `tests/modules/cmed/cmed.schema.test.ts`.

## Task 2: Motor de Importação e Parsing CMED (CSV ANVISA)
- Criar `src/modules/cmed/cmed-parser.service.ts`:
  - Parser robusto para arquivos CSV oficiais da CMED.
  - Normalização de EANs (13 dígitos), Registro MS (13 dígitos), conversão de moeda brasileira (`12,50` -> `12.50`) e classificação tributária (Positiva, Negativa, Neutra).
  - Bulk insert transacional de alto desempenho.
- Criar `tests/modules/cmed/cmed-parser.service.test.ts`.

## Task 3: Motor de Validação Sanitária & Precificação Dinâmica
- Criar `src/modules/cmed/cmed-pricing.service.ts`:
  - `validatePmcCap(ean, price, icmsRate)`: validação do teto regulatório de preço.
  - `runPricingAudit(storeId, icmsRate)`: identificação de produtos com preço superior ao PMC ou margem negativa.
  - `calculateCategoryPrice(productId, storeId, icmsRate)`: cálculo dinâmico baseado em regras comerciais.
  - `applyBatchPriceUpdates(storeId, updates)`: aplicação segura de novos preços com histórico.
- Criar `tests/modules/cmed/cmed-pricing.service.test.ts`.

## Task 4: Rotas REST Fastify & Bloqueio Sanitário no Balcão/PDV
- Criar `src/modules/cmed/cmed.routes.ts`:
  - `/api/cmed/import`
  - `/api/cmed/search`
  - `/api/cmed/audit`
  - `/api/cmed/rules`
  - `/api/cmed/validate-price`
  - `/api/cmed/apply-updates`
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.cmed.test.ts`.

## Task 5: Interface Frontend React (CmedPricingPage.tsx)
- Criar `frontend/src/types/cmed.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar métodos `cmedApi` em `frontend/src/services/api.ts`.
- Atualizar `StationMode` e `useStationMode.ts` com `CMED_PRICING`.
- Criar `frontend/src/pages/CmedPricingPage.tsx`.
- Integrar no `frontend/src/App.tsx`.
- Criar `frontend/tests/pages/CmedPricingPage.test.tsx` com Vitest.

## Task 6: Auditoria Geral de Homologação & Git Push
- Rodar suíte completa `npm.cmd test`.
- Validar `npx.cmd tsc --noEmit` e `npx.cmd tsc -p frontend/tsconfig.json --noEmit`.
- Validar `npm.cmd run build:web`.
- Instruir `git push origin master`.
