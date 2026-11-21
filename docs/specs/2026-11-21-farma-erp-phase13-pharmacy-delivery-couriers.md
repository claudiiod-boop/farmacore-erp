# FarmaCore ERP — Especificação Técnica da Fase 13
## Módulo: Delivery Farmacêutico, Tele-Entrega & Gestão de Motoboys com Acerto no Caixa

---

### 1. Visão Geral e Contexto de Negócio

No varejo farmacêutico brasileiro (redes como RaiaDrogasil, Pague Menos, Panvel e farmácias independentes associativistas), a Tele-Entrega / Delivery Farmacêutico é um canal crítico de faturamento e conveniência para os pacientes:

1. **Recepção e Separação Ágil de Pedidos (Tele-Entrega & Canais Digitais):**
   - Recepção rápida de pedidos originados por WhatsApp, telefone, balcão ou canais digitais.
   - Registro de dados do cliente, endereço completo de entrega, ponto de referência, forma de pagamento no destino (Dinheiro com troco solicitado, Maquininha Cartão de Débito/Crédito, PIX na entrega).
   - Separação e conferência rápida (*Picking & Packing*): validação dos medicamentos, lotes e validades antes do empacotamento.

2. **Roteirização, Despacho & Gestão de Entregadores (Motoboys):**
   - Agrupamento de pedidos prontos em um **Romaneio de Despacho** para um entregador.
   - Emissão de filipeta de pacote (para colar na sacola) e **Romaneio de Entrega Térmico (48 colunas)** com instruções de trajeto, valores a receber e troco calculado que o motoboy deve portar.
   - Tabela de taxas de entrega flexíveis por bairro/zona da cidade, com tempo estimado e política de frete grátis por valor mínimo de compra.
   - Rastreamento do ciclo de vida do pedido:
     `RECEIVED` (Recebido) $\to$ `PREPARING` (Em Separação) $\to$ `READY_FOR_PICKUP` (Pronto para Despacho) $\to$ `DISPATCHED` (Em Rota de Entrega) $\to$ `DELIVERED` (Entregue com Sucesso) ou `RETURNED` (Retornou / Não Atendido).

3. **Acerto de Contas do Entregador no Caixa PDV:**
   - Ao retornar à farmácia, o motoboy realiza o acerto de contas com o operador do caixa da loja:
     - Conferência dos pedidos entregues e dos pedidos devolvidos/retornados.
     - Baixa financeira dos valores arrecadados pelo motoboy por forma de pagamento (Dinheiro, Cartão na maquininha portátil ou PIX).
     - O dinheiro físico recebido pelo motoboy é integrado formalmente na gaveta da sessão de caixa aberta (`cash_movements` com `type = 'SUPPLY'` e motivo `ACERTO_DELIVERY`), garantindo que o Fechamento Cego de Caixa reflita o montante real apurado.
     - Apuração de comissões ou diárias devidas ao entregador por corrida realizada, com emissão do recibo térmico de acerto.

---

### 2. Arquitetura de Dados (Migration 012)

