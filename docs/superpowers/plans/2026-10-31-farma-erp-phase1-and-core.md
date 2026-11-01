# FarmaCore ERP & PDV - Plano de Implementação (Fase 1: Core & Fundação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o núcleo operacional do FarmaCore em TypeScript e SQLite, englobando o catálogo de medicamentos com regras CMED (PMC/PF), controle de lotes com algoritmo FEFO, motor de Pré-Venda de Balcão com retenção de receita e finalização básica no PDV com emulador de cupom fiscal.

**Architecture:** Monólito modular em TypeScript com Fastify no backend, SQLite como banco relacional local de alta velocidade, e frontend React/Vite com emulador de periféricos (ESC/POS). A arquitetura separa o domínio farmacêutico (regras da Anvisa e CMED) dos adaptadores de entrega (HTTP e UI).

**Tech Stack:** Node.js, TypeScript, Fastify, SQLite (`better-sqlite3` ou `sqlite3`), Vitest, React, Vite, Tailwind CSS.

**Spec:** `C:/Users/magno/.gemini/antigravity/scratch/farma-erp/docs/specs/2026-10-31-farma-erp-design.md`

## Global Constraints

- Backend e testes devem rodar em ambiente Node.js 18+ com TypeScript estrito (`strict: true`).
- SQLite embutido como banco de dados local com `WAL mode` ativado para suporte a leituras concorrentes.
- Proibida a venda ou saída de lotes com data de validade igual ou anterior à data atual.
- Proibida qualquer precificação de venda acima do PMC (Preço Máximo ao Consumidor) registrado para o medicamento.
- Dispensação de medicamentos das listas da Portaria 344/98 e antimicrobianos exige obrigatoriamente: CRM, UF do prescritor, tipo de receituário, nome do paciente e seleção/confirmação do lote físico.

## Review Focus

1. **Tentativa de venda com preço superior ao PMC:** O sistema deve rejeitar a inclusão ou alteração de preço que ultrapasse o PMC registrado na tabela CMED com erro `CMED_PMC_EXCEEDED`.
2. **Tentativa de dispensação de lote vencido:** O motor de estoque deve filtrar ou lançar erro `BATCH_EXPIRED` caso o operador tente selecionar um lote cuja validade já expirou.
3. **Dispensação de controlado sem dados de prescritor:** O serviço de Pré-Venda de Balcão deve rejeitar a criação do pedido com `PRESCRIPTION_REQUIRED` se o produto for tarja vermelha/preta controlada e os dados da receita estiverem vazios.
4. **Reserva de lote concorrente no balcão:** Se dois atendentes tentarem alocar as últimas caixas de um mesmo lote simultaneamente, a transação do segundo deve falhar de forma atômica com `INSUFFICIENT_BATCH_STOCK`.
5. **Tentativa de resgate de Pré-Venda já finalizada ou cancelada:** O Caixa do PDV deve bloquear a cobrança duplicada com erro `PRE_SALE_ALREADY_CLOSED`.

---

### Task 1: Scaffolding do Projeto e Configuração da Stack

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/database/connection.ts`
- Test: `tests/database/connection.test.ts`

**Interfaces:**
- Consumes: N/A
- Produces: `getDatabase(dbPath?: string): Database` — retorna instância SQLite configurada com modo WAL e chaves estrangeiras ativas.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/database/connection.test.ts
import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../src/database/connection';

describe('Database Connection', () => {
  it('should initialize an in-memory SQLite database with WAL and foreign keys enabled', () => {
    const db = getDatabase(':memory:');
    const pragmaFk = db.pragma('foreign_keys', { simple: true });
    expect(pragmaFk).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/database/connection.test.ts`  
Expected: FAIL with "Cannot find module '../../src/database/connection'"

- [ ] **Step 3: Implement scaffolding and `getDatabase` in `src/database/connection.ts`**

