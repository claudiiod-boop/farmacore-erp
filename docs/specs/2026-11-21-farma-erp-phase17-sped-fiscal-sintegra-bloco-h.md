# Especificação Técnica - Fase 17: SPED Fiscal EFD ICMS/IPI, Sintegra & Bloco H Farmacêutico

## 1. Visão Geral do Domínio
O **SPED Fiscal (Escrituração Fiscal Digital - EFD ICMS/IPI)** e o **Sintegra** são as obrigações acessórias fiscais primordiais exigidas pelas Secretarias de Fazenda Estaduais (SEFAZ) e pela Receita Federal do Brasil para farmácias e drogarias comerciais.
No varejo farmacêutico brasileiro, a maioria dos medicamentos é tributada sob o regime de **Substituição Tributária (ICMS-ST)** ou **Monofásico de PIS/COFINS**, exigindo rigor no tratamento de CSTs (CST ICMS 060, CSOSN 500, CST PIS/COFINS 04), CFOPs de entrada (1102, 1403) e saída (5102, 5405), e na apuração do **Bloco H (Inventário Contábil Periódico/Anual)** valorado a custo médio ponderado.

## 2. Estrutura de Arquivos e Registros Oficiais
### 2.1 EFD ICMS/IPI (Layout em Linhas Delimitadas por Pipes `|`)
1. **Bloco 0 (Abertura, Identificação e Referências):**
   - `|0000|`: Abertura, identificação da drogaria (CNPJ, IE, Razão Social, UF, Código Município, Período, Perfil A/B).
   - `|0001|`: Indicador de movimento do bloco.
   - `|0005|`: Dados complementares (Nome fantasia, CEP, endereço, telefone, e-mail).
   - `|0100|`: Dados do contabilista responsável (Nome, CPF, CRC, CNPJ escritório, contato).
   - `|0150|`: Cadastro de participantes (fornecedores de NF-e e clientes identificados).
   - `|0190|`: Unidades de medida.
   - `|0200|`: Cadastro de produtos/itens (Código interno, descrição, EAN, NCM, CEST, tipo de item `00 = Mercadoria para Revenda`).
   - `|0990|`: Totalizador de linhas do Bloco 0.
2. **Bloco C (Documentos Fiscais - Mercadorias):**
   - `|C001|`: Abertura do bloco.
   - `|C100|`: Documento Fiscal (NF-e modelo 55 de compras e transferências; NFC-e modelo 65 de vendas no PDV).
   - `|C170|`: Itens do Documento Fiscal (itens das notas de entrada com NCM, CFOP, CST, valores e alíquotas).
   - `|C190|`: Registro analítico por CST, CFOP e alíquota de ICMS.
   - `|C990|`: Totalizador de linhas do Bloco C.
3. **Bloco E (Apuração do ICMS Próprio e ICMS-ST):**
   - `|E001|`: Abertura do bloco.
   - `|E100|`: Período de apuração.
   - `|E110|`: Totalizador da apuração do ICMS Próprio (Débitos vs Créditos).
   - `|E200|`: Apuração por UF da Substituição Tributária (ICMS-ST).
   - `|E210|`: Valores de ICMS-ST retido.
   - `|E990|`: Totalizador de linhas do Bloco E.
4. **Bloco H (Inventário Físico & Contábil):**
   - `|H001|`: Abertura do bloco (gerado com movimento quando solicitado).
   - `|H005|`: Totalização do inventário (data do inventário, valor total do estoque, motivo `01 = No encerramento do período`).
   - `|H010|`: Detalhamento de cada item estocado (código, unidade, quantidade física acumulada de lotes, valor unitário a custo médio, valor total, código de posse `0 = Posse do informante em seu poder`, conta contábil).
   - `|H990|`: Totalizador de linhas do Bloco H.
5. **Bloco 1 & Bloco 9 (Controle e Totalização):**
   - `|1001|`, `|1010|`, `|1990|`: Outras informações fiscais.
   - `|9001|`: Abertura do Bloco 9.
   - `|9900|`: Registros analíticos com contagem exata de cada registro gerado (`0000`, `C100`, etc.).
   - `|9990|`: Totalizador de linhas do Bloco 9.
   - `|9999|`: Total geral de linhas do arquivo SPED.

### 2.2 Sintegra (Convênio ICMS 57/95)
- Arquivo texto posicional de 126 colunas:
  - Registro 10: Mestre do estabelecimento.
  - Registro 11: Dados complementares de endereço.
  - Registro 50: Notas fiscais de compra e venda modelo 55.
  - Registro 54: Itens das notas fiscais.
  - Registro 60M/60A/60R: Resumo diário de operações ao consumidor (NFC-e / ECF).
  - Registro 74: Inventário de estoque.
  - Registro 90: Totalizadores de registros.

### 2.3 Motor de Pré-Validação e Auditoria PVA
- Verificação de consistências antes do envio para o PVA:
  - Validação de formato de NCM (8 dígitos numéricos).
  - Consistência de CFOP x CST (Ex: CFOP 5405 / CST 060 para ST).
  - Integridade de itens de estoque no Bloco H (custo unitário > 0, quantidade >= 0).
  - Cruzamento de totalizadores com somatórios dos registros analíticos C190.

## 3. Arquitetura de Dados & Persistência (Migration 016)
- Tabela `sped_generations`: Armazenamento de metadados, parâmetros e conteúdo gerado (.txt).
- Tabela `accounting_parameters`: Parâmetros fiscais e do contabilista (CRC, CPF, CNPJ escritório).
- Tabela `sped_audit_divergences`: Histórico de divergências apontadas na pré-validação.
