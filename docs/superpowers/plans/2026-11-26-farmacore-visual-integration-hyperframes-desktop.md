# FarmaCore ERP: Plano Mestre de Integração de Telas, Identidade Visual, Animações com HyperFrames e Empacotamento Desktop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar os fluxos operacionais mapeados das telas de MOVIMENTO do InovaFarma ao FarmaCore, estabelecer a identidade visual e logo proprietários da Magnos Farma, criar animações fluidas de carregamento com HyperFrames e empacotar o sistema em executável Desktop nativo (.exe).

**Architecture:** Frontend React + TypeScript estilizado com Tailwind CSS e componentes modulares replicando o padrão operacional de balcão (teclado prioritário e abas verticais), motor de animação e splash screen com HyperFrames, conectado à API REST Node.js/SQLite de alta performance e envelopado pelo Electron Builder para distribuição nativa Windows.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide Icons, HyperFrames (`hyperframes`, `@hyperframes/player`), Node.js, Express, SQLite3 / Better-SQLite3, Electron & Electron-Builder.

## Global Constraints
- Nenhuma quebra nas 52 fases já existentes e nos 1.937 testes automatizados.
- Operação 100% via teclado nos módulos de balcão (Vendas, Caixa, Consulta de Preços).
- Preservação da base de 40.247 produtos importados do InovaFarma no carregamento inicial.
- Build do executável desktop (.exe) compatível com Windows 10 e Windows 11 (64-bit).

## Review Focus
1. Carregamento inicial de catálogo e checagem de banco sem travamento da UI (feedback visual de progresso 0% a 100%).
2. Navegação ágil por teclas de atalho (F1-F12, Esc, Enter) na tela de vendas sem conflito com o navegador/electron.
3. Compatibilidade do motor HyperFrames no ambiente de renderização do Electron/Vite.
4. Consistência da paleta de cores e contraste para ambiente de balcão (alta legibilidade sob iluminação fluorescente).
5. Empacotamento do instalador Windows incluindo banco de dados SQLite pré-populado.

---

### Fase 1: Mapeamento e Integração Funcional das Telas de MOVIMENTO

- [ ] **Task 1.1: Mapeamento de Atalhos e Estados Operacionais de Vendas**
  - Implementar gerenciador global de teclas de atalho (`useKeyboardShortcuts`):
    - `F2`: Foco na busca de produto / leitor de código de barras
    - `F3`: Seleção / busca de cliente (ou abertura de crediário)
    - `F4` ou `Enter`: Finalizar venda / checkout
    - `F7`: Abrir pop-up suspenso de PBMs (Farmácia Popular, Vidalink, e-Pharma, etc.)
    - `F8`: Devolução / cancelamento de item selecionado
    - `F10`: Limpar venda atual
    - `Esc`: Voltar ao Menu Geral
  - Integrar aos endpoints de venda (`/api/v1/sales`) e de produtos (`/api/v1/products`).

- [ ] **Task 1.2: Integração da Tela de Caixa com Abas e Botões Coloridos**
  - Mapear os 5 botões superiores de comando rápido:
    - *Fechar Caixa* (Vinho / Bordô `#7B1E2A`)
    - *Procurar / Consultar Caixas* (Cinza `#6C757D`)
    - *Opções do Caixa* (Laranja `#E67E22`)
    - *Sangria de Dinheiro* (Vermelho `#D9534F`)
    - *Suprimento de Troco* (Azul `#0275D8`)
  - Conectar aos endpoints de `/api/v1/cash-sessions` e `/api/v1/cash-transactions`.

- [ ] **Task 1.3: Integração da Conta do Cliente com Abas Verticais**
  - Replicar a arquitetura de 4 abas laterais:
    - Aba 1: *Carteira* (Limite total, saldo utilizado, saldo disponível, status do crediário)
    - Aba 2: *Ficha Financeira* (Extrato detalhado de débitos e créditos com cálculo de juros/multa)
    - Aba 3: *Histórico de Baixas* (Pagamentos anteriores com recibo)
    - Aba 4: *Histórico de Produtos* (Itens adquiridos pelo cliente com data e balconista)
  - Conectar ao módulo de clientes e crediário (`/api/v1/customers` e `/api/v1/customer-credit`).