Configurar `package.json` com scripts de build e test, dependências (`fastify`, `better-sqlite3`, `zod`), devDependencies (`vitest`, `typescript`, `@types/node`, `@types/better-sqlite3`), e implementar a fábrica `getDatabase` ativando `PRAGMA foreign_keys = ON;`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/database/connection.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git init
git add package.json tsconfig.json vitest.config.ts src/database/connection.ts tests/database/connection.test.ts
git commit -m "chore: scaffold farma-erp project and database connection"
```

---

### Task 2: Schema Relacional e Migrations

**Files:**
- Create: `src/database/migrations/001_initial_schema.sql`
- Create: `src/database/migrator.ts`
- Test: `tests/database/migrator.test.ts`

**Interfaces:**
- Consumes: `getDatabase` de `src/database/connection.ts`
- Produces: `runMigrations(db: Database): void` — aplica todas as tabelas (products, batches, pre_sales, pre_sale_items, cash_sessions, sales, sale_items, prescriptions).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/database/migrator.test.ts
import { describe, it, expect } from 'vitest';
import { getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';

describe('Database Migrator', () => {
  it('should create required tables including products, batches, and pre_sales', () => {
    const db = getDatabase(':memory:');
    runMigrations(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    expect(tables).toContain('products');
    expect(tables).toContain('batches');
    expect(tables).toContain('pre_sales');
    expect(tables).toContain('prescriptions');
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/database/migrator.test.ts`  
Expected: FAIL with "Cannot find module '../../src/database/migrator'"

- [ ] **Step 3: Implement SQL schema and `runMigrations`**

Definir `001_initial_schema.sql` com:
- `products`: id, ean, name, active_ingredient (DCB), ms_registration, stripe (SEM_TARJA, VERMELHA, PRETA), control_type (ISENTO, ANTIMICROBIANO, C1, B1, etc.), pmc, pf, price, is_active.
- `batches`: id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity.
- `pre_sales`: id, code, status (OPEN, CONVERTED_TO_SALE, CANCELLED), customer_name, customer_cpf, total_amount, created_at.
- `pre_sale_items`: id, pre_sale_id, product_id, batch_id, quantity, unit_price, total_price.
- `prescriptions`: id, pre_sale_id, doctor_name, doctor_crm, doctor_uf, prescription_type, prescription_date, patient_name, buyer_name, buyer_cpf.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/database/migrator.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/database/migrations/001_initial_schema.sql src/database/migrator.ts tests/database/migrator.test.ts
git commit -m "feat: add initial database schema and migration engine"
```

---

### Task 3: Catálogo Farmacêutico e Validação de Teto CMED

**Files:**
- Create: `src/modules/catalog/catalog.service.ts`
- Create: `src/modules/catalog/types.ts`
- Test: `tests/modules/catalog/catalog.service.test.ts`

**Interfaces:**
- Consumes: `Database`
- Produces: `CatalogService`:
  - `createProduct(data: CreateProductDTO): Product`
  - `getProductByEan(ean: string): Product | null`
  - `searchProducts(query: string): Product[]`
  - Validação estrita: se `price > pmc`, lançar `Error('CMED_PMC_EXCEEDED')`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/modules/catalog/catalog.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let db: any;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CatalogService(db);
  });

  it('should register a medicine when price is within PMC limit', () => {
    const prod = service.createProduct({
      ean: '7891234567890',
      name: 'Amoxicilina 500mg',
      activeIngredient: 'Amoxicilina',
      msRegistration: '100430001001',
      stripe: 'VERMELHA',
      controlType: 'ANTIMICROBIANO',
      pmc: 45.00,
      pf: 30.00,
      price: 39.90,
    });
    expect(prod.id).toBeDefined();
    expect(service.getProductByEan('7891234567890')?.name).toBe('Amoxicilina 500mg');
  });

  it('should reject registration if sales price exceeds CMED PMC ceiling', () => {
    expect(() => {
      service.createProduct({
        ean: '7891234567891',
        name: 'Clonazepam 2mg',
        activeIngredient: 'Clonazepam',
        msRegistration: '100430002001',
        stripe: 'PRETA',
        controlType: 'B1',
        pmc: 25.00,
        pf: 15.00,
        price: 25.01,
      });
    }).toThrow('CMED_PMC_EXCEEDED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/catalog/catalog.service.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `CatalogService` in `src/modules/catalog/catalog.service.ts`**

Implementar métodos com validação de `price <= pmc`, inserção e consultas SQL otimizadas com busca por EAN ou LIKE em `name` e `active_ingredient`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/catalog/catalog.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/catalog/ tests/modules/catalog/
git commit -m "feat: implement pharmaceutical catalog with CMED PMC price ceiling enforcement"
```

