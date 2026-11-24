# Especificação Técnica — Fase 30: Rastreabilidade SNCM & DataMatrix Bidimensional (Lei 13.410/2016 e RDC 157/2017 ANVISA)

## 1. Visão Geral & Contexto Regulatório

A **Lei Federal nº 13.410/2016** e as Resoluções da Diretoria Colegiada **RDC nº 157/2017** e **RDC nº 319/2019 da ANVISA** instituíram o **Sistema Nacional de Controle de Medicamentos (SNCM)**, estabelecendo o rastreamento de ponta a ponta de todo o ciclo de vida dos medicamentos no território brasileiro.

Cada unidade física (caixinha individual de medicamento) recebe um código bidimensional **GS1 DataMatrix** contendo o **Identificador Único de Medicamento (IUM)**, composto por:
1. **GTIN (AI 01)**: Código de barras comercial de 14 dígitos.
2. **Serial Number (AI 21)**: Número serial alfanumérico individual exclusivo de até 20 dígitos.
3. **Data de Validade (AI 17)**: Formato AAMMDD.
4. **Lote de Fabricação (AI 10)**: Identificador do lote industrial.

A farmácia comunitária/drogaria atua como o elo final da cadeia, sendo legalmente responsável por:
- **Recebimento de Mercadorias**: validação física dos seriais recebidos contra a NF-e.
- **Dispensação ao Consumidor Final**: leitura do DataMatrix no PDV/Balcão para desativação no SNCM, atrelando a venda ao cupom fiscal NFC-e.
- **Devolução / Perda**: comunicação de desvio, quebra, furto ou descarte PGRSS.
- **Auditoria de Autenticidade & Bloqueio Sanitário**: verificação imediata para barrar medicamentos falsificados, roubados ou cuja validade já expirou.

---

## 2. Arquitetura do Banco de Dados (Migration 029)

### Tabelas:
1. `sncm_items`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `product_id` INTEGER NOT NULL REFERENCES products(id)
   - `batch_id` INTEGER REFERENCES batches(id)
   - `store_id` INTEGER NOT NULL DEFAULT 1
   - `gtin` TEXT NOT NULL
   - `serial_number` TEXT NOT NULL
   - `expiration_date` TEXT NOT NULL
   - `batch_number` TEXT NOT NULL
   - `status` TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK(status IN ('IN_STOCK', 'DISPENSED', 'RETURNED', 'LOST', 'QUARANTINE'))
   - `sale_id` INTEGER REFERENCES sales(id)
   - `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
   - `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP
   - UNIQUE(gtin, serial_number)

2. `sncm_events`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `store_id` INTEGER NOT NULL DEFAULT 1
   - `sncm_item_id` INTEGER NOT NULL REFERENCES sncm_items(id) ON DELETE CASCADE
   - `event_type` TEXT NOT NULL CHECK(event_type IN ('RECEBIMENTO', 'DISPENSACAO', 'DEVOLUCAO', 'PERDA_INUTILIZACAO', 'QUARENTENA'))
   - `event_date` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
   - `nfe_access_key` TEXT
   - `fiscal_doc_number` TEXT
   - `transmission_status` TEXT NOT NULL DEFAULT 'PENDING' CHECK(transmission_status IN ('PENDING', 'SENT', 'CONFIRMED', 'REJECTED'))
   - `anvisa_protocol` TEXT
   - `anvisa_message` TEXT
   - `operator_name` TEXT
   - `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

---

## 3. Serviços do Módulo (`sncm.service.ts`)

- `parseDataMatrix(rawString: string)`:
  - Decodifica strings com Application Identifiers (AIs) GS1:
    - `01` -> GTIN (14 dígitos)
    - `21` -> Serial Number
    - `17` -> Validade (converte AAMMDD para YYYY-MM-DD)
    - `10` -> Lote
- `registerReceipt(storeId, items: Array<{ rawDataMatrix?: string; gtin?: string; serialNumber?: string; ... }>)`:
  - Insere unidades individuais no estoque rastreado e gera evento `RECEBIMENTO`.
- `dispenseItem(storeId, serialOrDataMatrix: string, saleId?: number, fiscalDocNumber?: string)`:
  - Valida se o item existe no estoque, não está vencido nem já dispensado.
  - Atualiza status para `DISPENSED` e registra evento `DISPENSACAO`.
- `queryItemBySerial(gtin: string, serial: string)`:
  - Retorna histórico completo de movimentações e autenticidade da caixa.
- `transmitEventsToAnvisa(storeId)`:
  - Simula/executa envio dos eventos pendentes ao webservice da ANVISA com retorno de protocolo oficial.
- `getSncmKpis(storeId)`:
  - Itens rastreados em estoque, unidades dispensadas hoje, eventos pendentes de envio e alertas sanitários.

---

## 4. Frontend React (`SncmTraceabilityPage.tsx`)

- Painel Touch com 4 abas operacionais:
  - **Validador & Consulta Rápida DataMatrix**: leitor óptico 2D para verificação imediata de procedência e validade.
  - **Recebimento de Carga**: bipagem em lote de caixas recebidas com confrontação de NF-e.
  - **Eventos Sanitários & Transmissão ANVISA**: log de eventos (Dispensações, Recebimentos) e botão de sincronização com protocolo do SNCM.
  - **Estoque Serializado**: inventário caixa a caixa com filtros por GTIN, lote e status.
