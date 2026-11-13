# FarmaCore ERP & PDV — Especificação Técnica da Fase 5
## Entrada de Mercadorias (Importador XML de NF-e) & Módulo Regulatório SNGPC (Anvisa)

**Data:** 12 de Novembro de 2026  
**Status:** Em Revisão / Proposta  
**Contexto:** Evolução do FarmaCore ERP após a conclusão do Core de Balcão (Fase 1 e 2), Frente de Caixa/PDV Híbrido (Fase 3) e Motor Fiscal Autônomo NFC-e (Fase 4). Implementação da **Abordagem 1: Pipeline Integrado Nativo (Padrão InovaFarma)** para recepção automatizada de compras e escrituração sanitária da Anvisa.

---

## 1. Visão Geral & Objetivos

A **Fase 5** fecha o ciclo operacional do FarmaCore ERP, conectando a cadeia de suprimentos farmacêutica (distribuidoras) ao controle de estoque e à conformidade regulatória perante a **Anvisa (Agência Nacional de Vigilância Sanitária)**:

1. **Importação Automatizada de NF-e (Modelo 55 - Layout SEFAZ 4.00):**
   - Leitura de XMLs emitidos por distribuidoras farmacêuticas (ex: SantaCruz, Profarma, Panpharma, Gam).
   - Extração automática de cabeçalho, dados do emitente (CNPJ, Razão Social, IE) e itens faturados.
   - Extração do bloco de rastreabilidade de medicamentos `<med>`: Registro MS (`cProdANVISA`), Lote (`nLote`), Quantidade do lote (`qLote`), Data de Fabricação (`dFab`), Data de Validade (`dVal`) e Preço Máximo ao Consumidor (`vPMC`).
   - Mapeamento De-Para inteligente: vinculação automática por código de barras EAN-13. Se o produto não existir no cadastro, criação automática no catálogo mantendo integridade com os NCMs e tributos fiscais.
   - Alimentação atômica do estoque com criação dos lotes correspondentes e controle de validade (FEFO).
   - Validação da Tabela CMED: alerta impeditivo caso o preço de venda cadastrado ou sugerido ultrapasse o PMC registrado na nota da distribuidora.

2. **Módulo Regulatório SNGPC (Portaria 344/98 e RDC 20/2011):**
   - Sistema Nacional de Gerenciamento de Produtos Controlados da Anvisa.
   - **Movimentações de Entrada:** Alimentadas automaticamente a partir da importação do XML da NF-e para produtos classificados como controlados (`controlType !== 'ISENTO'`).
   - **Movimentações de Saída (Dispensação):** Alimentadas automaticamente a partir das vendas finalizadas no caixa que possuam dados de receita médica retida (CRM, UF, tipo de receita, paciente e comprador).
   - **Livro de Registro Específico de Medicamentos Controlados:** Geração digital dos termos de abertura, encerramento e páginas do livro de receituário conforme exigido pela vigilância sanitária local (VISA).
   - **Exportador do XML Semanal SNGPC:** Geração canônica do arquivo XML no padrão XSD oficial da Anvisa (`mensagemSNGPC`), contendo o cabeçalho do estabelecimento, responsável técnico (CRF) e os blocos de `<entradaMedicamentos>` e `<saidaMedicamentoVendaAoConsumidor>`.

3. **Interface de Retaguarda & Navegação Integrada:**
   - Adição de navegação global no topo da aplicação: `Balcão [F1]`, `Caixa [F2]`, `Entrada de XML [F3]`, `SNGPC Anvisa [F4]`.
   - Tela de **Entrada de Compras**: Dropzone/upload de arquivo XML, painel de conciliação de itens, conferência física de lotes, validação de margens/preços e histórico de notas fiscais de entrada.
   - Tela do **Módulo SNGPC**: Extrato de movimentações sanitárias, visualizador do livro de receituário e gerador do arquivo semanal de transmissão com validação de consistência.

---

## 2. Modelagem do Banco de Dados (Migração `004_purchases_sngpc.sql`)

