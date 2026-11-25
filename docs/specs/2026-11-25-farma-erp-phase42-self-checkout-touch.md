# Especificação Técnica — Fase 42: Totem de Autoatendimento Avançado & Pagamento Autônomo com TEF/PIX Touch (Self-Checkout Farmacêutico)

## 1. Contexto e Objetivos
A experiência de compra em farmácias para produtos de conveniência, dermocosméticos, higiene e medicamentos isentos de prescrição (MIPs/OTCs) pode ser realizada de forma 100% autônoma pelo próprio cliente no **Totem Self-Checkout**.

Objetivos:
1. **Autoatendimento Touchscreen:** Fluxo ágil para terminais touch (15" a 21") com leitor de código de barras em modo contínuo.
2. **Bloqueio Regulatório Inteligente (RDC 44/2009 & Portaria 344/98):**
   - Produtos de venda livre (MIPs, cosméticos, correlatos) são processados normalmente.
   - Medicamentos tarjados (Tarja Vermelha ou Preta) ou sob controle especial são bloqueados para autoatendimento: o totem emite alerta orientando o cliente e gera automaticamente uma senha prioritária para o balcão farmacêutico.
3. **Pagamento Autônomo Direto na Tela:**
   - **PIX Dinâmico:** Geração de QR Code em tela com conciliação automática.
   - **Cartão (TEF):** Integração com PinPad autônomo (Débito e Crédito).
4. **Emissão Fiscal e Baixa de Estoque:**
   - Conclusão direta da venda com registro de `sale`, baixa atômica de lotes FEFO e autorização de NFC-e.

---

## 2. Modelagem do Banco de Dados (Migration 041)
- `self_checkout_sessions`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `kiosk_id`: INTEGER NOT NULL REFERENCES `kiosk_terminals(id)`
  - `store_id`: INTEGER NOT NULL REFERENCES `stores(id)`
  - `session_code`: TEXT NOT NULL UNIQUE (ex: `SC-YYYYMMDD-XXXX`)
  - `status`: TEXT NOT NULL CHECK(status IN ('OPEN', 'PAYING', 'PAID', 'BLOCKED_REQUIRES_PHARMACIST', 'CANCELLED', 'TIMEOUT'))
  - `customer_cpf`: TEXT
  - `customer_name`: TEXT
  - `subtotal`: REAL DEFAULT 0.0
  - `discount_amount`: REAL DEFAULT 0.0
  - `total_amount`: REAL DEFAULT 0.0
  - `payment_method`: TEXT (PIX, CARTAO_CREDITO, CARTAO_DEBITO)
  - `sale_id`: INTEGER REFERENCES `sales(id)`
  - `nfce_key`: TEXT
  - `blocked_reason`: TEXT
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
  - `completed_at`: DATETIME

- `self_checkout_items`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `session_id`: INTEGER NOT NULL REFERENCES `self_checkout_sessions(id)` ON DELETE CASCADE
  - `product_id`: INTEGER NOT NULL REFERENCES `products(id)`
  - `quantity`: REAL NOT NULL CHECK(quantity > 0)
  - `unit_price`: REAL NOT NULL CHECK(unit_price >= 0)
  - `total_price`: REAL NOT NULL CHECK(total_price >= 0)
  - `batch_id`: INTEGER REFERENCES `batches(id)`
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
