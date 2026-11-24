# Plano de Implementação - Fase 24: Fracionamento de Medicamentos em Blíster (RDC 80/2006 ANVISA)

## Meta e Escopo
Implementar o módulo completo de Fracionamento Farmacêutico em Blíster conforme a **RDC 80/2006 da ANVISA**:
1. Migration 023 (`is_fractionable`, `units_per_package`, `fractional_unit` em `products`; tabelas `fractionation_records` e `fractionation_dispensations`).
2. `FractionationService`: desmembramento de lotes pais, criação de sublotes, dispensação com registro de bula e emissão de rótulo sanitário 48 colunas.
3. Rotas Fastify REST (`/api/fractionation/*`).
4. Interface Web React (`FractionationPage.tsx`), integração no `App.tsx` e atalho de modo de estação.
5. Cobertura de testes unitários e de integração 100% PASS.

---

## Tasks do Plano

### Task 1: Migration 023 & Tipos de Domínio
- Criar `src/database/migrations/023_medicine_fractionation_rdc80.sql`.
- Criar `src/modules/fractionation/fractionation.types.ts`.
- Criar testes de schema `tests/modules/fractionation/fractionation.schema.test.ts`.

### Task 2: FractionationService (Regras RDC 80/2006 & Rótulo Térmico)
- Criar `src/modules/fractionation/fractionation.service.ts`:
  - `fractionateMedicine`
  - `dispenseFractioned`
  - `generateOfficialLabel`
  - `listFractionationRecords`
  - `listFractionableProducts`
  - `toggleProductFractionable`
  - `getFractionationKpis`
- Criar testes unitários `tests/modules/fractionation/fractionation.service.test.ts`.

### Task 3: Rotas REST Fastify do Módulo de Fracionamento
- Criar `src/modules/fractionation/fractionation.routes.ts`.
- Integrar no `src/api/routes.ts`.
- Criar testes de rotas `tests/api/routes.fractionation.test.ts`.

### Task 4: Frontend React (`FractionationPage.tsx`) & Navegação
- Criar `frontend/src/types/fractionation.ts`.
- Atualizar `frontend/src/types/index.ts`, `frontend/src/hooks/useStationMode.ts` e `frontend/src/services/api.ts`.
- Criar `frontend/src/pages/FractionationPage.tsx` com 3 abas funcionais (Executar Fracionamento, Dispensação & Rótulo RDC 80, Catálogo Fracionável).
- Atualizar `frontend/src/App.tsx` com o botão na barra superior (`topbar-fractionation-button`).
- Criar testes de frontend `frontend/tests/pages/FractionationPage.test.tsx`.

### Task 5: Homologação Completa da Suíte de Testes & Push
- Executar typecheck (`tsc --noEmit`), build web (`npm run build:web`) e suíte completa (`npm test`).
- Limpeza do working tree e entrega de commits.
