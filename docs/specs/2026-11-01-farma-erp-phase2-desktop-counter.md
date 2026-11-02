# Documento de Design: FarmaCore Fase 2 - Aplicação Desktop & Módulo de Balcão (Atendimento e Pré-Venda)

**Data:** 01/11/2026  
**Status:** Proposta de Arquitetura  
**Inspiração / Benchmarking:** InovaFarma (Módulo de Balcão e Terminal de Pré-Venda Desktop)

---

## 1. Contexto e Objetivos

No varejo farmacêutico, o **Balcão** é a primeira linha de contato e triagem clínica. O atendente ou farmacêutico precisa de uma aplicação desktop ágil, focada em teclado (sem dependência de mouse) e que guie com segurança a conformidade com as normas da Anvisa (Portaria 344/98 e RDC 20/2011).

### Objetivos da Fase 2:
1. **Container Desktop Nativo (Electron):** Empacotar o backend Fastify + SQLite e a interface React em uma aplicação desktop executável no Windows, com controle de atalhos globais (`F1` a `F12`) e prevenção de fechamentos ou recargas acidentais.
2. **Terminal de Atendimento de Balcão:** Interface de alta velocidade para consulta de medicamentos com busca instantânea por Nome Comercial, Princípio Ativo (DCB) ou código de barras EAN-13.
3. **Visibilidade de Estoque e FEFO no Balcão:** Exibição clara dos lotes físicos disponíveis na prateleira, com destaque visual para o lote que vence primeiro (FEFO) e opção de seleção/conferência manual do lote em mãos.
4. **Modal Regulatório de Retenção de Receituário:** Interceptação obrigatória antes de gerar a pré-venda se houver medicamento controlado ou antibiótico, exigindo CRM/UF, dados do prescritor, tipo de receituário e paciente.
5. **Emissão de Ticket de Pré-Venda (`#PV-XXXX`):** Impressão visual simulada ou física em bobina térmica do comprovante de pré-venda com código de barras para o cliente apresentar no Caixa (PDV).

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
* **G1 - Janela Desktop Dedicada:** Execução em Electron gerenciando o ciclo de vida do backend Fastify localmente e renderizando a interface com zero configuração para o usuário final.
* **G2 - Navegação 100% por Atalhos de Teclado:**
  * `F2` ou `Enter`: Focar no campo de busca de medicamentos.
  * `F3`: Abrir consulta detalhada de lotes do item em foco.
  * `F4`: Abrir tela de fechamento da Pré-Venda (disparando modal de receita se necessário).
  * `F9`: Limpar atendimento atual / novo cliente.
  * `Esc`: Fechar modais abertos.
* **G3 - Bloqueio Regulatório Visual:** Impossibilitar que a pré-venda seja concluída se houver pendência de receita médica em produtos controlados.
* **G4 - Feedback Instantâneo de Preços CMED:** Exibir Preço de Venda praticado e o teto PMC para que o farmacêutico saiba a margem autorizada.

### Não-Metas (Non-Goals)
* Finalização financeira e recebimento de pagamentos (isso pertence ao Caixa/PDV da Fase 3).
* Transmissão online do SNGPC à Anvisa nesta fase (o balcão apenas coleta e grava com precisão os dados para o módulo SNGPC da Fase 4).

### Anti-Metas (Anti-Goals)
* **Nunca** permitir atalhos de navegador que possam fechar a tela de atendimento ou perder os itens já bipados (bloquear `Ctrl+R`, `F5`, `Ctrl+W`).
* **Nunca** gerar ticket de pré-venda sem confirmação do lote físico quando o item for controlado.

---

## 3. Arquitetura da Solução Desktop

```mermaid
flowchart TD
    subgraph Electron Container
        A[Main Process - main.ts] -->|Inicia em Background| B[Fastify REST API & SQLite]
        A -->|Cria Janela Nativa| C[BrowserWindow - Renderer Process]
        C -->|Context Bridge / IPC| D[Preload Script - preload.ts]
    end

    subgraph Interface React (Renderer)
        E[Tela de Balcão / Atendimento] -->|F2 Busca| F[Catálogo Farmacêutico]
        E -->|F3 Lotes| G[Grade de Lotes FEFO]
        E -->|F4 Fechar| H{Exige Receita?}
        H -->|Sim| I[Modal Portaria 344/98]
        H -->|Não| J[Gera Pré-Venda #PV-XXXX]
        I -->|Validado| J
        J --> K[Emissor de Ticket Térmico]
    end

    D <--> E
    E <-->|HTTP localhost| B
```

---

## 4. Estrutura de Arquivos da Fase 2

```
farma-erp/
├── desktop/                    # Processo Principal do Electron
│   ├── main.ts                 # Inicialização da janela, atalhos e servidor
│   ├── preload.ts              # Ponte de segurança IPC
│   └── tsconfig.desktop.json
├── frontend/                   # Interface do Balcão em React
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProductSearch.tsx     # Busca por EAN/Nome/DCB com autocomplete
│   │   │   ├── BatchSelector.tsx     # Seleção de lotes com indicação FEFO
│   │   │   ├── CartTable.tsx         # Tabela de itens da Pré-Venda
│   │   │   ├── PrescriptionModal.tsx # Retenção de receita Portaria 344/98
│   │   │   └── PreSaleTicket.tsx     # Comprovante térmico visual com código
│   │   ├── pages/
│   │   │   └── CounterPage.tsx       # Tela completa de Atendimento Balcão
│   │   ├── hooks/
│   │   │   └── useKeyboardShortcuts.ts # Mapeamento F1-F12
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.js
└── package.json
```

---

## 5. Roteiro de Implementação em Tarefas (Fase 2)

1. **Tarefa 1: Scaffolding do Frontend (React + Vite + Tailwind) e Electron Main Process**
   * Configuração de scripts para rodar em modo dev integrado (Vite + Electron) e build de distribuição.
2. **Tarefa 2: Componente de Busca Farmacêutica com Atalhos de Teclado (F2)**
   * Busca com debounce conectada a `/api/products/search?q=...`.
   * Badges coloridos de tarja (Livre, Vermelha, Preta) e visualização do PMC da CMED.
3. **Tarefa 3: Grade de Seleção de Lotes (FEFO) e Carrinho de Pré-Venda**
   * Consulta dos lotes via `/api/inventory/:productId/batches`.
   * Sugestão automática do lote mais próximo do vencimento e seleção manual para conferência.
4. **Tarefa 4: Modal de Retenção de Receituário da Portaria 344/98**
   * Validação em tempo real dos campos sanitários obrigatórios (Médico, CRM/UF, Paciente, Tipo de Receituário).
5. **Tarefa 5: Finalização da Pré-Venda e Visualizador de Ticket Térmico**
   * Chamada à API `POST /api/pre-sales` com itens e receita.
   * Exibição do comprovante térmico formatado na tela com código de barras em destaque.
