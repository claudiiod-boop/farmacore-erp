# Plano de Implementação - Fase 33: Controle de Lotes Vencidos, Avarias & Quarentena Sanitária Integrada ao PGRSS

## Meta
Implementar o módulo industrial de Gestão de Quarentena Sanitária, Varredura de Lotes Vencidos e Alertas de Recall / Notivisa ANVISA (RDC 44/2009 e RDC 222/2018) com bloqueio preventivo de vendas e integração de descarte PGRSS.

---

## Estrutura de Tarefas

### Tarefa 1: Migration 032 & Definições de Tipos TypeScript
- Arquivos:
  - `src/database/migrations/032_quarantine_recalls_anvisa.sql`
  - `src/modules/quarantine/quarantine.types.ts`
- Testes:
  - `tests/modules/quarantine/quarantine.schema.test.ts`
- Critério de Aceite:
  - Criação das tabelas `quarantine_records` e `recall_alerts` com foreign keys e constraints.
  - Teste em memória verificando inserções e constraints.

### Tarefa 2: Core Domain Service (`QuarantineService`)
- Arquivo:
  - `src/modules/quarantine/quarantine.service.ts`
- Testes:
  - `tests/modules/quarantine/quarantine.service.test.ts`
- Critério de Aceite:
  - `quarantineBatch`: Deduz quantidade do lote vendável (`batches.quantity`) e cria quarentena.
  - `sweepExpiredBatches`: Varre lotes com validade ultrapassada e os move para quarentena com motivo `EXPIRED`.
  - `registerRecallAlert`: Registra publicação RE da ANVISA, localiza todos os lotes correspondentes e bloqueia estoque movendo para quarentena.
  - `resolveQuarantine`: Executa descarte PGRSS, devolução a fornecedor ou liberação técnica com CRF do farmacêutico.
  - 100% de testes unitários passando.

### Tarefa 3: Endpoints Fastify & Rotas REST
- Arquivos:
  - `src/modules/quarantine/quarantine.routes.ts`
  - `src/api/routes.ts` (registro)
- Testes:
  - `tests/api/routes.quarantine.test.ts`
- Critério de Aceite:
  - Endpoints REST para quarentena, varredura de validade, cadastro de recalls, resolução e KPIs.
  - Testes de integração Fastify simulando requisições HTTP e payloads.

### Tarefa 4: Frontend React (`QuarantineRegulatoryPage`), Topbar & Testes
- Arquivos:
  - `frontend/src/types/quarantine.ts` e exportação em `frontend/src/types/index.ts`
  - `frontend/src/services/api.ts` (funções `quarantineApi`)
  - `frontend/src/hooks/useStationMode.ts` (suporte ao modo `QUARANTINE_REGULATORY`)
  - `frontend/src/pages/QuarantineRegulatoryPage.tsx`
  - `frontend/src/App.tsx` (botão na topbar e renderização)
- Testes:
  - `frontend/tests/pages/QuarantineRegulatoryPage.test.tsx`
- Critério de Aceite:
  - Interface visual com KPIs, abas de Quarentena, Varredura de Vencidos e Alertas Notivisa.
  - Modal de resolução de quarentena.
  - Testes unitários com Vitest / Testing Library passando 100%.

### Tarefa 5: Auditoria, Build & Verificação Completa
- Verificação:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run build:web`
  - `npm.cmd test` (todas as fases 1 a 33 passando)
- Instrução de commit e sincronização remota (`git push origin master`).
