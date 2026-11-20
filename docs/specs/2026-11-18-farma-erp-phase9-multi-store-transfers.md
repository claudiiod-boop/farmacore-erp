# FarmaCore ERP — Especificação Técnica da Fase 9
# Gestão Multi-Loja & Transferência entre Filiais (Matriz / Rede de Drogarias)

**Status:** APROVADO  
**Data:** 18 de Novembro de 2026  
**Autor:** Equipe de Arquitetura FarmaCore  
**Contexto:** Padrão ERP Farmacêutico Linx / InovaFarma / Trier

---

## 1. Visão Geral e Objetivos do Módulo

A **Fase 9** do FarmaCore ERP transforma o sistema em uma plataforma corporativa multi-empresa preparada para redes de drogarias (Matriz e Filiais). O módulo é fundamentado em quatro pilares:

1. **Gestão de Lojas e Unidades de Negócio (`stores`):**
   - Suporte a Matriz (`is_headquarters = 1`) e múltiplas Filiais (`is_headquarters = 0`).
   - Cadastro fiscal e societário completo: Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual, Endereço completo com Código IBGE do Município, UF, Telefone, Email e Regime Tributário.
   - Inicialização com Loja Matriz Padrão (Loja 1) para garantir 100% de retrocompatibilidade com todas as fases anteriores.

2. **Segregação Física de Estoque por Loja & Rastreabilidade de Lotes:**
   - Adição do vínculo `store_id` na tabela `batches` (estoque por lote/filial).
   - Migração atômica de dados garantindo que todos os lotes legados pertençam à Loja 1.
   - Vendas (`sales`), pré-vendas (`pre_sales`) e sessões de caixa (`cash_sessions`) passam a respeitar o contexto da loja ativa.
   - Aplicação estrita do algoritmo FEFO (First Expired, First Out) de forma isolada por filial.

3. **Consulta de Estoque em Rede (Multi-Store Global Inventory Lookup):**
   - Visibilidade em tempo real do saldo de qualquer medicamento em todas as unidades da rede.
   - Exibição de: Loja, Saldo Físico, Saldo Reservado, Saldo Disponível para Venda, Endereço, Cidade e Telefone de contato.
   - Integração direta no Balcão (`CounterPage`) e no PDV (`PosPage`), permitindo salvar vendas indicando ao cliente a filial mais próxima ou solicitando transferência imediata.

4. **Transferências de Mercadorias entre Filiais (Inter-Store Transfers):**
   - Fluxo completo de estados: `DRAFT` (Rascunho) -> `REQUESTED` (Solicitado) -> `IN_TRANSIT` (Separado e despachado com baixa no estoque de origem) -> `RECEIVED` (Conferido e incorporado atomicamente no estoque de destino com novos lotes) ou `CANCELLED` (Cancelado com estorno automático de estoque).
   - Suporte ao Romaneio de Transferência (comprovante impresso com dados de transporte, lotes, quantidades e assinaturas).
   - Suporte à emissão fiscal de transferência: NF-e modelo 55 com CFOP 5.152 (estadual) ou 6.152 (interestadual), integrando ao motor fiscal.

---

## 2. Modelagem do Banco de Dados (Migration 008)

### 2.1. Tabela `stores` (Cadastro de Lojas / Filiais)
```sql
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, -- Ex: 'LJ01', 'MATRIZ', 'FILIAL-02'
  name TEXT NOT NULL,        -- Nome Fantasia (Ex: 'FarmaCore Matriz Centro')
  company_name TEXT NOT NULL,-- Razão Social (Ex: 'Drogaria FarmaCore Ltda')
  cnpj TEXT UNIQUE NOT NULL,
  ie TEXT NOT NULL,          -- Inscrição Estadual
  is_headquarters INTEGER NOT NULL DEFAULT 0, -- 1 = Matriz, 0 = Filial
  phone TEXT,
  email TEXT,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,       -- UF (2 letras)
  zip_code TEXT NOT NULL,    -- CEP
  ibge_code TEXT NOT NULL,   -- Código IBGE 7 dígitos do município
  tax_regime TEXT NOT NULL DEFAULT 'SIMPLES_NACIONAL', -- 'SIMPLES_NACIONAL' ou 'LUCRO_PRESUMIDO' ou 'LUCRO_REAL'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2. Alteração de Tabelas Existentes para Vínculo com `stores`
```sql
-- Adição de store_id em batches com retrocompatibilidade
ALTER TABLE batches ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;

-- Adição de store_id em pre_sales
ALTER TABLE pre_sales ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;

-- Adição de store_id em sales
ALTER TABLE sales ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;

-- Adição de store_id em cash_sessions
ALTER TABLE cash_sessions ADD COLUMN store_id INTEGER NOT NULL DEFAULT 1 REFERENCES stores(id) ON DELETE RESTRICT;

