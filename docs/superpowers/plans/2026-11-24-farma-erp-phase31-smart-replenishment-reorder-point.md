# Plano de Implementação — Fase 31: Reposição Inteligente de Estoque, Ponto de Pedido & Sugestão de Compras

## Contexto & Objetivos
Implementar o motor de inteligência de compras e reposição de estoque do FarmaCore ERP, automatizando o cálculo de Demanda Média Diária (DMD), Curva ABC, Estoque de Segurança, Ponto de Pedido (PP) e Sugestão de Compras para prevenção de ruptura farmacêutica e otimização do capital de giro.

---

## Tasks

### Task 1: Migration 030 e Tipos de Domínio
- Arquivos:
  - `src/database/migrations/030_smart_replenishment.sql`
  - `src/modules/replenishment/replenishment.types.ts`
  - `tests/modules/replenishment/replenishment.schema.test.ts`
- Commit: `feat(replenishment): create migration 030 and domain types for smart inventory replenishment`

### Task 2: Serviço de Reposição Inteligente (ReplenishmentService)
- Arquivos:
  - `src/modules/replenishment/replenishment.service.ts`
  - `tests/modules/replenishment/replenishment.service.test.ts`
- Commit: `feat(replenishment): implement ReplenishmentService for reorder points, ABC curve and purchase suggestions`

### Task 3: Rotas Fastify REST & Registro na API
- Arquivos:
  - `src/modules/replenishment/replenishment.routes.ts`
  - `src/api/routes.ts` (registro)
  - `tests/api/routes.replenishment.test.ts`
- Commit: `feat(replenishment): implement Fastify REST routes for replenishment suggestions and purchase orders`

### Task 4: Frontend React SmartReplenishmentPage & Integração
- Arquivos:
  - `frontend/src/types/replenishment.ts` & exportação em `frontend/src/types/index.ts`
  - `frontend/src/hooks/useStationMode.ts` (modo `SMART_REPLENISHMENT`)
  - `frontend/src/services/api.ts` (`replenishmentApi`)
  - `frontend/src/pages/SmartReplenishmentPage.tsx`
  - `frontend/src/App.tsx` (topbar button e renderização)
  - `frontend/tests/pages/SmartReplenishmentPage.test.tsx`
- Commit: `feat(replenishment): implement SmartReplenishmentPage React UI, station mode integration and tests`

### Task 5: Auditoria, Build e Verificação Geral
- `npx.cmd tsc --noEmit`
- `npm.cmd run build:web`
- `npm.cmd test` (100% de aprovação)
- Sincronização via `git push origin master`
