# FarmaCore ERP & PDV - Plano de Implementação (Fase 2: Desktop & Balcão)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o terminal de atendimento de balcão do FarmaCore em uma aplicação desktop (Electron + React + Tailwind CSS), proporcionando busca instantânea de medicamentos por atalhos (`F2`), seleção inteligente de lotes (FEFO), modal de retenção de receitas (Portaria 344/98) e emissão visual do ticket de Pré-Venda (`#PV-XXXX`).

**Architecture:** Frontend React SPA construído com Vite e Tailwind CSS, empacotado dentro de uma janela nativa do Electron (`BrowserWindow`). O Electron executa em background o servidor Fastify e o banco SQLite (criados na Fase 1), expondo canais IPC seguros para controle de janela e atalhos de hardware.

**Tech Stack:** Electron, React 18+, Vite, TypeScript, Tailwind CSS, Lucide Icons, Vitest, `@testing-library/react`.

**Spec:** `C:/Users/magno/.gemini/antigravity/scratch/farma-erp/docs/specs/2026-11-01-farma-erp-phase2-desktop-counter.md`

## Global Constraints

- O frontend deve rodar perfeitamente tanto no navegador web quanto dentro do Electron via proxy/API em `http://localhost:3000`.
- Navegação prioritária por teclado: tecla `F2` foca na busca de produtos, `F4` finaliza a pré-venda, `Esc` fecha qualquer modal.
- Proibida a geração de pré-venda contendo medicamentos com `controlType !== 'ISENTO'` sem preenchimento completo dos campos sanitários obrigatórios (CRM, UF, Nome do Médico, Tipo de Receita, Nome do Paciente).
- Para medicamentos controlados, o operador deve ter visibilidade clara do número do lote físico e data de validade que está reservando.
- Preços praticados devem respeitar o teto PMC estipulado pela CMED com indicador visual de conformidade.

## Review Focus

1. **Tentativa de fechar pré-venda com remédio controlado sem receita:** O botão de finalização (`F4`) deve obrigatoriamente abrir o modal de retenção e bloquear a requisição se os campos estiverem incompletos.
2. **Seleção de lote esgotado ou expirado:** A interface do seletor de lotes deve desabilitar lotes vencidos ou com saldo zero, destacando o lote com menor data de validade (FEFO).
3. **Atalhos de teclado concorrentes:** Pressionar `F2` enquanto um modal estiver aberto não deve perder o foco ou corromper o estado do formulário de receita.
4. **Tratamento de queda ou erro do backend:** Se o Fastify retornar erro (ex: `INSUFFICIENT_BATCH_STOCK`), a interface deve exibir alerta amigável na tela sem travar a sessão de atendimento.
5. **Formatação do ticket de pré-venda:** O comprovante visual gerado deve exibir código legível `#PV-XXXX`, itens, quantidades, lotes e aviso para encaminhamento ao caixa.

---

### Task 1: Scaffolding do Frontend (React + Vite + Tailwind) e Electron Main Process

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/index.html`
- Create: `desktop/main.ts`
- Create: `desktop/preload.ts`
- Test: `frontend/tests/App.test.tsx`

**Interfaces:**
- Consumes: N/A
- Produces: Aplicação React montável e testável com Vitest e scripts de execução configurados no `package.json` raiz (`npm run dev:web`, `npm run dev:desktop`).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/App.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App Root Component', () => {
  it('should render the FarmaCore header and counter terminal title', () => {
    render(<App />);
    expect(screen.getByText(/FarmaCore/i)).toBeDefined();
    expect(screen.getByText(/Terminal de Balcão/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/tests/App.test.tsx`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement frontend scaffolding, Tailwind CSS, and Electron files**

Configurar `frontend/` com React 18, Tailwind CSS, `@testing-library/react`, `jsdom`, e criar `desktop/main.ts` com criação de janela Electron e atalho para URL local ou estática.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/tests/App.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/ desktop/ package.json
git commit -m "chore: scaffold frontend React Vite Tailwind and Electron desktop container"
```

---

### Task 2: Componente de Busca Farmacêutica com Atalhos (F2) e Indicadores CMED

**Files:**
- Create: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Create: `frontend/src/components/ProductSearch.tsx`
- Create: `frontend/src/services/api.ts`
- Test: `frontend/tests/components/ProductSearch.test.tsx`

**Interfaces:**
- Consumes: API endpoint `GET /api/products/search?q=...`
- Produces: `ProductSearch`: componente de autocomplete rápido com foco ao pressionar `F2`, listando produtos com badges de tarja (Verde para isento, Vermelha, Preta) e PMC.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/components/ProductSearch.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductSearch from '../../src/components/ProductSearch';

describe('ProductSearch Component', () => {
  it('should trigger search and display product stripe and PMC price', async () => {
    const onSelect = vi.fn();
    render(<ProductSearch onSelectProduct={onSelect} />);

    const input = screen.getByPlaceholderText(/buscar medicamento/i);
    fireEvent.change(input, { target: { value: 'Amoxicilina' } });

    await waitFor(() => {
      expect(screen.getByText(/Amoxicilina/i)).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/tests/components/ProductSearch.test.tsx`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `ProductSearch` and `useKeyboardShortcuts`**

