# FarmaCore ERP — Especificação Técnica da Fase 12
## Módulo: CRM Farmacêutico, Clube de Fidelidade, Cashback & Motor de Promoções Combinadas

---

### 1. Visão Geral e Contexto de Negócio

No varejo farmacêutico brasileiro competitivo (redes como RaiaDrogasil, Pague Menos, Panvel e drogarias associativistas como Farmácias Associadas e Redefarma), as ferramentas de CRM, Fidelidade e Motores de Promoções Combinadas são os principais motores de margem, retenção de clientes e ticket médio:

1. **Clube de Fidelidade & Cashback Próprio:**
   - Permite que a farmácia acumule um percentual configurável de cada compra em uma carteira digital vinculada ao CPF do paciente.
   - O saldo possui validade configurável (ex: 60 ou 90 dias) para estimular a recorrência na mesma drogaria.
   - Resgate direto no PDV como desconto financeiro abatido no ato da compra.

2. **Motor de Promoções Combinadas (Pricing Engine):**
   - **Leve Mais por Menos (Leve X Pague Y):** Clássico de higiene e beleza (ex: "Leve 3 Pague 2 Sabonetes Dove").
   - **Desconto Progressivo por Quantidade:** Escalonamento de descontos por faixas de volume no mesmo produto (ex: 1 un = R$ 15,00 cada; 2 un = R$ 13,00 cada; 3+ un = R$ 11,00 cada).
   - **Promoção Cruzada / Compre X Ganhe Desconto em Y (Combo):** Estímulo ao cross-selling (ex: Compre Fralda e ganhe 40% no Lenço Umedecido).
   - **Preço Especial do Clube da Drogaria:** Preço diferenciado exclusivo para clientes identificados pelo CPF no início do atendimento.
   - **Desconto de Aniversariante:** Percentual de desconto concedido no mês ou dia de aniversário do paciente.
   - Todas as promoções respeitam estritamente o teto CMED (Preço Máximo ao Consumidor).

3. **Adesão a Tratamento Contínuo & Alerta de Recompra Preditiva:**
   - Pacientes com doenças crônicas (hipertensão, diabetes, dislipidemia, uso de anticoncepcionais ou medicamentos controlados de uso prolongado) necessitam de reposição periódica.
   - O sistema calcula com precisão a data provável em que a caixa do medicamento terminará com base na posologia e quantidade de comprimidos.
   - Painel ativo de recompra preditiva alertando a equipe da farmácia 3 a 5 dias antes do término, viabilizando contato farmacêutico humanizado.

---

### 2. Arquitetura de Dados (Migration 011)

