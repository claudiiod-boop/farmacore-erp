# FarmaCore ERP & PDV — Especificação Técnica da Fase 4
## Motor Fiscal Autônomo: Emissão de NFC-e (Modelo 65), Regras Tributárias Farmacêuticas & DANFE Térmico

**Data:** 06 de Novembro de 2026  
**Status:** Em Revisão / Proposta  
**Contexto:** Evolução do FarmaCore ERP após a conclusão do Core de Balcão e Frente de Caixa (Fases 1, 2 e 3). Implementação da **Abordagem 1: Motor Fiscal Nativo Embutido** (padrão InovaFarma / ERP autônomo sem intermediários pagos).

---

## 1. Visão Geral & Objetivos

A **Fase 4** dota o FarmaCore ERP de um **motor fiscal nativo e autônomo** para emissão de **NFC-e (Nota Fiscal de Consumidor Eletrônica - Modelo 65)**, atendendo rigorosamente à legislação tributária e sanitária brasileira:

1. **Regras Fiscais Farmacêuticas Específicas:**
   - **PIS / COFINS Monofásico (Lei 10.147/2000):** Medicamentos comercializados em drogarias possuem tributação concentrada na indústria/importador, saindo na revenda com **CST PIS/COFINS 04 (Alíquota Zero)**.
   - **ICMS por Substituição Tributária (ICMS-ST):** Medicamentos faturados com **CFOP 5.405** e **CSOSN 500** (Simples Nacional) ou **CST 060** (Regime Normal), indicando que o imposto já foi retido anteriormente.
   - **Itens de Conveniência/Perfumaria:** Tributação padrão com CFOP 5.102 e CSOSN 102/500, CST PIS/COFINS 49/01.
   - **NCM & CEST Obrigatórios:** NCM farmacêutico (Capítulo 30 da TIPI: `3003` e `3004`) e CEST correspondente (Convênio ICMS 142/2018).
   - **Lei da Transparência Fiscal (Lei 12.741/2012 / IBPT):** Cálculo e destaque dos tributos federais, estaduais e municipais aproximados no cupom.

2. **Geração e Assinatura de XML SEFAZ 4.00:**
   - Geração canônica do XML da NFC-e no layout oficial 4.00 (`<NFe xmlns="http://www.portalfiscal.inf.br/nfe">`).
   - Cálculo da **Chave de Acesso de 44 dígitos** com cálculo ponderado do dígito verificador via Módulo 11 (`cDV`).
   - Assinatura digital nativa padrão XML-DSig (envelope `<Signature>`) utilizando Certificado Digital ICP-Brasil padrão **A1 PKCS#12 (`.pfx` / `.p12`)** via `node:crypto`.

3. **QR Code SEFAZ v2.00 & Contingência Offline:**
   - Montagem e hash SHA-1 do QR Code v2 da SEFAZ com Código de Segurança do Contribuinte (CSC/Token) e identificador `cIdToken`.
   - Suporte a **Contingência Offline (`tpEmis = 9`)**: quando a SEFAZ estiver indisponível ou a internet falhar, a NFC-e é gerada, impressa com indicação expressa de contingência (2 vias) e armazenada para transmissão assim que a conexão retornar.

4. **Provedor de Transmissão Pluggable & Emulador SEFAZ de Homologação:**
   - `SefazMockProvider`: Emulador integrado que simula autorização (`cStat: 100`), rejeições tributárias clássicas e cancelamentos fiscais, permitindo testes e operação sem custos adicionais ou necessidade de certificado de produção ativo em ambiente de desenvolvimento.
   - `SefazSoapProvider`: Cliente SOAP TLS 1.2 para envio aos WebServices oficiais da SEFAZ do estado (Homologação e Produção).

5. **DANFE NFC-e Térmico (48 Colunas ESC/POS):**
   - Comprovante fiscal térmico com logotipo da loja, identificação do consumidor (CPF/Nome opcional), lista detalhada de itens com NCM/CEST, tributos aproximados, formas de pagamento, QR Code e consulta pública da chave de acesso.

