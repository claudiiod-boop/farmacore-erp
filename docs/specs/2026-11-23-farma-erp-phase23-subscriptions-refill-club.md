# Especificação Técnica - Fase 23: Clube de Assinatura & Reposição Recorrente de Medicamentos

## 1. Visão Geral e Objetivos de Negócio
No varejo farmacêutico de alta performance, a retenção de pacientes com patologias crônicas (hipertensão, diabetes, dislipidemias, saúde mental e tireoide) representa mais de 45% do faturamento estável de uma farmácia.

A Fase 23 implementa o **Clube FarmaCore de Assinatura & Reposição Recorrente (Autoship / Refill Club)**, automatizando:
1. **Gestão de Contratos de Assinatura:** Ciclos periódicos (ex: 30, 60 ou 90 dias), desconto programado de assinante e escolha de canal (Entrega em Domicílio ou Retirada na Loja).
2. **Compliance Sanitário e RDC 44/2009:** Validação rigorosa de prescrições médicas para medicamentos de uso contínuo sob controle especial (Portaria 344/98 e Antimicrobianos RDC 20/2011), impedindo a geração automática de pré-vendas caso a receita esteja vencida ou ausente.
3. **Motor Automatizado de Faturamento e Pré-Venda:** Varredura diária de assinaturas ativas com faturamento agendado, gerando automaticamente a Pré-Venda no PDV (`pre_sales`) e despachando para a esteira de Pick-and-Pack / Tele-Entrega (`delivery_orders`).
4. **Alerta Preditivo e Notificação Omnichannel:** Disparo de avisos de preparação de pedido e lembrete de renovação de receita via WhatsApp.

---

## 2. Modelagem de Dados (Migration 022)

