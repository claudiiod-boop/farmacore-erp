# Plano de Implementação — Fase 36: Validador de Receitas Digitais ICP-Brasil, CFM & CFF

## Task 1: Migration 035 & Tipos de Prescrição Digital
- Criar `src/database/migrations/035_digital_prescriptions.sql`:
  - Tabela `digital_prescriptions` com chaves únicas para `prescription_code`.
  - Tabela `digital_prescription_items`.
  - Tabela `digital_prescription_dispensations` para log de carimbo digital.
- Criar `src/modules/digital-prescriptions/digital-prescriptions.types.ts`.
- Criar `tests/modules/digital-prescriptions/digital-prescriptions.schema.test.ts`.

## Task 2: DigitalPrescriptionService & Validador ICP-Brasil
- Criar `src/modules/digital-prescriptions/digital-prescriptions.service.ts`:
  - `registerPrescription(input)`: Registro/importação de receita digital.
  - `validatePrescription(code)`: Validação de assinatura ICP-Brasil, data de validade e status.
  - `dispensePrescription(code, input)`: Baixa irreversível com carimbo digital, CRF e filial.
  - `getPrescriptionByCode(code)`.
- Criar `tests/modules/digital-prescriptions/digital-prescriptions.service.test.ts`.

## Task 3: Fastify REST Routes
- Criar `src/modules/digital-prescriptions/digital-prescriptions.routes.ts`:
  - `POST /api/digital-prescriptions/validate`
  - `POST /api/digital-prescriptions/dispense`
  - `GET /api/digital-prescriptions/:code`
  - `POST /api/digital-prescriptions/mock-create`
- Registrar rotas em `src/api/routes.ts`.
- Criar `tests/api/routes.digital-prescriptions.test.ts`.

## Task 4: Frontend UI (Validação no Balcão & Modal de Dispensação)
- Criar `frontend/src/types/digital-prescription.ts` e exportar em `frontend/src/types/index.ts`.
- Adicionar `digitalPrescriptionsApi` em `frontend/src/services/api.ts`.
- Criar `frontend/src/components/counter/DigitalPrescriptionModal.tsx`:
  - Input para leitura de QR Code / Código de receita (ex: "MEM-1234-ABCD").
  - Card de autenticidade ICP-Brasil / CFM com dados do médico e paciente.
  - Lista de medicamentos prescritos com botão "Importar para Balcão".
  - Alerta bloqueador se receita já foi dispensada ou estiver vencida.
- Integrar atalho/botão "Receita Digital" em `frontend/src/pages/CounterPage.tsx`.
- Criar `frontend/tests/components/DigitalPrescriptionModal.test.tsx`.

## Task 5: Homologação Global & Sincronização GitHub
- `npx.cmd tsc --noEmit`
- `npm.cmd run build:web`
- `npm.cmd test`
- `git push origin master`
