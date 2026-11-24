# Plano de Implementação — Fase 35: Setorização Física & Ronda Térmica Multissetorial

## Task 1: Migration 034 & Expansão de Tipos
- Criar `src/database/migrations/034_temperature_sector_expansion.sql`:
  - Adicionar colunas `sector_code` e `floor_location` em `temperature_sensors` se não existirem.
  - Criar tabela `temperature_rounds` (`id`, `store_id`, `shift` TEXT ['MORNING', 'AFTERNOON', 'NIGHT'], `conducted_by` TEXT, `notes` TEXT, `excursions_count` INTEGER, `recorded_at` TIMESTAMP).
  - Adicionar `round_id` em `temperature_readings`.
- Atualizar `src/modules/temperature/temperature.types.ts`:
  - Expandir `SensorLocationType` com `'MEDICATION_HALL' | 'STORAGE_ROOM' | 'CLINICAL_ROOM' | 'QUARANTINE_AREA'`.
  - Adicionar tipos `SectorRoundInput`, `SectorReadingItem`, `TemperatureRound`.
- Testes unitários de schema em `tests/modules/temperature/temperature.schema.test.ts`.

## Task 2: Domain Service Expansion
- Atualizar `src/modules/temperature/temperature.service.ts`:
  - `seedDefaultStoreSectors(storeId)`: cria automaticamente sensores padrão para os setores físicos da loja caso não existam.
  - `recordSectorRound(input)`: transação atômica que cria a ronda e as leituras de todos os setores enviados.
  - `listRounds(storeId)`: histórico de rondas com auditoria de conformidade.
- Criar/atualizar testes unitários em `tests/modules/temperature/temperature.service.test.ts`.

## Task 3: Fastify REST Routes
- Atualizar `src/modules/temperature/temperature.routes.ts`:
  - `POST /api/temperature/rounds`: registrar ronda em lote multissetorial.
  - `GET /api/temperature/rounds`: listar histórico de rondas.
  - `POST /api/temperature/seed-sectors`: semear setores padrão.
- Atualizar testes de rotas em `tests/api/routes.temperature.test.ts`.

## Task 4: Frontend UI (Ronda Diária por Setores na `TemperatureMonitoringPage`)
- Atualizar `frontend/src/types/temperature.ts`.
- Adicionar métodos de ronda em `frontend/src/services/api.ts` (`recordSectorRound`, `listRounds`, `seedSectors`).
- Atualizar `frontend/src/pages/TemperatureMonitoringPage.tsx` com aba "Ronda Diária por Setor (Checklist Rápido)".
- Atualizar testes em `frontend/tests/pages/TemperatureMonitoringPage.test.tsx`.

## Task 5: Homologação Completa & Push
- `npx.cmd tsc --noEmit`
- `npm.cmd run build:web`
- `npm.cmd test` (217+ arquivos, 1.650+ testes)
- `git push origin master`
