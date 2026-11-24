# Plano de Implementação: Fase 37 — Sanitização, Higienização de Ambientes, Dedetização & POPs Regulatórios (RDC 44/2009 ANVISA)

## Contexto e Objetivo
Implementar o sistema completo de governança sanitária e controle de boas práticas farmacêuticas segundo a RDC 44/2009 ANVISA: registro e homologação de rotinas de higienização de setores físicos, controle rigoroso de laudos de dedetização e limpeza de reservatórios d'água com cálculo de vigência semestral, e gestão do ciclo de vida de Procedimentos Operacionais Padrão (POPs) com visão consolidada de compliance sanitário.

---

## Tarefas de Execução

### Task 1: Migration 036 & Tipos de Sanitização e POPs
- Criar `src/database/migrations/036_sanitization_pest_control_sops.sql`.
- Criar `src/modules/sanitization/sanitization.types.ts`.
- Criar `tests/modules/sanitization/sanitization.schema.test.ts`.
- Executar testes e validar migração.

### Task 2: SanitizationService & Regras Regulatórias
- Criar `src/modules/sanitization/sanitization.service.ts`:
  - CRUD e verificação RT de `sanitization_logs`.
  - CRUD, cálculo de dias para expirar e status de vigência de `pest_control_certificates`.
  - CRUD, validação de potabilidade e status de `water_tank_cleaning_logs`.
  - CRUD, versionamento e alerta de revisão de `standard_operating_procedures`.
  - Método `getComplianceOverview(companyId)` para gerar resumo analítico e score de conformidade VISA.
- Criar `tests/modules/sanitization/sanitization.service.test.ts`.
- Executar testes com Vitest.

### Task 3: Fastify REST API Endpoints
- Criar `src/modules/sanitization/sanitization.routes.ts`.
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.sanitization.test.ts`.
- Executar e homologar rotas Fastify.

### Task 4: Frontend React UI & Testes de Interface
- Criar `frontend/src/types/sanitization.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar `sanitizationApi` ao cliente `frontend/src/services/api.ts`.
- Criar página `frontend/src/pages/SanitizationCompliancePage.tsx`.
- Criar testes unitários em `frontend/tests/pages/SanitizationCompliancePage.test.tsx`.
- Executar testes de frontend com Vitest.

### Task 5: Homologação Global, Build e Push
- Rodar `npx.cmd tsc --noEmit`.
- Rodar `npm.cmd run build:web`.
- Rodar `npm.cmd test` em toda a suíte de testes.
- Commit modular e `git push origin master`.
