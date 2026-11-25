# Plano de Implementação — Fase 48: Balança de Precisão & Checkout com Código de Barras Pesável

## Objetivo
Implementar a comunicação com balanças seriais (Toledo, Filizola, Urano), decodificação de códigos de barras EAN-13 pesáveis padrão `2XXXXX`, emissão de etiquetas térmicas e controle de tara metrológica (Portaria INMETRO 236/1994 e RDC 67/2007).

---

## Tarefas

- [ ] **Task 1: Migration 047 & Tipos TypeScript**
  - Criar `src/database/migrations/047_precision_scale_weighted_barcode_checkout.sql`.
  - Criar `src/modules/scales/scale.types.ts`.
  - Criar `tests/modules/scales/scale.schema.test.ts`.

- [ ] **Task 2: ScaleWeighingService & Testes de Unidade**
  - Criar `src/modules/scales/scale.service.ts` com decodificação de código de barras pesável, cálculo de tara, leitura serial e geração de etiquetas.
  - Criar `tests/modules/scales/scale.service.test.ts`.

- [ ] **Task 3: Rotas REST Fastify & Testes de API**
  - Criar `src/modules/scales/scale.routes.ts`.
  - Registrar em `src/api/routes.ts`.
  - Criar `tests/api/routes.scale.test.ts`.

- [ ] **Task 4: Frontend Web & Navegação**
  - Criar `frontend/src/types/scale.ts` e exportar em `frontend/src/types/index.ts`.
  - Atualizar `frontend/src/hooks/useStationMode.ts` com `PRECISION_SCALE_MODULE`.
  - Atualizar `frontend/src/services/api.ts` com `scaleApi`.
  - Criar `frontend/src/pages/PrecisionScalePage.tsx`.
  - Adicionar atalho no `frontend/src/App.tsx` (`topbar-precision-scale-button`).
  - Criar `frontend/tests/pages/PrecisionScalePage.test.tsx`.

- [ ] **Task 5: Homologação Global & Git Push**
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run build:web`
  - `npx.cmd vitest run tests/`
  - Commit e push para `origin/master`.
