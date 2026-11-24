# Especificação Funcional & Técnica: Fase 38 — Livro Oficial de Injetáveis & Sala de Vacinas (RDC 197/2017 & RDC 44/2009 ANVISA)

## 1. Visão Geral e Contexto Regulatório
Em estrita conformidade com a **RDC nº 44/2009 da ANVISA** (Capítulo VI, Seção II - Da Administração de Medicamentos) e com a **RDC nº 197/2017 da ANVISA** (Requisitos Técnico-Sanitários para Serviços de Vacinação Humana em Farmácias e Drogarias), este módulo implementa:
1. **Livro Oficial Eletrônico de Aplicação de Medicamentos Injetáveis**:
   - Registro auditável de cada administração de injetável realizada no consultório / sala de aplicação.
   - Rastreabilidade total: medicamento, concentração, lote, validade, lote da seringa/agulha, via de administração (IM, IV, SC, ID), sítio anatômico de aplicação, dados completos do prescritor (CRM/UF) e do paciente.
   - Farmacêutico aplicador responsável (CRF).
   - Emissão da 2ª via da Declaração de Serviço Farmacêutico (DSF de Injetáveis) para guarda pelo prazo obrigatório de 5 anos.
2. **Sala de Vacinação & Controle Imunobiológico (RDC 197/2017)**:
   - Registro especializado de imunobiológicos: antígeno/vacina, fabricante, número do lote da vacina e do diluente, validade, esquema vacinal (dose 1, 2, 3, reforço, dose única).
   - Emissão do Comprovante / Carteira de Vacinação do Cidadão com identificador único e validação.
   - Registro de triagem pré-vacinal (temperatura corporal, histórico de alergias graves a ovos/proteínas, gestação).
   - Preparação de lote de exportação para o SI-PNI (Sistema de Informação do Programa Nacional de Imunizações / Ministério da Saúde).
   - Monitoramento e registro de Eventos Adversos Pós-Vacinação (EAPV) conforme protocolo Notivisa.

---

## 2. Modelagem de Dados & Schema SQLite (Migration 037)

### 2.1 Tabela `injectable_administration_logs`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER REFERENCES stores(id)
- `patient_name` TEXT NOT NULL
- `patient_cpf` TEXT NOT NULL
- `patient_birth_date` TEXT
- `patient_phone` TEXT
- `medication_name` TEXT NOT NULL
- `medication_dosage` TEXT NOT NULL
- `medication_batch` TEXT NOT NULL
- `medication_expiration_date` TEXT NOT NULL
- `syringe_needle_batch` TEXT NOT NULL
- `administration_route` TEXT NOT NULL CHECK(administration_route IN ('INTRAMUSCULAR', 'INTRAVENOSA', 'SUBCUTANEA', 'INTRADERMICA'))
- `anatomical_site` TEXT NOT NULL -- Ex: 'Deltoide Direito', 'Glúteo Ventro-glúteo', 'Vasto Lateral'
- `prescriber_name` TEXT NOT NULL
- `prescriber_crm` TEXT NOT NULL
- `prescriber_uf` TEXT NOT NULL
- `pharmacist_name` TEXT NOT NULL
- `pharmacist_crf` TEXT NOT NULL
- `declaration_number` TEXT NOT NULL UNIQUE -- Ex: 'DSF-INJ-2026-0001'
- `adverse_reaction_observed` INTEGER NOT NULL DEFAULT 0
- `notes` TEXT
- `administered_at` TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
- `created_at` TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))

### 2.2 Tabela `vaccination_records`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER REFERENCES stores(id)
- `patient_name` TEXT NOT NULL
- `patient_cpf` TEXT NOT NULL
- `patient_birth_date` TEXT NOT NULL
- `patient_phone` TEXT
- `vaccine_name` TEXT NOT NULL -- Ex: 'Influenza Tetravalente', 'Hepatite B Recombinante', 'HPV Nonavalente'
- `manufacturer` TEXT NOT NULL
- `vaccine_batch` TEXT NOT NULL
- `diluent_batch` TEXT
- `vaccine_expiration_date` TEXT NOT NULL
- `dose_type` TEXT NOT NULL CHECK(dose_type IN ('DOSE_1', 'DOSE_2', 'DOSE_3', 'REFRACTORY_BOOSTER', 'SINGLE_DOSE'))
- `administration_route` TEXT NOT NULL DEFAULT 'INTRAMUSCULAR'
- `anatomical_site` TEXT NOT NULL
- `pre_triage_fever` INTEGER NOT NULL DEFAULT 0
- `pre_triage_allergies` TEXT
- `pharmacist_name` TEXT NOT NULL
- `pharmacist_crf` TEXT NOT NULL
- `certificate_code` TEXT NOT NULL UNIQUE -- Ex: 'VAC-2026-XXXX'
- `sipni_status` TEXT NOT NULL DEFAULT 'PENDING' CHECK(sipni_status IN ('PENDING', 'EXPORTED', 'ACCEPTED', 'REJECTED'))
- `sipni_exported_at` TEXT
- `eapv_adverse_event` INTEGER NOT NULL DEFAULT 0
- `eapv_description` TEXT
- `administered_at` TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
- `created_at` TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))

---

## 3. Serviços & Regras de Negócio (`InjectableVaccinationService`)
- Registro de aplicação de medicamento injetável com validação de prescrição médica, lote de agulha/seringa e lote do medicamento.
- Emissão e recuperação de Declaração de Serviço Farmacêutico (DSF).
- Registro de aplicação de vacina com triagem de contraindicações clínicas e geração de código de certificado.
- Exportação de lote SI-PNI para integração governamental.
- Registro de EAPV (Evento Adverso Pós-Vacinação) com alerta regulatório imediato para a farmácia.
- Relatório oficial consolidado do Livro de Injetáveis para inspeção da VISA/CRF.
