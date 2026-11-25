# Plano de Implementação — Fase 44: Auditoria Sanitária Automatizada & Dossiê de Autoinspeção (ANVISA / VISA)

## Tasks

- [ ] Task 1: Migration 043 e Types de Auditoria Sanitária
  - Criar `src/database/migrations/043_sanitary_audit_autoinspection_dossier.sql`
  - Criar `src/modules/sanitary-audit/sanitary-audit.types.ts`
  - Criar `tests/modules/sanitary-audit/sanitary-audit.schema.test.ts`
  - Validar migration com vitest

- [ ] Task 2: SanitaryAuditService (Scanner Transversal, Score 0-100%, Dossiê & CAPA)
  - Criar `src/modules/sanitary-audit/sanitary-audit.service.ts`
  - Métodos: `runSanitaryScan`, `generateInspectionDossier`, `listAuditHistory`, `getAuditById`, `updateActionPlan`, `getSanitaryDashboard`
  - Criar `tests/modules/sanitary-audit/sanitary-audit.service.test.ts`
  - Validar cálculos de pontuação e detecção de não conformidades

- [ ] Task 3: Fastify REST Routes
  - Criar `src/modules/sanitary-audit/sanitary-audit.routes.ts`
  - Registrar em `src/api/routes.ts`
  - Criar `tests/api/routes.sanitary-audit.test.ts`
  - Validar endpoints REST

- [ ] Task 4: Frontend Dossiê de Autoinspeção Sanitária
  - Criar `frontend/src/types/sanitary-audit.ts` e exportar em `frontend/src/types/index.ts`
  - Atualizar `useStationMode.ts` com `SANITARY_AUDIT_DOSSIER` e `isSanitaryAuditDossier`
  - Adicionar chamadas em `frontend/src/services/api.ts`
  - Criar `frontend/src/pages/SanitaryAuditDossierPage.tsx`
  - Integrar em `frontend/src/App.tsx`
  - Criar `frontend/tests/pages/SanitaryAuditDossierPage.test.tsx` e validar com vitest

- [ ] Task 5: Homologação Global & Git Push
  - `tsc --noEmit`
  - `npm run build:web`
  - `npm test`
  - Commit convencional e push para `master`