---

### Fase 2: Identidade Visual Própria, Logo & Design System Magnos Farma

- [ ] **Task 2.1: Definição da Paleta de Cores e Tipografia FarmaCore**
  - Criar o arquivo de tema `frontend/src/styles/theme.ts`:
    - Cor Primária Farmacêutica: `#1B4965` (Azul Escuro Confiável)
    - Cor Secundária / Acento: `#00A8E8` (Ciano Inova Moderno)
    - Cor de Ação / Sucesso: `#2A9D8F` (Verde Saúde)
    - Cor de Alerta / Atenção: `#E76F51` (Laranja Coral)
    - Cores Neutras: `#FFFFFF` (Fundo Limpo) e `#F8F9FA` (Cards e Tabela)
    - Barra de Totais e Rodapé: `#31708F` (Azul Petróleo Operacional)
  - Configurar fontes Segoe UI / Inter com hierarquia visual precisa para monitores de frente de caixa.

- [ ] **Task 2.2: Criação do Logo Vetorial SVG Magnos Farma / FarmaCore**
  - Criar componente `FarmaCoreLogo.tsx` em SVG vetorial:
    - Versão Ícone: Cruz estilizada com folhas e núcleo dinâmico.
    - Versão Completa: Marca FarmaCore + "Magnos Farma - Sistema Integrado".
    - Versão Monocromática / Branca para uso no cabeçalho e na splash screen.

---

### Fase 3: Animações de Carregamento & Efeitos com HyperFrames

- [ ] **Task 3.1: Instalação e Configuração do HyperFrames**
  - Instalar dependências no frontend:
    - `npm install hyperframes @hyperframes/core @hyperframes/player`
  - Criar o wrapper de inicialização `frontend/src/components/animations/HyperFramesRenderer.tsx`.

- [ ] **Task 3.2: Splash Screen com Barra de Progresso e Percentual (0% a 100%)**
  - Criar `frontend/src/components/loading/AppSplashScreen.tsx`:
    - Animação do logo FarmaCore com brilho fluido.
    - Barra de progresso com gradiente e contador numérico em tempo real (`0%` até `100%`).
    - Etapas informativas no carregamento:
      1. *Carregando módulos centrais...*
      2. *Conectando ao banco de dados SQLite...*
      3. *Verificando catálogo mestre (40.247 produtos)...*
      4. *Sincronizando modo da estação (Terminal / Servidor)...*
      5. *Pronto para operar!*

- [ ] **Task 3.3: Componentes de Carregamento para Operações Pesadas**
  - Criar `frontend/src/components/loading/TableSkeletonLoader.tsx` e `LoadingOverlay.tsx` com animações suaves de shimmer para:
    - Busca de produtos na base de 40.247 itens.
    - Emissão e autorização de PBMs.
    - Fechamento e consolidação de caixas.

---

### Fase 4: Reestilização Fiel das Telas & Empacotamento Desktop (.exe)

- [ ] **Task 4.1: Reestilização da Tela de Vendas (Balcão)**
  - Campo de busca largo `PRODUTO | [ Código ou Nome ] 🔍`.
  - Tabela zebrada limpa com colunas exatas do balcão.
  - Barra de resumo inferior com `ITENS`, `ESTOQUE`, `DESC. MÁX` e `TOTAL LÍQUIDO` destacado.
  - Rodapé azul petróleo com os 12 botões e atalhos de função.
  - Menu suspenso de PBMs (Farmácia Popular, Vidalink, e-Pharma, etc.).

- [ ] **Task 4.2: Configuração e Build do Electron Desktop (.exe)**
  - Configurar `electron` e `electron-builder` no `package.json`.
  - Criar script principal `electron/main.ts` (janela em tela cheia, sem barra de menus indesejadas, suporte a atalhos globais e splash screen integrada).
  - Configurar build para gerar o instalador `FarmaCore-Setup.exe` e executável standalone em `dist-electron/`.

- [ ] **Task 4.3: Testes, Homologação e Sincronização Git**
  - Garantir 100% de aprovação na suíte de testes Vitest.
  - Testar build completo (`npm run build:web` e `npm run build:electron`).
  - Commit e sincronização na branch `master` no GitHub.
