# Especificação Técnica - Fase 34: Termômetro & Higrômetro Digital — Monitoramento de Temperatura e Umidade (RDC 44/2009 e RDC 430/2020 ANVISA)

## 1. Visão Geral & Contexto Regulatório Farmacêutico
O controle e monitoramento de temperatura e umidade relativa no varejo farmacêutico são requisitos sanitários obrigatórios fiscalizados pelas Vigilâncias Sanitárias (VISAs) e ANVISA:
- **RDC 44/2009 ANVISA (Boas Práticas Farmacêuticas):**
  - A drogaria deve manter registros diários de temperatura e umidade das áreas de armazenamento, dispensação e, especialmente, dos equipamentos de refrigeração para produtos termolábeis.
  - A leitura deve ocorrer em intervalos definidos (no mínimo duas vezes ao dia: manhã e tarde), registrando temperatura de momento, máxima e mínima.
- **RDC 430/2020 ANVISA (Boas Práticas de Distribuição, Armazenagem e Transporte de Medicamentos):**
  - **Cadeia de Frio (Geladeira / Câmara Fria de Termolábeis):**
    - Faixa estrita: $+2,0^\circ\text{C}$ a $+8,0^\circ\text{C}$.
    - Medicamentos como insulinas, vacinas, biológicos e análogos de GLP-1 (Ozempic, Saxenda, Mounjaro) sofrem degradação irreversível ou precipitação com risco de perda de eficácia ou formação de imunogenicidade se congelados ($< +2^\circ\text{C}$) ou expostos a calor ($> +8^\circ\text{C}$).
  - **Salão de Vendas / Estoque Seco (Ambiente Climatizado):**
    - Faixa recomendada: $+15,0^\circ\text{C}$ a $+30,0^\circ\text{C}$ (ideal até $+25,0^\circ\text{C}$).
    - Umidade Relativa do Ar (UR): $\le 70\%$ (geralmente $40\%$ a $70\%$).
- **Gestão de Excursões de Temperatura:**
  - Qualquer leitura fora da faixa regulatória constitui **Excursão Térmica**.
  - O sistema deve classificar a severidade (`CRITICAL` para geladeira fora de $+2..+8^\circ\text{C}$, ou `MILD` para desvio leve no salão), emitir alerta visual sonoro, registrar o tempo decorrido e permitir ao Farmacêutico RT abrir automaticamente um registro de **Quarentena Sanitária** (Fase 33) para avaliação técnica de estabilidade dos lotes contidos na geladeira.

---

## 2. Modelagem do Banco de Dados (Migration 033)

### 2.1 Tabela `temperature_sensors` (Termômetros / Sensores Calibrados)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `store_id` (INTEGER NOT NULL REFERENCES stores(id))
- `name` (TEXT NOT NULL) -- Ex: "Geladeira de Termolábeis 01", "Salão de Vendas", "Estoque Seco"
- `location_type` (TEXT NOT NULL CHECK(location_type IN ('REFRIGERATOR_COLD_CHAIN', 'SALES_FLOOR', 'STORAGE_ROOM')))
- `min_allowed_temp` (REAL NOT NULL) -- Ex: 2.0 para geladeira, 15.0 para salão
- `max_allowed_temp` (REAL NOT NULL) -- Ex: 8.0 para geladeira, 30.0 para salão
- `min_allowed_humidity` (REAL NOT NULL DEFAULT 40.0)
- `max_allowed_humidity` (REAL NOT NULL DEFAULT 70.0)
- `serial_number` (TEXT)
- `calibration_cert_number` (TEXT) -- Certificado RBC / Inmetro
- `calibration_due_date` (TEXT) -- Validade da calibração periódica
- `is_active` (INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)))
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

