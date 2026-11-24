# Especificação Técnica - Fase 27: Descarte Sanitário & PGRSS (RDC 222/2018 ANVISA)

## 1. Visão Geral e Fundamentação Sanitária
A RDC 222/2018 da ANVISA regulamenta as Boas Práticas de Gerenciamento de Resíduos de Serviços de Saúde (PGRSS).
Farmácias e drogarias geram principalmente:
- **Grupo B (Resíduos Químicos):** Medicamentos vencidos, avariados, antimicrobianos, substâncias controladas da Portaria 344/98, reagentes e sobras de manipulação magistral;
- **Grupo A (Resíduos Biológicos):** Seringas e materiais biológicos oriundos de serviços farmacêuticos clínicos (injeções, testes rápidos);
- **Grupo E (Perfurocortantes):** Agulhas, ampolas quebradas e lâminas.

A conformidade regulatória exige:
1. **Segregação Imediata:** Registro do produto, lote, motivo do descarte, peso estimado em kg e responsável técnico (Farmacêutico CRF);
2. **Baixa de Estoque Sanitária:** O item deixa de constar no estoque vendável e é transferido para o abrigo de resíduos da loja;
3. **Manifesto de Transporte de Resíduos (MTR):** Documento obrigatório para despacho da carga até a empresa de tratamento/incineração licenciada pelo órgão ambiental (IBAMA / órgão estadual);
4. **Certificado de Destinação Final (CDF):** Registro final emitido pela usina de incineração/coprocessamento, comprovando a destruição térmica segura e fechando o ciclo de rastreabilidade.

---

## 2. Modelagem de Dados (Migration 026)

### 2.1. Tabela `pgrss_disposal_records`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `product_id` INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT
- `batch_id` INTEGER REFERENCES batches(id) ON DELETE SET NULL
- `waste_group` TEXT NOT NULL CHECK (waste_group IN ('GRUPO_B_QUIMICO', 'GRUPO_A_BIOLOGICO', 'GRUPO_E_PERFUROCORTANTE'))
- `reason` TEXT NOT NULL CHECK (reason IN ('VENCIDO', 'AVARIADO', 'RECALL_ANVISA', 'SOBRA_MANIPULACAO', 'CONTAMINADO'))
- `quantity` REAL NOT NULL CHECK (quantity > 0)
- `weight_kg` REAL NOT NULL CHECK (weight_kg > 0)
- `pharmacist_name` TEXT NOT NULL
- `pharmacist_crf` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'STORED' CHECK (status IN ('STORED', 'DISPATCHED', 'INCINERATED'))
- `notes` TEXT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.2. Tabela `pgrss_manifests` (MTR)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `manifest_number` TEXT NOT NULL UNIQUE -- Ex: MTR-202611-001
- `collector_name` TEXT NOT NULL -- Razão Social da Coletora
- `collector_cnpj` TEXT NOT NULL -- CNPJ da Coletora
- `environmental_license` TEXT NOT NULL -- Licença de Operação Ambiental
- `vehicle_plate` TEXT NOT NULL -- Placa do caminhão de coleta
- `driver_name` TEXT NOT NULL
- `total_weight_kg` REAL NOT NULL CHECK (total_weight_kg > 0)
- `total_items` INTEGER NOT NULL CHECK (total_items > 0)
- `dispatch_date` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'DISPATCHED' CHECK (status IN ('DISPATCHED', 'DESTINED', 'CANCELLED'))
- `cdf_number` TEXT -- Certificado de Destinação Final
- `certificate_date` TEXT
- `incineration_plant` TEXT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Tabela `pgrss_manifest_items`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `manifest_id` INTEGER NOT NULL REFERENCES pgrss_manifests(id) ON DELETE CASCADE
- `disposal_record_id` INTEGER NOT NULL REFERENCES pgrss_disposal_records(id) ON DELETE RESTRICT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
- UNIQUE(manifest_id, disposal_record_id)

---

## 3. Serviços e Regras de Negócio (`PgrssDisposalService`)
1. `segregateWaste(input)`:
   - Valida existência do produto e do lote.
   - Deduz a quantidade do lote no estoque para evitar venda indevida.
   - Registra o item segregado no abrigo de resíduos com status `STORED`.
2. `listWasteRecords(filters)`:
   - Lista resíduos por loja, status (`STORED`, `DISPATCHED`, `INCINERATED`), grupo ou motivo.
3. `createMtrManifest(input)`:
   - Agrupa uma lista de `disposal_record_ids` que estejam no status `STORED`.
   - Calcula o peso total e contagem de itens.
   - Gera o número de MTR e atualiza os registros de descarte para `DISPATCHED`.
4. `finalizeWithCdf(manifestId, cdfNumber, certificateDate, incinerationPlant)`:
   - Atualiza o status do MTR para `DESTINED` e dos registros para `INCINERATED`.
5. `generateMtrDocument(manifestId)`:
   - Gera espelho textual / formatado do Manifesto de Transporte de Resíduos pronto para impressão e assinatura de entrega.
6. `getPgrssKpis(storeId?)`:
   - Peso total descartado no mês, quantidade de MTRs emitidos, total incinerado e resíduos atualmente no abrigo.

---

## 4. Endpoints REST Fastify
- `POST /api/sanitary/pgrss/segregate` - Segrega produto/lote para descarte sanitário
- `GET /api/sanitary/pgrss/records` - Lista registros de resíduos
- `POST /api/sanitary/pgrss/manifests` - Emite novo Manifesto MTR
- `GET /api/sanitary/pgrss/manifests` - Lista manifestos MTR
- `GET /api/sanitary/pgrss/manifests/:id/document` - Emite espelho do MTR para impressão
- `PATCH /api/sanitary/pgrss/manifests/:id/cdf` - Baixa com Certificado de Destinação Final (CDF)
- `GET /api/sanitary/pgrss/kpis` - Indicadores de gestão de resíduos

---

## 5. Interface React (`PgrssDisposalPage.tsx`)
- Indicadores: Resíduos no Abrigo (kg), Resíduos Despachados (kg), MTRs Ativos, Taxa de Destinação Final (CDF).
- Aba 1: "Abrigo de Resíduos (Aguardando Coleta)" com botão "Segregar Medicamento" e "Emitir Manifesto MTR".
- Aba 2: "Manifestos de Coleta (MTR & CDF)" com status, espelho de impressão e botão para anexar CDF de incineração.
- Aba 3: "Histórico & Rastreabilidade Geral" de resíduos incinerados.
