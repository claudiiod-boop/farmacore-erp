# Plano de Implementação - Fase 32: Devoluções de Clientes, Trocas no Balcão & Estorno Fiscal / Logística Reversa

## Meta
Implementar o módulo industrial de Trocas e Devoluções de Clientes no FarmaCore ERP, com suporte integral a estorno fiscal (CFOP 1.202/1.411 referenciando NFC-e), exigências sanitárias da RDC 44/2009 ANVISA (quarentena obrigatória para termolábeis e autorização técnica do farmacêutico para controlados), emissão de vales-compra (Store Credit) e rastreamento de estoque.

---

## Estrutura de Tarefas

### Tarefa 1: Migration 031 & Definições de Tipos TypeScript
- Arquivos:
  - `src/database/migrations/031_customer_returns_fiscal.sql`
  - `src/modules/returns/returns.types.ts`
- Testes:
  - `tests/modules/returns/returns.schema.test.ts`
- Critério de Aceite:
  - Migration cria tabelas `customer_returns`, `customer_return_items`, `store_credits` com índices e foreign keys.
  - Teste verifica integridade das tabelas e tipos TypeScript.

### Tarefa 2: Core Domain Service (`CustomerReturnService`)
- Arquivo:
  - `src/modules/returns/returns.service.ts`
- Testes:
  - `tests/modules/returns/returns.service.test.ts`
- Critério de Aceite:
  - Validação de itens elegíveis de venda anterior (não permite devolver mais que a quantidade vendida).
  - Regra RDC 44/2009: medicamento termolábil não pode ter destino `RETURN_TO_STOCK` (força `QUARANTINE` ou `DISPOSAL_PGRSS`).
  - Regra Portaria 344/98: exige `pharmacist_crf` se houver produto controlado.
  - Movimentação de estoque atômica com SQLite transaction.
  - Emissão e controle de saldo de `store_credits`.
  - Geração de dados de NF-e de Devolução com cálculo de estorno de ICMS/PIS/COFINS e chave referenciada.
  - 100% de cobertura nos testes unitários do serviço.

### Tarefa 3: Endpoints Fastify & Rotas REST
- Arquivos:
  - `src/modules/returns/returns.routes.ts`
  - `src/api/routes.ts` (registro)
- Testes:
  - `tests/api/routes.returns.test.ts`
- Critério de Aceite:
  - Endpoints para criar devolução, aprovar/completar, rejeitar, listar itens elegíveis da venda, validar vale-compras e obter KPIs.
  - Testes de integração Fastify simulando ciclo de vida completo.

### Tarefa 4: Frontend React (`CustomerReturnsPage`), Topbar & Testes
- Arquivos:
  - `frontend/src/types/returns.ts` e exportação em `frontend/src/types/index.ts`
  - `frontend/src/services/api.ts` (funções `returnsApi`)
  - `frontend/src/hooks/useStationMode.ts` (suporte ao modo `CUSTOMER_RETURNS`)
  - `frontend/src/pages/CustomerReturnsPage.tsx`
  - `frontend/src/App.tsx` (botão na barra superior e renderização da página)
- Testes:
  - `frontend/tests/pages/CustomerReturnsPage.test.tsx`
- Critério de Aceite:
  - Busca de cupom de venda por ID/NFC-e.
  - Interface com seleção de itens, estado do produto e destino sanitário.
  - Emissão visual de vale-compras e comprovante térmico de devolução.
  - Testes unitários com Testing Library / Vitest passando 100%.

### Tarefa 5: Auditoria, Build & Verificação Completa
- Verificação:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run build:web`
  - `npm.cmd test` (todas as fases 1 a 32 passando sem regressão)
- Instrução de commit e sincronização remota (`git push origin master`).
