# Plano de Implementação — Fase 46: Balanço Patrimonial & Inventário Rotativo Cego

## Objetivo
Implementar o módulo completo de contagem cega, balanço patrimonial e conciliação de divergências de estoque com validação sanitária para medicamentos controlados (Portaria 344/98 e RDC 44/2009).

---

## Tarefas

- [ ] **Task 1: Migration 045 & Tipos TypeScript**
  - Criar `src/database/migrations/045_blind_inventory_patrimonial_balance.sql`.
  - Criar `src/modules/inventory-audit/blind-inventory.types.ts`.
  - Criar `tests/modules/inventory-audit/blind-inventory.schema.test.ts`.

- [ ] **Task 2: BlindInventoryService & Testes de Unidade**
  - Criar `src/modules/inventory-audit/blind-inventory.service.ts` com regras de contagem cega, cálculo de divergência, trava sanitária de controlados e finalização.
  - Criar `tests/modules/inventory-audit/blind-inventory.service.test.ts`.

- [ ] **Task 3: Rotas REST Fastify & Testes de API**
  - Criar `src/modules/inventory-audit/blind-inventory.routes.ts`.
  - Registrar em `src/api/routes.ts`.
  - Criar `tests/api/routes.blind-inventory.test.ts`.

- [ ] **Task 4: Frontend Web & Navegação**
  - Criar `frontend/src/types/blind-inventory.ts` e exportar em `frontend/src/types/index.ts`.
  - Atualizar `frontend/src/hooks/useStationMode.ts` com `BLIND_INVENTORY_AUDIT`.
  - Atualizar `frontend/src/services/api.ts` com `blindInventoryApi`.
  - Criar `frontend/src/pages/BlindInventoryPage.tsx`.
  - Adicionar atalho no `frontend/src/App.tsx` (`topbar-blind-inventory-button`).
  - Criar `frontend/tests/pages/BlindInventoryPage.test.tsx`.

- [ ] **Task 5: Homologação Global & Git Push**
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run build:web`
  - `npx.cmd vitest run tests/`
  - Commit e push para `origin/master`.
