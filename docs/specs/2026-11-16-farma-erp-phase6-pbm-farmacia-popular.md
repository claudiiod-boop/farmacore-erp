# FarmaCore ERP & PDV — Especificação Técnica da Fase 6
## Gateway de Convênios Farmacêuticos (PBM) & Farmácia Popular do Brasil (Datasus/MS)

**Data:** 16 de Novembro de 2026  
**Status:** Revisado & Aprovado pelo Builder-Check  
**Contexto:** Evolução do FarmaCore ERP após a conclusão do Balcão Ágil (Fases 1 e 2), Frente de Caixa/PDV Híbrido (Fase 3), Motor Fiscal Autônomo NFC-e (Fase 4) e Compras/SNGPC (Fase 5). Implementação da **Abordagem 1: Gateway Unificado de Convênios & Subsídios (Padrão InovaFarma / Linx)** para autorização em tempo real de subsídios públicos e privados.

---

## 1. Visão Geral & Objetivos de Negócio

No ecossistema farmacêutico brasileiro, a dispensação de medicamentos sob o programa **Aqui Tem Farmácia Popular (Ministério da Saúde / Datasus)** e autorizadores privados de PBM (**Pharmacy Benefit Management** — Vidalink, e-Pharma, Funcional Card, Orizon) representa entre 25% e 45% do faturamento de uma drogaria independente.

A **Fase 6** dota o FarmaCore ERP de um motor corporativo de convênios farmacêuticos que gerencia a pré-autorização, dispensação subsidiada, co-pagamento do paciente, estornos e conformidade com as regras fiscais e sanitárias auditadas pelo **Denasus (Departamento Nacional de Auditoria do SUS)**:

1. **Gateway Unificado de PBM (`PbmProvider`):**
   - Abstração agnóstica para suportar múltiplos provedores (Datasus SOAP/WSDL, PBMs privados REST/JSON e mocks de simulação offline).
   - Ciclo de vida padrão de transação: `authorize()` (pré-autorização/reserva de cota), `confirm()` (efetivação vinculada ao fechamento do cupom fiscal) e `cancel()` (estorno administrativo ou por desistência da venda).

2. **Módulo Regulatório Farmácia Popular do Brasil (Datasus/MS):**
   - Protocolo SOAP/XML canônico compatível com o WebService de Autorização do Datasus (`wsfarmaciapopular`).
   - Autenticação e assinatura digital via certificado ICP-Brasil (A1 em arquivo `.pfx` ou `.pem`), com criptografia nativa `node:crypto`.
   - **Regras Regulatórias do Ministério da Saúde (Portaria MS nº 184/2011 e Portaria MS nº 675/2023):**
     - Bloqueio por intervalo temporal de 30 dias por princípio ativo / apresentação do Datasus (`fp_code`).
     - Cálculo de cobertura com base na posologia diária prescrita (`daily_dose`).
     - Validação de CRM/UF do prescritor médico e data de emissão da receita: validade geral de **180 dias** e validade estendida de **365 dias (1 ano)** para anticoncepcionais.
     - Validação de elegibilidade etária (ex.: fraldas geriátricas restritas a pacientes com **idade >= 60 anos** ou laudo com CID específico; limite de 40 unidades a cada 10 dias).
     - Separação precisa de gratuidade 100% (hipertensão, diabetes, asma, osteoporose, anticoncepcionais e beneficiários do Bolsa Família) e medicamentos com co-pagamento (dislipidemia, rinite, Parkinson, glaucoma e fraldas com até 90% de subsídio sobre o Preço de Referência do Ministério da Saúde).
     - Identificação de retiradas por terceiros / procuradores legais (`proxy_name`, `proxy_cpf`).
   - **Emulador/Simulador Datasus Mock (`DatasusMockProvider`):**
     - Ambiente de simulação completo para desenvolvimento e testes unitários 100% offline no Vitest, reproduzindo cenários de aprovação, saldo insuficiente, bloqueio temporal de 30 dias, receita vencida, restrição etária, timeout de conexão e cancelamento idempotente.

