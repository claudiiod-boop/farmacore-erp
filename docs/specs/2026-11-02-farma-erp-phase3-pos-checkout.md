# FarmaCore ERP & PDV — Especificação Técnica da Fase 3
## Frente de Caixa (PDV Híbrido) & Checkout Financeiro

**Data:** 02 de Novembro de 2026  
**Status:** Em Revisão / Proposta  
**Contexto:** Evolução do ecossistema FarmaCore ERP após a conclusão do Core/Backend (Fase 1) e do Terminal Desktop de Balcão (Fase 2).

---

## 1. Visão Geral & Objetivos

A **Fase 3** implementa a **Frente de Caixa (PDV)** completa para drogarias brasileiras, seguindo a **Abordagem 2 (PDV Híbrido)** aprovada:
1. **Resgate Rápido de Pré-Venda:** O operador bip ou digita o ticket `#PV-XXXX` emitido no balcão de atendimento, carregando instantaneamente os medicamentos (incluindo controlados da Portaria 344/98 já aprovados e com receita retida).
2. **Venda Direta / Conveniência no Caixa:** O operador pode bipar produtos de conveniência/perfumaria (isentos de prescrição) diretamente na fila do caixa, adicionando-os à venda avulsa ou mesclando com uma pré-venda já resgatada, com seleção automática do lote FEFO viável.
3. **Gestão de Turno e Sessão de Caixa:** Abertura com Fundo de Troco, Sangria de segurança periódica (`[F10]`), Suprimento e Fechamento com conferência financeira cega (`[F12]`).
4. **Checkout e Formas de Pagamento Múltiplas (`[F8]`):** Dinheiro com cálculo instantâneo de troco, Cartão de Crédito, Cartão de Débito e Pix com simulação de QR Code dinâmico, suportando divisão de valores.
5. **Dedução Atômica e Cupom Térmico PDV:** Baixa física definitiva nos lotes de estoque via transação ACID no SQLite WAL e emissão do comprovante térmico de venda no formato ESC/POS de 48 colunas (`#VENDA-XXXXX`).

---

## 2. Configuração de Posto de Trabalho (Station Profile)

Para suportar postos fixos no ambiente de drogaria (máquinas dedicadas exclusivamente ao Balcão ou exclusivamente ao Caixa):
- **Armazenamento:** Preferência persistida no `localStorage` sob a chave `farmacore_station_mode: 'COUNTER' | 'POS'`.
- **Comportamento na Inicialização:**
  - Se configurado como `COUNTER`, o container Electron carrega o `CounterPage`.
  - Se configurado como `POS`, o container Electron carrega o `PosPage`.
  - Se não configurado (primeira inicialização), exibe uma tela limpa de seleção de posto com opção "Lembrar este posto neste terminal".
  - Troca de perfil acessível a qualquer momento via atalho de supervisor (`[Ctrl+Shift+S]`) ou menu superior.

---

## 3. Modelo de Dados & Schema (SQLite WAL)

### 3.1 Nova Tabela: `cash_movements` (Migração `002_cash_movements.sql`)

```sql
CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_session_id INTEGER NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('SANGRIA', 'SUPPLY')),
  amount REAL NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session_id ON cash_movements(cash_session_id);
```

### 3.2 Atualização da Tabela `cash_sessions`
- O campo `current_cash` em `cash_sessions` é atualizado atomicamente a cada movimentação:
  - `SUPPLY` (Suprimento / Aporte): `current_cash = current_cash + amount`
  - `SANGRIA` (Sangria / Retirada): `current_cash = current_cash - amount` (bloqueado se `amount > current_cash`)
  - Venda com pagamento em `DINHEIRO`: `current_cash = current_cash + (valor_dinheiro - troco)`

---

## 4. Arquitetura de Backend & Endpoints REST

### 4.1 Extensões no `PosService` (`src/modules/pos/pos.service.ts`)
1. `registerCashMovement(sessionId: number, type: 'SANGRIA' | 'SUPPLY', amount: number, reason: string, operatorName: string): CashMovement`
   - Valida sessão aberta (`SESSION_NOT_OPEN`).
   - Para `SANGRIA`, valida se `amount <= session.currentCash` (lança `INSUFFICIENT_DRAWER_CASH` se faltar numerário na gaveta).
   - Atualiza `current_cash` da sessão e insere registro em `cash_movements` em transação ACID.
