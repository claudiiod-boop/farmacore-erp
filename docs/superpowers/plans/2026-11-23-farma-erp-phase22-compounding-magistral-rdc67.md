# Plano de Implementação — Fase 22
# Farmácia Magistral & Manipulação Farmacêutica (RDC 67/2007 ANVISA)

## Tarefas Estruturadas (TDD)

### Task 1: Banco de Dados — Migration 021 & Tipos de Domínio
- Criar `src/database/migrations/021_compounding_magistral_rdc67.sql`.
- Tabelas:
  - `raw_materials` (id, dcb, cas_number, name, apparent_density, default_unit, cost_per_unit, is_active).
  - `raw_material_batches` (id, raw_material_id, batch_number, supplier, manufacturer, potency_percent, moisture_percent, molecular_weight_salt, molecular_weight_base, report_number, expiration_date, status: `QUARANTINE`, `APPROVED`, `REJECTED`, rejection_reason).
  - `compounding_orders` (id, store_id, order_number, patient_name, patient_document, prescriber_name, prescriber_crm, prescriber_uf, pharmaceutical_form, total_units, capsule_size, target_weight_per_unit, actual_average_weight, status: `QUOTATION`, `AWAITING_WEIGHING`, `IN_MANIPULATION`, `QUALITY_CONTROL`, `READY`, `DELIVERED`, subtotal, packaging_cost, pharmaceutical_fee, total_amount, directions, warnings).
  - `compounding_order_items` (id, order_id, raw_material_id, batch_id, prescribed_dose, unit, factor_correction, factor_equivalence, corrected_dose_per_unit, total_dose_to_weigh, weighed_amount, status: `PENDING`, `WEIGHED`).
- Criar `src/modules/compounding/compounding.types.ts`.
- Escrever testes unitários em `tests/modules/compounding/compounding.schema.test.ts`.

### Task 2: CompoundingCalculationService (Motor Farmacotécnico)
- Criar `src/modules/compounding/compounding-calculation.service.ts`:
  - `calculateCorrectionFactor(potencyPercent: number, moisturePercent: number): number`
  - `calculateEquivalenceFactor(molecularWeightSalt?: number, molecularWeightBase?: number): number`
  - `calculateCorrectedDose(prescribedDose: number, fc: number, feq: number): number`
  - `determineCapsuleSize(totalVolumeMl: number): { capsuleSize: string; capsuleVolumeMl: number; excipientVolumeMl: number }`
  - `calculateExcipientMass(excipientVolumeMl: number, excipientDensity?: number): number`
- Escrever testes em `tests/modules/compounding/compounding-calculation.service.test.ts`.

### Task 3: CompoundingService (Ordens de Manipulação, Quarentena & Rótulos)
- Criar `src/modules/compounding/compounding.service.ts`:
  - Gestão de matérias-primas e lotes.
  - Aprovação/rejeição de laudo na quarentena (`releaseRawMaterialBatch`, `rejectRawMaterialBatch`).
  - Geração de ordem de manipulação com cálculo automático de ativos e excipiente q.s.p.
  - Registro de pesagem por item na balança analítica.
  - Conferência de peso médio de cápsulas com tolerância da farmacopeia (±10% para < 300mg, ±7.5% para >= 300mg).
  - Geração de rótulo magistral ESC/POS formatado (RDC 67/2007).
- Escrever testes em `tests/modules/compounding/compounding.service.test.ts`.

### Task 4: Rotas REST Fastify
- Criar `src/modules/compounding/compounding.routes.ts`:
  - `GET /api/compounding/raw-materials` & `POST /api/compounding/raw-materials`
  - `GET /api/compounding/raw-materials/:id/batches` & `POST /api/compounding/raw-materials/:id/batches`
  - `POST /api/compounding/raw-materials/batches/:id/release`
  - `POST /api/compounding/raw-materials/batches/:id/reject`
  - `POST /api/compounding/calculate-capsule`
  - `GET /api/compounding/orders` & `POST /api/compounding/orders`
  - `GET /api/compounding/orders/:id`
  - `POST /api/compounding/orders/:id/weigh-item`
  - `POST /api/compounding/orders/:id/quality-control`
  - `GET /api/compounding/orders/:id/label`
- Registrar em `src/api/routes.ts`.
- Escrever testes de integração em `tests/api/routes.compounding.test.ts`.

### Task 5: Interface React — `CompoundingPage.tsx`
- Criar tipos em `frontend/src/types/compounding.ts` e exportar em `frontend/src/types/index.ts`.
- Atualizar `frontend/src/hooks/useStationMode.ts` com `COMPOUNDING_MAGISTRAL` e `isCompounding`.
- Adicionar `compoundingApi` em `frontend/src/services/api.ts`.
- Criar página `frontend/src/pages/CompoundingPage.tsx` com 4 abas:
  1. Orçamento & Calculadora de Cápsulas.
  2. Ficha de Pesagem & Manipulação.
  3. Quarentena & Laudos de Matéria-Prima.
  4. Rótulo Magistral Oficial (RDC 67).
- Conectar botão `topbar-compounding-button` em `frontend/src/App.tsx`.
- Escrever testes em `frontend/tests/pages/CompoundingPage.test.tsx`.

### Task 6: Auditoria de Homologação Geral & Push
- Executar suíte completa (`npm.cmd test`, `tsc`, `build:web`).
- Garantir 100% de sucesso.
- Sincronizar com `origin master` no GitHub.