```sql
-- Migration 004: Purchases & SNGPC Regulatory Module

-- 1. Cabeçalho das Notas Fiscais de Entrada (Compras)
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  access_key TEXT UNIQUE NOT NULL, -- 44 dígitos da NF-e
  invoice_number INTEGER NOT NULL,
  invoice_series INTEGER NOT NULL,
  issue_date TEXT NOT NULL,
  supplier_cnpj TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_ie TEXT,
  total_invoice_amount REAL NOT NULL,
  total_products_amount REAL NOT NULL,
  total_icms_st REAL NOT NULL DEFAULT 0,
  xml_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_key ON purchase_invoices(access_key);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_cnpj);

-- 2. Itens das Notas Fiscais de Entrada
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
  item_index INTEGER NOT NULL,
  supplier_product_code TEXT NOT NULL,
  ean TEXT NOT NULL,
  product_name TEXT NOT NULL,
  ncm TEXT NOT NULL,
  cfop TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost REAL NOT NULL,
  total_cost REAL NOT NULL,
  batch_number TEXT,
  expiration_date TEXT,
  manufacturing_date TEXT,
  anvisa_registration TEXT,
  pmc REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice ON purchase_invoice_items(purchase_invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_product ON purchase_invoice_items(product_id);

-- 3. Livro e Movimentações Sanitárias do SNGPC
CREATE TABLE IF NOT EXISTS sngpc_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('ENTRADA', 'SAIDA_VENDA', 'PERDA')),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('PURCHASE_INVOICE', 'SALE', 'INVENTORY_ADJUSTMENT')),
  reference_id INTEGER NOT NULL,
  movement_date TEXT NOT NULL,
  ms_registration TEXT NOT NULL,
  prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
  is_transmitted INTEGER NOT NULL DEFAULT 0,
  transmission_id INTEGER REFERENCES sngpc_transmissions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sngpc_movements_prod_batch ON sngpc_movements(product_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_sngpc_movements_transmitted ON sngpc_movements(is_transmitted);
CREATE INDEX IF NOT EXISTS idx_sngpc_movements_date ON sngpc_movements(movement_date);

-- 4. Arquivos e Lotes de Transmissão Semanal SNGPC
CREATE TABLE IF NOT EXISTS sngpc_transmissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  pharmacist_name TEXT NOT NULL,
  pharmacist_cpf TEXT NOT NULL,
  pharmacist_crf TEXT NOT NULL,
  pharmacist_crf_uf TEXT NOT NULL,
  xml_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'GERADO' CHECK (status IN ('GERADO', 'TRANSMITIDO', 'CONFIRMADO', 'REJEITADO')),
  hash_xml TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Extensão de Prescrições para Notificação SNGPC
ALTER TABLE prescriptions ADD COLUMN notification_number TEXT;
ALTER TABLE prescriptions ADD COLUMN buyer_doc_type TEXT DEFAULT '1'; -- 1=CPF
```

---

## 3. Arquitetura de Módulos Backend

```
src/
├── database/
│   └── migrations/
│       └── 004_purchases_sngpc.sql
├── modules/
│   ├── purchases/
│   │   ├── types.ts                    # Interfaces da NF-e de compra e reconciliação
│   │   ├── nfe-parser.ts               # Parser XML canônico de NF-e 4.00 (<NFe>, <med>, etc.)
│   │   └── purchase.service.ts         # Orquestrador de compras, criação de produtos/lotes e integração
│   └── sngpc/
│       ├── types.ts                    # Interfaces do SNGPC, receituários e movimentações
│       ├── sngpc.service.ts            # Gestão de movimentações sanitárias e livro de receituário
│       └── sngpc-xml-builder.ts        # Gerador do arquivo XML oficial da Anvisa (mensagemSNGPC)
```

### 3.1 Parser de NF-e (`src/modules/purchases/nfe-parser.ts`)
- Suporta arquivos `.xml` brutos de NF-e (Layout 4.00, Modelo 55), tanto com tag raiz `<nfeProc>` quanto `<NFe>`.
- Extrai dados da chave de acesso (`infNFe Id="NFe..."`), número, série e data de emissão.
- Extrai emitente da distribuidora (`<emit>` com CNPJ, xNome, IE).
- Mapeia cada `<det>`:
  - `<prod>`: `cProd`, `cEAN`, `xProd`, `NCM`, `CFOP`, `uCom`, `qCom`, `vUnCom`, `vProd`.
  - `<med>`: `<cProdANVISA>`, `<nLote>`, `<qLote>`, `<dFab>`, `<dVal>`, `<vPMC>`.
  - `<imposto>`: `vICMSST`, `vIPI`.