2. `getCashMovements(sessionId: number): CashMovement[]`
   - Retorna histórico ordenado de sangrias e suprimentos da sessão.
3. `closeCashSession(sessionId: number): CashSessionSummary` (Aprimorado)
   - Inclui no resumo consolidado: `initialCash`, `totalSupplies`, `totalSangrias`, `expectedCash` na gaveta e vendas por método.
4. `checkoutSale(params: CheckoutParams): SaleDetails` (Unificado para Híbrido)
   - Parâmetros:
     - `cashSessionId: number` (obrigatório, sessão deve estar `OPEN`).
     - `preSaleCode?: string` (opcional, para resgate de ticket do balcão).
     - `additionalItems?: { productId: number; batchId: number; quantity: number }[]` (opcional, itens bipados diretamente no caixa).
     - `payments: PaymentItem[]` (obrigatório: `DINHEIRO`, `CARTAO_CREDITO`, `CARTAO_DEBITO`, `PIX`).
   - Regras de Validação:
     - Se contiver `preSaleCode`, valida que a pré-venda está `OPEN`, deduz lotes reservados e altera status para `CONVERTED_TO_SALE`.
     - Para `additionalItems` bipados no caixa, valida que são `controlType === 'ISENTO'` (proíbe venda direta de controlados no caixa), valida saldo e deduz lotes via `InventoryService`.
     - Calcula valor total consolidado (`preSaleTotal + additionalItemsTotal`).
     - Valida `totalPaid >= grandTotal` e calcula troco em dinheiro.
     - Lança erro `EXCESS_NON_CASH_PAYMENT` se houver troco vindo de cartão ou Pix.
     - Insere `sales`, `sale_items`, `sale_payments` e atualiza `cash_sessions.current_cash` em uma única transação SQLite com `SAVEPOINT`.

### 4.2 Novas Rotas REST no Fastify (`src/api/routes.ts`)
- `POST /api/pos/sessions/:id/movements`: Registro de Sangria / Suprimento.
- `GET /api/pos/sessions/:id/movements`: Histórico de movimentações da sessão.
- `GET /api/pos/sessions/:id/summary`: Prévia do fechamento (para operador conferir valores).
- `POST /api/pos/checkout`: Rota unificada de checkout híbrido (pré-venda + itens de conveniência).

---

## 5. Arquitetura de Frontend & Componentes React

### 5.1 Componentes Principais (`frontend/src/components/pos/`)
1. **`PosPage.tsx` (Terminal de Caixa Principal):**
   - **Header de Caixa:** Status do caixa (Aberto/Fechado), Operador atual, Valor em gaveta, Atalhos de teclado.
   - **Área Central (Duas Colunas):**
     - **Coluna Esquerda:** Grade de itens a serem faturados (itens resgatados da pré-venda destacados com badge `#PV` + itens avulsos de conveniência adicionados no caixa). Permite cancelar item avulso com `[F7]`.
     - **Coluna Direita:** Painel de totais com Subtotal, Descontos, Total a Pagar, dados do cliente/paciente e atalho gigante `[F8] RECEBER / FINALIZAR`.
   - **Barra Inferior de Atalhos:**
     - `[F2]` Consulta Preço
     - `[F5]` Resgatar Pré-Venda
     - `[F7]` Cancelar Item
     - `[F8]` Pagamento / Checkout
     - `[F10]` Sangria / Suprimento
     - `[F12]` Fechar Caixa
     - `[Esc]` Cancelar / Limpar Venda

2. **`PreSaleLookupModal.tsx`:**
   - Modal com campo autofocus para digitação ou leitura de código de barras do ticket `#PV-XXXX`.
   - Carrega itens e receita da pré-venda via `GET /api/pre-sales/:code`.

