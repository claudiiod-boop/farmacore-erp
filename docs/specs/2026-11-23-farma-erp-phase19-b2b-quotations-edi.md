# Especificação Funcional — Fase 19: Central de Cotação B2B, Reposição Inteligente & EDI Farma

## 1. Visão Geral
No varejo farmacêutico brasileiro de alta performance (padrão InovaFarma, Linx Farma Big e Trier), a rentabilidade da farmácia depende criticamente da capacidade de repor medicamentos no momento exato (evitando rupturas e excessos de estoque) e de comprar das distribuidoras farmacêuticas (ex: Santa Cruz, Panpharma, Profarma, Drogacenter, GAM) com o menor custo líquido por item, aproveitando descontos comerciais, prazos de pagamento e layouts de cotação eletrônica (EDI Farma).

A Fase 19 implementa:
1. **Motor de Sugestão de Reposição Automática:**
   - Cálculo do Consumo Médio Diário (CMD) ponderado nos últimos 30/60/90 dias.
   - Ponto de Pedido: $PP = (CMD \times LeadTime) + EstoqueSeguranca$.
   - Identificação de estoque em risco de ruptura e sugestão de compras por lote econômico.
2. **Campanhas de Cotação B2B Eletrônica:**
   - Criação de campanhas de cotação agrupando demandas por loja ou rede.
   - Suporte a produtos de referência, genéricos e similares com busca por princípio ativo.
3. **Motor EDI Farma (Intercâmbio Eletrônico de Dados):**
   - Exportação de espelho de cotação no formato padronizado EDI / CSV para envio às distribuidoras.
   - Importação e conciliação das propostas de retorno enviadas pelas distribuidoras (preços unitários, descontos comerciais, quantidades disponíveis e flags de Substituição Tributária de ICMS).
4. **Otimizador Comparador de Propostas:**
   - Modo **Item a Item (Split Order / Pedido Fracionado):** seleciona a distribuidora mais barata para cada produto cotado.
   - Modo **Pedido Fechado (Melhor Distribuidora Global):** avalia a distribuidora com melhor pontuação global, respeitando pedido mínimo de faturamento e frete grátis.
   - Transformação automática das propostas vencedoras em Pedidos de Compra oficiais.
5. **Interface Operacional React:**
   - Painel integrado no FarmaCore ERP com visualização de sugestões, simulador de cotação e comparativo de preços.

---

## 2. Tabelas e Schema 018
- `b2b_suppliers`: Distribuidoras cadastradas com código EDI, pedido mínimo em R$, prazo padrão e e-mail.
- `b2b_replenishment_rules`: Parâmetros de reposição por produto/loja (lead time, estoque mínimo, estoque de segurança).
- `b2b_quotation_campaigns`: Campanhas de cotação (`DRAFT`, `OPEN`, `AWAITING_RESPONSES`, `ANALYZED`, `CLOSED`).
- `b2b_quotation_items`: Itens da campanha com quantidades sugeridas e solicitadas.
- `b2b_quotation_proposals`: Propostas enviadas pelas distribuidoras.
- `b2b_quotation_proposal_items`: Itens cotados com preços, descontos, disponibilidade e marcação de vencedor.
- `b2b_edi_logs`: Histórico de trocas de arquivos EDI.

---

## 3. Critérios Sanitários e Fiscais
- Respeito irrestrito ao Preço Fábrica (PF) e Preço Máximo ao Consumidor (PMC) da CMED/ANVISA.
- Verificação de produtos controlados pela Portaria 344/98 com emissão de alerta para documentação específica na entrega da distribuidora.