- Normaliza valores monetários e datas no formato ISO (`YYYY-MM-DD`).

### 3.2 Serviço de Compras (`src/modules/purchases/purchase.service.ts`)
- `previewNfeXml(xmlString: string): Promise<PurchasePreviewResult>`:
  - Parse da NF-e sem persistência no banco.
  - Compara EANs com produtos existentes.
  - Identifica produtos não cadastrados (sugerindo cadastro automático).
  - Extrai lotes, validades e PMC da tag `<med>`.
  - Verifica se o preço de venda atual ou sugerido excede o PMC da nota, retornando aviso preventivo (`cmedWarning: boolean`).
- `importNfeXml(xmlString: string, options?: PurchaseImportOptions): Promise<PurchaseImportResult>`:
  - Valida se a chave de acesso já foi importada anteriormente (`PURCHASE_INVOICE_ALREADY_IMPORTED`).
  - Para cada item da nota:
    - Busca o produto no catálogo pelo `ean`.
    - Se o produto não for encontrado e `autoRegisterProducts` for verdadeiro: cadastra o produto no catálogo com nome, NCM, registro MS e PMC extraídos da nota, adotando a classificação sanitária informada (ou `'SEM_TARJA'` / `'ISENTO'` se não especificada).
    - Aplica política do teto CMED: se o preço de venda for superior ao PMC, ajusta automaticamente para o teto (`price = Math.min(price, pmc)`), garantindo conformidade legal sem travar a recepção física das mercadorias.
    - Cria o novo lote na tabela `batches` com o número do lote (`nLote`), quantidade (`qLote`), data de fabricação (`dFab`) e data de validade (`dVal`).
    - Se o produto for controlado ou antibiótico (`controlType !== 'ISENTO'`), registra a entrada sanitária correspondente no `SngpcService`.
  - Persiste a nota fiscal de compra e seus itens transacionalmente com `SAVEPOINT`.
- `getInvoices(): PurchaseInvoiceSummary[]`
- `getInvoiceById(id: number): PurchaseInvoiceDetails | null`

### 3.3 Serviço SNGPC & Livro de Receituário (`src/modules/sngpc/sngpc.service.ts`)
- Registra movimentações de Entrada (vinculadas a compras) e de Saída (vinculadas a vendas finalizadas no caixa com prescrição médica).
- `getMovements(filter: SngpcMovementFilter)`: Consulta movimentações filtrando por data, tipo (`ENTRADA`/`SAIDA_VENDA`), produto ou lote.
- `getLivroRegistro(filter: { startDate: string; endDate: string; controlType?: string })`: Gera a estrutura para impressão do Livro de Registro Específico (Portaria 344/98), consolidando entradas, saídas, perdas e saldo final por substância.
- `generateWeeklyXml(params: SngpcTransmissionParams)`: Gera o arquivo oficial `mensagemSNGPC.xml` para transmissão à Anvisa, cobrindo o intervalo semanal de movimentações não transmitidas.

### 3.4 Gerador de XML SNGPC (`src/modules/sngpc/sngpc-xml-builder.ts`)
- Constrói o XML conforme o XSD oficial do SNGPC v2.0 da Anvisa:
  - `<mensagemSNGPC xmlns="urn:sngpc-schema">`
  - `<cabecalho>`: `<cnpjEmissor>`, `<cpfTransmissor>`, `<dataInicio>`, `<dataFim>`.
  - `<corpo>`:
    - `<medicamentos>`:
      - `<entradaMedicamentos>`: `<notaFiscalEndosso>`, `<dataNotaFiscal>`, `<cnpjOrigem>`, `<medicamentoEntrada>` (`<registroMSMedicamento>`, `<numeroLoteMedicamento>`, `<quantidadeMedicamento>`).
      - `<saidaMedicamentoVendaAoConsumidor>`: `<tipoReceituarioMedicamento>`, `<numeroNotificacaoReceita>`, `<dataPrescricaoMedicamento>`, `<prescritorMedicamento>` (`<nomePrescritor>`, `<numeroRegistroProfissional>`, `<conselhoProfissional>`, `<ufConselho>`), `<paciente>`, `<comprador>`, `<medicamentoVenda>` (`<registroMSMedicamento>`, `<numeroLoteMedicamento>`, `<quantidadeMedicamento>`).