3. **Impressão do Cupom Vinculado (Fiscalização Denasus):**
   - Emissão das **2 vias obrigatórias** em padrão ESC/POS (48 colunas):
     - **1ª Via - Consumidor:** Detalhamento do valor da tabela, valor subsidiado pelo Governo Federal e valor do co-pagamento pago no caixa.
     - **2ª Via - Estabelecimento (Guarda Obrigatória por 5 Anos):** Declaração legal de recebimento, listagem completa de itens autorizados e lotes entregues, dados completos da receita médica, dados do médico prescritor e campos de assinatura do paciente/procurador (com RG e Órgão Emissor) e do farmacêutico responsável técnico (CRF).

4. **Integração com Caixa e Vendas (PDV & Balcão):**
   - Expansão do meio de pagamento no PDV: adição do enum `CONVENIO_PBM`.
   - Lançamento automático da parcela subsidiada como `CONVENIO_PBM` e direcionamento do saldo de co-pagamento para Dinheiro, Cartão ou PIX.
   - O meio `CONVENIO_PBM` é registrado nos totalizadores da sessão de caixa (`totalsByMethod`), mas **nunca é somado ao dinheiro físico da gaveta** (`current_cash` / `expectedCash`), evitando divergências no fechamento do caixa.
   - Vínculo direto com a NFC-e (tPag 99 / Outros com descrição "PROGRAMA FARMACIA POPULAR") e baixa de estoque atômica com rastreabilidade de lotes (`batches`).

---

## 2. Modelagem do Banco de Dados (Migração `005_pbm_farmacia_popular.sql`)

```sql
-- Migration 005: PBM & Farmacia Popular Gateway (Refined)

-- 1. Provedores PBM
CREATE TABLE IF NOT EXISTS pbm_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT UNIQUE NOT NULL, -- 'FARMACIA_POPULAR', 'VIDALINK', 'EPHARMA', 'FUNCIONAL'
  provider_name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'MOCK' CHECK (environment IN ('PRODUCAO', 'HOMOLOGACAO', 'MOCK')),
  is_active INTEGER NOT NULL DEFAULT 1,
  credentials_json TEXT, -- usuario, senha, cnpj, cert_pfx_base64, cert_password, endpoint
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Transações de Autorização PBM / Farmácia Popular
CREATE TABLE IF NOT EXISTS pbm_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_uuid TEXT UNIQUE NOT NULL,
  provider_id TEXT NOT NULL REFERENCES pbm_configs(provider_id),
  sale_id INTEGER REFERENCES sales(id) ON DELETE RESTRICT,
  authorization_protocol TEXT NOT NULL,
  receipt_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('AUTHORIZED', 'CONFIRMED', 'CANCELLED', 'REJECTED')),
  patient_cpf TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_birth_date TEXT,
  doctor_crm TEXT NOT NULL,
  doctor_uf TEXT NOT NULL,
  doctor_name TEXT,
  prescription_date TEXT NOT NULL,
  proxy_name TEXT,
  proxy_cpf TEXT,
  fiscal_key_nfce TEXT,
  nfce_number INTEGER,
  total_gross_amount REAL NOT NULL,
  subsidy_amount REAL NOT NULL,
  patient_copay_amount REAL NOT NULL,
  rejection_reason TEXT,
  cancellation_protocol TEXT,
  cancellation_reason TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pbm_trans_protocol ON pbm_transactions(authorization_protocol);
CREATE INDEX IF NOT EXISTS idx_pbm_trans_cpf ON pbm_transactions(patient_cpf);
CREATE INDEX IF NOT EXISTS idx_pbm_trans_sale ON pbm_transactions(sale_id);
CREATE INDEX IF NOT EXISTS idx_pbm_trans_created ON pbm_transactions(created_at);

-- 3. Itens Autorizados na Transação PBM
CREATE TABLE IF NOT EXISTS pbm_transaction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pbm_transaction_id INTEGER NOT NULL REFERENCES pbm_transactions(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  batch_id INTEGER REFERENCES batches(id) ON DELETE RESTRICT,
  ean TEXT NOT NULL,
  ms_registration TEXT NOT NULL,
  product_name TEXT NOT NULL,
  daily_dose REAL NOT NULL DEFAULT 1.0,
  authorized_quantity INTEGER NOT NULL,
  unit_gross_price REAL NOT NULL,
  total_gross_price REAL NOT NULL,
  reference_unit_price REAL NOT NULL DEFAULT 0.0,
  subsidy_unit_price REAL NOT NULL,
  subsidy_total_price REAL NOT NULL,
  patient_unit_price REAL NOT NULL,
  patient_total_price REAL NOT NULL,
  program_type TEXT NOT NULL DEFAULT 'GRATUITO' CHECK (program_type IN ('GRATUITO', 'CO_PAGAMENTO', 'DESCONTO_CONVENIO')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pbm_items_transaction ON pbm_transaction_items(pbm_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pbm_items_product ON pbm_transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_pbm_items_batch ON pbm_transaction_items(batch_id);

-- 4. Extensão da tabela de produtos com metadados Farmácia Popular / PBM
ALTER TABLE products ADD COLUMN fp_eligible INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN fp_code TEXT; -- Código do medicamento na tabela oficial do Datasus
ALTER TABLE products ADD COLUMN fp_reference_price REAL DEFAULT 0.0;
ALTER TABLE products ADD COLUMN fp_type TEXT CHECK (fp_type IS NULL OR fp_type IN ('GRATUITO', 'CO_PAGAMENTO'));
```

