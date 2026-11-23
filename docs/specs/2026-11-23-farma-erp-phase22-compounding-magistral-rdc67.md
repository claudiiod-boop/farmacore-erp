# Especificação Técnica — Fase 22
# FarmaCore ERP: Módulo de Farmácia Magistral & Manipulação Farmacêutica (RDC 67/2007 ANVISA)

## 1. Visão Geral e Contexto
A farmácia de manipulação opera sob rigorosas Boas Práticas de Manipulação Farmacêutica (BPMF) estabelecidas pela **RDC 67/2007 da ANVISA**. A **Fase 22** introduz o módulo **FarmaCore Magistral**, permitindo a gestão técnica completa de fórmulas individualizadas, controle analítico de matérias-primas com quarentena, dimensionamento volumétrico de cápsulas, cálculos estequiométricos de Fator de Equivalência (FEq) e Fator de Correção (FC por teor e umidade), ordem de manipulação com ficha de pesagem e geração do rótulo legal magistral.

## 2. Requisitos Técnicos e Regulatórios (RDC 67/2007 ANVISA)
1. **Quarentena e Laudo de Matéria-Prima:**
   - Toda matéria-prima recebida entra obrigatoriamente com status `QUARANTINE`.
   - Só pode ser utilizada na manipulação se for aprovada no controle de qualidade (`APPROVED`), com laudo anexado, teor (%) e umidade (%) aferidos.
2. **Cálculos Farmacotécnicos:**
   - **Fator de Correção por Pureza/Teor e Umidade (FC):**
     $$FC = \frac{100}{\text{Teor \%}} \times \frac{100}{100 - \text{Umidade \%}}$$
   - **Fator de Equivalência (FEq):**
     $$FEq = \frac{\text{Peso Molecular do Sal ou Forma Hidratada}}{\text{Peso Molecular da Base Ativa}}$$
   - **Quantidade Corrigida a Pesar:**
     $$\text{Qtd Real} = \text{Qtd Prescrita} \times FC \times FEq$$
3. **Dimensionamento de Cápsulas (Cubagem):**
   - Capacidade volumétrica nominal por tamanho de cápsula (mL):
     - Nº 4: 0,21 mL
     - Nº 3: 0,30 mL
     - Nº 2: 0,37 mL
     - Nº 1: 0,50 mL
     - Nº 0: 0,68 mL
     - Nº 00: 0,95 mL
   - O sistema calcula o volume ocupado pelo pó compactado (massa / densidade aparente) e escolhe o menor invólucro viável, calculando a quantidade de excipiente (amido, celulose, etc.) q.s.p. para completar a cápsula.
4. **Ficha de Pesagem & Rastreabilidade:**
   - A ordem de manipulação (OM) lista lote, teor e fabricante de cada matéria-prima usada, registrando peso teórico e peso pesado na balança analítica.
5. **Rótulo Magistral Oficial:**
   - Dados obrigatórios: nome do paciente, prescritor e registro (CRM/CRO), número da ordem de manipulação, data de manipulação, prazo de validade, fórmula completa com dosagens, quantidade, forma farmacêutica, posologia e alertas regulatórios (ex: "Uso interno", "Guardar em local fresco", "Venda sob prescrição").

## 3. Arquitetura de Componentes
1. **CompoundingCalculationService:**
   - Cálculo atômico de FC, FEq, cubagem e excipiente q.s.p.
2. **CompoundingService:**
   - Cadastro de matérias-primas, lotes e liberação de quarentena.
   - Orçamento e criação de ordem de manipulação.
   - Registro de pesagem e conferência de peso médio.
   - Geração do texto do rótulo magistral formatado para impressora térmica/etiqueta.
3. **CompoundingPage (React):**
   - Orçamento e calculadora de cápsulas.
   - Ficha de pesagem com status de conferência.
   - Quarentena e laudos de matérias-primas.
   - Visualização e impressão do rótulo magistral.