-- Índices de performance para busca multi-loja
CREATE INDEX IF NOT EXISTS idx_batches_store_product ON batches(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pre_sales_store_status ON pre_sales(store_id, status);
```

### 2.3. Tabela `transfers` (Ordens de Transferência entre Lojas)
```sql
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_number TEXT UNIQUE NOT NULL, -- Ex: 'TRF-20261118-0001'
  source_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  target_store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'REQUESTED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'
  requested_by TEXT NOT NULL,           -- Nome do solicitante/operador
  dispatched_by TEXT,                   -- Nome do responsável pelo despacho
  received_by TEXT,                     -- Nome do responsável pelo recebimento
  carrier_name TEXT,                    -- Nome da transportadora / motorista
  tracking_code TEXT,                   -- Placa do veículo ou código de rastreio
  notes TEXT,
  
  -- Fiscal e NF-e de transferência (Mod. 55)
  nfe_key TEXT,                         -- Chave de 44 dígitos da NF-e mod. 55 emitida
  nfe_protocol TEXT,                    -- Protocolo de autorização SEFAZ
  cfop TEXT NOT NULL DEFAULT '5152',    -- 5152 interna, 6152 interestadual
  
  dispatched_at TEXT,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK (source_store_id <> target_store_id)
);
```

### 2.4. Tabela `transfer_items` (Itens Transferidos e Lotes)
```sql
CREATE TABLE IF NOT EXISTS transfer_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  source_batch_id INTEGER REFERENCES batches(id) ON DELETE RESTRICT, -- Lote físico na origem
  batch_number TEXT NOT NULL,
  expiration_date TEXT NOT NULL,
  manufacturing_date TEXT NOT NULL,
  requested_quantity INTEGER NOT NULL,
  shipped_quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost REAL NOT NULL DEFAULT 0.0,
  total_cost REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfers_source_status ON transfers(source_store_id, status);