---

## 2. Modelo de Dados & Schema (SQLite WAL)

### 2.1 Nova Migração: `003_fiscal_nfce.sql`

```sql
-- Configuração da Empresa Emitente e Credenciais Fiscais
CREATE TABLE IF NOT EXISTS fiscal_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj TEXT NOT NULL,
  ie TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  crt INTEGER NOT NULL DEFAULT 1, -- 1=Simples Nacional, 3=Regime Normal
  c_uf INTEGER NOT NULL DEFAULT 35, -- Ex: 35 = São Paulo
  municipio TEXT NOT NULL,
  c_mun INTEGER NOT NULL,
  logradouro TEXT NOT NULL,
  numero TEXT NOT NULL,
  bairro TEXT NOT NULL,
  cep TEXT NOT NULL,
  serie INTEGER NOT NULL DEFAULT 1,
  next_n_nf INTEGER NOT NULL DEFAULT 1,
  csc_token TEXT NOT NULL DEFAULT '000001',
  csc_id INTEGER NOT NULL DEFAULT 1,
  environment TEXT NOT NULL DEFAULT 'HOMOLOGACAO', -- 'HOMOLOGACAO' | 'PRODUCAO' | 'SIMULADOR'
  cert_pfx_base64 TEXT,
  cert_password TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Atributos fiscais dos produtos (NCM, CEST, CFOP, CSOSN, PIS/COFINS)
ALTER TABLE products ADD COLUMN ncm TEXT NOT NULL DEFAULT '3004.90.99';
ALTER TABLE products ADD COLUMN cest TEXT NOT NULL DEFAULT '13.001.00';
ALTER TABLE products ADD COLUMN cfop TEXT NOT NULL DEFAULT '5405';
ALTER TABLE products ADD COLUMN csosn_icms TEXT NOT NULL DEFAULT '500';
ALTER TABLE products ADD COLUMN cst_pis TEXT NOT NULL DEFAULT '04';
ALTER TABLE products ADD COLUMN cst_cofins TEXT NOT NULL DEFAULT '04';
ALTER TABLE products ADD COLUMN origin INTEGER NOT NULL DEFAULT 0; -- 0=Nacional

-- Tabela de Documentos Fiscais NFC-e emitidos
CREATE TABLE IF NOT EXISTS nfce_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
  ch_nfe TEXT NOT NULL UNIQUE,
  n_nf INTEGER NOT NULL,
  serie INTEGER NOT NULL,
  tp_amb INTEGER NOT NULL, -- 1=Producao, 2=Homologacao
  tp_emis INTEGER NOT NULL DEFAULT 1, -- 1=Normal, 9=Contingencia Offline
  status TEXT NOT NULL DEFAULT 'EMITIDA', -- 'EMITIDA' | 'AUTORIZADA' | 'CANCELADA' | 'REJEITADA' | 'CONTINGENCIA'
  protocol_number TEXT,
  protocol_date TEXT,
  xml_signed TEXT NOT NULL,
  xml_authorized TEXT,
  qr_code_url TEXT NOT NULL,
  digest_value TEXT NOT NULL,
  c_stat INTEGER,
  x_motivo TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_nfce_invoices_sale_id ON nfce_invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_nfce_invoices_ch_nfe ON nfce_invoices(ch_nfe);
CREATE INDEX IF NOT EXISTS idx_nfce_invoices_status ON nfce_invoices(status);
```

---

## 3. Arquitetura do Motor Fiscal (`src/modules/fiscal/`)

