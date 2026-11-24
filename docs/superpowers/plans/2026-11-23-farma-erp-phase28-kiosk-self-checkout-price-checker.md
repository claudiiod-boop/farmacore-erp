# Implementation Plan - Phase 28: Totem de Autoatendimento, Terminal de Consulta de Preços & Pré-Venda Express

## Overview
Implementar subsistema de totens e quiosques de autoatendimento para farmácias, compreendendo consulta de preços e PMC com sugestão de genéricos, emissão de senhas de atendimento para fila inteligente e emissão de pré-vendas expressas no terminal touch.

---

## Tasks

### Task 1: Migration 027 & Tipos Kiosk
- [ ] Criar `src/database/migrations/027_kiosk_terminals_queue.sql` (`kiosk_terminals`, `queue_tickets`, `kiosk_price_queries`).
- [ ] Criar `src/modules/kiosk/kiosk.types.ts`.
- [ ] Criar `tests/modules/kiosk/kiosk.schema.test.ts`.
- [ ] Commit Task 1.

### Task 2: KioskService (Consulta de Preços, Fila & Pré-Venda Express)
- [ ] Criar `src/modules/kiosk/kiosk.service.ts`:
  - `queryProductPrice`: busca por EAN/nome, cálculo fidelidade, PMC e genéricos equivalentes.
  - `issueQueueTicket`: geração sequencial de senhas (N-001, P-001, R-001, C-001) e recibo térmico.
  - `listQueueTickets` e `callQueueTicket`.
  - `createExpressPreSale`: pré-venda assistida no totem bloqueando controlados da Portaria 344/98.
  - `listTerminals` e `createTerminal`.
  - `getKioskKpis`.
- [ ] Criar `tests/modules/kiosk/kiosk.service.test.ts`.
- [ ] Commit Task 2.

### Task 3: Rotas REST Fastify
- [ ] Criar `src/modules/kiosk/kiosk.routes.ts`.
- [ ] Registrar rotas em `src/api/routes.ts`.
- [ ] Criar `tests/api/routes.kiosk.test.ts`.
- [ ] Commit Task 3.

### Task 4: Frontend React (KioskPage)
- [ ] Criar `frontend/src/types/kiosk.ts` e exportar em `frontend/src/types/index.ts`.
- [ ] Atualizar `frontend/src/services/api.ts` com métodos `kioskApi`.
- [ ] Atualizar `frontend/src/hooks/useStationMode.ts` com `KIOSK_TERMINAL` e `isKiosk`.
- [ ] Criar `frontend/src/pages/KioskPage.tsx`.
- [ ] Integrar no `frontend/src/App.tsx` com botão `topbar-kiosk-button`.
- [ ] Criar `frontend/tests/pages/KioskPage.test.tsx`.
- [ ] Commit Task 4.

### Task 5: Auditoria & Verificação Final
- [ ] `npx.cmd tsc --noEmit`
- [ ] `npm.cmd run build:web`
- [ ] `npm.cmd test`
- [ ] Orientar usuário para `git push origin master`.
