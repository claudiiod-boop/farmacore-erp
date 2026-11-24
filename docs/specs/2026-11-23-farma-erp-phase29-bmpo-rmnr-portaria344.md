# Especificação Técnica — Fase 29: Balanços Oficiais BMPO, RMNRA & RMNRB (Portaria 344/98 ANVISA)

## 1. Visão Geral & Contexto Regulatório

No varejo farmacêutico brasileiro, além da transmissão eletrônica semanal ao SNGPC, a **Portaria SVS/MS nº 344/1998** e a **RDC nº 22/2014 da ANVISA** exigem que farmácias e drogarias elaborem e apresentem periodicamente às **Vigilâncias Sanitárias Municipais e Estaduais (VISA)** os mapas e balanços oficiais de medicamentos sob controle especial.

O descumprimento ou inconsistência nesses documentos acarreta infração sanitária grave (Lei nº 6.437/1977), com multas e interdição do estabelecimento.

A Fase 29 implementa o módulo regulatório oficial de fechamento e emissão de mapas da Portaria 344/98:
1. **BMPO (Balanço de Medicamentos Psicoativos e Outros)**:
   - Relatório trimestral (1º, 2º, 3º e 4º trimestres) e **Balanço Anual** consolidado.
   - Apuração do movimento de estoque: Saldo Inicial, Entradas por Compra/Transferência, Saídas por Venda/Prescrição, Perdas/Descartes e Saldo Final.
   - Enquadramento por listas da Portaria 344/98 (A1, A2, A3, B1, B2, C1, C2, C3, C4, C5 e Antimicrobianos RDC 20/2011).
2. **RMNRA (Relação Mensal de Notificações de Receita "A")**:
   - Mapa nominal mensal das Notificações de Receita Amarela (entorpecentes e psicotrópicos fortes).
   - Relação dos números de notificação, paciente, comprador, médico (CRM/UF), medicamento e lote.
3. **RMNRB / RMNRB2 (Relação Mensal de Notificações de Receita "B")**:
   - Mapa nominal mensal das Notificações de Receita Azul (psicotrópicos tranquilizantes/ansiolíticos e anorexígenos B2).
4. **Termos de Encerramento & Protocolo Sanitário da VISA**:
   - Geração de termo oficial para encadernação e visto da autoridade sanitária, contendo declaração do Farmacêutico Responsável Técnico (RT com CRF) e Representante Legal.
5. **Auditoria de Divergências**:
   - Confronto automático entre vendas registradas no PDV, receitas retidas no Balcão e saldo físico no inventário.

---

## 2. Arquitetura do Banco de Dados (Migration 028)

### Tabelas:
1. `regulatory_reports`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `store_id` INTEGER NOT NULL
   - `report_type` TEXT NOT NULL CHECK(report_type IN ('BMPO_TRIMESTRAL', 'BMPO_ANUAL', 'RMNRA', 'RMNRB', 'BSPO'))
   - `period_year` INTEGER NOT NULL
   - `period_quarter` INTEGER CHECK(period_quarter BETWEEN 1 AND 4)
   - `period_month` INTEGER CHECK(period_month BETWEEN 1 AND 12)
   - `pharmacist_name` TEXT NOT NULL
   - `pharmacist_crf` TEXT NOT NULL
   - `status` TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'CONCLUDED', 'FILED_WITH_VISA'))
   - `visa_protocol_number` TEXT
   - `visa_filing_date` TEXT
   - `observations` TEXT
   - `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
   - `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP

2. `regulatory_report_items`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `report_id` INTEGER NOT NULL REFERENCES regulatory_reports(id) ON DELETE CASCADE
   - `product_id` INTEGER NOT NULL REFERENCES products(id)
   - `active_ingredient` TEXT NOT NULL
   - `dcb_code` TEXT
   - `therapeutic_class` TEXT NOT NULL
   - `control_list` TEXT NOT NULL
   - `presentation` TEXT NOT NULL
   - `unit_measure` TEXT NOT NULL DEFAULT 'CX'
   - `initial_stock` REAL NOT NULL DEFAULT 0
   - `acquisitions` REAL NOT NULL DEFAULT 0
   - `sales` REAL NOT NULL DEFAULT 0
   - `losses` REAL NOT NULL DEFAULT 0
   - `final_stock` REAL NOT NULL DEFAULT 0

3. `regulatory_prescriptions_rel`:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `report_id` INTEGER NOT NULL REFERENCES regulatory_reports(id) ON DELETE CASCADE
   - `sale_id` INTEGER NOT NULL
   - `product_id` INTEGER NOT NULL
   - `prescription_notification_number` TEXT NOT NULL
   - `notification_type` TEXT NOT NULL
   - `dispensation_date` TEXT NOT NULL
   - `prescriber_name` TEXT NOT NULL
   - `prescriber_register_number` TEXT NOT NULL
   - `prescriber_uf` TEXT NOT NULL
   - `patient_name` TEXT NOT NULL
   - `patient_document` TEXT
   - `buyer_name` TEXT NOT NULL
   - `buyer_document` TEXT NOT NULL
   - `quantity_dispensed` REAL NOT NULL
   - `batch_number` TEXT NOT NULL

---

## 3. Serviços do Módulo (`bmpo.service.ts`)

- `generateBmpo(storeId, year, quarter, pharmacistName, pharmacistCrf)`:
  - Calcula o período (datas início e fim do trimestre ou ano).
  - Cruza movimentações de entradas e vendas com receita para todas as substâncias controladas.
  - Grava o relatório e itens na tabela.
- `generateRmnr(storeId, year, month, type: 'RMNRA' | 'RMNRB', pharmacistName, pharmacistCrf)`:
  - Filtra as receitas do mês do respectivo tipo de talonário.
  - Preenche a lista nominal para submissão oficial.
- `fileReportWithVisa(reportId, protocolNumber, filingDate)`:
  - Marca o relatório como protocolado na autoridade sanitária.
- `getReportDocument(reportId)`:
  - Gera layout oficial formatado para impressão em papel timbrado.
- `getRegulatoryKpis(storeId)`:
  - Contagem de balanços emitidos, receitas A e B arquivadas no mês e prazos para entrega à VISA.

---

## 4. Frontend React (`BmpoRegulatoryPage.tsx`)

- Painel com Abas:
  - **BMPO (Trimestral / Anual)**: tabela oficial Anvisa com Saldo Inicial, Entradas, Saídas, Perdas e Saldo Final por substância.
  - **RMNRA (Receita Amarela)**: mapa nominal das notificações A.
  - **RMNRB (Receita Azul)**: mapa nominal das notificações B.
  - **Protocolos VISA**: histórico de submissões, protocolos e comprovantes.
- Emissão com pré-visualização e impressão direta em formato A4 formatado conforme os padrões da Anvisa.
