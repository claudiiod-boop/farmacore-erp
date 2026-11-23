# Especificação Funcional — Fase 20: Tabela Oficial CMED / ANVISA & Gestão de Precificação Farmacêutica

## 1. Visão Geral
No Brasil, o comércio varejista de medicamentos é estritamente regulamentado pela **Câmara de Regulação do Mercado de Medicamentos (CMED)**, vinculada à ANVISA, nos termos da **Lei Federal nº 10.742/2003**.

A legislação impõe:
1. **Preço Fábrica (PF):** Teto de preço pelo qual o laboratório farmacêutico ou distribuidora pode vender à farmácia.
2. **Preço Máximo ao Consumidor (PMC):** Teto de preço pelo qual o medicamento pode ser vendido ao público consumidor final. É **crime contra as relações de consumo** e infração sanitária grave praticar qualquer preço de venda superior ao PMC oficial registrado na CMED para a alíquota de ICMS do respectivo estado (artigo 19 da Lei 10.742/2003 c/c Código de Defesa do Consumidor).
3. **Classificação Tributária de PIS/COFINS:**
   - **Lista Positiva:** Medicamentos com crédito presumido e isenção de PIS/COFINS (Decreto 3.803/2001).
   - **Lista Negativa:** Medicamentos com tributação monofásica concentrada na indústria, ensejando alíquota ZERO nas vendas pelo varejo farmacêutico (Lei 10.147/2000).
   - **Lista Neutra:** Produtos tributados pela regra geral.

A Fase 20 implementa a ingestão da base oficial da CMED, a auditoria sanitária permanente do catálogo de produtos da farmácia, a trava inviolável de preço no PDV e balcão, e o motor de precificação dinâmica com garantia de margem comercial.

---

## 2. Modelagem de Dados (Schema 019)
- `cmed_table_versions`: Controle de versões da tabela oficial divulgada mensalmente pela ANVISA.
- `cmed_products`: Catálogo oficial da CMED contendo EAN, Registro MS, Princípio Ativo, Laboratório, Classe Terapêutica, Tipo (Genérico, Similar, Novo, etc.), Lista PIS/COFINS e PF/PMC para alíquotas de ICMS (12%, 17%, 17.5%, 18%, 19%, 20%, 20.5%, 21%, 22%).
- `cmed_pricing_rules`: Regras comerciais por categoria (desconto médio sobre PMC, markup sobre PF, margem mínima).
- `cmed_price_audit_logs`: Histórico de auditoria de alterações de preços e detecções de infrações sanitárias.