3. **`DirectItemInput.tsx` (Bip de Conveniência no Caixa):**
   - Campo sempre pronto para leitura de código de barras EAN-13 no caixa.
   - Bipa EAN -> Verifica se é produto `ISENTO` -> Seleciona lote FEFO com saldo -> Adiciona à grade do PDV.
   - Se for medicamento controlado (tarja vermelha/preta), bloqueia com alerta: *"Medicamento controlado exige atendimento prévio no balcão com retenção de receita."*

4. **`PaymentModal.tsx`:**
   - Tela de faturamento financeiro completo.
   - Exibe Total a Pagar, Total Recebido, Saldo Restante / Troco.
   - Seleção rápida de formas de pagamento:
     - `[1] Dinheiro` (com cálculo imediato de troco e atalhos de notas comuns: R$ 10, 20, 50, 100).
     - `[2] Cartão Crédito` (valor + seleção de bandeira).
     - `[3] Cartão Débito` (valor + seleção de bandeira).
     - `[4] Pix` (valor + visualizador dinâmico de QR Code SVG simulado e código copia-e-cola).
   - Suporta divisão de formas de pagamento (ex: R$ 30 no Dinheiro + R$ 25 no Pix).
   - Validações em tempo real: impede concluir com pagamento menor que o total; impede gerar troco em pagamentos via cartão/Pix.

5. **`CashSessionModal.tsx` & `CashMovementModal.tsx`:**
   - Modal de Abertura de Caixa (Nome do Operador e Fundo de Troco).
   - Modal de Sangria (Retirada por segurança) e Suprimento (Aporte de troco) com motivo obrigatório.
   - Modal de Fechamento de Caixa com conferência cega e resumo detalhado por forma de pagamento.

6. **`SaleReceiptModal.tsx`:**
   - Visualizador de cupom fiscal térmico ESC/POS (48 colunas).
   - Impressão automática ou via tecla `[Enter] / [F11]`.

---

## 6. Ergonomia e Mapeamento de Teclado (Frente de Caixa)

| Tecla de Atalho | Ação Executada | Condição de Bloqueio |
| :--- | :--- | :--- |
| **`[F2]`** | Abre consulta de preço por EAN | Desabilitado durante pagamento |
| **`[F5]`** | Abre modal de resgate de Pré-Venda `#PV-XXXX` | Desabilitado se modal ativo |
| **`[F7]`** | Cancela o item selecionado da lista de conveniência | Não permite cancelar item da pré-venda sem cancelar a pré-venda inteira |
| **`[F8]`** | Abre tela de Pagamento / Checkout | Desabilitado se caixa vazio ou fechado |
| **`[F10]`** | Abre modal de Sangria / Suprimento | Apenas com caixa aberto |
| **`[F12]`** | Abre modal de Fechamento de Turno | Apenas com caixa aberto e sem venda em andamento |
| **`[Esc]`** | Fecha modais abertos / Cancela atendimento atual | - |

---

## 7. Estratégia de Testes Automatizados (TDD)

1. **Testes de Backend (Vitest / Node):**
   - `tests/modules/pos/pos.service.movements.test.ts`: Testes unitários de Sangria e Suprimento (saldo insuficiente na gaveta, histórico, impacto no fechamento).
   - `tests/modules/pos/pos.service.hybrid-checkout.test.ts`: Checkout híbrido (apenas pré-venda, apenas conveniência direta, pré-venda + conveniência combinados, bloqueio de controlados na venda direta).
   - `tests/api/routes.pos.test.ts`: Testes das rotas REST de movimentações e checkout híbrido.
2. **Testes de Frontend (Vitest / JSDOM + Testing Library):**
   - `frontend/tests/components/PaymentModal.test.tsx`: Divisão de pagamentos, troco em dinheiro, bloqueio de troco em cartão/Pix.
   - `frontend/tests/components/CashMovementModal.test.tsx`: Sangria e Suprimento.
   - `frontend/tests/components/CashSessionModal.test.tsx`: Abertura e fechamento de caixa com resumo.
   - `frontend/tests/pages/PosPage.test.tsx`: Fluxo completo integrado de caixa (Abertura -> Resgate de Pré-Venda -> Bip de Conveniência -> Pagamento F8 -> Conclusão e Cupom).
