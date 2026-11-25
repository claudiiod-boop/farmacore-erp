# Especificação Técnica — Fase 47: Emissor e Validador de Cupom Fiscal SAT (CF-e-SAT SP / MF-e CE) com Contingência Off-line Automática e Envio em Lote à SEFAZ

## 1. Visão Geral
No varejo farmacêutico brasileiro, particularmente no estado de São Paulo (SAT Fiscal - Portaria CAT 147/2012) e Ceará (Módulo Fiscal Eletrônico - MF-e / Decreto 31.922/2016), a emissão do Cupom Fiscal Eletrônico (CF-e) é obrigatória para a grande maioria das drogarias, operando como contingência legal ou substituto direto da NFC-e:
1. **Comunicação com Hardware SAT / MF-e:** O PDV comunica-se com o módulo de segurança criptográfico (aparelho SAT físico ou emulador homologado SEFAZ) via DLL/libSAT (`EnviarDadosVenda`, `ConsultarSAT`, `ConsultarStatusOperacional`, `CancelarUltimaVenda`).
2. **Geração do XML do CF-e (Modelo 59):** Montagem do arquivo XML com tags fiscais rigorosas: dados do emitente (CNPJ, IE, IM), dados do destinatário (CPF facultativo ou obrigatório para PBM/Controlados), itens com EAN, NCM, CFOP, CEST, CST/CSOSN ICMS, PIS/COFINS monofásico e totalizadores.
3. **Contingência Off-line & Fila de Transmissão:** Caso ocorra falha de rede ou timeout com a SEFAZ, o cupom é assinado localmente pela memória do SAT (contingência nativa com validade jurídica de 10 dias) e mantido em fila local para sincronização em lote automática assim que a conectividade for restabelecida.
4. **Impressão do Extrato CF-e-SAT:** Geração do leiaute térmico de 80mm com chave de acesso de 44 dígitos, número de série do SAT de 9 dígitos e string codificada para QR Code de consulta pública SEFAZ.

---

## 2. Arquitetura de Dados (Migration 046)

### 2.1. `sat_devices` (Dispositivos / Módulos Fiscais SAT)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id)
- `pos_station_id` TEXT NOT NULL -- ex: 'CAIXA_01'
- `serial_number` TEXT UNIQUE NOT NULL -- ex: '000123456' (9 dígitos)
- `model` TEXT NOT NULL DEFAULT 'BEMATECH_RB2000' -- 'DIMEP_D_SAT', 'BEMATECH_RB2000', 'ELGIN_SMART', 'SWEDA_SAT', 'EMULADOR_SEFAZ'
- `sign_code` TEXT NOT NULL -- Código de vinculação AC (Software House + Farmácia)
- `status` TEXT NOT NULL DEFAULT 'ACTIVE' -- 'ACTIVE', 'BLOCKED', 'MAINTENANCE', 'UNLINKED'
- `last_status_check` TEXT
- `firmware_version` TEXT
- `memory_percent_used` REAL DEFAULT 0.0
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
- `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP

### 2.2. `cfe_sat_documents` (Cupons Fiscais Eletrônicos CF-e)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `sale_id` INTEGER NOT NULL REFERENCES sales(id)
- `store_id` INTEGER NOT NULL REFERENCES stores(id)
- `sat_device_id` INTEGER NOT NULL REFERENCES sat_devices(id)
- `access_key` TEXT UNIQUE NOT NULL -- Chave de 44 dígitos iniciando com '35' (SP) ou '23' (CE)
- `cfe_number` INTEGER NOT NULL -- Número sequencial do CF-e gerado pelo SAT
- `session_random_number` INTEGER NOT NULL -- Número aleatório de 6 dígitos gerado pelo PDV
- `total_amount` REAL NOT NULL
- `discount_amount` REAL NOT NULL DEFAULT 0.0
- `net_amount` REAL NOT NULL
- `xml_sent` TEXT NOT NULL
- `xml_signed` TEXT NOT NULL
- `qr_code_payload` TEXT NOT NULL
- `sefaz_status_code` TEXT NOT NULL DEFAULT '06000' -- '06000' = Emitido com Sucesso
- `sefaz_status_message` TEXT NOT NULL
- `status` TEXT NOT NULL DEFAULT 'AUTHORIZED' -- 'AUTHORIZED', 'CANCELLED', 'SYNC_PENDING'
- `issued_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
- `cancelled_at` TEXT
- `cancel_xml` TEXT
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

### 2.3. `cfe_sat_contingency_queue` (Fila de Sincronização em Lote)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `cfe_id` INTEGER NOT NULL REFERENCES cfe_sat_documents(id) ON DELETE CASCADE
- `sat_device_id` INTEGER NOT NULL REFERENCES sat_devices(id)
- `status` TEXT NOT NULL DEFAULT 'PENDING' -- 'PENDING', 'TRANSMITTED', 'ERROR'
- `retry_count` INTEGER NOT NULL DEFAULT 0
- `last_error` TEXT
- `last_attempt_at` TEXT
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

---

## 3. Serviços & Regras de Negócio (`SatFiscalService`)
1. **`registerSatDevice(input)`**: Cadastra e vincula módulo SAT ao caixa/loja.
2. **`checkSatStatus(deviceId)`**: Consulta status operacional do aparelho SAT (memória, bateria, rede, comunicação com SEFAZ).
3. **`issueCfeSat(saleId, deviceId, customerCpf?)`**:
   - Monta o XML do CF-e Modelo 59 com produtos, CFOP, NCM, ICMS, PIS/COFINS monofásico.
   - Dispara chamada ao SAT (`EnviarDadosVenda`).
   - Retorna chave de acesso de 44 dígitos, XML assinado e string QR Code.
   - Se SAT operar sem internet na farmácia: emite em contingência local e enfileira em `cfe_sat_contingency_queue`.
4. **`syncContingencyBatch(deviceId)`**: Dispara sincronização em lote das vendas contingenciadas para a SEFAZ.
5. **`cancelLastCfe(cfeId, justification)`**: Cancela o último CF-e emitido no prazo regulatório de 30 minutos (Portaria CAT 147/2012).
6. **`getSatKpis(storeId)`**: Indicadores de emissão SAT, cupons autorizados, cancelados e lote em contingência.
