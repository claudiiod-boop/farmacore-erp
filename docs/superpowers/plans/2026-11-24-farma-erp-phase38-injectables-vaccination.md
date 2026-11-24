# Plano de Implementação: Fase 38 — Livro Oficial de Injetáveis & Sala de Vacinas (RDC 197/2017 & RDC 44/2009 ANVISA)

## Contexto e Objetivo
Implementar o Livro Eletrônico Oficial de Administração de Medicamentos Injetáveis e o Módulo de Sala de Vacinação em conformidade com as RDC 44/2009 e RDC 197/2017 da ANVISA, assegurando rastreabilidade de lotes, insumos, triagem, carteira de vacinação do cidadão e integração de dados com o SI-PNI.

---

## Tarefas de Execução

### Task 1: Migration 037 & Tipos de Domínio TypeScript
- Criar `src/database/migrations/037_injectables_vaccination.sql`.
- Criar `src/modules/injectables/injectables.types.ts`.
- Criar teste de schema `tests/modules/injectables/injectables.schema.test.ts`.
- Executar testes e validar migração.

### Task 2: InjectableVaccinationService & Regras Regulatórias
- Criar `src/modules/injectables/injectables.service.ts`:
  - Registro de aplicação de injetáveis com validação e geração de código DSF.
  - Registro de vacinas com triagem e certificado.
  - Exportação e atualização de status para lote SI-PNI.
  - Registro de EAPV e histórico de aplicações por paciente.
  - Livro consolidado de injetáveis filtrado por período e RT.
- Criar `tests/modules/injectables/injectables.service.test.ts`.
- Executar testes com Vitest.

### Task 3: Fastify REST API Endpoints (`/api/injectables/*` e `/api/vaccines/*`)
- Criar `src/modules/injectables/injectables.routes.ts`.
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.injectables.test.ts`.
- Executar e homologar rotas Fastify.

### Task 4: Frontend React UI & Testes de Interface
- Criar `frontend/src/types/injectables.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar `injectablesApi` ao cliente `frontend/src/services/api.ts`.
- Criar página `frontend/src/pages/InjectablesVaccinationPage.tsx`.
- Criar testes unitários em `frontend/tests/pages/InjectablesVaccinationPage.test.tsx`.
- Executar testes de frontend com Vitest.

### Task 5: Homologação Global, Build e Push
- Rodar `npx.cmd tsc --noEmit`.
- Rodar `npm.cmd run build:web`.
- Rodar `npm.cmd test` em toda a suíte de testes.
- Commit modular e `git push origin master`.
