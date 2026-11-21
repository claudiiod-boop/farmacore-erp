# FarmaCore ERP — Especificação Técnica da Fase 14
## Módulo: Central de Validades Preditiva (Painel 30/60/90 Dias), Recall Sanitário Anvisa & Baixa de Perdas/Avarias

---

### 1. Visão Geral e Contexto de Negócio

No varejo farmacêutico brasileiro, a gestão de validades, perdas operacionais e conformidade com a Vigilância Sanitária (Anvisa e VISAs municipais/estaduais) é um pilar vital de sustentabilidade financeira e responsabilidade civil/penal do farmacêutico responsável técnico (RT):

1. **Gestão Preditiva de Validades (Prevenção de Perdas):**
   - Medicamentos vencidos representam prejuízo direto de 100% do custo de aquisição e infração sanitária gravíssima se expostos em gôndola.
   - O sistema classifica o estoque em faixas de tempo até o vencimento:
     - **Vencidos:** Devem ser retirados imediatamente da área de vendas para a área de segregação/descarte.
     - **Crítico (<= 30 dias):** Risco iminente; requer ação imediata de queima promocional no balcão/PDV ou devolução.
     - **Alerta (31 a 60 dias):** Janela para negociação de troca com distribuidores ou aceleração de vendas.
     - **Atenção (61 a 90 dias):** Prazo limite padrão para a maioria das distribuidoras aceitarem devolução/troca.
     - **Seguro (> 90 dias):** Estoque saudável.
   - O sistema calcula o valor financeiro em risco a preço de custo e a preço de venda.

2. **Recall Sanitário Anvisa (Rastreabilidade Reversa de Pacientes):**
   - Quando a Anvisa publica uma Resolução RE interditando ou determinando o recolhimento compulsório de um lote (por desvio de qualidade, contaminação, falta de eficácia ou suspeita de falsificação - conforme RDC 658/2022 e RDC 55/2005):
     - **Bloqueio Automático:** O sistema bloqueia instantaneamente as vendas do lote em todas as frentes (Balcão, PDV, Tele-Entrega).
     - **Rastreabilidade Reversa de Pacientes:** O sistema varre as vendas passadas (vendas com CPF, pré-vendas com receita e tele-entregas) e identifica todos os pacientes que compraram unidades daquele lote específico, gerando lista de contato prioritário para aviso de recall e troca.
     - **Resolução de Recall:** Registro do destino dos medicamentos recolhidos (devolução ao fabricante ou incineração).

3. **Baixa Regulatória de Perdas, Avarias & Laudo de Descarte Sanitário:**
   - Registro formal de saída de estoque por motivos sanitários e operacionais:
     - `EXPIRED` (Medicamento Vencido)
     - `BROKEN_DAMAGED` (Quebra de Frasco / Avaria Física)
     - `RECALL_ANVISA` (Recolhimento Sanitário Anvisa)
     - `TEMPERATURE_EXCURSION` (Excursão de Temperatura em Geladeira / Termolábeis)
     - `THEFT_STOLEN` (Furto / Sinistro)
     - `OTHER` (Outras Avarias Justificadas)
   - **Laudo de Descarte / Termo de Incineração:** Geração de documento legal assinado pelo farmacêutico responsável (com CRF/UF) e dados da empresa credenciada de descarte de resíduos de serviços de saúde (RSS - RDC 306/2004 e Conama 358), com número de manifesto MTR para apresentação à fiscalização da Vigilância Sanitária.

---

### 2. Arquitetura de Dados (Migration 013)

