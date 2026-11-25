# Especificação Técnica — Fase 46: Balanço Patrimonial & Inventário Rotativo Cego (RDC 44/2009 e Portaria 344/98)

## 1. Visão Geral
No varejo farmacêutico brasileiro, auditorias de estoque exigem conformidade estrita com normas sanitárias e contábeis:
1. **Contagem Cega (Blind Counting):** Durante a contagem física (seja diária rotativa por curva ABC ou geral no balanço periódico), o operador/conferente não deve visualizar a quantidade em estoque registrada no sistema, evitando vícios de confirmação.
2. **Segurança Sanitária & Trava em Controlados (Portaria 344/98 & SNGPC):** Qualquer divergência física em medicamentos sujeitos a controle especial (Portaria 344/98 - Listas A1, A2, A3, B1, B2, C1, C2, etc.) requer bloqueio sanitário imediato, exigindo justificativa formal do Farmacêutico RT (Responsável Técnico) com CRF antes de qualquer baixa ou regularização.
3. **Reconciliação e Ajuste Patrimonial:** Após a segunda ou terceira contagem de auditoria, o gestor aprova as divergências, disparando lançamentos contábeis de ajuste no inventário, geração de perdas/ganhos para o DRE e atualização no Bloco H do SPED Fiscal.

---

## 2. Arquitetura de Dados (Migration 045)

### 2.1. `stock_inventories` (Sessões de Inventário / Balanço)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `code` TEXT UNIQUE NOT NULL (ex: `INV-202611-0001`)
- `store_id` INTEGER NOT NULL REFERENCES stores(id)
- `type` TEXT NOT NULL (ex: `'ROTATIVO'`, `'GERAL_PATRIMONIAL'`, `'CONTROLADOS_SNGPC'`)
- `status` TEXT NOT NULL DEFAULT `'OPEN'` (`'OPEN'`, `'COUNTING'`, `'AUDITING'`, `'FINALIZED'`, `'CANCELLED'`)
- `started_at` TEXT NOT NULL
- `finished_at` TEXT
- `responsible_user_id` INTEGER REFERENCES users(id)
- `responsible_pharmacist_crf` TEXT
- `total_items_counted` INTEGER DEFAULT 0
- `total_divergences_count` INTEGER DEFAULT 0
- `total_divergence_value` REAL DEFAULT 0.0
- `notes` TEXT
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
- `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP

### 2.2. `stock_inventory_items` (Itens do Inventário)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `inventory_id` INTEGER NOT NULL REFERENCES stock_inventories(id) ON DELETE CASCADE
- `product_id` INTEGER NOT NULL REFERENCES products(id)
- `batch_id` INTEGER REFERENCES batches(id)
- `system_quantity` REAL NOT NULL -- Oculto do operador durante a contagem
- `counted_quantity` REAL DEFAULT 0.0
- `divergence_quantity` REAL DEFAULT 0.0 -- (counted - system)
- `unit_cost` REAL NOT NULL DEFAULT 0.0
- `divergence_value` REAL DEFAULT 0.0
- `is_controlled` INTEGER NOT NULL DEFAULT 0 -- Flag Portaria 344/98
- `requires_pharmacist_approval` INTEGER NOT NULL DEFAULT 0
- `pharmacist_approved` INTEGER DEFAULT 0
- `justification` TEXT
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP
- `updated_at` TEXT DEFAULT CURRENT_TIMESTAMP

### 2.3. `stock_inventory_adjustments` (Lançamentos de Ajuste Contábil/Físico)
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `inventory_id` INTEGER NOT NULL REFERENCES stock_inventories(id)
- `item_id` INTEGER NOT NULL REFERENCES stock_inventory_items(id)
- `product_id` INTEGER NOT NULL REFERENCES products(id)
- `batch_id` INTEGER REFERENCES batches(id)
- `adjustment_type` TEXT NOT NULL -- 'SOBRA' (entrada) ou 'FALTA' (saída/perda)
- `quantity` REAL NOT NULL
- `unit_cost` REAL NOT NULL
- `total_cost` REAL NOT NULL
- `dre_reason` TEXT NOT NULL -- 'QUEBRA', 'FURTO', 'VALIDADE_EXPIRADA', 'AJUSTE_CONTAGEM'
- `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

---

## 3. Regras de Negócio & Serviços (`BlindInventoryService`)
1. **`createInventorySession(storeId, type, userId)`**: Inicia a contagem, congelando snapshots das quantidades do sistema para cada produto/lote participante.
2. **`registerItemCount(inventoryId, productId, batchId, countedQty)`**: Registra a contagem cega. O conferente informa apenas o EAN/lote e a quantidade contada.
3. **`calculateDivergences(inventoryId)`**: Apura as diferenças (`counted_quantity - system_quantity`). Se houver divergência em controlado (`is_controlled = 1`), marca `requires_pharmacist_approval = 1`.
4. **`approveControlledDivergence(itemId, pharmacistCrf, justification)`**: Valida e registra a assinatura do RT sanitário para justificar perda ou quebra de controlado.
5. **`finalizeInventory(inventoryId, userId)`**: Bloqueia se houver controlados com divergência sem aprovação do RT. Efetua a regularização física do estoque (`batches.quantity`), gera `stock_inventory_adjustments` e finaliza a sessão.
6. **`getInventoryKpis(storeId)`**: Indicadores de acurácia de estoque (% acurácia, perdas no mês, itens auditados).
