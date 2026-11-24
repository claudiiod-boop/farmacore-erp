# Especificação Técnica — Fase 35: Setorização Física & Ronda Térmica Multissetorial (RDC 44/2009 e RDC 430/2020 ANVISA)

## 1. Visão Geral
Expandir o sistema de monitoramento térmico e higrométrico para cobrir todos os setores físicos obrigatórios de uma farmácia/drogaria:
- **Hall de Medicamentos / Dispensário / Balcão** (`MEDICATION_HALL` ou `SALES_FLOOR`): +15°C a +30°C / UR ≤ 70%
- **Estoque & Depósito Central** (`STORAGE_ROOM`): +15°C a +30°C / UR ≤ 70%
- **Geladeira de Termolábeis / Vacinas** (`REFRIGERATOR_COLD_CHAIN`): +2°C a +8°C
- **Sala de Serviços / Injetáveis / Consultório** (`CLINICAL_ROOM`): +15°C a +30°C
- **Doca de Recebimento & Quarentena** (`QUARANTINE_AREA`): +15°C a +30°C

Implementar o módulo de **Ronda Térmica Diária (Checklist Rápido em Lote)**:
- Permite ao atendente ou farmacêutico lançar a aferição matutina/vespertina de todos os setores da loja com 1 clique.
- Validação atômica e abertura automática de incidentes de excursão caso qualquer setor esteja fora dos parâmetros regulamentares.
- Visualização e auditoria por setor físico para relatórios oficiais da Vigilância Sanitária (VISA).

## 2. Requisitos Técnicos
1. **Migration 034 (`034_temperature_sector_expansion.sql`):**
   - Atualizar a tabela de sensores e adicionar metadados de setorização física (`sector_code`, `floor_location`).
   - Adicionar tabela `temperature_rounds` para auditoria do checklist da ronda (turno matutino/vespertino, executor, status geral).
2. **Domain Service (`TemperatureMonitoringService`):**
   - Método `recordSectorRound(input)`: Grava leituras em lote para múltiplos setores de forma transacional.
   - Método `listSectors(storeId)`: Retorna setores cadastrados com status térmico em tempo real.
   - Método `seedDefaultStoreSectors(storeId)`: Inicializa os 5 setores padrão para novas lojas.
3. **Fastify REST Routes:**
   - `POST /api/temperature/rounds`: Registro da ronda térmica diária multissetorial.
   - `GET /api/temperature/rounds`: Histórico de rondas realizadas com status de conformidade.
   - `GET /api/temperature/sectors`: Listagem consolidada por setor físico da farmácia.
4. **Frontend React:**
   - Nova aba dedicada: **"Ronda Diária por Setor (Checklist Rápido)"** na `TemperatureMonitoringPage`.
   - Grid interativo com cards de cada setor (Hall de Medicamentos, Estoque, Geladeira, etc.).
   - Inputs rápidos de temperatura e umidade com validação visual imediata (verde/vermelho).
   - Botão "Salvar Ronda Sanitária Completa (Manhã / Tarde)".
