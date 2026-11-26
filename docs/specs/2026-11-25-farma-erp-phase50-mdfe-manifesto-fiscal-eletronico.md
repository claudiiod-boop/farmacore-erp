# Especificação Técnica - Fase 50: Emissor e Validador de MDF-e (Manifesto Eletrônico de Documentos Fiscais - Modelo 58 / Ajuste SINIEF 21/2010)

## 1. Contexto e Justificativa Regulatória
O MDF-e (Manifesto Eletrônico de Documentos Fiscais, modelo 58) é de emissão obrigatória para contribuintes emitentes de NF-e no transporte interestadual ou intermunicipal de cargas próprias ou fracionadas (Ajuste SINIEF 21/2010). No varejo farmacêutico de rede, as transferências de medicamentos entre Centros de Distribuição e Filiais, ou entre filiais de municípios distintos, exigem:
1. **Agrupamento de NF-e de Transferência:** Vinculação de todas as chaves de acesso das NF-e emitidas para o veículo transportador.
2. **Averbação de Seguro de Carga Farmacêutica:** Obrigatoriedade do registro dos dados da seguradora, número da apólice e número de averbação da carga.
3. **Identificação de Veículo e Condutor:** Registro do condutor (CPF e Nome), veículo de tração (Placa e UF) e registro RNTRC da ANTT.
4. **Encerramento de Manifesto Obrigatório:** O MDF-e deve ser encerrado após o descarregamento das mercadorias na filial de destino antes que o veículo possa realizar nova viagem interestadual/intermunicipal.
5. **DAMDFE (Documento Auxiliar do MDF-e):** Geração do espelho simplificado para acompanhamento da carga com QR Code e código de barras 1D de 44 dígitos.

## 2. Requisitos Técnicos
### 2.1 Modelo de Dados (Migration 049)
- `mdfe_documents`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `mdfe_number`: INTEGER NOT NULL
  - `series`: INTEGER NOT NULL DEFAULT 1
  - `access_key`: TEXT NOT NULL UNIQUE (44 dígitos, modelo 58)
  - `emission_type`: TEXT NOT NULL DEFAULT 'NORMAL' CHECK (emission_type IN ('NORMAL', 'CONTINGENCY'))
  - `uf_start`: TEXT NOT NULL
  - `uf_end`: TEXT NOT NULL
  - `driver_name`: TEXT NOT NULL
  - `driver_cpf`: TEXT NOT NULL
  - `vehicle_plate`: TEXT NOT NULL
  - `vehicle_rntrc`: TEXT
  - `insurance_company_name`: TEXT
  - `insurance_policy_number`: TEXT
  - `total_nfe_count`: INTEGER NOT NULL DEFAULT 0
  - `total_cargo_value_brl`: REAL NOT NULL DEFAULT 0.0
  - `total_weight_kg`: REAL NOT NULL DEFAULT 0.0
  - `sefaz_status_code`: TEXT NOT NULL DEFAULT '100'
  - `sefaz_protocol`: TEXT
  - `status`: TEXT NOT NULL CHECK (status IN ('DRAFT', 'AUTHORIZED', 'CLOSED', 'CANCELLED'))
  - `xml_content`: TEXT
  - `damdfe_content`: TEXT
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
  - `closed_at`: DATETIME
  - `cancelled_at`: DATETIME

- `mdfe_nfe_items`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `mdfe_id`: INTEGER NOT NULL (FK mdfe_documents ON DELETE CASCADE)
  - `nfe_access_key`: TEXT NOT NULL
  - `nfe_number`: INTEGER
  - `transfer_id`: INTEGER (FK transfers)
  - `destination_store_id`: INTEGER (FK stores)
  - `cargo_value_brl`: REAL NOT NULL
  - `weight_kg`: REAL NOT NULL
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

### 2.2 Funcionalidades do Backend (`MdfeFiscalService`)
1. `createMdfeDraft`: Geração de rascunho com cálculo automático do valor total da carga e somatório de peso com validação de condutor e veículo.
2. `authorizeMdfe`: Geração de chave de acesso de 44 dígitos (código UF + AAMM + CNPJ + mod 58 + série + número + tpEmis + cMDF + DV), montagem do XML assinado e autorização SEFAZ.
3. `closeMdfe`: Registro do evento de encerramento do manifesto (motivo, data de chegada e UF de encerramento).
4. `cancelMdfe`: Cancelamento dentro do prazo regulamentar SEFAZ (24 horas) com justificativa.
5. `generateDamdfe`: Emissão do Documento Auxiliar em formato texto 80mm/A4 com QR Code fiscal e chaves de acesso agrupadas.
6. `getMdfeKpis`: Métricas operacionais (total autorizados, em transporte, encerrados e carga total transportada em R$).