```sql
-- 1. Resoluções de Recall Sanitário Anvisa
CREATE TABLE IF NOT EXISTS anvisa_recalls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resolution_number TEXT NOT NULL UNIQUE, -- Ex: RE 1.234/2026
  resolution_date TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Lotes e Produtos Afetados pelo Recall
CREATE TABLE IF NOT EXISTS anvisa_recall_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recall_id INTEGER NOT NULL REFERENCES anvisa_recalls(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  action_taken TEXT NOT NULL DEFAULT 'BLOCKED' CHECK (action_taken IN ('BLOCKED', 'RETURNED_TO_SUPPLIER', 'DESTROYED')),
  total_stock_blocked INTEGER NOT NULL DEFAULT 0 CHECK (total_stock_blocked >= 0),
  blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recall_id, product_id, batch_number)
);

-- 3. Baixas Formais por Perdas, Avarias e Vencimento
CREATE TABLE IF NOT EXISTS inventory_losses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loss_number TEXT NOT NULL UNIQUE, -- PER-YYYYMM-XXXX
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (reason IN (
    'EXPIRED',
    'BROKEN_DAMAGED',
    'RECALL_ANVISA',
    'TEMPERATURE_EXCURSION',
    'THEFT_STOLEN',
    'OTHER'
  )),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'DISPOSED')),
  total_cost_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_cost_amount >= 0),
  total_sale_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_sale_amount >= 0),
  responsible_pharmacist_name TEXT NOT NULL,
  pharmacist_crf TEXT NOT NULL,
  pharmacist_crf_uf TEXT NOT NULL,
  laudo_number TEXT,
  disposal_company_name TEXT,
  disposal_certificate_number TEXT,
  mtr_number TEXT, -- Manifesto de Transporte de Resíduos
  disposed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Itens da Baixa de Perdas
CREATE TABLE IF NOT EXISTS inventory_loss_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loss_id INTEGER NOT NULL REFERENCES inventory_losses(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  batch_number TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  total_cost REAL NOT NULL CHECK (total_cost >= 0),
  unit_sale_price REAL NOT NULL CHECK (unit_sale_price >= 0),
  total_sale_price REAL NOT NULL CHECK (total_sale_price >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_batches_expiry_qty ON batches(expiration_date, current_quantity);
CREATE INDEX IF NOT EXISTS idx_anvisa_recalls_status ON anvisa_recalls(status);
CREATE INDEX IF NOT EXISTS idx_anvisa_recall_items_batch ON anvisa_recall_items(batch_number, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_losses_store_status ON inventory_losses(store_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_loss_items_batch ON inventory_loss_items(batch_id);
```

---

### 3. Serviços e Regras de Negócio

#### 3.1. `ExpiryManagementService` (`src/modules/sanitary/expiry-management.service.ts`)
- **`getExpiryMatrix(storeId?: number, referenceDate?: string): ExpiryRiskMatrix`**:
  - Cruza lotes com `current_quantity > 0` e classifica em faixas de dias até a data de referência:
    - `EXPIRED` ($\text{dias} < 0$)
    - `RISK_30_DAYS` ($0 \le \text{dias} \le 30$)
    - `RISK_60_DAYS` ($31 \le \text{dias} \le 60$)
    - `RISK_90_DAYS` ($61 \le \text{dias} \le 90$)
    - `SAFE` ($\text{dias} > 90$)
  - Totaliza para cada faixa: quantidade de lotes, unidades em estoque, valor financeiro a preço de custo e a preço de venda.
- **`getExpiringBatches(filters: ExpiryFilters): { batches: ExpiringBatchItem[]; total: number }`**:
  - Retorna a lista detalhada e paginada de lotes com dados do produto, fabricante, EAN, quantidade, dias restantes e sugestão de ação (`DISPOSE`, `PROMOTION`, `RETURN_TO_SUPPLIER`, `NORMAL`).
- **`suggestActionForBatch(batch: BatchDetails, supplierReturnDays: number = 90): BatchActionSuggestion`**:
  - Se já vencido: `DISPOSE` (Retirar de venda imediatamente).
  - Se faltam mais de 90 dias e há estoque alto: `RETURN_TO_SUPPLIER` (Devolução para distribuidora antes do prazo fatal).
  - Se faltam entre 1 e 60 dias: `PROMOTION` (Desconto promocional de queima).

#### 3.2. `AnvisaRecallService` (`src/modules/sanitary/anvisa-recall.service.ts`)
- **`registerRecall(input: RegisterRecallInput): AnvisaRecallWithItems`**:
  - Valida unicidade do número da resolução Anvisa (`resolutionNumber`).
  - Em transação atômica SQLite:
    - Insere em `anvisa_recalls` com status `ACTIVE`.
    - Para cada produto e lote informado:
      - Localiza os lotes correspondentes em `batches`.
      - Atualiza o lote para `is_blocked = 1` (bloqueio cautelar imediato).
      - Insere o registro em `anvisa_recall_items` com a quantidade bloqueada apurada.
- **`getAffectedPatients(recallId: number): AffectedPatientItem[]`**:
  - Rastreabilidade reversa obrigatória pela legislação sanitária:
    - Busca em `sale_items` unidos a `sales`, `customers` e `pre_sales` todos os pacientes que compraram o lote recolhido.
    - Retorna nome do paciente, CPF, telefone, data da compra, cupom fiscal/venda ID, quantidade adquirida e se possuía receita médica retida.
