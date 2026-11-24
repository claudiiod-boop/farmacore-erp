# Especificação Técnica - Fase 28: Totem de Autoatendimento, Consulta de Preços & Pré-Venda Express

## 1. Visão Geral e Experiência do Cliente na Farmácia
A **Fase 28** implementa a interface e retaguarda de **Totens de Autoatendimento (Kiosks) e Terminais Busca-Preço Touchscreen** para drogarias:

1. **Terminal de Consulta de Preços (Busca-Preço Rápido):**
   - Leitura de código de barras (EAN-13) ou busca por nome/princípio ativo;
   - Exibição de Preço Balcão, Desconto do Programa de Fidelidade (Clube FarmaCore) e Preço Máximo ao Consumidor (PMC CMED);
   - Sugestão de medicamentos Genéricos ou Similares equivalentes (Intercambialidade RDC 58/2014);
   - Telemetria de consultas de preço para análise de demanda de clientes.

2. **Emissão de Senhas de Atendimento (Fila Inteligente):**
   - Categorias:
     - `NORMAL`: Atendimento geral de balcão;
     - `PREFERENCIAL`: Prioridade por lei (Idosos 60+, Gestantes, Lactantes, PCD - Lei 10.048/2000);
     - `RAPIDO`: Retirada de encomendas de entrega, compras WhatsApp e Farmácia Popular;
     - `CONSULTORIO`: Atendimentos e consultas clínicas farmacêuticas.
   - Emissão de ticket impresso em formato térmico com numeração diária sequencial e estimativa de espera.

3. **Pré-Venda Express (Self-Checkout Assistido):**
   - Navegação touch screen simplificada por categorias de produtos livres de prescrição (MIPs / OTC, Perfumaria, Higiene e Vitaminas);
   - Cesta de compras expressa no totem;
   - Identificação opcional do cliente por CPF para aplicação de descontos e pontuação no programa de fidelidade;
   - Emissão de Ticket de Pré-Venda com código de barras/código `#PV-EXPRESS-XXXX` para pagamento rápido no Caixa PDV.
   - **Regra Sanitária:** Bloqueio de produtos controlados (Portaria 344/98 e antimicrobianos) para venda direta no totem sem validação prévia de receita médica no balcão.

---

## 2. Modelagem de Dados (Migration 027)

### 2.1. Tabela `kiosk_terminals`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `terminal_code` TEXT NOT NULL UNIQUE -- Ex: TTM-01
- `name` TEXT NOT NULL -- Ex: Totem Entrada Principal
- `ip_address` TEXT
- `mode` TEXT NOT NULL DEFAULT 'HYBRID' CHECK (mode IN ('PRICE_CHECKER', 'SELF_PRE_SALE', 'QUEUE_TICKET', 'HYBRID'))
- `is_active` INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.2. Tabela `queue_tickets`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `kiosk_id` INTEGER REFERENCES kiosk_terminals(id) ON DELETE SET NULL
- `ticket_number` TEXT NOT NULL -- Ex: N-001, P-002, R-003, C-004
- `service_type` TEXT NOT NULL CHECK (service_type IN ('NORMAL', 'PREFERENCIAL', 'RAPIDO', 'CONSULTORIO'))
- `customer_name` TEXT
- `customer_cpf` TEXT
- `status` TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'ATTENDING', 'COMPLETED', 'CANCELLED'))
- `called_at` TEXT
- `completed_at` TEXT
- `counter_operator` TEXT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Tabela `kiosk_price_queries`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `kiosk_id` INTEGER REFERENCES kiosk_terminals(id) ON DELETE SET NULL
- `product_id` INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
- `customer_cpf` TEXT
- `queried_price` REAL NOT NULL
- `discount_applied` REAL NOT NULL DEFAULT 0.0
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

---

## 3. Serviços e Regras de Negócio (`KioskService`)
1. `queryProductPrice(eanOrTerm, customerCpf?, storeId?, kioskId?)`:
   - Busca produto por EAN ou nome.
   - Calcula preço normal e preço com desconto fidelidade (se CPF informado ou tabela promocional ativa).
   - Localiza genéricos e similares equivalentes com menor preço.
   - Registra auditoria em `kiosk_price_queries`.
2. `issueQueueTicket(storeId, serviceType, kioskId?, customerName?, customerCpf?)`:
   - Apura o próximo número sequencial da data atual para o tipo de serviço.
   - Prefixo: `N-` para Normal, `P-` para Preferencial, `R-` para Rápido, `C-` para Consultório.
   - Insere em `queue_tickets` com status `WAITING`.
   - Gera layout textual para impressão do bilhete em bobina térmica 58mm/80mm.
3. `listQueueTickets(storeId, status?)` e `callQueueTicket(ticketId, operatorName)`:
   - Gerenciamento da fila para exibição no painel de chamada de senhas do balcão.
4. `createExpressPreSale(input)`:
   - Valida se os itens selecionados não são de retenção obrigatória de receita (Portaria 344/98 e antimicrobianos).
   - Gera pré-venda com código `#PV-EXPRESS-XXXX` aproveitando o `pre_sales` existente.
   - Retorna o ticket formatado para impressão no totem.
5. `getKioskKpis(storeId?)`:
   - Consultas de preços no dia, senhas emitidas, pré-vendas geradas e tempo médio de espera.

---

## 4. Endpoints REST Fastify
- `GET /api/kiosk/price-check` - Consulta de preço rápida por EAN/Nome com cálculo de desconto fidelidade
- `POST /api/kiosk/queue/ticket` - Emite senha de atendimento com ticket térmico
- `GET /api/kiosk/queue/tickets` - Lista fila de senhas da loja
- `PATCH /api/kiosk/queue/tickets/:id/call` - Balconista chama a senha no painel
- `POST /api/kiosk/pre-sale` - Emite pré-venda expressa criada no totem
- `GET /api/kiosk/terminals` - Lista terminais cadastrados
- `POST /api/kiosk/terminals` - Registra novo terminal de autoatendimento
- `GET /api/kiosk/kpis` - Métricas de utilização dos totens

---

## 5. Interface React (`KioskPage.tsx`)
- Modo Totem Touchscreen com tipografia ampla e botões grandes:
  - **Tela 1: Menu Principal do Totem** (3 Ações: "Consultar Preço", "Retirar Senha", "Comprar Express").
  - **Tela 2: Busca-Preço Touch** (Digitação/Leitor de código de barras, exibição do preço em destaque, desconto fidelidade e botão para ver genéricos equivalentes mais baratos).
  - **Tela 3: Retirada de Senha** (Seleção de tipo: Atendimento Normal, Prioritário por Lei, Retirada Rápida, Consultório Farmacêutico; impressão do comprovante).
  - **Tela 4: Autoatendimento Express** (Grade visual de produtos OTC/Perfumaria, cesta de compras, tela de identificação por CPF e emissão do ticket de pré-venda térmica).
