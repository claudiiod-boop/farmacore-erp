# Especificação Funcional & Técnica: Fase 37 — Sanitização, Higienização de Ambientes, Dedetização & POPs Regulatórios (RDC 44/2009 ANVISA)

## 1. Visão Geral e Contexto Regulatório
Em conformidade rigorosa com a **RDC nº 44/2009 da ANVISA** (Capítulo II - Das Condições Gerais, Seção III - Da Infraestrutura Física e Higienização, e Seção IV - Das Boas Práticas Farmacêuticas) e diretrizes dos Conselhos Regionais de Farmácia (CRF) e Vigilâncias Sanitárias locais (VISA), toda farmácia ou drogaria deve manter programas formais, documentados e auditáveis de:
1. **Higienização e Sanitização Contínua**: limpeza diária, semanal e terminal de todos os setores e superfícies de contato de medicamentos.
2. **Controle Integrado de Vetores e Pragas Urbanas**: execução periódica comprovada por empresa especializada e licenciada, com periodicidade máxima semestral.
3. **Limpeza e Desinfecção Semestral de Reservatórios de Água**: laudos de desinfecção e potabilidade de água.
4. **Gestão Documental de Procedimentos Operacionais Padrão (POPs) & MBP**: procedimentos operacionais padronizados com controle rigoroso de versionamento, revisão anual e ciência/treinamento dos colaboradores.

---

## 2. Requisitos de Domínio & Entidades de Banco de Dados

### 2.1 Tabela `sanitization_logs`
- `id` (UUID PK)
- `company_id` (TEXT NOT NULL)
- `sector_name` (TEXT NOT NULL) -- Ex: 'SALA_INJETAIS', 'ESTOQUE_CENTRAL', 'GELADEIRA_TERMOLABEIS', 'SALAO_VENDAS', 'SANITARIOS'
- `cleaning_type` (TEXT NOT NULL) -- 'ROUTINE', 'TERMINAL', 'IMMEDIATE'
- `scheduled_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `execution_timestamp` (TEXT NOT NULL) -- ISO8601
- `chemical_product` (TEXT NOT NULL) -- Ex: 'Álcool Etílico 70%', 'Quaternário de Amônio 5ª Geração', 'Hipoclorito de Sódio 1%'
- `dilution_or_batch` (TEXT)
- `performed_by` (TEXT NOT NULL) -- Nome ou ID do executor
- `verified_by_pharmacist` (TEXT) -- Farmacêutico RT que avaliou
- `verified_at` (TEXT)
- `status` (TEXT NOT NULL) -- 'PENDING', 'COMPLETED', 'NON_CONFORMING'
- `notes` (TEXT)
- `created_at` (TEXT NOT NULL)

### 2.2 Tabela `pest_control_certificates`
- `id` (UUID PK)
- `company_id` (TEXT NOT NULL)
- `service_provider_name` (TEXT NOT NULL)
- `service_provider_cnpj` (TEXT NOT NULL)
- `sanitary_license_number` (TEXT NOT NULL)
- `certificate_number` (TEXT NOT NULL UNIQUE)
- `application_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `expiration_date` (TEXT NOT NULL) -- YYYY-MM-DD (semestral)
- `target_pests` (TEXT NOT NULL) -- Ex: 'Baratas, Roedores, Formigas, Moscas'
- `chemical_agents_used` (TEXT NOT NULL)
- `antidote_information` (TEXT)
- `technical_responsible_pest` (TEXT NOT NULL) -- Químico/Biólogo/Eng. Agrônomo responsável
- `pharmacist_approval_crf` (TEXT NOT NULL) -- RT que homologou laudo na farmácia
- `status` (TEXT NOT NULL) -- 'VALID', 'EXPIRING_SOON', 'EXPIRED'
- `notes` (TEXT)
- `created_at` (TEXT NOT NULL)