---

## 3. Tipos e Contratos do Gateway (`src/modules/pbm/types.ts`)

```typescript
export interface PbmItemRequest {
  productId: number;
  ean: string;
  msRegistration: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  dailyDose?: number; // Posologia diária (ex: 1 comprimido ao dia)
  batchId?: number;
}

export interface PbmAuthorizeParams {
  providerId: 'FARMACIA_POPULAR' | 'VIDALINK' | 'EPHARMA' | 'FUNCIONAL' | 'MOCK';
  patientCpf: string;
  patientName: string;
  patientBirthDate?: string; // YYYY-MM-DD
  doctorCrm: string;
  doctorUf: string;
  doctorName?: string;
  prescriptionDate: string; // YYYY-MM-DD
  proxyName?: string;
  proxyCpf?: string;
  isBolsaFamilia?: boolean;
  items: PbmItemRequest[];
}

export interface PbmItemResult {
  productId: number;
  ean: string;
  msRegistration: string;
  productName: string;
  batchId?: number;
  dailyDose: number;
  authorizedQuantity: number;
  unitGrossPrice: number;
  totalGrossPrice: number;
  referenceUnitPrice: number;
  subsidyUnitPrice: number;
  subsidyTotalPrice: number;
  patientUnitPrice: number;
  patientTotalPrice: number;
  programType: 'GRATUITO' | 'CO_PAGAMENTO' | 'DESCONTO_CONVENIO';
  status: 'APROVADO' | 'REJEITADO';
  rejectReason?: string;
}

export interface PbmAuthorizationResult {
  success: boolean;
  transactionUuid: string;
  authorizationProtocol: string;
  providerId: string;
  patientCpf: string;
  patientName: string;
  totalGrossAmount: number;
  subsidyAmount: number;
  patientCopayAmount: number;
  items: PbmItemResult[];
  errorMessage?: string;
}

export interface PbmConfirmParams {
  authorizationProtocol: string;
  saleId: number;
  fiscalKeyNfce?: string;
  nfceNumber?: number;
}

export interface PbmConfirmResult {
  success: boolean;
  authorizationProtocol: string;
  receiptNumber: string;
  confirmedAt: string;
  errorMessage?: string;
}

export interface PbmProvider {
  providerId: string;
  providerName: string;
  authorize(params: PbmAuthorizeParams): Promise<PbmAuthorizationResult>;
  confirm(params: PbmConfirmParams): Promise<PbmConfirmResult>;
  cancel(protocol: string, reason: string): Promise<{ success: boolean; cancellationProtocol?: string; message?: string }>;
}
```

---

## 4. Formatador do Cupom Vinculado ESC/POS (`pbm-receipt-formatter.ts`)

A formatação em 48 colunas atende integralmente ao manual do Datasus e assegura que a 2ª via física contenha todos os dados para fiscalização do Denasus:

