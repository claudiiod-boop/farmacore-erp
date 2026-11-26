# Especificação Técnica - Fase 52: Magnos Farma Analytics (Executivo & Operacional em Tempo Real) & Módulo de Orçamento via WhatsApp

## 1. Contexto e Objetivos
A Magnos Farma opera com o sistema InovaFarma no ambiente local e utiliza a ferramenta executiva "Magnos Farma Analytics" para acompanhamento de vendas em tempo real, curva por hora, ranking de equipe de balcão e projeções de faturamento.
Com a nova atualização do InovaFarma, surge também o módulo oficial de **Orçamento via WhatsApp**, permitindo orçar receitas, calcular descontos e enviar cotações formatadas diretamente para o cliente via API/link oficial do WhatsApp com fechamento rápido.

Esta Fase 52 unifica de forma nativa e definitiva:
1. **Dashboard Executivo & Operacional em Tempo Real (Magnos Farma Analytics):**
   - Vendas do dia (Caixa Positivo Dia), Cupons emitidos, Ticket Médio diário.
   - Vendas acumuladas do mês, Projeção matemática até o final do mês baseada na média diária de dias úteis e corridos.
   - Total de desconto concedido no mês e percentual de margem/desconto médio.
   - Distribuição de vendas por hora (07h às 22h) para ajuste do quadro de operadores no balcão.
   - Ranking de Balconistas com meta individual, atingimento (%) e ticket médio por atendente.
   - Top Produtos mais vendidos (Medicamentos, Genéricos, Similares, Perfumaria e Conveniência).
2. **Módulo de Orçamento via WhatsApp:**
   - Criação de cotações com múltiplos itens, aplicação de descontos de balcão/PBM e cálculo de validade da cotação.
   - Geração de mensagem canônica formatada com quebras de linha, emojis e link direto de fechamento `https://wa.me/{phone}?text={encodedText}`.
   - Histórico de orçamentos gerados, convertidos e pendentes.

## 2. Modelo de Dados (Migration 051)
- `analytics_sales_targets`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `year_month`: TEXT NOT NULL (YYYY-MM)
  - `target_amount`: REAL NOT NULL
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `analytics_employee_targets`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `employee_id`: INTEGER NOT NULL
  - `employee_name`: TEXT NOT NULL
  - `year_month`: TEXT NOT NULL (YYYY-MM)
  - `target_amount`: REAL NOT NULL
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `whatsapp_quotations`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `store_id`: INTEGER NOT NULL (FK stores)
  - `customer_name`: TEXT NOT NULL
  - `customer_phone`: TEXT NOT NULL
  - `attendant_name`: TEXT NOT NULL
  - `subtotal_brl`: REAL NOT NULL
  - `discount_brl`: REAL NOT NULL DEFAULT 0
  - `total_brl`: REAL NOT NULL
  - `status`: TEXT NOT NULL CHECK (status IN ('OPEN', 'SENT', 'CONVERTED', 'EXPIRED', 'CANCELLED'))
  - `valid_until`: TEXT NOT NULL
  - `whatsapp_message_payload`: TEXT NOT NULL
  - `created_at`: DATETIME DEFAULT CURRENT_TIMESTAMP
- `whatsapp_quotation_items`:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `quotation_id`: INTEGER NOT NULL (FK whatsapp_quotations ON DELETE CASCADE)
  - `product_id`: INTEGER NOT NULL
  - `product_name`: TEXT NOT NULL
  - `quantity`: REAL NOT NULL
  - `unit_price_brl`: REAL NOT NULL
  - `total_price_brl`: REAL NOT NULL
