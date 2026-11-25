# Especificação Técnica — Fase 48: Balança de Precisão & Checkout com Código de Barras Pesável (Portaria INMETRO 236/1994 e RDC 67/2007)

## 1. Visão Geral
No varejo farmacêutico e farmácias de manipulação (RDC 67/2007 e Portaria INMETRO 236/1994), a pesagem precisa de matérias-primas, cápsulas, pós, cosméticos a granel, produtos fracionados e itens pesáveis no balcão/checkout exige controle metrológico rigoroso:
1. **Comunicação Serial RS232 / USB com Balanças:** Protocolos contínuos e sob demanda (Toledo Prix 3 / Prix 4 / Prix 5, Filizola Platina / CS, Urano Pop-Z, Balmak) para leitura automática de Tara, Peso Bruto, Peso Líquido e verificação de peso estável (estabilidade metrológica).
2. **Decodificação de Código de Barras EAN-13 Pesável (Padrão 2XXXXX):** No balcão ou self-service, etiquetas impressas por balanças etiquetadoras iniciam com o dígito `2`. O código embute o prefixo (`2`), o código do produto (4 ou 5 dígitos), o tipo de dado (peso líquido em gramas ou valor total em centavos) e o dígito verificador EAN-13. O FarmaCore deve decodificar instantaneamente o código no scanner do PDV, calculando a quantidade vendida ou valor a cobrar.
3. **Emissão de Etiquetas de Pesagem Térmica:** Geração de etiquetas de gôndola/balcão com código de barras gerado, data de pesagem, peso líquido, preço por kg, tara descontada, lote e validade sanitária.
4. **Registro e Auditoria de Pesagem Metrológica:** Histórico com identificação do operador, balança utilizada, selo INMETRO / lacre metrológico e verificação de estabilidade para evitar fraudes ou desvios de dosagem em produtos magistrais.

---

## 2. Arquitetura de Dados (Migration 047)

### 2.1. `scale_devices` (Balanças Homologadas)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id)
- `name` TEXT NOT NULL -- ex: 'Balança Checkout 01', 'Balança Analítica Laboratório'
- `serial_port` TEXT NOT NULL -- ex: 'COM1', '/dev/ttyUSB0'
- `baud_rate` INTEGER NOT NULL DEFAULT 9600
- `protocol` TEXT NOT NULL DEFAULT 'TOLEDO_PR4' -- 'TOLEDO_PR4', 'FILIZOLA', 'URANO', 'BALMAK', 'GENERICA_CONTINUA'
- `inmetro_seal_number` TEXT NOT NULL -- Selo / Lacre do INMETRO
- `capacity_kg` REAL NOT NULL DEFAULT 15.0
- `precision_grams` REAL NOT NULL DEFAULT 5.0 -- 5g para balcão, 0.001g para manipulação analítica
- `is_active` INTEGER NOT NULL DEFAULT 1
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
- `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP

### 2.2. `weighted_barcode_configs` (Configuração do Padrão EAN-13 Pesável)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id)
- `prefix` TEXT NOT NULL DEFAULT '2' -- Padrão GS1 Brasil para pesáveis
- `product_code_length` INTEGER NOT NULL DEFAULT 4 -- 4 ou 5 dígitos
- `payload_type` TEXT NOT NULL DEFAULT 'TOTAL_VALUE' -- 'TOTAL_VALUE' (centavos) ou 'NET_WEIGHT' (gramas)
- `decimal_places` INTEGER NOT NULL DEFAULT 2
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

### 2.3. `scale_weighing_logs` (Registros de Pesagem / Etiquetas Emitidas)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `scale_device_id` INTEGER REFERENCES scale_devices(id)
- `product_id` INTEGER NOT NULL REFERENCES products(id)
- `batch_id` INTEGER REFERENCES batches(id)
- `gross_weight_grams` REAL NOT NULL
- `tare_grams` REAL NOT NULL DEFAULT 0.0
- `net_weight_grams` REAL NOT NULL
- `price_per_kg` REAL NOT NULL
- `total_price` REAL NOT NULL
- `generated_barcode` TEXT NOT NULL
- `operator_name` TEXT
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

---

## 3. Serviços & Regras de Negócio (`ScaleWeighingService`)
1. **`registerScaleDevice(input)`**: Cadastra balança com porta serial, protocolo e selo metrológico do INMETRO.
2. **`readWeightFromScale(deviceId)`**: Simula/lê o buffer da balança serial, validando estabilidade e subtraindo a tara metrológica (`net = gross - tare`).
3. **`decodeWeightedBarcode(barcode, storeId)`**: Decodifica strings de 13 dígitos que iniciam com '2'. Identifica o produto no cadastro, calcula a quantidade em kg ou busca o valor total e calcula o peso a partir do preço/kg.
4. **`generateWeighingLabel(productId, batchId, netWeightGrams, scaleDeviceId?)`**: Gera o código EAN-13 calculando o dígito verificador módulo 10 e cria registro em `scale_weighing_logs`.
5. **`getScaleKpis(storeId)`**: Indicadores de balanças ativas, pesagens realizadas no dia, peso total movimentado e conferência de calibração metrológica.