### 2.2 Tabela `temperature_readings` (Histórico de Medições)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `sensor_id` (INTEGER NOT NULL REFERENCES temperature_sensors(id) ON DELETE CASCADE)
- `store_id` (INTEGER NOT NULL REFERENCES stores(id))
- `temperature` (REAL NOT NULL) -- Temperatura de momento (°C)
- `humidity` (REAL) -- Umidade relativa (%)
- `max_temp_recorded` (REAL) -- Temperatura máxima registrada no ciclo
- `min_temp_recorded` (REAL) -- Temperatura mínima registrada no ciclo
- `is_excursion` (INTEGER NOT NULL DEFAULT 0 CHECK(is_excursion IN (0, 1)))
- `recorded_by` (TEXT NOT NULL)
- `notes` (TEXT)
- `recorded_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

### 2.3 Tabela `temperature_excursions` (Incidentes de Excursão Térmica)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `sensor_id` (INTEGER NOT NULL REFERENCES temperature_sensors(id) ON DELETE CASCADE)
- `store_id` (INTEGER NOT NULL REFERENCES stores(id))
- `reading_id` (INTEGER NOT NULL REFERENCES temperature_readings(id) ON DELETE CASCADE)
- `started_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `resolved_at` (DATETIME)
- `severity` (TEXT NOT NULL CHECK(severity IN ('CRITICAL', 'MILD')))
- `peak_temp` (REAL NOT NULL)
- `min_temp` (REAL NOT NULL)
- `action_taken` (TEXT)
- `pharmacist_crf` (TEXT)
- `quarantine_record_id` (INTEGER REFERENCES quarantine_records(id))
- `status` (TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'RESOLVED')))
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

---

## 3. Serviços & Endpoints

### 3.1 `TemperatureMonitoringService`
- `registerSensor(input)`: Cadastra termômetro/sensor com limites configurados e dados de calibração RBC.
- `recordReading(input)`:
  - Salva leitura de temperatura e umidade.
  - Compara com `min_allowed_temp` e `max_allowed_temp` (e umidade).
  - Se estiver fora da faixa permitida, marca `is_excursion = 1` e abre automaticamente registro em `temperature_excursions`.
  - Se for geladeira (`REFRIGERATOR_COLD_CHAIN`), classifica como `CRITICAL` e pode disparar quarentena preventiva de termolábeis.
- `resolveExcursion(id, input)`:
  - Atualiza status para `RESOLVED`.
  - Registra ação corretiva e CRF do farmacêutico responsável.
  - Vincula opcionalmente ao registro de quarentena sanitária.
- `listSensors(storeId)`: Retorna sensores da loja com status da última leitura.
- `listReadings(sensorId, dateRange)`: Retorna histórico de medições para o Mapa de Temperatura diário.
- `listExcursions(storeId, status)`: Retorna ocorrências de excursão térmica.
- `getKpis(storeId)`: Retorna contadores de sensores ativos, excursões abertas, temperatura atual da geladeira e salão, e status sanitário.

### 3.2 Endpoints REST
- `POST /api/temperature/sensors`: Cadastra sensor/termômetro.
- `GET /api/temperature/sensors`: Lista sensores com última leitura.
- `POST /api/temperature/readings`: Registra medição manual ou de telemetria IoT.
- `GET /api/temperature/readings`: Lista medições para auditoria e relatório VISA.
- `GET /api/temperature/excursions`: Lista incidentes de excursão.
- `POST /api/temperature/excursions/:id/resolve`: Resolve incidente de excursão com laudo farmacêutico.
- `GET /api/temperature/kpis`: Métricas do módulo.

---

## 4. Frontend & Experiência de Uso (`TemperatureMonitoringPage`)
- Termômetros visuais com indicação das faixas ideais ($+2..+8^\circ\text{C}$ para geladeira com agulha indicativa, e $+15..+25^\circ\text{C}$ / $40..70\%$ UR para o salão).
- Registro rápido de medição matutina e vespertina com cálculo de máxima e mínima.
- Alerta visual com sirene pulsante em caso de excursão térmica com botão direto para "Abrir Quarentena de Lotes".
- Gráfico/Tabela de auditoria para fiscalização sanitária da VISA com emissão de Mapa Térmico.