```text
================================================
           AQUI TEM FARMÁCIA POPULAR
              MINISTÉRIO DA SAÚDE
================================================
FARMACIA FARMACORE LTDA
CNPJ: 12.345.678/0001-90  IE: 123.456.789.111
RUA DAS FARMACIAS, 123 - CENTRO - CURITIBA/PR
------------------------------------------------
1a VIA - CONSUMIDOR
PROTOCOLO AUTORIZACAO: FP20261116000001
RECIBO DATASUS: 987654321
DATA AUTORIZACAO: 16/11/2026 15:42:10
BENEFICIARIO: JOAO DA SILVA
CPF: 123.***.***-00
MEDICO: DR. CARLOS SILVA - CRM 12345/PR
DATA DA RECEITA: 10/11/2026
------------------------------------------------
ITENS AUTORIZADOS:
LOSARTANA POTASSICA 50MG CX 30 CP
   1 CX  x R$ 12,00                     R$ 12,00
   VLR SUBSIDIO GOVERNO:                R$ 12,00
   VLR PAGO PACIENTE:                    R$ 0,00
------------------------------------------------
TOTAL BRUTO:                            R$ 12,00
TOTAL SUBSIDIADO (MIN. SAUDE):          R$ 12,00
TOTAL A PAGAR PELO BENEFICIARIO:         R$ 0,00
================================================

[CORTE DE PAPEL]

================================================
           AQUI TEM FARMÁCIA POPULAR
              MINISTÉRIO DA SAÚDE
================================================
2a VIA - ESTABELECIMENTO (GUARDA OBRIGATORIA: 5 ANOS)
PROTOCOLO AUTORIZACAO: FP20261116000001
RECIBO DATASUS: 987654321
CUPOM FISCAL / NFC-e: 000.012.345
DATA: 16/11/2026 15:42:10
BENEFICIARIO: JOAO DA SILVA
CPF: 123.***.***-00  DT NASC: 15/05/1958
MEDICO: DR. CARLOS SILVA - CRM 12345/PR
DATA RECEITA: 10/11/2026
------------------------------------------------
ITENS DISPENSADOS / AUDITORIA DENASUS:
01. LOSARTANA POTASSICA 50MG CX 30 CP
    EAN: 7891234567890 | LOTE: LOT12345
    QTD AUTORIZADA: 1 CX | DOSE DIARIA: 1.0
    VLR BRUTO: R$ 12,00 | SUBSIDIO: R$ 12,00
------------------------------------------------
TOTAL BRUTO:                            R$ 12,00
TOTAL SUBSIDIADO:                       R$ 12,00
TOTAL PAGO PELO PACIENTE:                R$ 0,00
------------------------------------------------
DECLARO TER RECEBIDO DO MINISTÉRIO DA SAÚDE,
ATRAVÉS DO PROGRAMA FARMÁCIA POPULAR DO BRASIL,
OS MEDICAMENTOS/FRALDAS CONSTANTES NESTE CUPOM.

________________________________________________
ASSINATURA DO BENEFICIARIO OU PROCURADOR LEGAL
NOME: JOAO DA SILVA
RG: ___________________ ORGAO EMISSOR: _________

________________________________________________
FARMACÊUTICO RESPONSÁVEL TÉCNICO - CRF/PR 98765
================================================
```

---

## 5. Endpoints REST Fastify (`src/api/routes/pbm.ts`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/pbm/providers` | Lista provedores configurados e seus status |
| `POST` | `/api/pbm/authorize` | Solicita autorização de itens (cálculo de cotas e subsídios) |
| `POST` | `/api/pbm/confirm` | Confirma a autorização vinculando-a ao `saleId` e NFC-e |
| `POST` | `/api/pbm/cancel` | Cancela / estorna uma autorização prévia com geração de protocolo |
| `GET` | `/api/pbm/transactions` | Lista histórico de transações autorizadas para conferência |
| `GET` | `/api/pbm/transactions/:id/coupon` | Retorna o texto formatado para impressão do Cupom Vinculado (ESC/POS) |
| `GET` | `/api/pbm/config` | Consulta parametrizações do módulo |
| `PUT` | `/api/pbm/config` | Atualiza parâmetros (ambiente Homologação/Produção/Mock, credenciais) |