### 2.3 Tabela `water_tank_cleaning_logs`
- `id` (UUID PK)
- `company_id` (TEXT NOT NULL)
- `service_provider` (TEXT NOT NULL)
- `cleaning_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `expiration_date` (TEXT NOT NULL) -- YYYY-MM-DD (semestral)
- `potability_report_number` (TEXT)
- `potability_status` (TEXT NOT NULL) -- 'POTABLE_COMPLIANT', 'NON_POTABLE_CONTAMINATED', 'PENDING_LAB'
- `responsible_cleaner` (TEXT NOT NULL)
- `pharmacist_crf` (TEXT NOT NULL)
- `status` (TEXT NOT NULL) -- 'VALID', 'EXPIRING_SOON', 'EXPIRED'
- `notes` (TEXT)
- `created_at` (TEXT NOT NULL)

### 2.4 Tabela `standard_operating_procedures`
- `id` (UUID PK)
- `company_id` (TEXT NOT NULL)
- `sop_code` (TEXT NOT NULL UNIQUE) -- Ex: 'POP-AMB-001'
- `title` (TEXT NOT NULL)
- `category` (TEXT NOT NULL) -- 'HIGIENE_AMBIENTAL', 'SERVICOS_FARMACEUTICOS', 'TERMOLABEIS', 'DESCARTE_RESIDUOS', 'DISPENSACAO'
- `version` (TEXT NOT NULL) -- Ex: '1.0', '2.0'
- `effective_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `next_review_date` (TEXT NOT NULL) -- YYYY-MM-DD
- `author_name` (TEXT NOT NULL)
- `reviewer_pharmacist_crf` (TEXT NOT NULL)
- `content_summary` (TEXT NOT NULL)
- `status` (TEXT NOT NULL) -- 'ACTIVE', 'NEEDS_REVISION', 'ARCHIVED'
- `created_at` (TEXT NOT NULL)
- `updated_at` (TEXT NOT NULL)

---

## 3. Serviços & Regras de Negócio (`SanitizationService`)
- Registro e listagem paginada/filtrada de higienizações de ambiente.
- Verificação/Homologação pelo Farmacêutico RT de um registro de higienização.
- Registro de Certificado de Dedetização com cálculo e controle automático de status de vigência (aviso preventivo quando expira em até 30 dias).
- Registro de Limpeza e Potabilidade de Caixa d'Água com controle semestral.
- Gestão do Ciclo de Vida de POPs (inclusão, versionamento, revisão e arquivamento).
- Relatório de Auditoria e KPI Consolidado de Conformidade Sanitária (Índice de conformidade sanitária de 0 a 100%, alertas de vencimentos).

---

## 4. Endpoints REST Fastify (`/api/sanitization/*`)
- `POST /api/sanitization/logs` - Registra nova higienização de setor.
- `GET /api/sanitization/logs` - Lista higienizações com filtros por setor, data e status.
- `POST /api/sanitization/logs/:id/verify` - Farmacêutico RT homologa registro de limpeza.
- `POST /api/sanitization/pest-control` - Cadastra certificado de dedetização.
- `GET /api/sanitization/pest-control` - Lista certificados e alerta de vigência.
- `POST /api/sanitization/water-tank` - Cadastra higienização de reservatório de água.
- `GET /api/sanitization/water-tank` - Lista registros e potabilidade da água.
- `POST /api/sanitization/sops` - Cadastra/atualiza Procedimento Operacional Padrão (POP).
- `GET /api/sanitization/sops` - Lista POPs vigentes e que necessitam de revisão.
- `GET /api/sanitization/compliance-overview` - KPI e diagnóstico global para fiscalização VISA.

---

## 5. Interface React & Experiência do Usuário (`SanitizationCompliancePage.tsx`)
- Indicadores de topo: Status Geral Sanitário (100% Regular / Alerta), Dias para próxima dedetização, Dias para próxima limpeza de reservatório, Higienizações realizadas no mês, POPs em dia.
- Abas de navegação direta:
  1. **Ronda Diária de Higienização**: checklist rápido de execução por setor com escolha de saneante e executor.
  2. **Dedetização & Pragas**: visualização de laudo ativo, licença sanitária e botão de renovação semestral.
  3. **Reservatório de Água**: laudos de limpeza e controle de potabilidade.
  4. **POPs & Manuais**: biblioteca de POPs com badges de status de vigência e modal para cadastrar/revisar POP.
