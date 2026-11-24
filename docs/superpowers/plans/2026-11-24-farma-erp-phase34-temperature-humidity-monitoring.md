# Plano de Implementação - Fase 34: Termômetro & Higrômetro Digital — Monitoramento Contínuo de Temperatura e Umidade (RDC 44/2009 e RDC 430/2020 ANVISA)

## Meta
Implementar o módulo industrial de Monitoramento de Temperatura e Umidade com suporte a sensores calibrados (RBC/Inmetro), Cadeia de Frio (+2°C a +8°C para termolábeis), Salão de Vendas (+15°C a +30°C / ≤70% UR), detecção automática de Excursões Térmicas e integração com Quarentena Sanitária.

---

## Estrutura de Tarefas

### Tarefa 1: Migration 033 & Definições de Tipos TypeScript
- Arquivos:
  - `src/database/migrations/033_temperature_humidity_monitoring.sql`
  - `src/modules/temperature/temperature.types.ts`
- Testes:
  - `tests/modules/temperature/temperature.schema.test.ts`
- Critério de Aceite:
  - Criação das tabelas `temperature_sensors`, `temperature_readings` e `temperature_excursions` com foreign keys e constraints.
  - Teste em memória verificando inserções e integridade.

### Tarefa 2: Core Domain Service (`TemperatureMonitoringService`)
- Arquivo:
  - `src/modules/temperature/temperature.service.ts`
- Testes:
  - `tests/modules/temperature/temperature.service.test.ts`
- Critério de Aceite:
  - Cadastro de sensores com limites regulatórios e certificado de calibração.
  - Gravação de leituras diárias (manhã/tarde).
  - Detecção automática de excursão térmica (geladeira fora de +2..+8°C ou salão fora de limites).
  - Abertura de incidente em `temperature_excursions`.
  - Resolução de excursão com laudo e CRF do Farmacêutico RT.
  - 100% de cobertura nos testes unitários do serviço.

### Tarefa 3: Endpoints Fastify & Rotas REST
- Arquivos:
  - `src/modules/temperature/temperature.routes.ts`
  - `src/api/routes.ts` (registro)
- Testes:
  - `tests/api/routes.temperature.test.ts`
- Critério de Aceite:
  - Endpoints REST para sensores, leituras diárias, histórico para relatório VISA, incidentes de excursão e KPIs.
  - Testes de integração Fastify simulando requisições HTTP e payloads.

### Tarefa 4: Frontend React (`TemperatureMonitoringPage`), Topbar & Testes
- Arquivos:
  - `frontend/src/types/temperature.ts` e exportação em `frontend/src/types/index.ts`
  - `frontend/src/services/api.ts` (funções `temperatureApi`)
  - `frontend/src/hooks/useStationMode.ts` (suporte ao modo `TEMPERATURE_MONITORING`)
  - `frontend/src/pages/TemperatureMonitoringPage.tsx`
  - `frontend/src/App.tsx` (botão na barra superior e renderização)
- Testes:
  - `frontend/tests/pages/TemperatureMonitoringPage.test.tsx`
- Critério de Aceite:
  - Interface visual com cards de sensores, indicação de faixa segura (+2..+8°C e +15..+25°C), registro rápido de medição e alerta de excursão.
  - Testes unitários com Vitest / Testing Library passando 100%.

### Tarefa 5: Auditoria, Build & Verificação Completa
- Verificação:
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run build:web`
  - `npm.cmd test` (todas as fases 1 a 34 passando)
  - Commit e `git push origin master`.