CREATE INDEX IF NOT EXISTS idx_transfers_target_status ON transfers(target_store_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON transfer_items(transfer_id);
```

---

## 3. Serviços e Regras de Negócio

### 3.1. `StoreService` (Gestão de Lojas & Consulta em Rede)
- **`listStores(filter?: { activeOnly?: boolean }): Store[]`**
  - Retorna todas as lojas cadastradas com resumo de endereço e identificação de matriz.
- **`getStoreById(id: number): Store`**
  - Retorna detalhes completos da loja solicitada.
- **`createStore(data: CreateStoreInput): Store`**
  - Valida CNPJ único, formato de código e campos obrigatórios.
  - Garante que apenas uma loja pode ser Matriz (`is_headquarters = 1`) por rede.
- **`updateStore(id: number, data: UpdateStoreInput): Store`**
  - Atualiza dados cadastrais e fiscais da filial.
- **`getNetworkProductStock(productId: number): NetworkStockItem[]`**
  - Executa query otimizada em `batches` agrupada por `store_id`.
  - Retorna para cada loja da rede:
    - Identificação da loja (`storeId`, `storeName`, `storeCity`, `storePhone`).
    - Quantidade física total (`totalQuantity`).
    - Quantidade reservada (`reservedQuantity`).
    - Quantidade disponível imediata (`availableQuantity = totalQuantity - reservedQuantity`).
    - Data de validade mais próxima de expiração na loja (`earliestExpiry`).

### 3.2. `TransferService` (Controle Atômico de Transferência)
- **`createTransfer(input: CreateTransferInput): Transfer`**
  - Valida lojas de origem e destino (não podem ser a mesma loja).
  - Gera numeração sequencial única `TRF-YYYYMMDD-XXXX`.
  - Registra itens com status `DRAFT` ou `REQUESTED`.
- **`dispatchTransfer(transferId: number, dispatchedBy: string, carrierInfo?: CarrierInfo): Transfer`**
  - Transição de estado para `IN_TRANSIT`.
  - Executa algoritmo FEFO no estoque da loja de origem para cada item transferido.
  - Deduz fisicamente a quantidade de `batches` da loja de origem.
  - Atualiza `shipped_quantity` e carimba `dispatched_at` e `dispatched_by`.
- **`receiveTransfer(transferId: number, receivedBy: string, itemsConfirmed?: ReceiveItemInput[]): Transfer`**
  - Transição de estado de `IN_TRANSIT` para `RECEIVED`.
  - Para cada item conferido:
    - Localiza ou cria o registro correspondente em `batches` com o `target_store_id`.
    - Preserva rigorosamente `batch_number`, `expiration_date`, `manufacturing_date` e rastreabilidade SNGPC.
    - Incrementa o saldo do lote na loja de destino.
  - Atualiza `received_quantity` e carimba `received_at` e `received_by`.
- **`cancelTransfer(transferId: number, reason: string): Transfer`**
  - Se a transferência estava em `IN_TRANSIT`, estorna atomicamente a quantidade enviada de volta aos lotes da loja de origem.
  - Altera status para `CANCELLED`.
- **`generateTransferSlip(transferId: number): string`**
  - Emite o Romaneio de Transferência formatado para impressão térmica/documental (80 colunas / A4).
  - Inclui cabeçalho de Origem e Destino, tabela de itens/lotes/validade, instruções de transporte e termos de recebimento com assinaturas.

### 3.3. Integração Fiscal de Transferência (`FiscalService`)
- Método `emitTransferNfe(transferId: number): Promise<FiscalInvoice>`:
  - Gera XML de NF-e modelo 55 (Nota Fiscal Grande Eletrônica).
  - Natureza da Operação: "TRANSFERÊNCIA DE MERCADORIA".
  - CFOP 5.152 (se `source.state == target.state`) ou 6.152 (se `source.state != target.state`).
  - Emitente: Dados da Loja de Origem.
  - Destinatário: Dados da Loja de Destino.
  - Itens com valor unitário de custo (`unit_cost`) ou PMC/PF regulatório.
  - Grava a chave de acesso `nfe_key` e protocolo na tabela `transfers`.

---

## 4. Endpoints da API REST (Fastify)

### 4.1. Módulo de Lojas (`/api/stores`)
- `GET /api/stores`: Lista todas as filiais da rede.
- `GET /api/stores/:id`: Detalhes de uma filial.
- `POST /api/stores`: Cadastrar nova filial/matriz.
- `PUT /api/stores/:id`: Atualizar filial.
- `GET /api/stores/network-stock/:productId`: Consulta de disponibilidade do produto em todas as lojas da rede.

### 4.2. Módulo de Transferências (`/api/transfers`)
- `GET /api/transfers`: Lista transferências (filtros por status, origem, destino, período).
- `GET /api/transfers/:id`: Detalhes de uma ordem de transferência com seus itens e lotes.
- `POST /api/transfers`: Cria nova transferência (Rascunho ou Solicitada).
- `POST /api/transfers/:id/dispatch`: Despachar transferência (baixa estoque origem -> IN_TRANSIT).
- `POST /api/transfers/:id/receive`: Receber transferência (entrada estoque destino -> RECEIVED).
- `POST /api/transfers/:id/cancel`: Cancelar transferência (estorno de estoque).
- `GET /api/transfers/:id/slip`: Gerar Romaneio de Transferência para impressão.
- `POST /api/transfers/:id/emit-nfe`: Emitir NF-e mod. 55 de transferência na SEFAZ.

---

## 5. Interface com o Usuário (Frontend React)

1. **Global Store Selector (Topbar):**
   - No topo do sistema, um seletor dropdown elegante permite alternar a filial ativa de operação (ex: "Loja 01 - Matriz Centro", "Loja 02 - Filial Bairro Sul").
   - Persistido no `localStorage` e distribuído via `StoreContext`.
   - Todas as requisições de Balcão e PDV enviam o header `X-Store-Id: <id>` ou query param.

2. **Modal de Consulta de Estoque em Rede no Balcão (`NetworkStockModal`):**
   - No `CounterPage` (Balcão de Atendimento), ao buscar um produto ou clicar em "Ver em outras lojas", abre-se um modal limpo listando todas as filiais da rede que possuem o produto em estoque.
   - Mostra: Nome da Filial, Quantidade Disponível, Telefone para contato e botão rápido de "Solicitar Transferência".

3. **Página de Gestão de Filiais e Transferências (`MultiStorePage`):**
   - **Aba "Lojas e Filiais":** Cards com resumo de cada filial (Matriz/Filial, CNPJ, Cidade, Status Ativo) e botão para cadastrar nova unidade.
   - **Aba "Transferências":** Tabela com badges de status (`DRAFT`, `REQUESTED`, `IN_TRANSIT`, `RECEIVED`, `CANCELLED`), filtro por data e ações de Despachar, Receber, Visualizar Romaneio e Emitir NF-e.
   - **Modal de Nova Transferência:** Seleção da filial de origem, filial de destino, inclusão de produtos com auto-complete e quantidade requisitada.
   - **Modal de Romaneio Impresso:** Visualização do comprovante pronto para impressão ou download.

---

## 6. Critérios de Aceite e Homologação
1. **Migration 008:** Executada com sucesso sem quebrar dados existentes; todos os lotes legados recebem `store_id = 1`.
2. **Isolamento de Estoque:** Ao vender na Loja 1, o estoque da Loja 2 permanece intocado.
3. **Atomicidade da Transferência:**
   - Ao despachar, o estoque da Loja de Origem diminui imediatamente.
   - Durante `IN_TRANSIT`, o estoque não aparece disponível nem na origem nem no destino.
   - Ao receber na Loja de Destino, os lotes são criados/incrementados com exata correspondência de validade e fabricante.
   - Ao cancelar em trânsito, o saldo é integralmente devolvido à origem.
4. **Consulta em Rede:** Retorna saldos consolidados e disponíveis com 0 latência perceptível.
5. **Regras Fiscais e CFOP:** Emissão de transferência com CFOP 5.152 (estadual) ou 6.152 (interestadual).
6. **Suíte de Testes:** 100% dos testes anteriores continuam passando + novos testes com cobertura completa.
