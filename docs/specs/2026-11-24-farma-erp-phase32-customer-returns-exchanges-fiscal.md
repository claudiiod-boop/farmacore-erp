# Especificação Técnica - Fase 32: Devoluções de Clientes, Trocas no Balcão & Estorno Fiscal / Logística Reversa

## 1. Visão Geral & Contexto Regulatório Farmacêutico
No varejo farmacêutico brasileiro, a devolução e troca de mercadorias envolvem rigorosas regras sanitárias da ANVISA e obrigações tributárias da SEFAZ:
- **RDC 44/2009 ANVISA:** A drogaria deve manter controle estrito sobre produtos devolvidos. Medicamentos termolábeis (ex: vacinas, insulinas) que saíram da drogaria e perderam o controle térmico da cadeia de frio **não podem retornar ao estoque para revenda**, devendo ser encaminhados para descarte (PGRSS) ou quarentena.
- **Portaria 344/98 & Antimicrobianos:** Medicamentos sob controle especial devolvidos exigem autorização expressa do Farmacêutico Responsável Técnico (CRF) e registro de reintegração/estorno sanitário.
- **Legislação Fiscal (SEFAZ):**
  - Toda devolução de venda no balcão (NFC-e / SAT / ECF) ou faturada (NF-e) exige a emissão de **NF-e de Devolução / Entrada de Mercadoria** referenciando a chave de acesso do documento fiscal original.
  - Aplicação dos CFOPs regulatórios: `1.202` (devolução de venda no estado de mercadoria comum), `1.411` (devolução de venda no estado sujeita a ICMS Substituição Tributária / ICMS-ST), ou `5.202` (devolução interestadual).
  - Cálculo proporcional de estorno de ICMS, PIS, COFINS e FCP.
- **Formas de Compensação Financeira ao Consumidor:**
  - `STORE_CREDIT`: Emissão de Vale-Compras / Crédito de Loja vinculado ao CPF do cliente com prazo de validade (geralmente 30 a 90 dias).
  - `CASH_REFUND`: Reembolso em espécie no caixa com estorno da sessão de PDV aberta.
  - `CARD_REVERSAL`: Solicitação de cancelamento de transação TEF/Cartão.
  - `EXCHANGE`: Troca direta no balcão por outro produto, abatendo o valor devolvido.

---

## 2. Modelagem do Banco de Dados (Migration 031)

### 2.1 Tabela `customer_returns`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `store_id` (INTEGER NOT NULL REFERENCES stores(id))
- `sale_id` (INTEGER NOT NULL REFERENCES sales(id))
- `customer_id` (INTEGER REFERENCES customers(id))
- `code` (TEXT NOT NULL UNIQUE) -- ex: DEV-2026-0001
- `return_type` (TEXT NOT NULL) -- 'RETURN' | 'EXCHANGE'
- `refund_method` (TEXT NOT NULL) -- 'STORE_CREDIT' | 'CASH_REFUND' | 'CARD_REVERSAL' | 'EXCHANGE'
- `total_amount` (REAL NOT NULL)
- `reason` (TEXT NOT NULL) -- 'DEFECT' | 'ADVERSE_REACTION' | 'WRONG_ITEM' | 'CUSTOMER_DISSATISFACTION' | 'OTHER'
- `notes` (TEXT)
- `status` (TEXT NOT NULL DEFAULT 'DRAFT') -- 'DRAFT' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
- `fiscal_nfe_key` (TEXT) -- Chave de acesso da NF-e de devolução emitida
- `cfop` (TEXT NOT NULL DEFAULT '1.202')
- `created_by` (TEXT NOT NULL)
- `authorized_by_pharmacist` (TEXT) -- Nome/CRF do farmacêutico se houver medicamento
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

