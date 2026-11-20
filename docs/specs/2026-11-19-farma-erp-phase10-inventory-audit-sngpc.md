# FarmaCore ERP — Especificação Técnica da Fase 10
# Auditoria, Inventário Rotativo / Balanço com Contagem Cega & Ajuste Regulatório SNGPC

**Status:** APROVADO  
**Data:** 19 de Novembro de 2026  
**Autor:** Equipe de Arquitetura FarmaCore  
**Contexto:** Padrão ERP Farmacêutico Linx / InovaFarma / Trier & Portaria 344/98 Anvisa

---

## 1. Visão Geral e Objetivos do Módulo

A **Fase 10** do FarmaCore ERP implementa o ecossistema de governança patrimonial e auditoria de estoque da farmácia, integrando a conferência física cega por leitor de código de barras/coletor à conformidade regulatória estrita da Anvisa (SNGPC - Portaria 344/98 e RDC 20/2011).

O módulo é estruturado em cinco pilares fundamentais:

1. **Gestão de Sessões de Inventário (`inventory_sessions`):**
   - **Tipos de Inventário:**
     - `GERAL`: Balanço integral de todos os produtos cadastrados na filial ativa.
     - `ROTATIVO`: Inventário setorial por categoria mercadológica (`REFERENCIA`, `GENERICO`, `SIMILAR`, `PERFUMARIA`, `CORRELATOS_OUTROS`) ou por Curva ABC (ex: contagem cíclica dos itens da Classe A).
     - `CONTROLADOS_SNGPC`: Inventário estrito do armário de medicamentos controlados (Portaria 344/98 listas A1, A2, A3, B1, B2, C1, C2 e antimicrobianos).
   - **Ciclo de Estados:**
     - `OPEN`: Sessão aberta, equipe em contagem física.
     - `COUNTED`: Contagens finalizadas, aguardando análise de divergências e parecer farmacêutico/gerencial.
     - `APPLIED`: Ajustes efetivados no estoque físico dos lotes e movimentações regulatórias transmitidas/geradas para o SNGPC.
     - `CANCELLED`: Sessão cancelada sem impacto no estoque.

2. **Contagem Cega por Código de Barras / Coletor de Dados:**
   - O operador ou farmacêutico bipa o EAN do produto e insere lote, validade e quantidade contada.
   - **Contagem Cega:** O operador em campo **não vê o saldo esperado do sistema**, prevenindo contagens induzidas ou negligência com sobras/faltas.
   - Suporte a múltiplas contagens (1ª Contagem e Recontagem em caso de divergência).

3. **Apuração de Divergências & Motivos Regulatórios:**
   - Identificação automática por lote:
     - `SURPLUS` (Sobra): Quantidade física contada > Quantidade lógica no sistema.
     - `SHORTAGE` (Falta): Quantidade física contada < Quantidade lógica no sistema.
     - `EXACT` (Exato): Saldo físico idêntico ao lógico.
   - Exigência de motivo formal para cada divergência:
     - `AVARIA`: Produto quebrado, umedecido ou danificado.
     - `VENCIMENTO`: Produto vencido descartado/segregado.
     - `FURTO_EXTRAVIO`: Falta não justificada / perda por furto.
     - `ERRO_OPERACIONAL`: Inversão de lote em vendas ou entradas.
     - `QUEBRA_ARMAZENAMENTO`: Perda por temperatura ou acondicionamento.
     - `AJUSTE_INVENTARIO`: Acerto administrativo de balanço.
     - `SOBRA_NAO_IDENTIFICADA`: Excesso físico não justificado por nota.

4. **Ajuste Atômico de Estoque & Impacto no SNGPC:**
   - **Medicamentos Comuns:** Ajuste atômico imediato na tabela `batches` (`quantity = counted_quantity`), ou criação de lote no caso de sobras de lotes novos.
   - **Medicamentos Controlados (SNGPC):** 
     - Exigência do CRF e UF do Farmacêutico Responsável Técnico na homologação.
     - Geração automática de registro no Livro de Registro e histórico de perdas do SNGPC com motivo oficial Anvisa (1 = Vencimento, 2 = Avaria, 3 = Furto/Roubo, 4 = Coleta/Apreensão, 5 = Ajuste de Inventário).

5. **Métricas de Acurácia Patrimonial & Termo de Balanço:**
   - **Acurácia de Inventário (%):** $\frac{\text{Lotes Corretos}}{\text{Total de Lotes Auditados}} \times 100\%$.
   - **Impacto Financeiro:** Custo total das faltas, custo total das sobras e diferença líquida patrimonial em R$.
   - **Termo de Balanço e Auditoria:** Documento para impressão (80 colunas / A4) com sumário executivo, discriminação das divergências justificadas e campos de assinatura formal do Farmacêutico RT e do Gerente.

