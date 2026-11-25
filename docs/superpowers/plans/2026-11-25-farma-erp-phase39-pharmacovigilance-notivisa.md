# Plano de Implementação: Fase 39 — Farmacovigilância, Reações Adversas (RAM) & Queixas Técnicas (RDC 406/2020 ANVISA & NOTIVISA)

## Contexto e Objetivo
Implementar o módulo completo de Farmacovigilância e Notificação Sanitária segundo a RDC 406/2020 da ANVISA e NOTIVISA, abrangendo registro de reações adversas clínicas (RAM), queixas técnicas de qualidade de medicamentos com bloqueio em quarentena e emissão de dossiês formais de vigilância sanitária.

---

## Tarefas de Execução

### Task 1: Migration 038 & Tipos de Domínio TypeScript
- Criar `src/database/migrations/038_pharmacovigilance_notivisa.sql`.
- Criar `src/modules/pharmacovigilance/pharmacovigilance.types.ts`.
- Criar `tests/modules/pharmacovigilance/pharmacovigilance.schema.test.ts`.
- Executar testes e validar migração.

### Task 2: PharmacovigilanceService & Regras Sanitárias
- Criar `src/modules/pharmacovigilance/pharmacovigilance.service.ts`:
  - Registro de RAM com validações clínicas e geração de código de protocolo sequencial.
  - Registro de Queixas Técnicas (desvios de qualidade) com bloqueio preventivo de lote.
  - Submissão ao NOTIVISA (gerando protocolo oficial e atualizando status para 'SUBMITTED').
  - Geração de dossiê exportável.
  - Resumo de Farmacovigilância (RAMs por gravidade, queixas por tipo, pendentes de envio).
- Criar `tests/modules/pharmacovigilance/pharmacovigilance.service.test.ts`.
- Executar testes com Vitest.

### Task 3: Fastify REST API Endpoints (`/api/pharmacovigilance/*`)
- Criar `src/modules/pharmacovigilance/pharmacovigilance.routes.ts`.
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.pharmacovigilance.test.ts`.
- Executar e homologar rotas Fastify.

### Task 4: Frontend React UI & Testes de Interface
- Criar `frontend/src/types/pharmacovigilance.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar `pharmacovigilanceApi` ao cliente `frontend/src/services/api.ts`.
- Criar página `frontend/src/pages/PharmacovigilancePage.tsx`.
- Criar testes unitários em `frontend/tests/pages/PharmacovigilancePage.test.tsx`.
- Executar testes de frontend com Vitest.

### Task 5: Homologação Global, Build e Push
- Rodar `npx.cmd tsc --noEmit`.
- Rodar `npm.cmd run build:web`.
- Rodar `npm.cmd test` em toda a suíte de testes (~233 arquivos e ~1.730 testes).
- Commit modular e `git push origin master`.
