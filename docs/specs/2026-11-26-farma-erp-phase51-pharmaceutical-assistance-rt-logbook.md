# Especificação Técnica - Fase 51: Gestão de Assistência Farmacêutica Integral (Lei 13.021/2014) & Livro Eletrônico de Ocorrências do Farmacêutico RT (CRF/CFF)

## 1. Contexto e Justificativa Regulatória
A Lei Federal nº 13.021/2014 transformou as farmácias e drogarias no Brasil em unidades de prestação de assistência à saúde e assistência farmacêutica integral. Entre as exigências fiscalizadas pelo Conselho Federal de Farmácia (CFF), Conselhos Regionais (CRF) e Vigilâncias Sanitárias (VISA/ANVISA):
1. **Presença Obrigatória do Farmacêutico Integral:** A farmácia deve manter farmacêutico habilitado presente durante todo o horário de funcionamento do estabelecimento (RT Titular e RT Substituto).
2. **Certidão de Regularidade Técnica (CRT):** Controle rigoroso do número e data de vigência do certificado de regularidade emitido pelo CRF competente.
3. **Livro de Ocorrências Farmacêuticas (RDC 44/2009 e Resoluções CFF):** Registro obrigatório e cronológico de todas as intervenções sanitárias, queixas técnicas, desvios de temperatura, inspeções do fiscal do CRF e notificações com integridade garantida por hash digital.
4. **Espelho Fiscalizatório Imediato:** Emissão instantânea do extrato do livro de ocorrências para inspeções in loco dos fiscais do CRF e VISA.

## 2. Requisitos Técnicos
### 2.1 Modelo de Dados (Migration 050)
- `pharmaceutical_staff`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `name`: TEXT NOT NULL
  - `cpf`: TEXT NOT NULL UNIQUE
  - `crf_number`: TEXT NOT NULL
  - `crf_uf`: TEXT NOT NULL
  - `role`: TEXT NOT NULL CHECK (role IN ('RT_TITULAR', 'RT_SUBSTITUTO', 'FARMACEUTICO_ASSISTENTE'))
  - `phone`: TEXT
  - `email`: TEXT
  - `crt_certificate_number`: TEXT
  - `crt_validity_date`: TEXT
  - `is_active`: INTEGER NOT NULL DEFAULT 1
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `pharmaceutical_shifts`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `staff_id`: INTEGER NOT NULL (FK pharmaceutical_staff ON DELETE CASCADE)
  - `day_of_week`: INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6)
  - `start_time`: TEXT NOT NULL (HH:MM)
  - `end_time`: TEXT NOT NULL (HH:MM)
  - `is_active`: INTEGER NOT NULL DEFAULT 1
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `pharmaceutical_logbook_entries`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `staff_id`: INTEGER NOT NULL (FK pharmaceutical_staff)
  - `entry_type`: TEXT NOT NULL CHECK (entry_type IN ('INSPECTION_CRF', 'INSPECTION_VISA', 'TEMPERATURE_EXCURSION', 'RECALL_ALERT', 'TECHNICAL_COMPLAINT', 'DISPENSATION_INCIDENT', 'GENERAL_OCCURRENCE'))
  - `title`: TEXT NOT NULL
  - `description`: TEXT NOT NULL
  - `crf_inspector_name`: TEXT
  - `crf_inspection_term_number`: TEXT
  - `action_taken`: TEXT
  - `entry_date`: TEXT NOT NULL
  - `sha256_hash`: TEXT NOT NULL
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### 2.2 Funcionalidades do Backend (`PharmaceuticalAssistanceService`)
1. Cadastro de profissionais farmacêuticos com checagem de vigência da CRT e unicidade de RT Titular por loja.
2. Definição da grade de escalas horárias semanais para cobertura integral.
3. Registro no Livro Eletrônico de Ocorrências com carimbo de tempo e cálculo automático de hash SHA-256 de integridade.
4. Geração de extrato impresso/formatado para fiscalização do CRF/VISA.
5. KPIs de conformidade da Lei 13.021/2014 (farmacêuticos ativos, horas semanais cobertas, dias para expiração da CRT e total de ocorrências).
