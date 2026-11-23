# Especificação Técnica - Fase 18: Consultório Farmacêutico & Serviços Clínicos Avançados (RDC 777/2023 & RDC 44/2009)

## 1. Visão Geral do Domínio
A prestação de serviços farmacêuticos clínicos em drogarias e farmácias comunitárias no Brasil é estritamente regulamentada pela **RDC ANVISA nº 777/2023** (que revogou a RDC 302/2005 e modernizou os Testes de Análises Clínicas - EAC no ambiente farmacêutico), pela **RDC ANVISA nº 44/2009** (Boas Práticas Farmacêuticas) e pelas **Resoluções CFF nº 585/2013 e 586/2013** (Atribuições clínicas e prescrição farmacêutica).

O módulo de **Consultório Farmacêutico** privativo possibilita:
1. Realização de **Exames de Análises Clínicas (EAC / TLR - Testes Laboratoriais Rápidos)** em amostras biológicas primárias (sangue capilar, swab nasal, saliva) com rastreabilidade de lote de reagente, leitor e controle de qualidade.
2. Execução de **Procedimentos Farmacêuticos** (administração de medicamentos injetáveis com checagem de prescrição médica, inalação/nebulização, aferição de pressão arterial e temperatura).
3. Emissão da **Declaração de Serviço Farmacêutico (DSF)** oficial em 2 vias, com identificação do paciente, parâmetros medidos, orientações farmacoterapêuticas e assinatura do farmacêutico com CRF.
4. **Farmacovigilância**: Notificação obrigatória de Reações Adversas a Medicamentos (RAM) e Queixas Técnicas (desvios de qualidade) para subsidiar o sistema Notivisa da ANVISA.

## 2. Requisitos Regulatórios & Funcionais
### 2.1 Cadastro de Farmacêuticos Clínicos
- Nome completo, CPF, número do CRF, UF do CRF e assinatura/carimbo profissional.

### 2.2 Catálogo de Serviços Farmacêuticos
- Serviços classificados por categoria:
  - `TLR`: Glicemia Capilar, Hemoglobina Glicada (HbA1c), Perfil Lipídico (Colesterol Total / Frações), Covid-19 (Antígeno / Anticorpos), Dengue NS1/IgG/IgM, Beta-hCG (Gravidez).
  - `PROCEDURE`: Aplicação de Injetáveis (Intramuscular / Subcutânea), Inalação, Aferição de Pressão Arterial, Medição de Temperatura.
  - `ASSESSMENT`: Acompanhamento Farmacoterapêutico, Revisão da Farmacoterapia, Orientação de Cessação Tabágica.
  - `PRESCRIPTION`: Prescrição de Medicamentos Isentos de Prescrição (MIPs) e fitoterápicos.

### 2.3 Atendimento Clínico & Anamnese
- Identificação do paciente (Nome, CPF, Data de Nascimento, Gênero, Telefone, Endereço).
- Anamnese: queixa principal, alergias declaradas, medicamentos de uso contínuo, patologias prévias.
- Sinais vitais: Pressão arterial (Sístole/Diástole), Frequência cardíaca (BPM), Temperatura (°C), Saturação de O2 (% SpO2).

### 2.4 Registro de Testes Rápidos TLR (RDC 777/2023)
- Tipo de teste, Nome comercial do teste/reagente, Registro MS/ANVISA do reagente, Número de lote do cassete/tira, Data de validade do reagente.
- Resultado quantitativo (ex: Glicemia 112 mg/dL) ou qualitativo (Reagente / Não Reagente).
- Faixa de referência etária e interpretação clínica preliminar (com alerta explícito de que o TLR tem finalidade de triagem e não substitui diagnóstico médico).

### 2.5 Registro de Procedimentos e Injetáveis
- Aplicação de Injetáveis: Medicamento administrado, lote do medicamento, data de validade, via e local anatômico de aplicação (Deltoide D/E, Glúteo D/E, Vasto Lateral), material descartável utilizado (seringa/agulha com registro MS), dados da receita médica (Prescritor, CRM, data da receita).

### 2.6 Emissão da DSF (Declaração de Serviço Farmacêutico)
- Numeração sequencial anual única da DSF.
- Impressão térmica 80mm ESC/POS ou documento A4 em 2 vias:
  - 1ª Via: Paciente.
  - 2ª Via: Arquivo do estabelecimento farmacêutico (guarda sanitária mínima de 5 anos).
- Dados do estabelecimento, dados do farmacêutico (CRF), dados do paciente, procedimento realizado, parâmetros aferidos e assinatura.

### 2.7 Módulo de Farmacovigilância
- Notificação de suspeita de reação adversa grave ou inesperada (RAM).
- Medicamento suspeito, fabricante, lote, descrição clínica do evento e protocolo gerado.
