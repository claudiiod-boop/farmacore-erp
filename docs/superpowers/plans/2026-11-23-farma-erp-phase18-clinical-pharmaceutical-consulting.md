# Plano de Implementação - Fase 18: Consultório Farmacêutico & Serviços Clínicos Avançados (RDC 777/2023 & RDC 44/2009)

> **Meta:** Desenvolver e homologar o módulo completo de **Consultório Farmacêutico e Serviços Clínicos Avançados** para o FarmaCore ERP & PDV, com suporte a Testes Laboratoriais Rápidos (TLR - RDC 777/2023), Procedimentos (Injetáveis, PA, Inalação), Emissão da DSF (Declaração de Serviço Farmacêutico) e Farmacovigilância (Notivisa).

---

## Task 1: Schema 017 & Tipos de Domínio TypeScript
- **Objetivo:** Criar tabelas para farmacêuticos clínicos, catálogo de serviços, atendimentos, procedimentos, testes rápidos TLR, farmacovigilância e definir interfaces TypeScript.
- **Arquivos:**
  - `src/database/migrations/017_pharmaceutical_consulting_clinical_services.sql`
  - `src/modules/clinical/clinical.types.ts`
  - `tests/modules/clinical/clinical.schema.test.ts`
- **Critérios de Sucesso:** Teste de schema validando criação das tabelas, chaves estrangeiras e integridade referencial.

---

## Task 2: Motor de Gestão Clínica Farmacêutica (`ClinicalServicesService`)
- **Objetivo:** Gerenciar farmacêuticos, catálogo de serviços, registro de atendimentos com anamnese, execução de testes rápidos TLR e procedimentos.
- **Arquivos:**
  - `src/modules/clinical/clinical-services.service.ts`
  - `tests/modules/clinical/clinical-services.service.test.ts`
- **Critérios de Sucesso:** Fluxo de criação de atendimento, adição de TLR (Glicemia, Covid, etc.), adição de aplicação de injetáveis com validação prescricional e finalização com numeração de DSF.

---

## Task 3: Motor de Farmacovigilância & Notificação Sanitária (`PharmacovigilanceService`)
- **Objetivo:** Registro e rastreamento de Reações Adversas a Medicamentos (RAM) e Queixas Técnicas integradas ao padrão Notivisa/ANVISA.
- **Arquivos:**
  - `src/modules/clinical/pharmacovigilance.service.ts`
  - `tests/modules/clinical/pharmacovigilance.service.test.ts`
- **Critérios de Sucesso:** Registro de RAM com classificação de severidade, histórico e emissão de ficha sanitária.

---

## Task 4: Formatador Oficial da DSF (ESC/POS & A4) e Rotas Fastify REST
- **Objetivo:** Formatar a Declaração de Serviço Farmacêutico em 2 vias (paciente e estabelecimento) e expor rotas REST `/api/clinical/*`.
- **Arquivos:**
  - `src/modules/clinical/dsf-formatter.ts`
  - `src/modules/clinical/clinical.routes.ts`
  - `src/api/routes.ts`
  - `tests/modules/clinical/dsf-formatter.test.ts`
  - `tests/api/routes.clinical.test.ts`
- **Critérios de Sucesso:** Rotas respondendo com 200/201, validação com Zod e emissão de cupom térmico da DSF.

---

## Task 5: Interface Frontend React (`ClinicalConsultingPage.tsx`)
- **Objetivo:** Criar página interativa do Consultório Farmacêutico com abas de Atendimento & Anamnese, Testes Rápidos (TLR), Procedimentos & Injetáveis, Farmacovigilância e Histórico de DSFs.
- **Arquivos:**
  - `frontend/src/types/clinical.ts`
  - `frontend/src/services/api.ts`
  - `frontend/src/pages/ClinicalConsultingPage.tsx`
  - `frontend/src/types/index.ts`
  - `frontend/src/hooks/useStationMode.ts`
  - `frontend/src/App.tsx`
  - `frontend/tests/pages/ClinicalConsultingPage.test.tsx`
- **Critérios de Sucesso:** Vitest do frontend passando 100%, typecheck sem erros e build web de produção com sucesso.

---

## Task 6: Auditoria de Homologação Final & Sincronização Git
- **Objetivo:** Executar suíte completa de testes do monorepo, validar backend e frontend, e instruir o push para `origin/master`.
