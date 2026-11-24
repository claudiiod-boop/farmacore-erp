# Especificação Técnica - Fase 24: Fracionamento de Medicamentos em Blíster (RDC 80/2006 ANVISA)

## 1. Visão Geral e Fundamentação Sanitária
A **RDC nº 80, de 11 de maio de 2006**, da ANVISA estabelece as condições e requisitos para o fracionamento de medicamentos em farmácias e drogarias brasileiras.

O objetivo do fracionamento é fornecer ao paciente a quantidade exata de medicamento prescrita na receita médica, evitando a automedicação, desperdício e intoxicação decorrentes de sobras em domicílio, reduzindo custos para o consumidor.

### 1.1. Diretrizes Regulatórias Centrais
1. **Embalagem Fracionável Registrada na ANVISA:** Apenas medicamentos aprovados com embalagem fracionável (blíster picotado ou strip com lote e validade gravados em cada alvéolo) podem ser submetidos ao procedimento.
2. **Supervisão Farmacêutica Exclusiva:** O fracionamento só pode ser executado sob a responsabilidade e assinatura direta de farmacêutico habilitado com CRF ativo.
3. **Conversão e Rastreabilidade de Estoque:** Ao fracionar uma caixa fechada (produto pai com N unidades), dá-se baixa no lote pai e gera-se um sublote fracionado (produto filho ou unidade de dispensação) com rastreamento integral (lote de origem, data de fabricação, validade inalterada).
4. **Rotulagem Oficial Obrigatória (Art. 8º da RDC 80):** A embalagem secundária fornecida ao paciente (saquinho inviolável ou envelope) deve conter rótulo impresso com todos os dados sanitários obrigatórios, além da entrega compulsória da bula.

---

## 2. Modelagem de Dados (Migration 023)

### 2.1. Alterações em `products`
- Adicionar flags/colunas:
  - `is_fractionable` INTEGER NOT NULL DEFAULT 0 CHECK (is_fractionable IN (0, 1))
  - `units_per_package` INTEGER NOT NULL DEFAULT 1 CHECK (units_per_package >= 1)
  - `fractional_unit` TEXT DEFAULT 'COMPRIMIDO' (ex: 'COMPRIMIDO', 'CAPSULA', 'BLISTER', 'AMPOLA')

### 2.2. Tabela `fractionation_records`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `store_id` INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE
- `product_id` INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT
- `original_batch_id` INTEGER NOT NULL REFERENCES batches(id) ON DELETE RESTRICT
- `pharmacist_name` TEXT NOT NULL
- `pharmacist_crf` TEXT NOT NULL
- `pharmacist_crf_uf` TEXT NOT NULL
- `original_packages_opened` INTEGER NOT NULL CHECK (original_packages_opened > 0)
- `units_generated` INTEGER NOT NULL CHECK (units_generated > 0)
- `sub_batch_code` TEXT NOT NULL UNIQUE
- `fractionation_date` TEXT NOT NULL (CURRENT_TIMESTAMP)
- `expiry_date` TEXT NOT NULL (herdada do lote original)
- `notes` TEXT
- `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

### 2.3. Tabela `fractionation_dispensations`
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `fractionation_record_id` INTEGER NOT NULL REFERENCES fractionation_records(id) ON DELETE CASCADE
- `sale_id` INTEGER REFERENCES sales(id) ON DELETE SET NULL
- `pre_sale_id` INTEGER REFERENCES pre_sales(id) ON DELETE SET NULL
- `patient_name` TEXT NOT NULL
- `patient_cpf` TEXT
- `doctor_name` TEXT NOT NULL
- `doctor_crm` TEXT NOT NULL
- `doctor_uf` TEXT NOT NULL
- `units_dispensed` INTEGER NOT NULL CHECK (units_dispensed > 0)
- `unit_price` REAL NOT NULL CHECK (unit_price >= 0)
- `total_price` REAL NOT NULL CHECK (total_price >= 0)
- `leaflet_supplied` INTEGER NOT NULL DEFAULT 1 CHECK (leaflet_supplied IN (0, 1)) -- Bula entregue
- `posology` TEXT NOT NULL
- `dispensed_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP

---

## 3. Regras de Negócio e Serviços (`FractionationService`)
1. `fractionateMedicine(input)`:
   - Valida se o produto é fracionável (`is_fractionable = 1`).
   - Valida saldo disponível no lote original pai (`batches.quantity >= original_packages_opened`).
   - Abate as caixas fechadas do lote pai.
   - Gera o sublote no formato: `FRAC-<batch_number>-<timestamp>`.
   - Cria o registro em `fractionation_records`.
   - Adiciona as unidades geradas ao estoque fracionado.
2. `dispenseFractioned(input)`:
   - Valida receita médica obrigatória (médico, CRM, posologia).
   - Registra a entrega compulsória da bula (`leaflet_supplied = 1`).
   - Abate do saldo do sublote fracionado.
   - Gera o rótulo de dispensação térmica (48 colunas).
3. `generateOfficialLabel(dispensationId | recordId)`:
   - Monta o texto no padrão oficial do Artigo 8º da RDC 80/2006:
     - Dados do estabelecimento (FarmaCore, CNPJ, Farmacêutico RT);
     - DCB, nome comercial, concentração, forma farmacêutica;
     - Lote original e sublote de fracionamento;
     - Fabricação, validade original e data do fracionamento;
     - Quantidade de unidades, posologia e aviso de bula entregue.
4. `getFractionationKpis()`:
   - Total de fracionamentos realizados;
   - Unidades fracionadas disponíveis;
   - Economia estimada gerada ao consumidor;
   - Produtos habilitados para fracionamento.

---

## 4. Endpoints REST Fastify
- `GET /api/fractionation/products` - Produtos fracionáveis cadastrados.
- `PATCH /api/fractionation/products/:id/toggle` - Habilita/desabilita fracionamento em um produto.
- `POST /api/fractionation/records` - Executa fracionamento de lote pai para sublote.
- `GET /api/fractionation/records` - Lista lotes e registros de fracionamento.
- `GET /api/fractionation/records/:id` - Detalhes do registro com sublote.
- `POST /api/fractionation/dispense` - Dispensação de fracionado com registro de receita e bula.
- `GET /api/fractionation/label/:dispensationId` - Rótulo térmico RDC 80/2006.
- `GET /api/fractionation/kpis` - Dashboard de indicadores.

---

## 5. Interface React (`FractionationPage.tsx`)
- **Dashboard & KPIs:** Medicamentos fracionáveis, lotes ativos, unidades fracionadas, dispensações realizadas.
- **Aba 1: Fracionar Medicamento (Balcão Farmacêutico):** Seleção de produto fracionável e lote de origem, conferência de embalagem primária inviolável, identificação do farmacêutico (CRF), cálculo automático de unidades geradas e emissão do sublote.
- **Aba 2: Dispensação ao Paciente & Emissão de Rótulo RDC 80:** Informação de paciente, médico/CRM, quantidade prescrita e posologia, confirmação de entrega de bula e impressão de rótulo térmico.
- **Aba 3: Catálogo de Fracionáveis:** Gestão de medicamentos com embalagem fracionável registrada na ANVISA e parametrização de unidades por caixa.