```sql
-- 1. Programas e Parâmetros de Fidelidade / Cashback
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  cashback_percent REAL NOT NULL DEFAULT 3.0 CHECK (cashback_percent >= 0 AND cashback_percent <= 100),
  validity_days INTEGER NOT NULL DEFAULT 90 CHECK (validity_days > 0),
  min_purchase_amount REAL NOT NULL DEFAULT 10.0 CHECK (min_purchase_amount >= 0),
  min_redeem_amount REAL NOT NULL DEFAULT 5.0 CHECK (min_redeem_amount >= 0),
  max_redeem_percent REAL NOT NULL DEFAULT 50.0 CHECK (max_redeem_percent > 0 AND max_redeem_percent <= 100),
  allow_with_promotions INTEGER NOT NULL DEFAULT 1 CHECK (allow_with_promotions IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Carteira de Fidelidade do Paciente (Vinculada ao Customer)
CREATE TABLE IF NOT EXISTS loyalty_wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  current_balance REAL NOT NULL DEFAULT 0.0 CHECK (current_balance >= 0),
  total_earned REAL NOT NULL DEFAULT 0.0 CHECK (total_earned >= 0),
  total_redeemed REAL NOT NULL DEFAULT 0.0 CHECK (total_redeemed >= 0),
  total_expired REAL NOT NULL DEFAULT 0.0 CHECK (total_expired >= 0),
  last_activity_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Extrato / Movimentações de Cashback
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_id INTEGER NOT NULL REFERENCES loyalty_wallets(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'EXPIRE', 'MANUAL_ADJUSTMENT')),
  amount REAL NOT NULL CHECK (amount > 0),
  balance_after REAL NOT NULL CHECK (balance_after >= 0),
  expires_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Motor de Campanhas e Promoções Combinadas
CREATE TABLE IF NOT EXISTS promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'TAKE_MORE_PAY_LESS',
    'PROGRESSIVE_DISCOUNT',
    'COMBO_CROSS_SELL',
    'CLUB_SPECIAL_PRICE',
    'BIRTHDAY_DISCOUNT'
  )),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  applies_to TEXT NOT NULL DEFAULT 'SPECIFIC_PRODUCTS' CHECK (applies_to IN ('ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORY')),
  target_category TEXT,
  conditions_json TEXT NOT NULL, -- JSON com tiers, produtos obrigatórios, descontos
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Vínculo de Produtos Específicos com a Promoção
CREATE TABLE IF NOT EXISTS promotion_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'TRIGGER' CHECK (role IN ('TRIGGER', 'REWARD', 'BOTH')),
  special_price REAL CHECK (special_price >= 0),
  discount_percent REAL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(promotion_id, product_id, role)
);

-- 6. Adesão a Tratamento Contínuo (Aviso de Recompra Preditiva)
CREATE TABLE IF NOT EXISTS patient_treatments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  daily_dose REAL NOT NULL DEFAULT 1.0 CHECK (daily_dose > 0),
  units_per_box INTEGER NOT NULL DEFAULT 30 CHECK (units_per_box > 0),
  boxes_purchased INTEGER NOT NULL DEFAULT 1 CHECK (boxes_purchased > 0),
  total_days_supply INTEGER NOT NULL CHECK (total_days_supply > 0),
  start_date TEXT NOT NULL,
  expected_refill_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONTACTED', 'REFILLED', 'DISCONTINUED')),
  last_contacted_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_wallet ON loyalty_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_refill ON patient_treatments(expected_refill_date, status);
CREATE INDEX IF NOT EXISTS idx_patient_treatments_customer ON patient_treatments(customer_id);
```

---

### 3. Serviços e Regras de Negócio

#### 3.1. `LoyaltyService` (`src/modules/crm/loyalty.service.ts`)
- **`getOrCreateWallet(customerId: number): LoyaltyWallet`**: Localiza ou cria a carteira do cliente com saldo zerado.
- **`calculateCashback(amount: number, storeId?: number): number`**: Aplica o percentual ativo do programa de fidelidade.
- **`creditCashback(saleId: number, customerId: number, saleAmount: number): LoyaltyTransaction`**: Credita saldo na carteira com data de expiração (ex: 90 dias) caso a venda atinja o valor mínimo.
- **`redeemCashback(customerId: number, saleAmount: number, requestedRedeem: number, saleId?: number): LoyaltyTransaction`**: Valida se o saldo é suficiente, se respeita o teto de resgate máximo (ex: até 50% do valor da venda) e debita atomicamente o saldo da carteira.
- **`expireOverdueCashback(): number`**: Job de expiração automática de créditos que ultrapassaram a data de validade sem utilização.

