# Plano de Implementação — Fase 30: Rastreabilidade SNCM & DataMatrix Bidimensional (Lei 13.410/2016 e RDC 157/2017 ANVISA)

## Contexto & Objetivos
Implementar a rastreabilidade individualizada de medicamentos pelo Sistema Nacional de Controle de Medicamentos (SNCM), permitindo a leitura de códigos GS1 DataMatrix (IUM: GTIN + Serial + Validade + Lote), recebimento de carga serializada, dispensação com desativação sanitária, histórico de autenticidade e comunicação de eventos com a ANVISA.

---

## Tasks

### Task 1: Migration 029 e Tipos de Domínio
- Arquivos:
  - `src/database/migrations/029_sncm_traceability.sql`
  - `src/modules/sncm/sncm.types.ts`
  - `tests/modules/sncm/sncm.schema.test.ts`
- Commit: `feat(sncm): create migration 029 and domain types for SNCM traceability and DataMatrix`

### Task 2: Serviço de Rastreabilidade SNCM e Parser GS1 (SncmService)
- Arquivos:
  - `src/modules/sncm/sncm.service.ts`
  - `tests/modules/sncm/sncm.service.test.ts`
- Commit: `feat(sncm): implement SncmService for DataMatrix parsing, receipts, dispensations and ANVISA events`

### Task 3: Rotas Fastify REST & Registro na API
- Arquivos:
  - `src/modules/sncm/sncm.routes.ts`
  - `src/api/routes.ts` (registro)
  - `tests/api/routes.sncm.test.ts`
- Commit: `feat(sncm): implement Fastify REST routes for SNCM items, dispensations and event transmission`

### Task 4: Frontend React SncmTraceabilityPage & Integração
- Arquivos:
  - `frontend/src/types/sncm.ts` & exportação em `frontend/src/types/index.ts`
  - `frontend/src/hooks/useStationMode.ts` (modo `SNCM_TRACEABILITY`)
  - `frontend/src/services/api.ts` (`sncmApi`)
  - `frontend/src/pages/SncmTraceabilityPage.tsx`
  - `frontend/src/App.tsx` (topbar button e renderização)
  - `frontend/tests/pages/SncmTraceabilityPage.test.tsx`
- Commit: `feat(sncm): implement SncmTraceabilityPage React UI, station mode integration and tests`

### Task 5: Auditoria, Build e Verificação Geral
- `npx.cmd tsc --noEmit`
- `npm.cmd run build:web`
- `npm.cmd test` (100% de aprovação)
- Sincronização via `git push origin master`
