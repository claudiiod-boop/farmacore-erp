# Plano de Execução — Fase 42: Totem de Autoatendimento Avançado & Pagamento Autônomo com TEF/PIX Touch

## Tarefas de Execução

### Task 1: Migration 041 & Tipos de Domínio
- Criar `src/database/migrations/041_self_checkout_autonomous_kiosk.sql`.
- Criar `src/modules/self-checkout/self-checkout.types.ts`.
- Criar teste de schema `tests/modules/self-checkout/self-checkout.schema.test.ts`.

### Task 2: SelfCheckoutService & Regras de Negócio
- Criar `src/modules/self-checkout/self-checkout.service.ts` com métodos de sessão, bipe de produtos com bloqueio sanitário, pagamento touch e fechamento de venda autônoma.
- Criar testes unitários `tests/modules/self-checkout/self-checkout.service.test.ts`.

### Task 3: Rotas REST Fastify
- Criar `src/modules/self-checkout/self-checkout.routes.ts`.
- Registrar rotas em `src/api/routes.ts`.
- Criar testes de integração `tests/api/routes.self-checkout.test.ts`.

### Task 4: Frontend React (SelfCheckoutTouchPage)
- Criar `frontend/src/types/self-checkout.ts`.
- Atualizar `frontend/src/types/index.ts`.
- Atualizar `frontend/src/services/api.ts` com `selfCheckoutApi`.
- Atualizar `frontend/src/hooks/useStationMode.ts` com modo `SELF_CHECKOUT_TOUCH`.
- Criar `frontend/src/pages/SelfCheckoutTouchPage.tsx`.
- Integrar no `frontend/src/App.tsx`.
- Criar testes de interface `frontend/tests/pages/SelfCheckoutTouchPage.test.tsx`.

### Task 5: Homologação Global, Testes e Sincronização
- Rodar `tsc --noEmit`.
- Rodar `npm run build:web`.
- Rodar suite completa de testes `npm test`.
- Commits atômicos e push para `master`.
