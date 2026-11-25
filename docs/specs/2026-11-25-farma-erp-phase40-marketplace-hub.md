# Especificação Técnica — Fase 40: Hub de Marketplaces & Delivery Externo (iFood Farmácias, Rappi, Farmácias APP & Consulta Remédios)

## 1. Contexto e Objetivos
A expansão digital das farmácias exige integração robusta com os maiores marketplaces e aplicativos de entrega do Brasil:
- **iFood Farmácias**
- **Rappi**
- **Farmácias APP**
- **Consulta Remédios**
- **Mercado Livre (Saúde & Beleza)**

O objetivo é fornecer um **Hub Omnichannel Centralizado** capaz de:
1. Manter estoque sincronizado em tempo real entre a loja física e os marketplaces, com buffer de segurança anti-ruptura (*safety stock*).
2. Gerenciar De-Para de produtos por EAN e SKU externo com margens de precificação customizadas para cobrir comissões de cada plataforma.
3. Ingerir pedidos externos automaticamente via Webhooks oficiais ou simulados.
4. Conduzir o ciclo de vida do pedido: confirmação, separação (*picking*), conferência de lote (*packing*), faturamento/despacho e entrega.
5. Sincronizar atualizações de status de volta para a API do marketplace.

---

## 2. Modelagem do Banco de Dados (Migration 039)
- `marketplace_channels`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL REFERENCES `stores(id)`
  - `channel_name`: TEXT NOT NULL (ex: 'IFOOD', 'RAPPI', 'FARMACIAS_APP', 'CONSULTA_REMEDIOS', 'MERCADO_LIVRE')
  - `api_key`: TEXT
  - `api_secret`: TEXT
  - `webhook_secret`: TEXT
  - `merchant_id`: TEXT
  - `commission_rate`: REAL DEFAULT 0.0 (taxa percentual da plataforma)
  - `stock_buffer_percent`: REAL DEFAULT 10.0 (reserva técnica para evitar furo de estoque)
  - `is_active`: INTEGER DEFAULT 1
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
  - `updated_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `marketplace_catalog_mappings`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `channel_id`: INTEGER NOT NULL REFERENCES `marketplace_channels(id)`
  - `product_id`: INTEGER NOT NULL REFERENCES `products(id)`
  - `external_sku`: TEXT NOT NULL
  - `markup_percent`: REAL DEFAULT 0.0 (acréscimo sobre PMC ou preço de gôndola)
  - `custom_price`: REAL
  - `is_synced`: INTEGER DEFAULT 1
  - `last_stock_synced`: INTEGER DEFAULT 0
  - `last_sync_at`: DATETIME
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `marketplace_orders`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL REFERENCES `stores(id)`
  - `channel_id`: INTEGER NOT NULL REFERENCES `marketplace_channels(id)`
  - `external_order_id`: TEXT NOT NULL
  - `display_order_id`: TEXT
  - `customer_name`: TEXT NOT NULL
  - `customer_document`: TEXT
  - `customer_phone`: TEXT
  - `delivery_address`: TEXT NOT NULL
  - `status`: TEXT NOT NULL (PENDING_CONFIRMATION, CONFIRMED, PREPARING, READY_FOR_PICKUP, DISPATCHED, DELIVERED, CANCELLED)
  - `subtotal`: REAL NOT NULL
  - `delivery_fee`: REAL DEFAULT 0.0
  - `platform_fee`: REAL DEFAULT 0.0
  - `total_amount`: REAL NOT NULL
  - `placed_at`: DATETIME NOT NULL
  - `confirmed_at`: DATETIME
  - `dispatched_at`: DATETIME
  - `delivered_at`: DATETIME
  - `cancellation_reason`: TEXT
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP

- `marketplace_order_items`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `order_id`: INTEGER NOT NULL REFERENCES `marketplace_orders(id)`
  - `product_id`: INTEGER NOT NULL REFERENCES `products(id)`
  - `external_sku`: TEXT
  - `product_name`: TEXT NOT NULL
  - `quantity`: REAL NOT NULL
  - `unit_price`: REAL NOT NULL
  - `total_price`: REAL NOT NULL
  - `batch_number`: TEXT

---

## 3. Serviços e Regras de Negócio
- `MarketplaceHubService`:
  - `registerChannel`: cadastra ou atualiza canal para uma loja.
  - `listChannels`: lista canais configurados.
  - `mapCatalogProduct`: vincula produto ao canal com regra de markup e preço final.
  - `syncCatalogStock`: calcula estoque disponível considerando lotes válidos e buffer de segurança.
  - `ingestWebhookOrder`: ingere novo pedido vindo do canal externo, validando duplicidade por `external_order_id`.
  - `updateOrderStatus`: executa transições na máquina de estados do pedido com reserva e baixa de estoque.
  - `getChannelKpis`: calcula indicadores de faturamento, pedidos pendentes e tempo médio por canal.
