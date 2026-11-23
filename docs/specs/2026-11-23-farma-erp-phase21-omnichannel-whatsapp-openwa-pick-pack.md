# Especificação Técnica — Fase 21
# FarmaCore ERP: Hub Omnichannel de Vendas, Atendimento WhatsApp (OpenWA Gateway) & Esteira de Pick-and-Pack Assistido

## 1. Visão Geral e Contexto
O varejo farmacêutico moderno exige canais digitais de conveniência integrados ao ecossistema da loja física. A **Fase 21** introduz o **Hub Omnichannel**, permitindo que a farmácia ofereça atendimento automatizado 24/7 via WhatsApp (através de gateway OpenWA / WPPConnect / Baileys) integrado ao catálogo com trava de Preço Máximo ao Consumidor (CMED - Fase 20), geração de pré-vendas (Fase 3), esteira de separação assistida (**Pick-and-Pack**) com bipagem de código de barras para prevenção de erros de dispensação, e despacho direto para a Tele-Entrega (Fase 15).

## 2. Requisitos Regulatórios & Boas Práticas Farmacêuticas
1. **RDC 44/2009 (ANVISA):** Venda remota de medicamentos por meio eletrônico exige conferência farmacêutica da receita (quando aplicável) e garantia de que o medicamento dispensado seja o exato prescrito.
2. **Prevenção de Erros de Dispensação (Pick-and-Pack Cego):** Nenhum pedido digital pode ser despachado sem a bipagem do código de barras EAN dos itens na esteira de separação, evitando troca de dosagens ou princípios ativos.
3. **Respeito à CMED (Lei 10.742/2003):** O bot de WhatsApp deve informar apenas preços válidos, respeitando os tetos PMC e as regras de precificação ativas da loja.

## 3. Arquitetura de Componentes
1. **OpenWaGatewayService:**
   - Adaptador desacoplado para integração com instâncias do OpenWA via REST / Webhooks.
   - Envio de mensagens de texto, listas interativas, imagens e botões.
   - Recepção e tratamento de webhooks (`onMessage`, `onStateChange`).
2. **OmnichannelBotService:**
   - Máquina de estados conversacional por número de telefone:
     - `IDLE`: Menu principal interativo.
     - `SEARCHING_PRODUCT`: Busca no catálogo de medicamentos e retorno de opções com preços.
     - `SENDING_PRESCRIPTION`: Recepção de imagem/PDF da receita médica com encaminhamento ao farmacêutico.
     - `TRACKING_DELIVERY`: Consulta do status do pedido no módulo de Tele-Entrega (Fase 15).
     - `HUMAN_ESCALATION`: Transbordo do atendimento para operador humano no balcão.
   - Conversão da conversa em Pedido Omnichannel (`omnichannel_orders`) e Pré-Venda (`pre_sales`).
3. **PickAndPackService:**
   - Gestão da esteira de pedidos (`NEW` -> `IN_SEPARATION` -> `CHECKED` -> `DISPATCHED`).
   - Bipagem item a item com validação do EAN esperado.
   - Notificação automática no WhatsApp do cliente ao concluir a separação e ao despachar com entregador.
4. **Interface React (`OmnichannelPickPackPage.tsx`):**
   - Aba 1: Esteira de Pick-and-Pack (Kanban/tabela de separação com leitor de código de barras).
   - Aba 2: Central de Atendimento WhatsApp (conversas, histórico de mensagens e resposta manual).
   - Aba 3: Configurações do Gateway OpenWA e Bot (servidor, API key, webhook e mensagens padrão).

## 4. Banco de Dados (Migration 020)
- `omnichannel_channels`: Configuração dos canais (WhatsApp OpenWA, E-commerce, etc.).
- `omnichannel_conversations`: Estado conversacional e contexto de cada contato.
- `omnichannel_messages`: Mensagens inbound e outbound.
- `omnichannel_orders`: Pedidos digitais gerados.
- `omnichannel_order_items`: Itens do pedido com contagem de conferência (picked_quantity).
