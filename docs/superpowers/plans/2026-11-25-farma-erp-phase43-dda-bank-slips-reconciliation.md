# Plano de Implementação — Fase 43: Conciliação Automática de Boletos Bancários & Débito Direto Autorizado (DDA)

## Tasks

- [ ] Task 1: Migration 042 e Types DDA
  - Criar `src/database/migrations/042_dda_bank_slips_reconciliation.sql`
  - Criar `src/modules/financial/dda.types.ts`
  - Criar `tests/modules/financial/dda.schema.test.ts`
  - Validar migration e tipos

- [ ] Task 2: DdaService (Importação, Match Heurístico, Liquidação & KPIs)
  - Criar `src/modules/financial/dda.service.ts`
  - Métodos: `importDdaInvoices`, `reconcileInvoicesAuto`, `manualMatch`, `settleDdaInvoice`, `getDdaKpis`, `listDdaInvoices`
  - Criar `tests/modules/financial/dda.service.test.ts`
  - Validar regras de match (CNPJ distribuidora + valor da fatura + tolerância de data) e segurança anti-fraude

- [ ] Task 3: Fastify REST Routes
  - Criar `src/modules/financial/dda.routes.ts`
  - Registrar rotas em `src/api/routes.ts`
  - Criar `tests/api/routes.dda.test.ts`
  - Validar endpoints REST

- [ ] Task 4: Frontend DDA & Boletos
  - Criar `frontend/src/types/dda.ts` e exportar em `frontend/src/types/index.ts`
  - Atualizar `useStationMode.ts` com `DDA_RECONCILIATION` e `isDdaReconciliation`
  - Adicionar chamadas em `frontend/src/services/api.ts`
  - Criar `frontend/src/pages/DdaReconciliationPage.tsx`
  - Integrar em `frontend/src/App.tsx`
  - Criar `frontend/tests/pages/DdaReconciliationPage.test.tsx` e validar

- [ ] Task 5: Homologação Global & Git Push
  - `tsc --noEmit`
  - `npm run build:web`
  - `npm test`
  - Commit convencional e push para `master`