---

## 2. Modelagem do Banco de Dados (Migration 009)

### 2.1. Tabela `inventory_sessions`
```sql
CREATE TABLE IF NOT EXISTS inventory_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_code TEXT UNIQUE NOT NULL, -- Ex: 'INV-20261119-0001'
  store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  inventory_type TEXT NOT NULL,       -- 'GERAL', 'ROTATIVO', 'CONTROLADOS_SNGPC'
  category_filter TEXT,              -- 'REFERENCIA', 'GENERICO', 'SIMILAR', 'PERFUMARIA', 'CORRELATOS_OUTROS', etc.
  status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'COUNTED', 'APPLIED', 'CANCELLED'
  opened_by TEXT NOT NULL,
  applied_by TEXT,
  responsible_pharmacist_crf TEXT,   -- Obrigatório para tipo CONTROLADOS_SNGPC ou se houver ajuste de controlado
  responsible_pharmacist_uf TEXT,
  notes TEXT,
  
  -- Métricas calculadas na conclusão
  total_products_expected INTEGER NOT NULL DEFAULT 0,
  total_products_counted INTEGER NOT NULL DEFAULT 0,
  total_batches_expected INTEGER NOT NULL DEFAULT 0,
  total_batches_counted INTEGER NOT NULL DEFAULT 0,
  accuracy_rate REAL NOT NULL DEFAULT 100.0,
  total_surplus_cost REAL NOT NULL DEFAULT 0.0,
  total_shortage_cost REAL NOT NULL DEFAULT 0.0,
  net_financial_difference REAL NOT NULL DEFAULT 0.0,
  
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2. Tabela `inventory_items`
```sql
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  manufacturing_date TEXT NOT NULL,
  
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  counted_quantity INTEGER NOT NULL DEFAULT 0,
  recount_quantity INTEGER,
  difference_quantity INTEGER NOT NULL DEFAULT 0, -- counted_quantity - expected_quantity
  difference_status TEXT NOT NULL DEFAULT 'EXACT', -- 'EXACT', 'SURPLUS', 'SHORTAGE'
  
  unit_cost REAL NOT NULL DEFAULT 0.0,
  total_cost_difference REAL NOT NULL DEFAULT 0.0, -- difference_quantity * unit_cost
  
  adjustment_reason TEXT, -- 'AVARIA', 'VENCIMENTO', 'FURTO_EXTRAVIO', 'ERRO_OPERACIONAL', 'QUEBRA_ARMAZENAMENTO', 'AJUSTE_INVENTARIO', 'SOBRA_NAO_IDENTIFICADA'
  notes TEXT,
  sngpc_adjusted INTEGER NOT NULL DEFAULT 0, -- 1 se gerou movimentação regulatória no SNGPC
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_sessions_store_status ON inventory_sessions(store_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_session ON inventory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_product_batch ON inventory_items(product_id, batch_number);
```

---

## 3. Serviços e Regras de Negócio

### 3.1. `InventoryAuditService`
- **`createSession(input: CreateInventorySessionInput): InventorySessionWithItems`**
  - Valida se a loja está ativa.
  - Verifica se já existe outra sessão `OPEN` do mesmo tipo na loja (para evitar inventários concorrentes na mesma categoria).
  - Gera código sequencial único `INV-YYYYMMDD-XXXX`.
  - Captura o *snapshot* lógico do estoque: para cada produto/lote elegível ao tipo/categoria, insere uma linha em `inventory_items` com `expected_quantity = batches.quantity - batches.reserved_quantity`.
  - Retorna a sessão com os itens preparados para contagem.
- **`addCount(sessionId: number, countInput: AddCountInput): InventoryItem`**
  - Recebe bip do leitor: `ean` ou `productId`, `batchNumber`, `expirationDate`, `manufacturingDate` e `quantity`.
  - Atualiza ou insere o registro em `inventory_items` com `counted_quantity`.
  - Atualiza `difference_quantity = counted_quantity - expected_quantity`.
  - Atualiza `difference_status`: `EXACT` se 0, `SURPLUS` se > 0, `SHORTAGE` se < 0.
- **`recountItem(sessionId: number, itemId: number, recountQuantity: number): InventoryItem`**
  - Permite ao fiscal registrar uma 2ª contagem para dirimir dúvidas em itens com divergência relevante.
- **`finishCounting(sessionId: number): InventorySessionWithItems`**
  - Transição de estado de `OPEN` para `COUNTED`.
  - Consolida métricas: total de lotes corretos vs divergentes, taxa de acurácia patrimonial e impacto financeiro.
- **`applyAdjustments(sessionId: number, params: ApplyAdjustmentsParams): InventorySessionWithItems`**
  - Transição de estado de `COUNTED` para `APPLIED`.
  - Se houver produtos controlados com divergência, valida obrigatoriedade de `responsiblePharmacistCrf` e `responsiblePharmacistUf`.
  - Em transação atômica no SQLite:
    - Para cada item divergente:
      - Atualiza o lote físico em `batches`:
        - Se o lote existia: `UPDATE batches SET quantity = counted_quantity WHERE id = batch_id`.
        - Se for sobra de lote novo: cria novo registro em `batches`.
      - Se o produto for controlado (Portaria 344/98 / Antimicrobiano):
        - Insere movimentação no SNGPC com tipo `AJUSTE_INVENTARIO` ou `PERDA`, associada ao motivo regulatório da Anvisa e carimbando o CRF do RT.
        - Carimba `sngpc_adjusted = 1`.
  - Atualiza status para `APPLIED` e data de fechamento.
- **`cancelSession(sessionId: number, reason: string): InventorySessionWithItems`**
  - Cancela a sessão se estiver em `OPEN` ou `COUNTED`. Nenhum estoque é alterado.
- **`generateBalanceReport(sessionId: number): InventoryBalanceReport`**
  - Retorna relatório completo com dados da loja, estatísticas, acurácia, divergências e comprovante ESC/POS.

---

## 4. Endpoints da API REST (Fastify)

- `GET /api/inventory/sessions`: Lista sessões de inventário com filtros (`storeId`, `status`, `inventoryType`, `startDate`, `endDate`).
- `GET /api/inventory/sessions/:id`: Detalhes completos da sessão com seus itens e divergências.
- `POST /api/inventory/sessions`: Abre nova sessão de inventário (`GERAL`, `ROTATIVO`, `CONTROLADOS_SNGPC`).
- `POST /api/inventory/sessions/:id/count`: Registra contagem cega de lote (EAN, lote, validade, quantidade).
- `PUT /api/inventory/sessions/:id/items/:itemId/recount`: Registra recontagem de item.
- `POST /api/inventory/sessions/:id/finish-count`: Finaliza contagens físicas (OPEN ➔ COUNTED).
- `POST /api/inventory/sessions/:id/apply`: Homologa e aplica ajustes no estoque físico e SNGPC (COUNTED ➔ APPLIED).
- `POST /api/inventory/sessions/:id/cancel`: Cancela a sessão.
- `GET /api/inventory/sessions/:id/report`: Retorna relatório de balanço patrimonial e texto ESC/POS para impressão.

---

## 5. Interface com o Usuário (Frontend React)

1. **Acesso ao Posto de Inventário / Balanço:**
   - Adicionado no roteador de estações ou como aba dedicada em Compras/Estoque (`F3`) e atalho direto.
2. **Painel de Contagem Cega Rápida (`BlindCountingPanel`):**
   - Campo de entrada com foco contínuo para leitor de código de barras.
   - Modo "Bip-a-Bip" (a cada leitura do mesmo EAN/Lote, incrementa +1) ou modo "Digitação de Quantidade".
   - Totalmente cego: o atendente vê apenas o que já contou nesta sessão, nunca o estoque do sistema.
3. **Painel de Conciliação e Parecer Farmacêutico (`ReconciliationPanel`):**
   - Tabela comparativa (Esperado vs Contado vs Diferença) exibida apenas após finalização da contagem.
   - Destaque em verde (Exato), azul (Sobra) e vermelho (Falta).
   - Dropdown obrigatório de Motivo de Ajuste para cada item com divergência.
   - Seção de homologação do Responsável Técnico (CRF e UF) para medicamentos controlados.
4. **Modal do Termo de Balanço Impresso (`InventoryReportModal`):**
   - Comprovante de fechamento de inventário pronto para impressão térmica ou A4 com assinaturas.

---

## 6. Critérios de Aceite e Homologação

1. **Contagem Cega:** Nenhum endpoint de contagem ou tela de bip expõe a quantidade esperada durante o status `OPEN`.
2. **Atomicidade no Ajuste:** A aplicação de ajustes (`APPLIED`) altera simultaneamente `batches` e gera registros no SNGPC em transação única.
3. **Integridade SNGPC:** Qualquer divergência em controlados da Portaria 344/98 exige CRF do farmacêutico e gera rastreabilidade regulatória completa.
4. **Retrocompatibilidade:** 100% dos 823 testes anteriores devem permanecer verdes, sem quebras nas 9 fases anteriores.