---

## 6. Interface do Usuário (Frontend React/Tailwind)

1. **TopBar Global:**
   - Adição do atalho visual `[F6] Convênio / Farmácia Popular` na barra de navegação superior.
2. **Modal de Autorização PBM (`PbmModal.tsx`):**
   - Abertura rápida via tecla de atalho `[F6]` no Balcão (`CounterPage`) ou no Caixa (`PosPage`).
   - Formulário ergonômico de alta velocidade (focado em tab/enter para operadores de caixa):
     - Seleção do Provedor (Farmácia Popular Datasus, Vidalink, e-Pharma).
     - Campo CPF com formatação automática e validação de dígitos.
     - Campo Nome do Paciente e Data de Nascimento.
     - Campos de Procurador Legal (opcionais para retiradas por terceiros).
     - Campo CRM, UF e Nome do Médico Prescritor.
     - Campo Data da Receita Médica (com validação visual de validade).
     - Grade de seleção de medicamentos (filtrando automaticamente itens elegíveis com código MS).
     - Botão `[F10] Autorizar Convênio`.
3. **Quadro de Resumo de Subsídio:**
   - Exibição visual destacada antes de confirmar:
     - **Valor Total:** R$ 54,00
     - **Subsidiado pelo Governo (Farmácia Popular):** R$ 42,00 (Badge Verde)
     - **A Pagar pelo Cliente no Caixa:** R$ 12,00 (Badge Azul)
4. **Finalização e Integração PDV:**
   - Inserção imediata da transação aprovada na comanda do Balcão ou direto no Caixa.
   - No Checkout do PDV, a parcela subsidiada é registrada como meio de pagamento `CONVENIO_PBM` e o saldo remanescente é pago pelo paciente.
   - Ao finalizar a venda, chamada automática a `/api/pbm/confirm` com a chave da NFC-e.
   - Impressão das 2 vias do Cupom Vinculado com pré-visualização e corte ESC/POS.

---

## 7. Estratégia de Testes (TDD & Verificação Rigorosa)

- **Testes Unitários:**
  - `pbm-provider.test.ts`: Contrato `PbmProvider`, validação de dados de entrada e cálculo financeiro.
  - `datasus-mock-provider.test.ts`: Matriz completa de 9 cenários:
    1. Hipertensão/Diabetes/Asma: 100% gratuito.
    2. Co-pagamento: Dislipidemia/Parkinson até 90% do Preço de Referência.
    3. Bolsa Família: 100% de gratuidade em todos os itens.
    4. Bloqueio 30 dias: CPF final `99` ou repetição de cota mensal.
    5. Validade de receita 180 dias geral (rejeição no final `88`).
    6. Validade estendida de 365 dias para anticoncepcionais.
    7. Restrição etária: fralda geriátrica bloqueada para menores de 60 anos sem laudo.
    8. Validação de dígitos verificadores de CPF.
    9. Cancelamento idempotente e simulação de timeout.
  - `pbm-receipt-formatter.test.ts`: Validação de 48 colunas ESC/POS para as 2 vias completas com itens, médico e termos Denasus.
  - `pbm-service.test.ts`: Ciclo no SQLite (`authorize` -> `confirm` -> `cancel`), integridade referencial com vendas e controle de transações órfãs.
  - `pos-integration.test.ts`: Verificação do meio de pagamento `CONVENIO_PBM`, fechamento de caixa sem mistura com dinheiro físico e troco restrito ao co-pagamento.
  - `pbm-routes.test.ts`: Teste de integração de rotas HTTP Fastify via `app.inject()`.
- **Testes de Frontend:**
  - Renderização do modal `PbmModal`, acionamento por atalho `[F6]`, cálculo de subsídios e disparo de impressão do cupom.
- **Critérios de Sucesso:**
  - 100% dos testes passando sem falhas.
  - TypeScript compilando sem nenhum erro (`npm run build`).
  - Zero dependências proprietárias pesadas ou não auditadas.