#### 3.2. `PromotionEngine` (`src/modules/crm/promotion-engine.service.ts`)
- **`evaluatePromotions(cartItems: CartItemInput[], customerId?: number, storeId?: number): PromotionEvaluationResult`**:
  - Avalia todas as promoções vigentes e ativas.
  - Para `'TAKE_MORE_PAY_LESS'`: se cliente comprou 3 unidades do produto X e a regra for Leve 3 Pague 2, aplica desconto de 100% sobre o menor valor unitário.
  - Para `'PROGRESSIVE_DISCOUNT'`: avalia a quantidade comprada na linha ou categoria e ajusta o preço unitário para a faixa correspondente (ex: 3 unidades = 15% de desconto em todas as 3).
  - Para `'COMBO_CROSS_SELL'`: se o carrinho contém o produto gatilho A e o produto bonificado B, concede o desconto configurado no produto B.
  - Para `'CLUB_SPECIAL_PRICE'`: se o cliente estiver identificado pelo CPF (cadastrado no Clube), aplica o preço promocional exclusivo.
  - Para `'BIRTHDAY_DISCOUNT'`: se o cliente fizer aniversário no mês corrente, aplica o percentual de desconto concedido pela drogaria.
  - Assegura que nenhum preço final fique abaixo de zero ou ultrapasse o Preço Máximo ao Consumidor (CMED).

#### 3.3. `TreatmentAdherenceService` (`src/modules/crm/treatment-adherence.service.ts`)
- **`registerTreatmentFromSale(saleId: number, customerId: number, items: SaleItemWithPosology[]): PatientTreatment[]`**:
  - Detecta se os itens vendidos possuem posologia ou são medicamentos de uso contínuo (tarjados ou com controle de tratamento).
  - Calcula a duração do suprimento: `daysSupply = (unitsPerBox * boxes) / dailyDose`.
  - Projeta a `expectedRefillDate = saleDate + daysSupply`.
- **`listUpcomingRefills(daysAhead: number = 5): UpcomingRefillItem[]`**:
  - Lista pacientes cujo tratamento deve terminar dentro do horizonte de dias solicitado (ex: próximos 5 dias).
  - Exibe nome do paciente, telefone, medicamento, posologia, data da última compra e data estimada de término.
- **`markAsContacted(treatmentId: number, notes?: string): void`**:
  - Atualiza o status para `CONTACTED`, registrando a data/hora e observações da intervenção farmacêutica.

---

### 4. Formatadores Térmicos ESC/POS & Rotas Fastify

- **Formatador Térmico:**
  - `formatCashbackStatement`: Extrato do Clube da Farmácia com saldo acumulado, saldo expirando em 30 dias e economia total do cliente.
  - `formatTreatmentRefillAlert`: Filipeta para o farmacêutico realizar contato de acompanhamento com o paciente.
- **Rotas Fastify (`/api/crm/*`):**
  - `/api/crm/loyalty/wallet/:customerId` (GET)
  - `/api/crm/loyalty/transactions/:customerId` (GET)
  - `/api/crm/loyalty/redeem` (POST)
  - `/api/crm/promotions` (GET, POST)
  - `/api/crm/promotions/:id` (GET, PUT, DELETE)
  - `/api/crm/promotions/evaluate` (POST)
  - `/api/crm/treatments` (GET, POST)
  - `/api/crm/treatments/upcoming` (GET)
  - `/api/crm/treatments/:id/contact` (POST)

---

### 5. Frontend React

- **Posto [F10] CRM, Fidelidade & Campanhas (`CrmPage.tsx`):**
  - Aba 1: *Clube & Carteiras de Cashback* (consulta por CPF, saldo disponível, barra de evolução, extrato de movimentações e ajuste manual).
  - Aba 2: *Promoções & Campanhas* (painel de regras ativas: Leve Mais Pague Menos, Desconto Progressivo, Combos, Preço Clube e criação de novas campanhas).
  - Aba 3: *Adesão a Tratamentos & Recompra Preditiva* (lista de pacientes com medicamento terminando nos próximos dias, alerta de posologia e botão de contato via WhatsApp / telefone).
- **Integração no Balcão e Caixa PDV:**
  - Badge no cliente "Clube da Drogaria" com saldo em reais de cashback.
  - No `PaymentModal`: opção de resgate com cálculo de saldo restante.
  - Notificação visual de promoções combinadas aplicadas no carrinho.