```sql
-- 1. Zonas e Bairros de Entrega
CREATE TABLE IF NOT EXISTS delivery_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'SP',
  delivery_fee REAL NOT NULL DEFAULT 5.0 CHECK (delivery_fee >= 0),
  estimated_minutes INTEGER NOT NULL DEFAULT 40 CHECK (estimated_minutes > 0),
  free_shipping_threshold REAL CHECK (free_shipping_threshold >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Entregadores / Motoboys
CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'MOTO' CHECK (vehicle_type IN ('MOTO', 'BIKE', 'CAR', 'WALK')),
  vehicle_plate TEXT,
  cnh TEXT,
  commission_per_delivery REAL NOT NULL DEFAULT 3.0 CHECK (commission_per_delivery >= 0),
  daily_allowance REAL NOT NULL DEFAULT 0.0 CHECK (daily_allowance >= 0),
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ON_DELIVERY', 'INACTIVE')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Pedidos de Tele-Entrega / Delivery
CREATE TABLE IF NOT EXISTS delivery_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE, -- DEL-YYYYMM-XXXX
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_cpf TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'SP',
  zip_code TEXT,
  reference_point TEXT,
  subtotal_amount REAL NOT NULL CHECK (subtotal_amount >= 0),
  delivery_fee REAL NOT NULL DEFAULT 0.0 CHECK (delivery_fee >= 0),
  discount_amount REAL NOT NULL DEFAULT 0.0 CHECK (discount_amount >= 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'CONVENIO', 'CREDIARIO')),
  change_for REAL CHECK (change_for >= 0),
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN (
    'RECEIVED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'DISPATCHED',
    'DELIVERED',
    'RETURNED',
    'CANCELLED'
  )),
  courier_id INTEGER REFERENCES couriers(id) ON DELETE SET NULL,
  dispatch_id INTEGER REFERENCES delivery_dispatches(id) ON DELETE SET NULL,
  pre_sale_id INTEGER REFERENCES pre_sales(id) ON DELETE SET NULL,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  cancellation_reason TEXT,
  notes TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dispatched_at TEXT,
  delivered_at TEXT,
  returned_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Itens do Pedido de Tele-Entrega
CREATE TABLE IF NOT EXISTS delivery_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_order_id INTEGER NOT NULL REFERENCES delivery_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  total_price REAL NOT NULL CHECK (total_price >= 0),
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  batch_number TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Romaneios de Despacho & Acertos de Contas no Caixa
CREATE TABLE IF NOT EXISTS delivery_dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispatch_number TEXT NOT NULL UNIQUE, -- ROM-YYYYMM-XXXX
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE RESTRICT,
  cash_session_id INTEGER REFERENCES cash_sessions(id) ON DELETE SET NULL,
  total_orders INTEGER NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  total_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_amount >= 0),
  total_change_provided REAL NOT NULL DEFAULT 0.0 CHECK (total_change_provided >= 0),
  collected_cash REAL NOT NULL DEFAULT 0.0 CHECK (collected_cash >= 0),
  collected_card REAL NOT NULL DEFAULT 0.0 CHECK (collected_card >= 0),
  collected_pix REAL NOT NULL DEFAULT 0.0 CHECK (collected_pix >= 0),
  total_commission REAL NOT NULL DEFAULT 0.0 CHECK (total_commission >= 0),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SETTLED', 'CANCELLED')),
  operator_name TEXT,
  notes TEXT,
  dispatched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON delivery_orders(status, store_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_customer ON delivery_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_courier ON delivery_orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_dispatch ON delivery_orders(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_delivery_dispatches_courier ON delivery_dispatches(courier_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_neighborhood ON delivery_zones(neighborhood, city);
```

---

### 3. Serviços e Regras de Negócio

#### 3.1. `DeliveryOrderService` (`src/modules/delivery/delivery-order.service.ts`)
- **`createDeliveryOrder(input: CreateDeliveryOrderInput): DeliveryOrder`**:
  - Gera numeração sequencial `DEL-YYYYMM-XXXX`.
  - Calcula a taxa de entrega automaticamente com base no bairro informado (`delivery_zones`) ou aplica taxa informada.
  - Se `subtotalAmount >= zone.freeShippingThreshold`, zera a taxa de entrega (`delivery_fee = 0`).
  - Valida troco: se `payment_method === 'DINHEIRO'`, `change_for` deve ser `>= total_amount`.
  - Insere o pedido com status inicial `RECEIVED` e seus itens com dados de lote.
- **`updateOrderStatus(id: number, targetStatus: DeliveryOrderStatus, options?: { courierId?: number; cancellationReason?: string }): DeliveryOrder`**:
  - Máquina de estados estrita:
    - `RECEIVED` $\to$ `PREPARING`
    - `PREPARING` $\to$ `READY_FOR_PICKUP`
    - `READY_FOR_PICKUP` $\to$ `DISPATCHED` (requer `courierId` ou vínculo com romaneio)
    - `DISPATCHED` $\to$ `DELIVERED` ou `RETURNED`
    - Qualquer status prévio pode ir para `CANCELLED` (com justificativa obrigatória).
  - Atualiza carimbos temporais (`dispatched_at`, `delivered_at`, `returned_at`).
- **`listDeliveryOrders(filters?: DeliveryOrderFilters): { orders: DeliveryOrder[]; total: number }`**:
  - Filtro por `status`, `storeId`, `courierId`, `dateRange` e busca por nome/telefone/número.

#### 3.2. `CourierManagementService` (`src/modules/delivery/courier.service.ts`)
- **`createCourier(input: CreateCourierInput): Courier`**:
  - Validação de CPF único, CNH e placa do veículo se aplicável.
  - Define status inicial `AVAILABLE`.
- **`listCouriers(filters?: { storeId?: number; activeOnly?: boolean; status?: CourierStatus }): Courier[]`**:
  - Lista de entregadores com status em tempo real.
- **`updateCourier(id: number, input: UpdateCourierInput): Courier`**:
  - Atualização cadastral, taxas de comissão e status (`AVAILABLE`, `ON_DELIVERY`, `INACTIVE`).

