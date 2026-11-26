# Plano de Implementação - Fase 50: Emissor e Validador de MDF-e (Manifesto Eletrônico de Documentos Fiscais - Modelo 58 / Ajuste SINIEF 21/2010)

## Objetivo
Implementar o módulo completo de emissão, autorização, DAMDFE e encerramento de MDF-e para transferências de medicamentos entre matriz e filiais, integrando averbação de seguro de carga e controle de condutor/veículo.

## Tasks de Execução

### Task 1: Banco de Dados e Tipos
- Criar migration `src/database/migrations/049_mdfe_manifesto_fiscal_eletronico.sql`.
- Criar `src/modules/fiscal/mdfe.types.ts`.
- Criar teste de schema `tests/modules/fiscal/mdfe.schema.test.ts`.
- Validar com Vitest.

### Task 2: Service de MDF-e e Testes Unitários
- Criar `src/modules/fiscal/mdfe.service.ts`:
  - `createMdfeDraft(input)`
  - `authorizeMdfe(mdfeId)`
  - `closeMdfe(mdfeId, input)`
  - `cancelMdfe(mdfeId, justification)`
  - `generateDamdfe(mdfeId)`
  - `listMdfes(filters)`
  - `getMdfeKpis(storeId)`
- Criar `tests/modules/fiscal/mdfe.service.test.ts` cobrindo cenários com sucesso e erros semânticos.
- Validar com Vitest.

### Task 3: Rotas REST API e Integração Backend
- Criar `src/modules/fiscal/mdfe.routes.ts`.
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.mdfe.test.ts`.
- Validar com Vitest.

### Task 4: Frontend e Testes de Interface
- Criar `frontend/src/types/mdfe.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar modo `MDFE_FISCAL_MODULE` em `frontend/src/hooks/useStationMode.ts`.
- Adicionar `mdfeApi` em `frontend/src/services/api.ts`.
- Criar `frontend/src/pages/MdfePage.tsx`.
- Integrar no `frontend/src/App.tsx` com botão `topbar-mdfe-button`.
- Criar `frontend/tests/pages/MdfePage.test.tsx` e validar com Vitest.

### Task 5: Homologação Global e Sincronização Git
- Executar `npx.cmd tsc --noEmit`.
- Executar `npm.cmd run build:web`.
- Executar suíte completa `npx.cmd vitest run`.
- Criar commit atômico e realizar `git push origin master`.
