# FarmaCore ERP & PDV 💊

> **Sistema Integrado de Gestão (ERP) e Frente de Caixa (PDV) Open Source para o Varejo Farmacêutico Brasileiro.**  
> Projetado com rigor técnico para cumprir a legislação sanitária da **Anvisa**, as regras tributárias da **SEFAZ** e os tetos de preços da **CMED**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7%20Strict-blue.svg)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-460%20passing%20(100%25)-brightgreen.svg)](tests/)
[![Fastify](https://img.shields.io/badge/Fastify-5.2-black.svg)](https://fastify.dev)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL%20Atomic-003B57.svg)](https://sqlite.org)

---

## 📋 Sumário
- [Visão Geral & Propósito](#-visão-geral--propósito)
- [Módulos do Sistema](#-módulos-do-sistema)
  - [1. Balcão de Atendimento [F1]](#1-balcão-de-atendimento-f1)
  - [2. Frente de Caixa / PDV Híbrido [F2]](#2-frente-de-caixa--pdv-híbrido-f2)
  - [3. Motor Fiscal Autônomo NFC-e (SEFAZ 4.00)](#3-motor-fiscal-autônomo-nfc-e-sefaz-400)
  - [4. Entrada de Mercadorias via XML de NF-e [F3]](#4-entrada-de-mercadorias-via-xml-de-nf-e-f3)
  - [5. Módulo Regulatório SNGPC (Anvisa) [F4]](#5-módulo-regulatório-sngpc-anvisa-f4)
- [Atalhos de Teclado Operacionais](#-atalhos-de-teclado-operacionais)
- [Arquitetura & Engenharia](#-arquitetura--engenharia)
- [Como Executar o Projeto](#-como-executar-o-projeto)
- [Roadmap de Próximas Fases](#-roadmap-de-próximas-fases)
- [Licença](#-licença)

---

## 🎯 Visão Geral & Propósito

No mercado brasileiro, pequenas farmácias comunitárias e drogarias de bairro dependem de sistemas legados de alto custo mensal (R$ 300 a mais de R$ 1.500/mês). O **FarmaCore ERP** foi concebido como uma alternativa **livre, moderna, sem mensalidades e de código aberto**, oferecendo estabilidade operacional, interface ergonômica de alto desempenho e conformidade regulatória plena com os órgãos fiscalizadores nacionais:

1. **Agência Nacional de Vigilância Sanitária (Anvisa):** Portaria 344/98 e RDC 20/2011 (Antimicrobianos e Psicotrópicos).
2. **Secretarias de Fazenda Estaduais (SEFAZ):** Nota Fiscal de Consumidor Eletrônica (NFC-e Modelo 65, Layout 4.00) e NF-e de Compras (Modelo 55).
3. **Câmara de Regulação do Mercado de Medicamentos (CMED):** Controle estrito do Preço Máximo ao Consumidor (PMC) e Preço Fábrica (PF).
4. **Regime Tributário Farmacêutico:** PIS/COFINS Monofásico (Lei 10.147/2000), ICMS-ST (Substituição Tributária) e transparência IBPT (Lei 12.741/2012).

---

## 📦 Módulos do Sistema

### 1. Balcão de Atendimento `[F1]`
- **Busca rápida ultra-otimizada `[F2]`:** pesquisa instantânea por código de barras EAN-13, nome comercial, princípio ativo (DCB) ou registro MS.
- **Seleção Inteligente FEFO (*First Expire, First Out*):** o sistema destaca automaticamente o lote com vencimento mais próximo disponível no estoque, evitando perdas por expiração.
- **Intercepção Sanitária Obrigatória:** produtos tarjados/controlados acionam automaticamente a captura da receita retida (CRM, UF, tipo de notificação A/B/C, dados do médico, paciente e comprador).
- **Emissão do Ticket de Pré-Venda:** impressão de comanda térmica de 80mm com código legível `#PV-XXXX` para resgate no caixa.

### 2. Frente de Caixa / PDV Híbrido `[F2]`
- **Resgate de Pré-Vendas `[F5]`:** importação instantânea digitando apenas o número da comanda do balcão.
- **Venda Direta no Caixa `[F2]`:** leitura de leitor de código de barras para itens de conveniência/OTC com cálculo em tempo real.
- **Controle Financeiro de Turno `[F10]` & `[F12]`:** abertura de sessão de caixa, sangrias com trava de saldo disponível, suprimentos de troco e fechamento com conciliação financeira.
- **Múltiplos Meios de Pagamento `[F8]`:** divisão em dinheiro com cálculo de troco automático, cartão de crédito/débito e Pix Dinâmico com QR Code renderizado em tela.

### 3. Motor Fiscal Autônomo NFC-e (SEFAZ 4.00)
- **Zero Dependências Externas:** gerador de XML canônico em TypeScript com assinatura digital **XML-DSig A1 (`.pfx`)** nativa via `node:crypto`.
- **Chave de Acesso Oficial:** 44 dígitos calculados rigorosamente com Módulo 11 ponderado (pesos 2 a 9).
- **Tributação Farmacêutica Automática:**
  - PIS/COFINS Monofásico: CST `04` com alíquota zero para NCMs `3003` e `3004` (Lei 10.147/2000).
  - ICMS-ST: CFOP `5.405` e CSOSN `500` (ICMS cobrado anteriormente por substituição tributária).
  - Cálculo de impostos aproximados IBPT em tela e no cupom (Lei 12.741/2012).
- **QR Code SEFAZ v2.00:** geração com token CSC e hash SHA-1 oficial do contribuinte.
- **Contingência Offline (`tpEmis = 9`):** emissão com geração de 2 vias de DANFE em caso de queda de internet.
- **DANFE Térmico ESC/POS:** formatação canônica de 48 colunas pronta para bobinas de 80mm e 58mm.

### 4. Entrada de Mercadorias via XML de NF-e `[F3]`
- **Parser Robusto de NF-e Modelo 55:** leitura de XMLs de distribuidoras (SantaCruz, Profarma, Panpharma, Gam) com ou sem envelope `<nfeProc>`.
- **Rastreabilidade de Medicamentos `<med>`:** extração de lote (`nLote`), quantidade do lote (`qLote`), data de fabricação (`dFab`), validade (`dVal`), registro MS (`cProdANVISA`) e PMC (`vPMC`).
- **Pré-Conferência Dry-Run:** análise em tela sem gravação no banco, identificando produtos novos vs existentes e divergências de PMC.
- **Teto CMED Automático:** se o preço de venda cadastrado ou sugerido superar o PMC da nota, o sistema auto-ajusta ao teto (`price = Math.min(price, pmc)`), garantindo conformidade legal com a CMED.
- **Alimentação Atômica do Estoque:** inserção de lotes com datas de validade e geração de código interno (`INT-...`) para itens manipulados ou sem GTIN.

### 5. Módulo Regulatório SNGPC (Anvisa) `[F4]`
- **Escrituração Sanitária Automática:** compras de medicamentos controlados (Portaria 344/98 e RDC 20/2011) geram registros de `ENTRADA`; vendas no PDV com receita geram registros de `SAIDA_VENDA`.
- **Livro de Registro Específico de Medicamentos Controlados:** consolidação por substância com cálculo de saldo anterior, entradas, saídas, perdas e saldo final, com termos oficiais de abertura e encerramento prontos para impressão física para a Vigilância Sanitária local (VISA).
- **Exportador do XML Semanal Oficial:** geração do arquivo `mensagemSNGPC.xml` no schema XSD `urn:sngpc-schema` da Anvisa, com cabeçalho contendo CRF e CPF do farmacêutico responsável e hash SHA-1 de integridade.

---

## ⌨️ Atalhos de Teclado Operacionais

O sistema foi desenhado para ser operado 100% via teclado nas estações de balcão e frente de caixa:

| Tecla | Função Global | Ação no Balcão `[F1]` | Ação no Caixa PDV `[F2]` |
|---|---|---|---|
| `[F1]` | Ir para **Balcão** | Foco na tela de atendimento | Alterna para o balcão |
| `[F2]` | Ir para **Caixa / Busca** | Abre pesquisa de catálogo | Inicia venda direta com scanner |
| `[F3]` | Ir para **Entrada XML** | Alterna para Compras | Alterna para Compras |
| `[F4]` | Ir para **SNGPC Anvisa** | Finaliza Pré-Venda | Alterna para SNGPC |
| `[F5]` | - | - | Resgatar Ticket `#PV` |
| `[F8]` | - | - | Abrir Checkout / Pagamento |
| `[F9]` | Limpar Formulário | Cancela e limpa carrinho | - |
| `[F10]` | - | - | Sangria ou Suprimento |
| `[F12]` | - | - | Fechar Turno de Caixa |
| `[Esc]` | Cancelar / Voltar | Fecha modais | Fecha modais / Cancela venda |

---

## 🏗 Arquitetura & Engenharia

```
farma-erp/
├── desktop/                  # Camada Electron nativa (Desktop App)
├── frontend/                 # Interface React 18 + Vite + Tailwind CSS + Lucide
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis (Balcão, PDV, Modais)
│   │   ├── pages/            # CounterPage [F1], PosPage [F2], PurchasesPage [F3], SngpcPage [F4]
│   │   ├── services/         # Clientes de API REST Fastify
│   │   └── types/            # Tipos de domínio TypeScript
│   └── tests/                # 21 suítes de testes unitários e de integração frontend
├── src/
│   ├── api/                  # Endpoints REST Fastify com validação Zod
│   ├── database/             # SQLite WAL com migrações versionadas (001 a 004)
│   └── modules/
│       ├── catalog/          # Catálogo CMED (PMC/PF) e busca EAN
│       ├── counter/          # Regras de balcão, pré-venda e retenção de receita
│       ├── fiscal/           # Motor NFC-e 4.00, XML-DSig A1, QR Code v2 e DANFE
│       ├── inventory/        # Estoque atômico com ordenação FEFO
│       ├── pos/              # Frente de caixa híbrido e fechamento de turno
│       ├── purchases/        # Parser NF-e 55, preview dry-run e importador atômico
│       └── sngpc/            # Gerador mensagemSNGPC Anvisa e Livro Portaria 344/98
└── tests/                    # 48 arquivos com 460 testes passando (100% cobertura)
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Node.js 18+** instalado ([Download Node.js](https://nodejs.org))
- **Git** instalado

### Instalação e Inicialização

```bash
# 1. Clonar o repositório
git clone https://github.com/claudiiod-boop/farmacore-erp.git
cd farmacore-erp

# 2. Instalar as dependências do backend e frontend
npm install

# 3. Executar a suíte de testes completa (Backend + Frontend)
npm test

# 4. Iniciar em modo de Desenvolvimento Web
npm run dev
# Backend Fastify iniciado em http://localhost:3000
# Frontend Vite iniciado em http://localhost:5173

# 5. Iniciar em modo Desktop (Electron)
npm run dev:desktop
```

---

## 🗺 Roadmap de Próximas Fases

- [ ] **Fase 6 — PBM (Convênios) & Farmácia Popular do Brasil:**
  - Conexão com o webservice oficial Datasus/MS da Farmácia Popular (Gratuidade e Co-pagamento).
  - Suporte a autorizadores PBM (Vidalink, e-Pharma/Pharmalink, Funcional Card).
- [ ] **Fase 7 — Relatórios Gerenciais & Curva ABC:**
  - Relatório de Curva ABC de vendas e estoque parado.
  - Fechamento cego de caixa para operadores e conferência pelo gerente.
- [ ] **Fase 8 — Instalador Windows `.exe`:**
  - Empacotamento via Electron Builder gerando instalador NSIS `.exe` para distribuição simplificada com 1 clique.

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

*Desenvolvido com foco no fortalecimento das farmácias comunitárias e drogarias independentes do Brasil.*
