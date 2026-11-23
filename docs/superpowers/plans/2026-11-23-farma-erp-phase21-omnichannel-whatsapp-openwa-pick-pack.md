# Plano de Implementação — Fase 21
# Hub Omnichannel de Vendas, Atendimento WhatsApp (OpenWA Gateway) & Pick-and-Pack Assistido

## Tarefas Estruturadas (TDD)

### Task 1: Banco de Dados — Migration 020 & Tipos de Domínio
- Criar `src/database/migrations/020_omnichannel_whatsapp_pick_pack.sql`.
- Tabelas: `omnichannel_channels`, `omnichannel_conversations`, `omnichannel_messages`, `omnichannel_orders`, `omnichannel_order_items`, `omnichannel_order_audits`.
- Criar `src/modules/omnichannel/omnichannel.types.ts`.
- Escrever testes unitários em `tests/modules/omnichannel/omnichannel.schema.test.ts`.

### Task 2: Gateway OpenWA & Motor de Mensageria
- Criar `src/modules/omnichannel/openwa-gateway.service.ts`:
  - Envio de mensagens de texto, botões e listas para o host do OpenWA via HTTP fetch/axios mockável.
  - Processamento de webhooks de mensagens recebidas (`handleInboundMessage`).
  - Registro de auditoria em `omnichannel_messages`.
- Escrever testes em `tests/modules/omnichannel/openwa-gateway.service.test.ts`.

### Task 3: Bot de Autoatendimento Farmacêutico & Integração com Catálogo
- Criar `src/modules/omnichannel/omnichannel-bot.service.ts`:
  - Máquina de estados conversacionais (`IDLE`, `SEARCHING_PRODUCT`, `SENDING_PRESCRIPTION`, `TRACKING_DELIVERY`, `HUMAN_ESCALATION`).
  - Consulta ao catálogo de produtos com preço respeitando o teto CMED.
  - Criação de pré-vendas e pedidos omnichannel.
- Escrever testes em `tests/modules/omnichannel/omnichannel-bot.service.test.ts`.

### Task 4: Esteira de Pick-and-Pack Assistido (Conferência Cega)
- Criar `src/modules/omnichannel/pick-and-pack.service.ts`:
  - Transições de estado do pedido: `NEW` -> `IN_SEPARATION` -> `CHECKED` -> `DISPATCHED`.
  - Validação de bipagem de EAN com incremento atômico de `picked_quantity`.
  - Impedimento de despacho antes da conferência de 100% dos itens.
  - Integração com Tele-Entrega e disparo de mensagem no WhatsApp ao cliente.
- Escrever testes em `tests/modules/omnichannel/pick-and-pack.service.test.ts`.

### Task 5: Rotas Fastify REST
- Criar `src/modules/omnichannel/omnichannel.routes.ts`:
  - `POST /api/omnichannel/webhook/openwa`
  - `GET /api/omnichannel/channels` & `POST /api/omnichannel/channels`
  - `GET /api/omnichannel/conversations` & `POST /api/omnichannel/conversations/:id/reply`
  - `GET /api/omnichannel/orders`
  - `POST /api/omnichannel/orders/:id/start-picking`
  - `POST /api/omnichannel/orders/:id/scan`
  - `POST /api/omnichannel/orders/:id/dispatch`
- Integrar em `src/api/routes.ts`.
- Escrever testes de integração em `tests/api/routes.omnichannel.test.ts`.

### Task 6: Interface React — `OmnichannelPickPackPage.tsx`
- Criar tipos em `frontend/src/types/omnichannel.ts` e registrar em `frontend/src/types/index.ts`.
- Adicionar modo `OMNICHANNEL_PICK_PACK` em `frontend/src/hooks/useStationMode.ts`.
- Implementar métodos de API em `frontend/src/services/api.ts`.
- Criar componente `frontend/src/pages/OmnichannelPickPackPage.tsx`.
- Conectar no `frontend/src/App.tsx`.
- Escrever testes React em `frontend/tests/pages/OmnichannelPickPackPage.test.tsx`.

### Task 7: Auditoria de Homologação Geral & Push
- Executar suíte completa (`npm.cmd test`, `tsc`, `build:web`).
- Garantir 100% dos testes passando sem nenhuma regressão.
- Git commit e push para `origin master`.
