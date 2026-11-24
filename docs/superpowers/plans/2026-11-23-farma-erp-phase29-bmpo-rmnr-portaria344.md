# Plano de Implementação — Fase 29: Balanços Oficiais BMPO, RMNRA & RMNRB (Portaria 344/98 ANVISA)

## Contexto & Objetivos
Implementar no FarmaCore ERP a apuração, auditoria e emissão dos mapas regulatórios oficiais exigidos pela Portaria 344/98 ANVISA para entrega trimestral/anual à Vigilância Sanitária (VISA):
- BMPO (Trimestral e Anual)
- RMNRA (Relação Mensal de Notificações de Receita "A")
- RMNRB (Relação Mensal de Notificações de Receita "B")
- Registro de Protocolos de entrega na VISA
- KPIs regulatórios e layout para impressão oficial A4

---

## Tasks

### Task 1: Migration 028 e Tipos de Domínio
- Arquivos:
  - `src/database/migrations/028_bmpo_rmnr_regulatory.sql`
  - `src/modules/bmpo/bmpo.types.ts`
  - `tests/modules/bmpo/bmpo.schema.test.ts`
- Commit: `feat(bmpo): create migration 028 and domain types for regulatory reports`

### Task 2: Serviço de Apuração e Balanços Regulatórios (BmpoService)
- Arquivos:
  - `src/modules/bmpo/bmpo.service.ts`
  - `tests/modules/bmpo/bmpo.service.test.ts`
- Commit: `feat(bmpo): implement BmpoService for official BMPO, RMNRA and RMNRB generation`

### Task 3: Rotas Fastify REST & Registro na API
- Arquivos:
  - `src/modules/bmpo/bmpo.routes.ts`
  - `src/api/routes.ts` (registro)
  - `tests/api/routes.bmpo.test.ts`
- Commit: `feat(bmpo): implement Fastify REST routes for regulatory reports and VISA filings`

### Task 4: Frontend React BmpoRegulatoryPage & Integração
- Arquivos:
  - `frontend/src/types/bmpo.ts` & exportação em `frontend/src/types/index.ts`
  - `frontend/src/hooks/useStationMode.ts` (modo `BMPO_REGULATORY`)
  - `frontend/src/services/api.ts` (`bmpoApi`)
  - `frontend/src/pages/BmpoRegulatoryPage.tsx`
  - `frontend/src/App.tsx` (topbar button e renderização)
  - `frontend/tests/pages/BmpoRegulatoryPage.test.tsx`
- Commit: `feat(bmpo): implement BmpoRegulatoryPage React UI, station mode integration and tests`

### Task 5: Auditoria & Verificação Final
- `npx.cmd tsc --noEmit`
- `npm.cmd run build:web`
- `npm.cmd test` (100% de aprovação)
- Sincronização via `git push origin master`
