# Especificação Técnica - Fase 33: Controle de Lotes Vencidos, Avarias & Quarentena Sanitária Integrada ao PGRSS (RDC 44/2009 e Notivisa ANVISA)

## 1. Visão Geral & Contexto Regulatório Farmacêutico
No varejo farmacêutico brasileiro, a segregação física e sistêmica de produtos inaptos para dispensação é uma determinação imperativa:
- **RDC 44/2009 ANVISA (Boas Práticas Farmacêuticas):**
  - Todo produto com prazo de validade expirado, avariado, violado ou sob suspeita de desvio de qualidade deve ser **imediatamente retirado da área de vendas** e transferido para a Área de Quarentena Sanitária, devidamente sinalizada e isolada.
  - O sistema de controle de estoque deve bloquear a venda desses lotes instantaneamente para impedir dispensação acidental no Balcão, Caixa ou Autoatendimento.
- **Notivisa & Resoluções Específicas (RE) da ANVISA (Recall e Interdição Cautelar):**
  - Diante de alertas de farmacovigilância ou publicações no Diário Oficial da União (DOU) de Resoluções RE de recolhimento de lotes pelo fabricante, o sistema deve registrar o alerta sanitário com o número da RE, número do lote e motivo.
  - A ativação do alerta deve realizar a varredura automática no estoque da filial, bloquear todas as unidades existentes daquele lote e emitir o Laudo de Interdição Cautelar.
- **Destinação e Descarte Integrado (PGRSS / Logística Reversa):**
  - **Descarte PGRSS (RDC 222/2018):** Itens sem condições de devolução ao fabricante são encaminhados para incineração ou aterro especializado como Resíduo Químico do Grupo B, gerando registro no Livro de Descarte e vinculando ao Manifesto de Transporte de Resíduos (MTR).
  - **Logística Reversa / Devolução a Fornecedor:** Lotes sob recall com indenização pelo laboratório são devolvidos com NF-e de Remessa para Devolução.
  - **Desinterdição Técnica:** Apenas com laudo e assinatura do Farmacêutico Responsável Técnico (CRF).

---

## 2. Modelagem do Banco de Dados (Migration 032)

### 2.1 Tabela `quarantine_records`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `store_id` (INTEGER NOT NULL REFERENCES stores(id))
- `product_id` (INTEGER NOT NULL REFERENCES products(id))
- `batch_id` (INTEGER NOT NULL REFERENCES batches(id))
- `quantity` (INTEGER NOT NULL CHECK(quantity > 0))
- `reason` (TEXT NOT NULL CHECK(reason IN ('EXPIRED', 'DAMAGED', 'RECALL_ANVISA', 'CUSTOMER_RETURN', 'SUSPECTED_ADULTERATION', 'TEMPERATURE_EXCURSION', 'OTHER')))
- `origin` (TEXT NOT NULL CHECK(origin IN ('INVENTORY_SWEEP', 'CUSTOMER_RETURN', 'INBOUND_INSPECTION', 'MANUAL')))
- `status` (TEXT NOT NULL DEFAULT 'QUARANTINED' CHECK(status IN ('QUARANTINED', 'DISPOSED_PGRSS', 'RETURNED_TO_SUPPLIER', 'RELEASED')))
- `notes` (TEXT)
- `quarantined_by` (TEXT NOT NULL)
- `quarantined_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `resolved_by` (TEXT)
- `resolved_at` (DATETIME)
- `resolution_notes` (TEXT)
- `pgrss_disposal_id` (INTEGER REFERENCES pgrss_disposals(id))
- `fiscal_nfe_key` (TEXT)
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

### 2.2 Tabela `recall_alerts` (Notivisa / Alertas Sanitários ANVISA)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `anvisa_re_number` (TEXT NOT NULL) -- Ex: "RE 1.234/2026"
- `publication_date` (TEXT NOT NULL)
- `product_id` (INTEGER NOT NULL REFERENCES products(id))
- `batch_number` (TEXT NOT NULL)
- `reason` (TEXT NOT NULL) -- Motivo do recolhimento/desvio de qualidade
- `severity` (TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM')))
- `is_active` (INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)))
- `affected_units_blocked` (INTEGER NOT NULL DEFAULT 0)
- `created_by` (TEXT NOT NULL)
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

---

## 3. Serviços & Endpoints

### 3.1 `QuarantineService`
- `quarantineBatch(input)`: Deduz quantidade do lote vendável (`batches`) e cria `quarantine_records`.
- `sweepExpiredBatches(storeId)`: Varredura automática que localiza lotes já vencidos (`expiration_date <= DATE('now')`) ainda em estoque vendável e os transfere automaticamente para a quarentena.
- `registerRecallAlert(input)`: Cadastra alerta de recall ANVISA, busca lotes correspondentes em estoque em todas as lojas, bloqueia e transfere para quarentena com motivo `RECALL_ANVISA`.
- `resolveQuarantine(id, resolution)`:
  - Se `DISPOSED_PGRSS`: gera descarte no módulo PGRSS e marca quarentena como resolvida.
  - Se `RETURNED_TO_SUPPLIER`: gera número de NF-e de remessa para devolução ao fabricante.
  - Se `RELEASED`: exige CRF do farmacêutico e restaura estoque vendável em `batches`.
- `listQuarantine(storeId, filters)`: Consulta registros de quarentena.
- `listRecallAlerts()`: Consulta alertas sanitários cadastrados.
- `getKpis(storeId)`: Retorna total de itens em quarentena, valor em risco, recalls ativos e itens destinados para descarte PGRSS.

### 3.2 Endpoints REST
- `POST /api/quarantine/transfer`: Transfere lote/itens para quarentena.
- `POST /api/quarantine/sweep-expired`: Executa varredura de lotes vencidos.
- `GET /api/quarantine`: Lista itens em quarentena.
- `GET /api/quarantine/:id`: Detalhes do registro de quarentena.
- `POST /api/quarantine/:id/resolve`: Resolve quarentena (Descarte, Devolução ou Liberação).
- `POST /api/quarantine/recalls`: Cadastra alerta sanitário Notivisa / ANVISA.
- `GET /api/quarantine/recalls`: Lista alertas de recall.
- `GET /api/quarantine/kpis`: Métricas do módulo.

---

## 4. Frontend & Experiência de Uso (`QuarantineRegulatoryPage`)
- Painel de Indicadores (Itens em Quarentena, Alertas Notivisa Ativos, Itens Vencidos Detectados, Valor Imobilizado).
- Aba 1: Quarentena Sanitária com filtros por motivo e botão de resolução de lote.
- Aba 2: Varredura de Validades (Auditoria FEFO e botão de "Transferir Vencidos para Quarentena").
- Aba 3: Alertas Notivisa / ANVISA (Cadastro de Recall com RE e bloqueio instantâneo).
- Modal de Resolução de Quarentena com seleção de destino (Descarte PGRSS / Logística Reversa / Liberação Farmacêutica).