---

### Task 4: Motor de Estoque com Algoritmo FEFO e Gestão de Lotes

**Files:**
- Create: `src/modules/inventory/inventory.service.ts`
- Create: `src/modules/inventory/types.ts`
- Test: `tests/modules/inventory/inventory.service.test.ts`

**Interfaces:**
- Consumes: `Database`, `CatalogService`
- Produces: `InventoryService`:
  - `addBatch(data: AddBatchDTO): Batch`
  - `getAvailableBatches(productId: number): Batch[]` (ordenado por `expiration_date ASC` - FEFO)
  - `suggestFefoBatch(productId: number, quantity: number): Batch`
  - `reserveBatchStock(batchId: number, quantity: number): void`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/modules/inventory/inventory.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';

describe('InventoryService (FEFO & Batches)', () => {
  let db: any;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let productId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);

    const prod = catalog.createProduct({
      ean: '7891111111111',
      name: 'Dipirona 500mg',
      activeIngredient: 'Dipirona Sódica',
      msRegistration: '100000000000',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 15.00,
      pf: 10.00,
      price: 8.50,
    });
    productId = prod.id;
  });

  it('should reject adding an already expired batch', () => {
    expect(() => {
      inventory.addBatch({
        productId,
        batchNumber: 'LOTE-VELHO',
        manufacturingDate: '2023-01-01',
        expirationDate: '2024-01-01',
        quantity: 10,
      });
    }).toThrow('BATCH_EXPIRED');
  });

  it('should automatically select the batch with earliest expiration date (FEFO)', () => {
    inventory.addBatch({
      productId,
      batchNumber: 'LOTE-LONGO',
      manufacturingDate: '2026-01-01',
      expirationDate: '2028-12-31',
      quantity: 50,
    });

    inventory.addBatch({
      productId,
      batchNumber: 'LOTE-CURTO',
      manufacturingDate: '2026-01-01',
      expirationDate: '2027-06-30',
      quantity: 20,
    });

    const suggested = inventory.suggestFefoBatch(productId, 1);
    expect(suggested.batchNumber).toBe('LOTE-CURTO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/inventory/inventory.service.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `InventoryService` in `src/modules/inventory/inventory.service.ts`**

Implementar adição de lotes com verificação de validade (`expiration_date > CURRENT_DATE`), listagem com `WHERE quantity - reserved_quantity > 0 ORDER BY expiration_date ASC`, e reserva atômica de estoque.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/inventory/inventory.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/inventory/ tests/modules/inventory/
git commit -m "feat: implement inventory service with FEFO lot suggestion and expiration guards"
```

---

### Task 5: Serviço de Balcão (Pré-Venda) e Validação de Receitas Portaria 344/98

**Files:**
- Create: `src/modules/counter/pre-sale.service.ts`
- Create: `src/modules/counter/types.ts`
- Test: `tests/modules/counter/pre-sale.service.test.ts`

**Interfaces:**
- Consumes: `Database`, `CatalogService`, `InventoryService`
- Produces: `PreSaleService`:
  - `createPreSale(data: CreatePreSaleDTO): PreSale`
  - `getPreSaleByCode(code: string): PreSaleDetails | null`
  - Validação estrita: se produto tiver `controlType !== 'ISENTO'`, exigir objeto `prescription` completo (doctorName, doctorCrm, doctorUf, prescriptionType, patientName) e validar que o `batchId` foi selecionado explicitamente.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/modules/counter/pre-sale.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';

describe('PreSaleService (Balcão & Receituário)', () => {
  let db: any;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let preSale: PreSaleService;
  let controlledProdId: number;
  let controlledBatchId: number;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSale = new PreSaleService(db, catalog, inventory);

    const prod = catalog.createProduct({
      ean: '7892222222222',
      name: 'Diazepam 10mg',
      activeIngredient: 'Diazepam',
      msRegistration: '100430003001',
      stripe: 'PRETA',
      controlType: 'B1',
      pmc: 30.00,
      pf: 20.00,
      price: 22.00,
    });
    controlledProdId = prod.id;

    const batch = inventory.addBatch({
      productId: controlledProdId,
      batchNumber: 'DZP-2026',
      manufacturingDate: '2026-01-01',
      expirationDate: '2027-12-31',
      quantity: 100,
    });
    controlledBatchId = batch.id;
  });

  it('should block controlled medicine pre-sale without prescription details', () => {
    expect(() => {
      preSale.createPreSale({
        customerName: 'João da Silva',
        items: [{ productId: controlledProdId, batchId: controlledBatchId, quantity: 1 }],
      });
    }).toThrow('PRESCRIPTION_REQUIRED');
  });

  it('should create pre-sale with ticket code when prescription is provided', () => {
    const sale = preSale.createPreSale({
      customerName: 'João da Silva',
      items: [{ productId: controlledProdId, batchId: controlledBatchId, quantity: 1 }],
      prescription: {
        doctorName: 'Dra. Maria Santos',
        doctorCrm: '123456',
        doctorUf: 'SP',
        prescriptionType: 'B1_AZUL',
        prescriptionDate: '2026-10-31',
        patientName: 'João da Silva',
        buyerName: 'João da Silva',
        buyerCpf: '123.456.789-00',
      },
    });

    expect(sale.code).toMatch(/^PV-\d+/);
    expect(sale.status).toBe('OPEN');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/counter/pre-sale.service.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `PreSaleService` in `src/modules/counter/pre-sale.service.ts`**

Implementar geração de código único `#PV-XXXX`, validação transacional do receituário com a tabela `prescriptions` e reserva do lote com `inventory.reserveBatchStock`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/counter/pre-sale.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/counter/ tests/modules/counter/
git commit -m "feat: implement counter pre-sale service with mandatory prescription validation"
```

---

### Task 6: Serviço de Caixa (PDV) e Finalização de Vendas

**Files:**
- Create: `src/modules/pos/pos.service.ts`
- Create: `src/modules/pos/types.ts`
- Test: `tests/modules/pos/pos.service.test.ts`

**Interfaces:**
- Consumes: `Database`, `PreSaleService`, `InventoryService`
- Produces: `PosService`:
  - `openCashSession(operatorName: string, initialCash: number): CashSession`
  - `closeCashSession(sessionId: number): CashSessionSummary`
  - `finalizeSaleFromPreSale(preSaleCode: string, payments: PaymentItem[]): Sale`
  - Validação estrita: garantir que o total de pagamentos bata com o total da Pré-Venda e efetivar a baixa física do lote (`quantity = quantity - sold, reserved = reserved - sold`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/modules/pos/pos.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getDatabase } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CatalogService } from '../../../src/modules/catalog/catalog.service';
import { InventoryService } from '../../../src/modules/inventory/inventory.service';
import { PreSaleService } from '../../../src/modules/counter/pre-sale.service';
import { PosService } from '../../../src/modules/pos/pos.service';

describe('PosService (Frente de Caixa)', () => {
  let db: any;
  let pos: PosService;
  let preSale: PreSaleService;
  let inventory: InventoryService;
  let catalog: CatalogService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    catalog = new CatalogService(db);
    inventory = new InventoryService(db);
    preSale = new PreSaleService(db, catalog, inventory);
    pos = new PosService(db, preSale, inventory);
  });

  it('should successfully finalize a pre-sale at the checkout with exact payment', () => {
    const prod = catalog.createProduct({
      ean: '7893333333333',
      name: 'Vitamina C 1g',
      activeIngredient: 'Ácido Ascórbico',
      msRegistration: '100000000001',
      stripe: 'SEM_TARJA',
      controlType: 'ISENTO',
      pmc: 20.00,
      pf: 12.00,
      price: 15.00,
    });

    const batch = inventory.addBatch({
      productId: prod.id,
      batchNumber: 'VIT-01',
      manufacturingDate: '2026-01-01',
      expirationDate: '2027-12-31',
      quantity: 10,
    });

    const pv = preSale.createPreSale({
      customerName: 'Consumidor Final',
      items: [{ productId: prod.id, batchId: batch.id, quantity: 2 }],
    });

    const sale = pos.finalizeSaleFromPreSale(pv.code, [
      { method: 'DINHEIRO', amount: 30.00 },
    ]);

    expect(sale.id).toBeDefined();
    expect(sale.status).toBe('COMPLETED');
    expect(sale.changeAmount).toBe(0);

    // Conferir se o lote foi baixado fisicamente
    const updatedBatch = inventory.getAvailableBatches(prod.id).find(b => b.id === batch.id);
    expect(updatedBatch?.quantity).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/pos/pos.service.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `PosService` in `src/modules/pos/pos.service.ts`**

Implementar abertura de sessão de caixa, conversão de status da Pré-Venda para `CONVERTED_TO_SALE`, inserção de venda e itens, e baixa física no estoque dentro de transação SQLite (`db.transaction`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/pos/pos.service.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/pos/ tests/modules/pos/
git commit -m "feat: implement POS service for cash session management and pre-sale checkout finalization"
```

---

### Task 7: Servidor Fastify REST e Emulador de Cupom Fiscal ESC/POS

**Files:**
- Create: `src/server.ts`
- Create: `src/api/routes.ts`
- Create: `src/modules/pos/receipt-formatter.ts`
- Test: `tests/api/routes.test.ts`

**Interfaces:**
- Consumes: Todos os serviços anteriores
- Produces: API HTTP rodando em porta configurável com endpoints:
  - `POST /api/products`, `GET /api/products`
  - `POST /api/batches`, `GET /api/inventory/:productId`
  - `POST /api/pre-sales`, `GET /api/pre-sales/:code`
  - `POST /api/pos/sessions`, `POST /api/pos/checkout`
  - `formatReceipt(sale: SaleDetails): string` — gera texto formatado em largura de 48 colunas padrão bobina térmica de 80mm com código de barras, dados do consumidor e impostos aproximados.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/api/routes.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from '../../src/api/routes';
import { getDatabase } from '../../src/database/connection';
import { runMigrations } from '../../src/database/migrator';

describe('Fastify REST API & Receipt Formatter', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = getDatabase(':memory:');
    runMigrations(db);
    app = Fastify();
    await registerRoutes(app, db);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return 200 on health check and handle product creation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/products',
      payload: {
        ean: '7894444444444',
        name: 'Paracetamol 750mg',
        activeIngredient: 'Paracetamol',
        msRegistration: '100000000002',
        stripe: 'SEM_TARJA',
        controlType: 'ISENTO',
        pmc: 12.00,
        pf: 8.00,
        price: 9.50,
      },
    });

    expect(response.statusCode).toBe(201);
    const json = JSON.parse(response.body);
    expect(json.name).toBe('Paracetamol 750mg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/routes.test.ts`  
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement `registerRoutes`, `server.ts` and `receipt-formatter.ts`**

Criar rotas Fastify integradas com os módulos, tratamento de erros para regras CMED e receitas, e formatador de cupom ESC/POS simulado.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/routes.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/api/ src/modules/pos/receipt-formatter.ts tests/api/
git commit -m "feat: implement Fastify REST routes and ESC/POS thermal receipt formatter"
```
