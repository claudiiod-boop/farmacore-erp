# Especificação Técnica — Fase 44: Auditoria Sanitária Automatizada & Dossiê de Autoinspeção (ANVISA / VISA)

## 1. Contexto & Necessidade Regulatória Farmacêutica
Drogarias e farmácias brasileiras são submetidas periodicamente a inspeções presenciais da **Vigilância Sanitária Municipal/Estadual (VISA)** e auditorias da **ANVISA**.
Durante uma inspeção, o fiscal sanitário exige a apresentação imediata de um conjunto denso de documentos comprobatórios e livros de registro:
1. **POPs (Procedimentos Operacionais Padrão):** Higienização de instalações, dispensação de medicamentos, controle de temperatura e calibragem de termohigrômetros.
2. **Cadeia de Frio & Termolábeis (RDC 44/2009 & RDC 430/2020):** Histórico de medições diárias (mínima/máxima) e registro de excursões térmicas de geladeiras e ambiente.
3. **Controle de Vetores & Pragas Urbanas e Limpeza de Caixa d'Água:** Certificados de desinsetização/desratização vigentes e laudo semestral bacteriológico de reservatório de água potável.
4. **Gerenciamento de Resíduos (RDC 222/2018 PGRSS):** Manifesto de Transporte de Resíduos (MTR) e comprovantes de incineração/destinação de perfurocortantes (Grupo E) e resíduos químicos/vencidos (Grupo B).
5. **Livro de Injetáveis & Vacinas (RDC 197/2017 & RDC 44/2009):** Registros de administração de antimicrobianos injetáveis e imunobiológicos com lote e prescritor.
6. **Farmacovigilância (RDC 406/2020):** Registros de Reações Adversas (RAM) e Queixas Técnicas comunicadas no NOTIVISA.
7. **Balanços de Controlados (Portaria 344/98 & SNGPC):** BMPO, RMNRA, RMNRB e livro de receituários especiais.

A preparação manual desses dossiês gera estresse, risco de autos de infração, multas e interdição cautelar do estabelecimento caso haja descompasso de datas ou extravio de folhas físicas.

O **Dossiê Digital de Autoinspeção Sanitária** automatiza a varredura contínua de todas essas bases do FarmaCore ERP, calcula um **Score Geral de Conformidade Sanitária (0 a 100%)**, identifica não conformidades em tempo real (ex: certificado de dedetização vencendo em 10 dias, medição de temperatura do dia não lançada, resíduo do Grupo E sem MTR) e gera o **Dossiê Consolidado de Inspeção em 1 Clique (Pronto para Fiscalização)**.

---

## 2. Requisitos Regulatórios & Arquitetura
1. **Scanner Transversal de Conformidade:**
   - Varre:
     - `standard_operating_procedures` (POPs atualizados e revisados anualmente).
     - `temperature_rounds` / `temperature_readings` (checagem de registros diários de temperatura).
     - `pest_control_certificates` & `water_tank_cleaning_logs` (validade de 6 meses).
     - `pgrss_manifests` & `pgrss_disposal_records` (destinação de resíduos).
     - `injectable_administration_logs` & `vaccination_records` (registros de sala de serviços farmacêuticos).
     - `adverse_drug_reactions` & `technical_complaints` (notificações de farmacovigilância).
     - `sngpc_transmissions` & `regulatory_reports` (balanços BMPO / Portaria 344).
2. **Score de Saúde Sanitária da Farmácia (0 a 100%):**
   - Calculado ponderando pesos por pilar:
     - Cadeia de Frio (20 pts)
     - SNGPC & Portaria 344 (25 pts)
     - POPs & Certificados de Pragas/Água (15 pts)
     - PGRSS & Resíduos (15 pts)
     - Sala de Injetáveis/Serviços (15 pts)
     - Farmacovigilância (10 pts)
   - Status:
     - `CONFORME_EXCELENTE` (90% a 100%)
     - `CONFORME_COM_ALERTAS` (70% a 89%)
     - `NAO_CONFORME_RISCO_INTERDICAO` (< 70%)
3. **Histórico de Auditorias & Dossiê Exportável:**
   - Registro de autoinspeções realizadas pelo Responsável Técnico (Farmacêutico RT).
   - Plano de Ação Corretiva e Preventiva (CAPA) para cada inconformidade encontrada.

---

## 3. Arquitetura de Dados
### Tabela `sanitary_audits`
- `id` (TEXT PRIMARY KEY)
- `store_id` (TEXT NOT NULL)
- `audit_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `responsible_pharmacist_crf` (TEXT NOT NULL)
- `responsible_pharmacist_name` (TEXT NOT NULL)
- `overall_score` (REAL NOT NULL) -- 0 a 100
- `compliance_status` (TEXT NOT NULL) -- 'EXCELLENT', 'WARNING', 'CRITICAL_RISK'
- `cold_chain_score` (REAL NOT NULL)
- `sngpc_score` (REAL NOT NULL)
- `pops_certificates_score` (REAL NOT NULL)
- `pgrss_score` (REAL NOT NULL)
- `injectables_score` (REAL NOT NULL)
- `pharmacovigilance_score` (REAL NOT NULL)
- `dossier_summary_json` (TEXT NOT NULL)
- `action_plan_notes` (TEXT)
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

### Tabela `sanitary_audit_items`
- `id` (TEXT PRIMARY KEY)
- `audit_id` (TEXT REFERENCES sanitary_audits(id) ON DELETE CASCADE)
- `category` (TEXT NOT NULL) -- 'COLD_CHAIN', 'SNGPC', 'POPS_CERTIFICATES', 'PGRSS', 'INJECTABLES', 'PHARMACOVIGILANCE'
- `item_description` (TEXT NOT NULL)
- `status` (TEXT NOT NULL) -- 'COMPLIANT', 'NON_COMPLIANT', 'WARNING_EXPIRING'
- `evidence_text` (TEXT)
- `corrective_action` (TEXT)
- `created_at` (TEXT NOT NULL)