```
src/modules/fiscal/
├── types.ts                    # Interfaces de NFC-e, regras fiscais e tributação
├── tax-calculator.ts           # Cálculo de PIS/COFINS monofásico, ICMS-ST e IBPT
├── access-key.ts               # Cálculo da Chave de Acesso de 44 dígitos (Módulo 11)
├── xml-builder.ts              # Construtor canônico do XML SEFAZ Layout 4.00
├── signer.ts                   # Assinador digital XML-DSig com Certificado A1 (.pfx)
├── qrcode-generator.ts         # Geração de URL e Hash SHA-1 do QR Code SEFAZ v2.00
├── danfe-formatter.ts          # Formatador térmico ESC/POS (48 colunas) do DANFE NFC-e
├── transmission/
│   ├── provider.interface.ts   # Interface pluggable de transmissão SEFAZ
│   ├── sefaz-mock.provider.ts  # Emulador local de autorização/rejeição/cancelamento
│   └── sefaz-soap.provider.ts  # Cliente SOAP TLS 1.2 com WebServices da SEFAZ
└── fiscal.service.ts           # Orquestrador da emissão, autorização, contingência e cancelamento
```

### 3.1 Regras de Cálculo Tributário Farmacêutico (`tax-calculator.ts`)
1. **PIS / COFINS Monofásico (Lei 10.147/2000):**
   - Para medicamentos (NCM iniciado em `3003` ou `3004`):
     - `cst_pis`: `'04'` (Operação Tributável Monofásica - Revenda a Alíquota Zero).
     - `vBC`: `0.00`, `pPIS`: `0.00`, `vPIS`: `0.00`.
     - `cst_cofins`: `'04'` (Operação Tributável Monofásica - Revenda a Alíquota Zero).
     - `vBC`: `0.00`, `pCOFINS`: `0.00`, `vCOFINS`: `0.00`.
   - Para itens de perfumaria/conveniência (Simples Nacional):
     - `cst_pis`: `'49'` / `'99'`, valores zerados.
2. **ICMS por Substituição Tributária (ICMS-ST):**
   - No Simples Nacional (`CRT = 1`):
     - Medicamentos: `CSOSN 500` (ICMS cobrado anteriormente por substituição tributária ou por antecipação). Tag `<ICMSSN500>` no XML.
     - Conveniência comum: `CSOSN 102` (Tributada pelo Simples Nacional sem permissão de crédito).
   - No Regime Normal (`CRT = 3`):
     - Medicamentos: `CST 060` (ICMS cobrado anteriormente por substituição tributária). Tag `<ICMS60>`.
3. **Lei 12.741/2012 (Transparência Fiscal / IBPT):**
   - Destaque automático do valor estimado dos tributos:
     - Medicamentos: ~33.45% (Federais + Estaduais).
     - Perfumaria: ~38.25%.
   - Totalizado no campo `vTotTrib` e impresso no rodapé do cupom.

### 3.2 Geração da Chave de Acesso de 44 Dígitos (`access-key.ts`)
A chave de acesso segue a composição oficial:
`cUF (2) + AAMM (4) + CNPJ (14) + mod (2, '65') + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)`
- `cDV`: Dígito verificador calculado com algoritmo Módulo 11 com pesos de 2 a 9 da direita para a esquerda. Resto 0 ou 1 resulta em `cDV = 0`.

### 3.3 Assinatura Digital XML-DSig (`signer.ts`)
- Utiliza a biblioteca nativa `node:crypto` para ler o certificado digital X.509 A1 em formato PKCS#12 (`.pfx`).
- Extrai a chave privada RSA e o certificado público.
- Calcula o `DigestValue` (SHA-1) do nó `<infNFe>`.
- Gera a tag `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` contendo `<SignedInfo>`, `<SignatureValue>` assinado com RSA-SHA1, e `<KeyInfo><X509Data><X509Certificate>`.

### 3.4 QR Code v2.00 SEFAZ (`qrcode-generator.ts`)
- URL oficial do estado: ex. `http://www.fazenda.sp.gov.br/nfce/qrcode?p=...`
- Payload: `chNFe|2|tpAmb|dhEmi|vNF|digVal|cIdToken`
- Hash SHA-1 concatenado com o CSC da farmácia:
  `cHashQRCode = SHA1(chNFe|2|tpAmb|dhEmi|vNF|digVal|cIdToken + CSC)`
