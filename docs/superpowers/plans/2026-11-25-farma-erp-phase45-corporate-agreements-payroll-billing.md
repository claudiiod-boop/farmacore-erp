# Plano de Implementação — Fase 45: Gestão de Convênios Empresariais & Faturamento em Lote para Empresas (B2B Desconto em Folha)

## Tasks

- [ ] Task 1: Migration 044 e Types de Convênio Empresarial
  - Criar `src/database/migrations/044_corporate_agreements_payroll_billing.sql`
  - Criar `src/modules/agreements/agreements.types.ts`
  - Criar `tests/modules/agreements/agreements.schema.test.ts`
  - Validar migration com vitest

- [ ] Task 2: CorporateAgreementService (Fechamento Mensal, Espelho RH, Validação de Limites & Quitação)
  - Criar `src/modules/agreements/agreements.service.ts`
  - Métodos: `generateInvoiceForAgreement`, `generateBatchBilling`, `exportPayrollDiscountFile`, `settleAgreementInvoice`, `checkCustomerAgreementEligibility`, `listInvoices`, `getAgreementKpis`
  - Criar `tests/modules/agreements/agreements.service.test.ts`
  - Validar cálculos de faturas, consolidação de colaboradores e travas de inadimplência

- [ ] Task 3: Fastify REST Routes
  - Criar `src/modules/agreements/agreements.routes.ts`
  - Registrar em `src/api/routes.ts`
  - Criar `tests/api/routes.agreements.test.ts`
  - Validar endpoints REST

- [ ] Task 4: Frontend Convênios & Desconto em Folha
  - Criar `frontend/src/types/agreements.ts` e exportar em `frontend/src/types/index.ts`
  - Atualizar `useStationMode.ts` com `CORPORATE_AGREEMENTS_BILLING` e `isCorporateAgreementsBilling`
  - Adicionar chamadas em `frontend/src/services/api.ts`
  - Criar `frontend/src/pages/CorporateAgreementsBillingPage.tsx`
  - Integrar em `frontend/src/App.tsx`
  - Criar `frontend/tests/pages/CorporateAgreementsBillingPage.test.tsx` e validar com vitest

- [ ] Task 5: Homologação Global & Git Push
  - `tsc --noEmit`
  - `npm run build:web`
  - `npm test`
  - Commit convencional e push para `master`