- Calcula o hash SHA-1 do arquivo para conferência de integridade.

---

## 4. Endpoints REST da API Fastify (`src/api/routes.ts`)

- `POST /api/purchases/preview-xml`: Recebe `{ xmlContent: string }`. Executa parse sem efeitos colaterais (dry-run), concilia EANs com o catálogo, extrai dados de lote/validade `<med>`, detecta divergências de PMC da CMED e retorna o resumo para conferência na tela.
- `POST /api/purchases/import-xml`: Recebe `{ xmlContent: string, autoRegisterProducts?: boolean, itemClassifications?: Record<string, { stripe: string; controlType: string }> }`. Efetiva a importação atômica, cadastra produtos novos com as classificações informadas, cria lotes no estoque, ajusta preços ao teto PMC se necessário e registra entradas no SNGPC para medicamentos controlados.
- `GET /api/purchases/invoices`: Lista notas fiscais de compras importadas.
- `GET /api/purchases/invoices/:id`: Retorna detalhes da nota com itens e lotes criados.
- `GET /api/sngpc/movements`: Retorna movimentações sanitárias (entradas/saídas).
- `GET /api/sngpc/livro`: Retorna os dados consolidados do Livro de Registro de Controlados.
- `POST /api/sngpc/generate-xml`: Recebe `{ startDate, endDate, pharmacistName, pharmacistCpf, pharmacistCrf, pharmacistCrfUf }`. Gera e armazena o XML semanal oficial para envio à Anvisa.
- `GET /api/sngpc/transmissions`: Histórico de transmissões/arquivos XML gerados.
- `GET /api/sngpc/transmissions/:id/xml`: Download do arquivo XML da Anvisa (`Content-Type: application/xml`).

---

## 5. Interface de Frontend (React / Tailwind)

1. **Barra de Navegação Global (`App.tsx`):**
   - Abas acessíveis por atalho ou clique:
     - `Balcão [F1]`
     - `Caixa [F2]`
     - `Entrada de XML [F3]`
     - `SNGPC & Livro [F4]`
2. **Tela de Entrada de Mercadorias (`PurchasesPage.tsx`):**
   - Dropzone para arrastar ou selecionar arquivos `.xml` de NF-e.
   - Modal de Pré-Conferência:
     - Exibe cabeçalho da nota (Distribuidora, CNPJ, Valor Total, Data).
     - Grade com itens: status de cruzamento (Produto existente ou Novo cadastro), Lote extraído, Validade, Qtd faturada, Custo unitário e PMC informado na nota.
     - Botão *"Confirmar Entrada e Alimentar Estoque"*.
   - Histórico das últimas notas importadas com pesquisa por número ou distribuidora.
3. **Tela do Módulo SNGPC & Livro de Controlados (`SngpcPage.tsx`):**
   - Filtros de período e tipo de receita (Receita B1 Azul, C1 Branca 2 Vias, Antimicrobianos).
   - Extrato visual de movimentações sanitárias com indicador de conformidade.
   - Visualizador formatado para impressão do **Livro de Registro Específico (Portaria 344/98)**.
   - Painel de Transmissão Semanal: formulário com dados do farmacêutico responsável (Nome, CRF e UF), botão para gerar o XML semanal oficial e botão de download do XML pronto para upload no portal da Anvisa.

---

## 6. Critérios de Aceitação & Verificação TDD

1. **Parser de NF-e:** Lê XMLs Modelo 55 com e sem `<nfeProc>`, extraindo corretamente as tags do grupo `<med>`.
2. **Entrada de Estoque & CMED:** Importação cria lotes atômicos com validade e respeita estritamente o teto PMC da CMED.
3. **Escrituração SNGPC:**
   - Compras de controlados geram registros de entrada no SNGPC.
   - Vendas de balcão com receita retida geram registros de saída sanitária com CRM/UF e dados do paciente/comprador.
4. **Validação do XML da Anvisa:** XML gerado obedece ao schema XSD oficial `mensagemSNGPC` da Anvisa.
5. **Navegação Global e Ergonomia:** Atalhos rápidos de teclado funcionam perfeitamente para alternar entre Balcão, Caixa, Compras e SNGPC.
6. **Suíte Completa:** 100% dos testes unitários e de integração passando, sem regressão nas Fases 1 a 4.
