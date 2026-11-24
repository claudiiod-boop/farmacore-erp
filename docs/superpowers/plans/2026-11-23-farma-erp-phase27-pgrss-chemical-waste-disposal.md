# Implementation Plan - Phase 27: Descarte Sanitário & PGRSS (RDC 222/2018 ANVISA)

## Overview
Implementar o subsistema de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS), cobrindo segregação de medicamentos vencidos e resíduos químicos (Grupo B, A e E), baixa sanitária de lote, emissão do Manifesto de Transporte de Resíduos (MTR), registro do Certificado de Destinação Final (CDF) e rastreabilidade sanitária para ANVISA e órgãos ambientais.

---

## Tasks

### Task 1: Migration 026 & Tipos de Domínio
- [ ] Criar `src/database/migrations/026_pgrss_waste_disposal.sql` (`pgrss_disposal_records`, `pgrss_manifests`, `pgrss_manifest_items`).
- [ ] Criar `src/modules/pgrss/pgrss.types.ts`.
- [ ] Criar `tests/modules/pgrss/pgrss.schema.test.ts`.
- [ ] Commit Task 1.

### Task 2: PgrssDisposalService (Regras Sanitárias & Rastreabilidade)
- [ ] Criar `src/modules/pgrss/pgrss.service.ts`:
  - `segregateWaste(input)`: baixa quantidade do lote e cria registro no abrigo (`STORED`).
  - `listWasteRecords(filters)`: filtros por loja, status, grupo de resíduo.
  - `createMtrManifest(input)`: agrupa registros e emite MTR.
  - `finalizeWithCdf(manifestId, cdfNumber, certificateDate, incinerationPlant)`: encerra ciclo com CDF.
  - `generateMtrDocument(manifestId)`: espelho textual com dados de transporte e resíduos.
  - `getPgrssKpis(storeId?)`: métricas de resíduos.
- [ ] Criar `tests/modules/pgrss/pgrss.service.test.ts`.
- [ ] Commit Task 2.

### Task 3: Rotas REST Fastify
- [ ] Criar `src/modules/pgrss/pgrss.routes.ts`.
- [ ] Registrar rotas em `src/api/routes.ts`.
- [ ] Criar `tests/api/routes.pgrss.test.ts`.
- [ ] Commit Task 3.

### Task 4: Frontend React (PgrssDisposalPage)
- [ ] Criar `frontend/src/types/pgrss.ts` e exportar em `frontend/src/types/index.ts`.
- [ ] Atualizar `frontend/src/services/api.ts` com métodos `pgrssApi`.
- [ ] Atualizar `frontend/src/hooks/useStationMode.ts` com `PGRSS_DISPOSAL` e `isPgrss`.
- [ ] Criar `frontend/src/pages/PgrssDisposalPage.tsx`.
- [ ] Integrar no `frontend/src/App.tsx` com botão `topbar-pgrss-button`.
- [ ] Criar `frontend/tests/pages/PgrssDisposalPage.test.tsx`.
- [ ] Commit Task 4.

### Task 5: Auditoria & Verificação
- [ ] `npx.cmd tsc --noEmit`
- [ ] `npm.cmd run build:web`
- [ ] `npm.cmd test`
- [ ] Orientar usuário para `git push origin master`.
