# Especificação Funcional & Técnica: Fase 39 — Farmacovigilância, Reações Adversas (RAM) & Queixas Técnicas (RDC 406/2020 ANVISA & NOTIVISA)

## 1. Visão Geral e Contexto Regulatório
Em estrita conformidade com a **RDC nº 406/2020 da ANVISA** (Boas Práticas de Farmacovigilância) e com as diretrizes do **NOTIVISA (Sistema de Notificações em Vigilância Sanitária da ANVISA)**, as farmácias e drogarias exercem papel fundamental na detecção, avaliação, compreensão e prevenção de eventos adversos ou quaisquer outros problemas relacionados a medicamentos.

Este módulo implementa:
1. **Notificação Formal de Reações Adversas a Medicamentos (RAM)**:
   - Registro de suspeita de eventos adversos inesperados ou graves associados ao uso de medicamentos dispensados ou administrados.
   - Dados clínicos: gravidade ('LEVE', 'MODERADA', 'GRAVE' - com critérios de internação hospitalar, risco de morte, anomalia congênita ou óbito), dechallenge/rechallenge (suspensão e reexposição), medicamentos concomitantes e evolução clínica/desfecho.
   - Protocolo único de farmacovigilância (`RAM-2026-XXXX`).
2. **Queixas Técnicas & Desvios de Qualidade (QT)**:
   - Notificação de suspeita de alteração físico-química, contaminação microbiológica, corpo estranho, odor/cor alterados, falha de rotulagem, precipitação em injetáveis ou ineficácia terapêutica total/parcial.
   - Protocolo único de queixa técnica (`QT-2026-XXXX`).
   - Opção de bloqueio preventivo automático do lote afetado (integração direta com o estoque em Quarentena Sanitária).
3. **Geração de Dossiê / Payload de Exportação NOTIVISA**:
   - Geração do dossiê estruturado contendo todos os dados exigidos pelo formulário oficial da ANVISA para transmissão ao órgão regulador.
   - Acompanhamento do status de envio: 'DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'.

---

## 2. Modelagem de Dados & Schema SQLite (Migration 038)

### 2.1 Tabela `adverse_drug_reactions` (RAM)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER REFERENCES stores(id)
- `protocol_code` TEXT NOT NULL UNIQUE -- Ex: 'RAM-2026-0001'
- `patient_initials` TEXT NOT NULL -- Ex: 'C.E.S.'
- `patient_age` INTEGER
- `patient_gender` TEXT NOT NULL CHECK(patient_gender IN ('M', 'F', 'OTHER'))
- `is_pregnant` INTEGER NOT NULL DEFAULT 0
- `suspected_drug_name` TEXT NOT NULL
- `suspected_drug_batch` TEXT NOT NULL
- `suspected_drug_manufacturer` TEXT
- `daily_dose` TEXT NOT NULL
- `treatment_start_date` TEXT NOT NULL
- `treatment_end_date` TEXT
- `therapeutic_indication` TEXT
- `concomitant_drugs` TEXT
- `reaction_description` TEXT NOT NULL
- `reaction_onset_date` TEXT NOT NULL
- `severity_level` TEXT NOT NULL CHECK(severity_level IN ('MILD', 'MODERATE', 'SEVERE'))
- `serious_criteria` TEXT -- Ex: 'HOSPITALIZATION', 'LIFE_THREATENING', 'DEATH', 'NONE'
- `dechallenge_status` TEXT NOT NULL CHECK(dechallenge_status IN ('IMPROVED', 'NOT_IMPROVED', 'NOT_APPLICABLE', 'UNKNOWN'))
- `rechallenge_status` TEXT NOT NULL CHECK(rechallenge_status IN ('RECURRED', 'NOT_RECURRED', 'NOT_REEXPOSED', 'UNKNOWN'))
- `outcome` TEXT NOT NULL CHECK(outcome IN ('RECOVERED', 'RECOVERING', 'NOT_RECOVERED', 'FATAL', 'UNKNOWN'))
- `notifier_pharmacist_name` TEXT NOT NULL
- `notifier_pharmacist_crf` TEXT NOT NULL
- `notivisa_submission_status` TEXT NOT NULL DEFAULT 'DRAFT' CHECK(notivisa_submission_status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'))
- `notivisa_protocol` TEXT
- `created_at` TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))

### 2.2 Tabela `technical_complaints` (Queixas Técnicas / Desvios de Qualidade)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER REFERENCES stores(id)
- `protocol_code` TEXT NOT NULL UNIQUE -- Ex: 'QT-2026-0001'
- `product_name` TEXT NOT NULL
- `product_ean` TEXT
- `batch_number` TEXT NOT NULL
- `manufacturer` TEXT NOT NULL
- `expiration_date` TEXT NOT NULL
- `complaint_type` TEXT NOT NULL CHECK(complaint_type IN (
    'PHYSICAL_CHEMICAL_ALTERATION',
    'FOREIGN_MATTER',
    'COLOR_OR_ODOR_CHANGE',
    'PACKAGING_OR_SEAL_DEFECT',
    'LABELING_INACCURACY',
    'LACK_OF_THERAPEUTIC_EFFICACY',
    'SUSPECTED_COUNTERFEIT'
  ))
- `description` TEXT NOT NULL
- `sample_available_for_pickup` INTEGER NOT NULL DEFAULT 1
- `quarantine_auto_blocked` INTEGER NOT NULL DEFAULT 0
- `reporter_type` TEXT NOT NULL CHECK(reporter_type IN ('CUSTOMER', 'EMPLOYEE', 'PRESCRIBER'))
- `reporter_name` TEXT
- `notifier_pharmacist_crf` TEXT NOT NULL
- `notivisa_submission_status` TEXT NOT NULL DEFAULT 'DRAFT' CHECK(notivisa_submission_status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED'))
- `notivisa_protocol` TEXT
- `created_at` TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))

---

## 3. Serviços & Regras de Negócio (`PharmacovigilanceService`)
- Registro de Notificação de RAM com cálculo de gravidade e validação de datas.
- Registro de Queixa Técnica com bloqueio automático opcional do lote em estoque (inserindo em `inventory_batches` status de quarentena/bloqueio ou gerando registro de quarentena).
- Submissão/Simulação de Protocolo NOTIVISA (gerando protocolo de transmissão oficial).
- Dossiê exportável em JSON/XML no formato compatível com o sistema NOTIVISA ANVISA.
- Painel analítico de farmacovigilância: total de RAMs por gravidade, total de queixas técnicas por tipo e lotes com múltiplos relatos.
