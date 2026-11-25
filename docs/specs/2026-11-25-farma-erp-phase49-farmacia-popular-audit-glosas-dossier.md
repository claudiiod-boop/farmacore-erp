# Especificação Técnica - Fase 49: Auditoria de Repasses do Farmácia Popular (MS / DataSUS), Prevenção de Glosas & Arquivo Digital de Comprovantes (5 Anos)

## 1. Contexto e Justificativa Regulatória
O Programa Farmácia Popular do Brasil (PFPB), regulamentado pela Portaria de Consolidação GM/MS nº 5/2017 (Anexo LXXVII) e fiscalizado pelo Departamento Nacional de Auditoria do SUS (DENASUS), impõe obrigações regulatórias estritas para as farmácias credenciadas:
1. **Guarda Documental Obrigatória de 5 (Cinco) Anos:** A farmácia deve manter sob sua guarda e em perfeitas condições de legibilidade todas as cópias de cupons fiscais e cupons vinculados assinados pelos beneficiários, receitas médicas retidas e documentos de identificação com foto pelo prazo inegociável de 5 anos contados da data de dispensação.
2. **Conciliação Financeira de Repasses FNS:** Divergências entre o valor autorizado no DataSUS e o montante efetivamente creditado em conta bancária pelo Fundo Nacional de Saúde (FNS) geram glosas parciais ou totais. Sem conciliação automatizada, farmácias sofrem prejuízos silenciosos ou tomam ciência de irregularidades apenas em notificações fiscais.
3. **Contestação de Glosas Administrativas:** Mecanismo regulatório formal para apresentação de justificativas e envio de contraprovas documentais digitalizadas com hash criptográfico de integridade em caso de retenção de créditos pelo Ministério da Saúde.

## 2. Requisitos Técnicos
### 2.1 Modelo de Dados (Migration 048)
- `fp_settlement_batches`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `batch_reference`: TEXT NOT NULL (ex: 'FNS-2026-11-REF01')
  - `competence_month`: TEXT NOT NULL (ex: '2026-10')
  - `credit_date`: TEXT NOT NULL
  - `total_authorized_amount`: REAL NOT NULL
  - `total_credited_amount`: REAL NOT NULL
  - `total_loss_amount`: REAL NOT NULL DEFAULT 0.0
  - `status`: TEXT NOT NULL CHECK (status IN ('IMPORTED', 'RECONCILED', 'DISCREPANT', 'CONTESTED'))
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `fp_audit_items`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `settlement_batch_id`: INTEGER (FK fp_settlement_batches)
  - `store_id`: INTEGER NOT NULL
  - `authorization_code`: TEXT NOT NULL UNIQUE
  - `sale_id`: INTEGER
  - `patient_cpf`: TEXT NOT NULL
  - `patient_name`: TEXT NOT NULL
  - `prescriber_crm`: TEXT NOT NULL
  - `prescriber_uf`: TEXT NOT NULL
  - `authorized_ms_amount`: REAL NOT NULL
  - `patient_copay_amount`: REAL NOT NULL DEFAULT 0.0
  - `credited_fns_amount`: REAL NOT NULL DEFAULT 0.0
  - `gloss_amount`: REAL NOT NULL DEFAULT 0.0
  - `gloss_reason`: TEXT
  - `status`: TEXT NOT NULL CHECK (status IN ('APPROVED', 'PARTIALLY_GLOSSED', 'TOTALLY_GLOSSED', 'CONTESTED'))
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `fp_digital_receipt_dossiers`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL
  - `authorization_code`: TEXT NOT NULL UNIQUE
  - `sale_id`: INTEGER
  - `patient_cpf`: TEXT NOT NULL
  - `patient_name`: TEXT NOT NULL
  - `dispensation_date`: TEXT NOT NULL
  - `retention_deadline`: TEXT NOT NULL (dispensation_date + 5 anos)
  - `signed_coupon_file_path`: TEXT
  - `prescription_file_path`: TEXT
  - `id_document_file_path`: TEXT
  - `legal_representation_file_path`: TEXT
  - `sha256_integrity_hash`: TEXT NOT NULL
  - `status`: TEXT NOT NULL CHECK (status IN ('PENDING_DOCS', 'ARCHIVED', 'EXPIRING_RETENTION', 'PURGED'))
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### 2.2 Funcionalidades do Backend (`FarmaciaPopularAuditService`)
1. Importação de lotes de repasse com cálculo automático de glosas e status.
2. Conciliação automática de itens autorizados com transações PBM locais.
3. Arquivamento e indexação de dossiê digital de 5 anos com cálculo SHA-256 e data de expiração legal.
4. Workflow de contestação administrativa de glosas com contraprova.
5. KPIs de conformidade do Farmácia Popular (Total Repassado, Total Glosado, % Taxa de Glosa, Dossiês Pendentes de Digitalização).

### 2.3 Interface do Usuário (Frontend)
- Painel de controle integrado com indicadores de conformidade DENASUS.
- Conciliador de lotes FNS com filtro por competência e status.
- Gerenciador de glosas com acionamento do modal de contestação administrativa.
- Repositório de dossiês de comprovantes de 5 anos com busca por CPF, autorização e verificação de integridade documental.