- URL final gerada para consulta e renderização gráfica via SVG.

---

## 4. Endpoints REST da API Fastify (`src/api/routes.ts`)

- `GET /api/fiscal/profile`: Retorna o perfil emitente configurado.
- `PUT /api/fiscal/profile`: Atualiza dados fiscais da farmácia (CNPJ, IE, CSC, ambiente, certificado).
- `POST /api/fiscal/nfce/issue`: Emite e autoriza a NFC-e para uma venda concluída (`saleId`).
  - Suporta flag `offlineContingency: boolean`.
- `GET /api/fiscal/nfce/:saleId`: Retorna os dados da NFC-e emitida para a venda (chave, protocolo, QR Code, status).
- `GET /api/fiscal/nfce/:saleId/xml`: Baixa o XML assinado/autorizado da NFC-e.
- `GET /api/fiscal/nfce/:saleId/danfe`: Retorna o texto formatado do DANFE térmico ESC/POS.
- `POST /api/fiscal/nfce/:saleId/cancel`: Registra o cancelamento fiscal da NFC-e (`justificativa` obrigatória de no mínimo 15 caracteres).

---

## 5. Interface de Frontend & Integração com o PDV (`PosPage.tsx`)

1. **Emissão Automática no Checkout:**
   - No modal de pagamento `PaymentModal`, uma opção "Emitir NFC-e Fiscal" (marcada por padrão) aciona a geração da nota fiscal logo após o fechamento do caixa.
   - O `SaleReceiptModal` exibe o **DANFE NFC-e Oficial**:
     - Cabeçalho Fiscal da SEFAZ: "DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica".
     - Chave de acesso formatada em 11 grupos de 4 dígitos.
     - QR Code SEFAZ escaneável via câmera de smartphone para consulta no portal da Fazenda.
     - Protocolo de Autorização e Data/Hora da SEFAZ.
     - Tributos da Lei 12.741/2012.
2. **Badge Fiscal na Grade de Vendas:**
   - Vendas autorizadas exibem o selo verde `NFC-e Autorizada`, vendas em contingência exibem o selo âmbar `Contingência Offline`, e opção para retransmitir notas pendentes.

---

## 6. Estratégia de Testes Automatizados (TDD)

1. **Testes Unitários de Motor Fiscal:**
   - `tests/modules/fiscal/access-key.test.ts`: Validação matemática da chave de 44 dígitos e algoritmo Módulo 11 com chaves reais da SEFAZ.
   - `tests/modules/fiscal/tax-calculator.test.ts`: Tributação PIS/COFINS monofásico (CST 04), ICMS-ST (CSOSN 500) e cálculo do IBPT.
   - `tests/modules/fiscal/xml-builder.test.ts`: Conformidade estrutural do XML SEFAZ 4.00 com schema oficial.
   - `tests/modules/fiscal/signer.test.ts`: Assinatura digital XML-DSig RSA-SHA1 com certificado de teste.
   - `tests/modules/fiscal/qrcode-generator.test.ts`: Formatação do QR Code v2 e cálculo de hash com CSC.
   - `tests/modules/fiscal/danfe-formatter.test.ts`: Formatação de 48 colunas do DANFE térmico.
2. **Testes de Serviço & Integração REST:**
   - `tests/modules/fiscal/fiscal.service.test.ts`: Ciclo completo (emissão normal, contingência offline, cancelamento).
   - `tests/api/routes.fiscal.test.ts`: Endpoints `/api/fiscal/*`.
3. **Testes de Frontend:**
   - `frontend/tests/components/SaleReceiptModal.test.tsx`: Renderização do DANFE com QR Code e chave de acesso.