### 2.2 Tabela `customer_return_items`
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `return_id` (INTEGER NOT NULL REFERENCES customer_returns(id) ON DELETE CASCADE)
- `sale_item_id` (INTEGER REFERENCES sale_items(id))
- `product_id` (INTEGER NOT NULL REFERENCES products(id))
- `batch_id` (INTEGER REFERENCES batches(id))
- `quantity` (INTEGER NOT NULL)
- `unit_price` (REAL NOT NULL)
- `total_price` (REAL NOT NULL)
- `condition` (TEXT NOT NULL) -- 'INTACT' | 'DEFECTIVE' | 'EXPIRED' | 'UNSEALED'
- `destination` (TEXT NOT NULL) -- 'RETURN_TO_STOCK' | 'QUARANTINE' | 'DISPOSAL_PGRSS'
- `is_thermolabile` (INTEGER NOT NULL DEFAULT 0)
- `requires_pharmacist_auth` (INTEGER NOT NULL DEFAULT 0)
- `reason` (TEXT)
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

### 2.3 Tabela `store_credits` (Vales-Compra)
- `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
- `store_id` (INTEGER NOT NULL REFERENCES stores(id))
- `customer_id` (INTEGER NOT NULL REFERENCES customers(id))
- `return_id` (INTEGER REFERENCES customer_returns(id))
- `code` (TEXT NOT NULL UNIQUE) -- ex: CRED-ABC123XYZ
- `initial_balance` (REAL NOT NULL)
- `current_balance` (REAL NOT NULL)
- `status` (TEXT NOT NULL DEFAULT 'ACTIVE') -- 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'CANCELLED'
- `expires_at` (DATETIME NOT NULL)
- `created_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)

---

## 3. Arquitetura de Serviços & Endpoints

### 3.1 `CustomerReturnService`
- `createReturn(data)`: Valida a venda original, verifica limites de quantidade, avalia regras de termolábeis e medicamentos controlados.
- `approveReturn(id, pharmacistCredentials)`: Valida autorização de farmacêutico para itens controlados ou suspeita de desvio de qualidade, atualiza status para `APPROVED` ou `COMPLETED`.
- `executeInventoryMovement(returnId)`: Movimenta estoque:
  - `RETURN_TO_STOCK`: incrementa estoque do lote original.
  - `QUARANTINE`: cria registro na quarentena sanitária.
  - `DISPOSAL_PGRSS`: gera descarte na tabela de PGRSS.
- `generateStoreCredit(returnId)`: Emite cupom de vale-compras com validade.
- `generateFiscalReturn(returnId)`: Monta estrutura XML/Payload para NF-e de entrada/devolução referenciando a NFC-e original com CFOP `1.202` ou `1.411`.
- `getKpis(storeId)`: Retorna total devolvido no mês, quantidade de devoluções por motivo, valor em vales ativos e itens em quarentena/descarte.

### 3.2 Endpoints REST
- `POST /api/returns`: Cria solicitação de devolução/troca.
- `GET /api/returns`: Lista devoluções com filtros.
- `GET /api/returns/:id`: Detalhes da devolução e itens.
- `POST /api/returns/:id/approve`: Aprovação e execução sanitária/financeira.
- `POST /api/returns/:id/reject`: Rejeição com justificativa técnica.
- `GET /api/returns/sale/:saleId/eligible-items`: Lista itens da venda elegíveis para devolução.
- `GET /api/returns/store-credits/validate/:code`: Consulta saldo de vale-compras.
- `GET /api/returns/kpis`: Métricas do módulo.

---

## 4. Frontend & Experiência de Uso (`CustomerReturnsPage`)
- Busca de venda original por ID de cupom fiscal, código da venda ou CPF do cliente.
- Seleção de itens e quantidades a devolver, indicação do estado (Lacrado / Avariado / Aberto).
- Sinalização automática de medicamentos termolábeis e controlados (alerta de quarentena/PGRSS obrigatório).
- Seleção da forma de reembolso (Vale-Compras, Dinheiro, Estorno Cartão, Troca).
- Emissão de Comprovante Térmico de Devolução (80mm) com código de vale-compras gerado.