#### 3.3. `DeliverySettlementService` (`src/modules/delivery/delivery-settlement.service.ts`)
- **`createDispatch(storeId: number, courierId: number, orderIds: number[]): DeliveryDispatchWithOrders`**:
  - Agrupa pedidos no status `READY_FOR_PICKUP`.
  - Gera número sequencial `ROM-YYYYMM-XXXX`.
  - Atualiza atomicamente os pedidos para `DISPATCHED`, vincula `dispatch_id = dispatch.id` e `courier_id = courierId`.
  - Atualiza status do entregador para `ON_DELIVERY`.
  - Totaliza valores a cobrar e troco que o motoboy precisa levar.
- **`settleDispatch(dispatchId: number, params: SettleDispatchParams): SettlementResult`**:
  - Executado em transação atômica do SQLite:
    - Valida que o romaneio está em `OPEN`.
    - Confere os pedidos entregues (`DELIVERED`) e pedidos não entregues (`RETURNED`).
    - Totaliza por forma de pagamento: Dinheiro, Cartão e PIX.
    - Se houver recebimento em `DINHEIRO` e for fornecido `cashSessionId`, insere movimentação formal de suprimento na sessão de caixa:
      - `cash_movements` com `type = 'SUPPLY'`, `amount = totalCashCollected`, `reason = 'Acerto de Tele-Entrega: Romaneio ' || dispatch_number || ' - Motoboy ' || courier.name`.
      - Incrementa `cash_sessions.current_cash`.
    - Calcula o total de comissão do motoboy (`totalDelivered * courier.commission_per_delivery + courier.dailyAllowance`).
    - Atualiza o romaneio para `SETTLED`, `settled_at = CURRENT_TIMESTAMP`, `operator_name`.
    - Atualiza status do motoboy de volta para `AVAILABLE`.
    - Retorna `SettlementResult` com resumo financeiro e comprovante térmico formatado.

---

### 4. Formatadores Térmicos ESC/POS & Rotas Fastify

- **Formatadores Térmicos (48 colunas):**
  - `formatDeliveryDispatchSlip`: Romaneio de Entrega do Motoboy com lista de clientes, endereços, pontos de referência, telefone, forma de cobrança, troco a devolver e canhoto para assinatura.
  - `formatDeliveryOrderSlip`: Etiqueta/Filipeta de Pacote para colar na sacola com itens conferidos, paciente e valor.
  - `formatCourierSettlementReceipt`: Recibo de Acerto de Contas com resumo financeiro entregador vs. caixa da drogaria.
- **Rotas Fastify (`/api/delivery/*`):**
  - `/api/delivery/orders` (GET, POST)
  - `/api/delivery/orders/:id` (GET, PUT)
  - `/api/delivery/orders/:id/status` (PATCH)
  - `/api/delivery/orders/:id/slip` (GET)
  - `/api/delivery/couriers` (GET, POST, GET /:id, PUT /:id)
  - `/api/delivery/zones` (GET, POST, PUT /:id, DELETE /:id)
  - `/api/delivery/dispatches` (POST, GET, GET /:id)
  - `/api/delivery/dispatches/:id/slip` (GET)
  - `/api/delivery/dispatches/:id/settle` (POST)

---

### 5. Frontend React: Posto [F11] Delivery & Tele-Entrega

- **Navegação & Atalho [F11]:**
  - Tecla `F11` e botão no topbar (`data-testid="topbar-delivery-button"`).
  - Renderiza `<DeliveryPage />` quando `isDelivery` for ativo.
- **`DeliveryPage.tsx` com 4 Abas Operacionais:**
  1. *Central de Pedidos (Kanban de Entregas):* Colunas interativas (`Recebidos`, `Em Separação`, `Pronto p/ Entrega`, `Em Rota`, `Entregues`); botão para `Novo Pedido Tele-Entrega` com busca de cliente por CPF e cálculo automático de taxa pelo bairro; botão de avançar etapa e visualização de etiqueta.
  2. *Roteirização & Despacho de Motoboys:* Seleção múltipla de pedidos prontos, seleção do motoboy disponível, cálculo de troco necessário, botão "Despachar & Imprimir Romaneio".
  3. *Acerto de Contas no Caixa:* Listagem de romaneios em rota; conferência dos pedidos pagos e devolvidos; confirmação dos valores apurados (Dinheiro/Cartão/PIX); registro automático na gaveta do caixa aberta e impressão do recibo de acerto.
  4. *Gestão de Entregadores & Zonas:* Cadastro e status dos motoboys (Disponível, Em Entrega, Inativo); tabela de bairros atendidos com taxa e prazo estimado.
