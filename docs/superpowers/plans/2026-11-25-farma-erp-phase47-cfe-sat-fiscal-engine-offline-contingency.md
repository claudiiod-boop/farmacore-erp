# Plano de Implementação — Fase 47: Emissor e Validador de Cupom Fiscal SAT (CF-e-SAT SP / MF-e CE)

## Objetivo
Implementar a emissão de Cupom Fiscal Eletrônico CF-e-SAT (Modelo 59) para drogarias em SP e CE, com driver de módulo fiscal, assinatura de XML, contingência off-line automática e extrato térmico 80mm com QR Code.

---

## Tarefas

- [ ] **Task 1: Migration 046 & Tipos TypeScript**
  - Criar `src/database/migrations/046_cfe_sat_fiscal_engine_offline_contingency.sql`.
  - Criar `src/modules/fiscal/sat.types.ts`.
  - Criar `tests/modules/fiscal/sat.schema.test.ts`.

- [ ] **Task 2: SatFiscalService & Testes de Unidade**
  - Criar `src/modules/fiscal/sat.service.ts` com emissão de CF-e, assinatura XML, contingência, sincronização de lote e cancelamento.
  - Criar `tests/modules/fiscal/sat.service.test.ts`.

- [ ] **Task 3: Rotas REST Fastify & Testes de API**
  - Criar `src/modules/fiscal/sat.routes.ts`.
  - Registrar em `src/api/routes.ts`.
  - Criar `tests/api/routes.sat.test.ts`.

- [ ] **Task 4: Frontend Web & Navegação**
  - Criar `frontend/src/types/sat.ts` e exportar em `frontend/src/types/index.ts`.
  - Atualizar `frontend/src/hooks/useStationMode.ts` com `SAT_FISCAL_MODULE`.
  - Atualizar `frontend/src/services/api.ts` com `satFiscalApi`.
  - Criar `frontend/src/pages/SatFiscalPage.tsx`.
  - Adicionar atalho no `frontend/src/App.tsx` (`topbar-sat-fiscal-button`).
  - Criar `frontend/tests/pages/SatFiscalPage.test.tsx`.

- [ ] **Task 5: Homologação Global & Git Push**
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run build:web`
  - `npx.cmd vitest run tests/`
  - Commit e push para `origin/master`.