Implementar campo com debounce de 250ms, seleção via setas do teclado (cima/baixo + Enter), badges de tarja coloridos e exibição do preço com teto PMC.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/tests/components/ProductSearch.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ProductSearch.tsx frontend/src/hooks/ frontend/tests/
git commit -m "feat: implement pharmaceutical product search with F2 shortcut and CMED badges"
```

---

### Task 3: Grade de Seleção de Lotes (FEFO) e Carrinho de Atendimento

**Files:**
- Create: `frontend/src/components/BatchSelector.tsx`
- Create: `frontend/src/components/CartTable.tsx`
- Test: `frontend/tests/components/BatchSelector.test.tsx`
- Test: `frontend/tests/components/CartTable.test.tsx`

**Interfaces:**
- Consumes: API endpoint `GET /api/inventory/:productId/batches`
- Produces:
  - `BatchSelector`: exibe lotes disponíveis ordenados por validade, destaca o lote FEFO sugerido e permite conferir o lote em mãos.
  - `CartTable`: lista itens selecionados, quantidades, lotes atribuídos e total acumulado.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/components/BatchSelector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BatchSelector from '../../src/components/BatchSelector';

describe('BatchSelector Component', () => {
  it('should highlight the earliest expiration batch with FEFO badge', () => {
    const batches = [
      { id: 1, batchNumber: 'LOTE-A', expirationDate: '2027-01-01', availableQuantity: 10, quantity: 10, reservedQuantity: 0 },
      { id: 2, batchNumber: 'LOTE-B', expirationDate: '2028-01-01', availableQuantity: 20, quantity: 20, reservedQuantity: 0 },
    ];
    render(<BatchSelector batches={batches} selectedBatchId={1} onSelectBatch={vi.fn()} />);

    expect(screen.getByText(/FEFO/i)).toBeDefined();
    expect(screen.getByText('LOTE-A')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/tests/components/BatchSelector.test.tsx`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `BatchSelector` and `CartTable`**

Implementar tabela visual de lotes com indicação de dias até o vencimento, botão de seleção rápida e tabela do carrinho de compras com botões de alteração de quantidade e remoção.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/tests/components/BatchSelector.test.tsx frontend/tests/components/CartTable.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/BatchSelector.tsx frontend/src/components/CartTable.tsx frontend/tests/
git commit -m "feat: implement FEFO batch selector and counter cart table"
```

---

### Task 4: Modal de Retenção de Receituário (Portaria 344/98 e Antimicrobianos)

**Files:**
- Create: `frontend/src/components/PrescriptionModal.tsx`
- Test: `frontend/tests/components/PrescriptionModal.test.tsx`

**Interfaces:**
- Consumes: Types de prescrição
- Produces: `PrescriptionModal`: formulário modal modal com validação de campos obrigatórios (CRM, UF, Nome do Médico, Tipo de Receita, Data da Receita, Nome do Paciente, Comprador e CPF).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/components/PrescriptionModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrescriptionModal from '../../src/components/PrescriptionModal';

describe('PrescriptionModal Component', () => {
  it('should block submission if mandatory doctor and patient fields are empty', () => {
    const onConfirm = vi.fn();
    render(<PrescriptionModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} />);

    const submitBtn = screen.getByRole('button', { name: /confirmar receita/i });
    fireEvent.click(submitBtn);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/crm é obrigatório/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/tests/components/PrescriptionModal.test.tsx`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `PrescriptionModal`**

Implementar modal com campos de prescrição farmacêutica, dropdown de tipos de receita (B1 Azul, C1 Branca 2 Vias, Antimicrobiano), formatação de data e validação antes da chamada de callback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/tests/components/PrescriptionModal.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PrescriptionModal.tsx frontend/tests/
git commit -m "feat: implement prescription retention modal for controlled substances"
```

---

### Task 5: Terminal de Balcão Integrado (CounterPage) e Visualizador de Ticket de Pré-Venda

**Files:**
- Create: `frontend/src/components/PreSaleTicket.tsx`
- Create: `frontend/src/pages/CounterPage.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/pages/CounterPage.test.tsx`

**Interfaces:**
- Consumes: Todos os componentes criados, API endpoints `POST /api/pre-sales` e `GET /api/pre-sales/:code`
- Produces: Tela principal do Balcão integrada com atalho `F4` para finalizar pré-venda, disparar o modal sanitário se houver controlados e emitir o ticket na tela com opção de impressão.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/tests/pages/CounterPage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CounterPage from '../../src/pages/CounterPage';

describe('CounterPage Integration', () => {
  it('should render search bar, cart, and keyboard shortcut indicators (F2, F4, F9)', () => {
    render(<CounterPage />);
    expect(screen.getByText(/F2 - Buscar/i)).toBeDefined();
    expect(screen.getByText(/F4 - Gerar Pré-Venda/i)).toBeDefined();
    expect(screen.getByText(/F9 - Novo Atendimento/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/tests/pages/CounterPage.test.tsx`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `PreSaleTicket`, `CounterPage`, and update `App.tsx`**

Integrar os fluxos: busca de produto, carregamento e seleção de lote com FEFO, adição ao carrinho, acionamento do modal de receita ao clicar em Finalizar (`F4`), chamada da API `POST /api/pre-sales` e exibição do comprovante visual com código do ticket.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/tests/pages/CounterPage.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PreSaleTicket.tsx frontend/src/pages/CounterPage.tsx frontend/src/App.tsx frontend/tests/
git commit -m "feat: implement integrated counter terminal page with pre-sale ticket generator"
```