- **`resolveRecall(recallId: number, params: ResolveRecallParams): AnvisaRecallWithItems`**:
  - Atualiza o status do recall para `COMPLETED` com registro das ações finais (lotes devolvidos ao fabricante ou encaminhados para descarte/incineração).

#### 3.3. `InventoryLossService` (`src/modules/sanitary/inventory-loss.service.ts`)
- **`createLossDraft(input: CreateLossDraftInput): InventoryLossWithItems`**:
  - Valida dados do farmacêutico responsável técnico (Nome, CRF, UF).
  - Valida motivo da perda (`EXPIRED`, `BROKEN_DAMAGED`, `RECALL_ANVISA`, etc.).
  - Calcula valores totais de custo e de venda.
  - Insere com status inicial `DRAFT`.
- **`approveAndDeductStock(lossId: number, params: ApproveLossParams): InventoryLossWithItems`**:
  - Em transação atômica SQLite:
    - Valida que a baixa está em `DRAFT`.
    - Para cada item da baixa:
      - Valida que o lote possui saldo suficiente (`current_quantity >= qty`).
      - Deduz atomicamente o estoque do lote (`batches.current_quantity -= qty`).
      - Deduz atomicamente o estoque geral do produto (`products.current_stock -= qty`).
    - Gera numeração sequencial padronizada `PER-YYYYMM-XXXX`.
    - Atualiza `status = 'APPROVED'`, carimbo de aprovação e farmacêutico.
- **`recordDisposalCertificate(lossId: number, params: DisposalCertificateParams): InventoryLossWithItems`**:
  - Registra os dados da empresa de tratamento/incineração de resíduos sanitários (Razão Social, Certificado/CDF, Manifesto MTR) e atualiza para `DISPOSED`.

---

### 4. Formatadores Térmicos ESC/POS & Rotas Fastify

- **Formatadores Térmicos (48 colunas):**
  - `formatExpiryAuditSlip`: Lista de conferência de validades para o conferente checar nas prateleiras da farmácia (produtos por corredor/categoria com data de validade e quantidade esperada).
  - `formatRecallPatientReport`: Relatório emergencial de rastreabilidade reversa com lista de pacientes para aviso de recolhimento sanitário.
  - `formatDisposalLaudoSlip`: Termo / Laudo Oficial de Baixa e Descarte Sanitário para apresentação à Vigilância Sanitária (VISA) com dados da farmácia, farmacêutico responsável (CRF), relação de medicamentos inutilizados e assinatura.
- **Rotas Fastify (`/api/sanitary/*`):**
  - `/api/sanitary/expiry/matrix` (GET)
  - `/api/sanitary/expiry/batches` (GET)
  - `/api/sanitary/expiry/audit-slip` (GET)
  - `/api/sanitary/recalls` (GET, POST)
  - `/api/sanitary/recalls/:id` (GET, PUT)
  - `/api/sanitary/recalls/:id/patients` (GET)
  - `/api/sanitary/recalls/:id/resolve` (POST)
  - `/api/sanitary/losses` (GET, POST)
  - `/api/sanitary/losses/:id` (GET)
  - `/api/sanitary/losses/:id/approve` (POST)
  - `/api/sanitary/losses/:id/disposal` (POST)
  - `/api/sanitary/losses/:id/laudo` (GET)

---

### 5. Frontend React: Posto [F12] Validades & Vigilância Sanitária

- **Navegação & Atalho [F12]:**
  - Atalho global `F12` capturado e botão na topbar (`data-testid="topbar-sanitary-button"`).
  - Renderiza `<SanitaryPage />` quando `isSanitary` for ativo.
- **`SanitaryPage.tsx` com 3 Abas Operacionais:**
  1. *Painel de Validades Preditiva (Matriz 30/60/90 Dias):* Cards com montante em risco a preço de custo e venda; tabela dinâmica com badges coloridos por criticidade; botão "Imprimir Lista de Conferência Física"; botão de ação rápida "Baixar por Vencimento".
  2. *Recall Sanitário Anvisa:* Lista de resoluções ativas; botão "Cadastrar Resolução Anvisa"; painel de lotes bloqueados com quantidade retida; modal de "Pacientes Afetados (Rastreabilidade Reversa)" com botão direto para WhatsApp e telefone.
  3. *Baixas por Perdas, Avarias & Descarte (Laudo VISA):* Central de baixas com histórico; botão "Nova Baixa de Estoque" com motivo (Vencido, Avaria, Recall, etc.); modal de conferência de itens com lote; aprovação atômica com baixa no estoque; botão "Registrar Certificado de Incineração" e visualização/impressão do Laudo Oficial para fiscalização VISA.