### 2.1. Tabela `subscriptions`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `customer_id` INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `plan_name` TEXT NOT NULL (ex: "Clube Hipertensão & Diabetes", "Uso Contínuo Mensal")
- `interval_days` INTEGER NOT NULL DEFAULT 30 CHECK (interval_days IN (15, 30, 45, 60, 90))
- `preferred_delivery_day` INTEGER NOT NULL DEFAULT 5 CHECK (preferred_delivery_day BETWEEN 1 AND 31)
- `delivery_mode` TEXT NOT NULL DEFAULT 'DELIVERY' CHECK (delivery_mode IN ('DELIVERY', 'STORE_PICKUP'))
- `delivery_address` TEXT (Endereço completo para remessa)
- `delivery_neighborhood` TEXT
- `delivery_city` TEXT
- `payment_method` TEXT NOT NULL DEFAULT 'PIX_RECURRING' CHECK (payment_method IN ('PIX_RECURRING', 'CREDIT_CARD_TOKEN', 'CONVENIO_CREDIARIO', 'CASH_ON_DELIVERY'))
- `payment_card_token` TEXT (Token de cartão criptografado para débito recorrente)
- `discount_percentage` REAL NOT NULL DEFAULT 5.0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
- `status` TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED'))
- `next_billing_date` TEXT NOT NULL (YYYY-MM-DD)
- `last_billing_date` TEXT
- `notes` TEXT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
- `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.2. Tabela `subscription_items`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `subscription_id` INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE
- `product_id` INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE
- `quantity` REAL NOT NULL DEFAULT 1.0 CHECK (quantity > 0)
- `unit_price` REAL NOT NULL CHECK (unit_price >= 0)
- `discount_percentage` REAL NOT NULL DEFAULT 0.0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
- `requires_prescription` INTEGER NOT NULL DEFAULT 0 CHECK (requires_prescription IN (0, 1))
- `prescription_doctor_crm` TEXT
- `prescription_doctor_uf` TEXT
- `prescription_expiry_date` TEXT (YYYY-MM-DD)
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Tabela `subscription_cycles`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `subscription_id` INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE
- `cycle_number` INTEGER NOT NULL
- `scheduled_date` TEXT NOT NULL (YYYY-MM-DD)
- `processed_at` TEXT
- `status` TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'PRESCRIPTION_PENDING', 'FAILED', 'CANCELLED', 'SKIPPED'))
- `pre_sale_id` INTEGER REFERENCES pre_sales(id) ON DELETE SET NULL
- `delivery_order_id` INTEGER REFERENCES delivery_orders(id) ON DELETE SET NULL
- `total_amount` REAL NOT NULL DEFAULT 0.0
- `failure_reason` TEXT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

---

## 3. Regras de Negócio e Serviços

### 3.1. `SubscriptionService`
1. `createSubscription(input)`:
   - Valida se o cliente existe e está ativo.
   - Valida os produtos, preços e receitas para itens controlados.
   - Calcula a primeira data de cobrança (`next_billing_date`) com base no dia preferido (`preferred_delivery_day`).
2. `updateSubscriptionStatus(id, newStatus)`:
   - Permite transições: `ACTIVE` <-> `PAUSED`, `ACTIVE` -> `CANCELLED`.
3. `addSubscriptionItem(subscriptionId, item)` / `removeSubscriptionItem(itemId)`:
   - Adiciona ou remove itens da cesta recorrente recalculando valores.
4. `renewPrescription(itemId, prescriptionData)`:
   - Atualiza CRM, UF e nova data de validade da receita médica de uso contínuo.
5. `processScheduledRefills(currentDate, storeId?)`:
   - Busca todas as assinaturas `ACTIVE` com `next_billing_date <= currentDate`.
   - Para cada assinatura:
     - Verifica se há itens com `requires_prescription = 1`. Se houver algum com `prescription_expiry_date < currentDate`, marca o ciclo como `PRESCRIPTION_PENDING`, registra log e não gera pré-venda até a regularização.
     - Se todas as receitas estiverem válidas:
       - Cria atômica e programada a `pre_sales` com status `'PENDING'` e itens correspondentes aplicando o desconto de assinante.
       - Se `delivery_mode = 'DELIVERY'`, cria a `delivery_orders` com status `'PENDING_PICK'` (Pronto para Conferência Cega / Pick-and-Pack).
       - Registra o ciclo em `subscription_cycles` como `'PROCESSED'`.
       - Atualiza o `last_billing_date = currentDate` e avança o `next_billing_date` em `interval_days` dias.
6. `getSubscriptionKpis()`:
   - Retorna métricas essenciais: MRR (Receita Recorrente Mensal), Assinaturas Ativas, Pausadas, Ciclos Processados no Mês, Receitas a Vencer nos Próximos 15 dias.

---

## 4. Endpoints REST Fastify
- `GET /api/subscriptions` - Listagem de assinaturas com filtros (status, customer_id, store_id).
- `POST /api/subscriptions` - Criação de assinatura com itens.
- `GET /api/subscriptions/:id` - Detalhes completos da assinatura (itens e histórico de ciclos).
- `PATCH /api/subscriptions/:id/status` - Atualização de status (`ACTIVE`, `PAUSED`, `CANCELLED`).
- `POST /api/subscriptions/:id/items` - Inclusão de item na assinatura.
- `DELETE /api/subscriptions/items/:itemId` - Remoção de item.
- `PATCH /api/subscriptions/items/:itemId/prescription` - Renovação de receita médica.
- `POST /api/subscriptions/process-refills` - Execução manual ou disparada pelo cron dos ciclos agendados.
- `GET /api/subscriptions/kpis` - Dashboard de indicadores de recorrência.
- `GET /api/subscriptions/expiring-prescriptions` - Relatório de receitas vencidas ou a vencer em até 15 dias.

---

## 5. Interface React (`SubscriptionsPage.tsx`)
1. **Cards de KPIs no Topo:** Total de Assinaturas Ativas, MRR Previsto, Entregas Recorrentes no Mês, Receitas Pendentes de Renovação.
2. **Aba 1: Assinaturas:** Tabela de assinaturas, modal para cadastrar novo cliente/medicamentos, botão de pausa/reativação.
3. **Aba 2: Esteira de Ciclos & Execução Diária:** Visualização dos ciclos do dia, botão "Processar Reposições Agendadas", rastreio da pré-venda gerada e link de entrega.
4. **Aba 3: Gestão de Receitas & Uso Contínuo:** Lista de pacientes com receitas vencidas ou prestes a vencer, com botão rápido para registrar nova data de receita médica informada pelo médico/paciente.
