# Plano de Implementação - Fase 49: Auditoria de Repasses do Farmácia Popular (MS / DataSUS), Prevenção de Glosas & Arquivo Digital de Comprovantes (5 Anos)

## Objetivo
Implementar o módulo completo de conciliação de repasses do Fundo Nacional de Saúde (FNS / DataSUS), detecção e contestação de glosas administrativas, e arquivo digital comprobatório com hash SHA-256 e temporalidade legal de 5 anos (Portaria GM/MS 5/2017 e diretrizes do DENASUS).

## Tasks de Execução

### Task 1: Banco de Dados e Tipos
- Criar migration `src/database/migrations/048_farmacia_popular_audit_glosas_dossier.sql`.
- Criar `src/modules/pbm/fp-audit.types.ts`.
- Criar teste de schema `tests/modules/pbm/fp-audit.schema.test.ts`.
- Validar com Vitest.

### Task 2: Service de Auditoria e Testes Unitários
- Criar `src/modules/pbm/farmacia-popular-audit.service.ts`:
  - `importSettlementBatch(input)`
  - `reconcileAuthorizations(batchId)`
  - `registerDigitalDossier(input)`
  - `contestGloss(auditItemId, input)`
  - `listDossiers(filters)`
  - `getAuditKpis(storeId)`
- Criar `tests/modules/pbm/farmacia-popular-audit.service.test.ts` cobrindo cenários com sucesso e erros semânticos.
- Validar com Vitest.

### Task 3: Rotas REST API e Integração Backend
- Criar `src/modules/pbm/farmacia-popular-audit.routes.ts`.
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.fp-audit.test.ts`.
- Validar com Vitest.

### Task 4: Frontend e Testes de Interface
- Criar `frontend/src/types/fp-audit.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar modo `FARMACIA_POPULAR_AUDIT` em `frontend/src/hooks/useStationMode.ts`.
- Adicionar `fpAuditApi` em `frontend/src/services/api.ts`.
- Criar `frontend/src/pages/FarmaciaPopularAuditPage.tsx`.
- Integrar no `frontend/src/App.tsx` com botão `topbar-fp-audit-button`.
- Criar `frontend/tests/pages/FarmaciaPopularAuditPage.test.tsx` e validar com Vitest.

### Task 5: Homologação Global e Sincronização Git
- Executar `npx.cmd tsc --noEmit`.
- Executar `npm.cmd run build:web`.
- Executar suíte completa `npx.cmd vitest run`.
- Criar commit atômico e realizar `git push origin master`.
