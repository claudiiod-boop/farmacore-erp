# Plano de Implementação - Fase 17: SPED Fiscal EFD ICMS/IPI, Sintegra & Bloco H Farmacêutico

> **Meta:** Desenvolver e homologar com padrão industrial o motor gerador do **SPED Fiscal (EFD ICMS/IPI)**, **Sintegra** e **Bloco H (Inventário Contábil)** para o FarmaCore ERP & PDV, integrando compras, vendas NFC-e, estoque físico e apuração tributária farmacêutica (ICMS-ST e Monofásico).

---

## Task 1: Schema 016 & Tipos de Domínio TypeScript
- **Objetivo:** Criar tabelas para parâmetros fiscais contábeis, histórico de arquivos gerados e auditoria pré-PVA.
- **Arquivos:**
  - `src/database/migrations/016_sped_fiscal_sintegra_bloco_h.sql`
  - `src/modules/fiscal/sped.types.ts`
  - `tests/modules/fiscal/sped.schema.test.ts`
- **Critérios de Sucesso:** Teste de migração executando com sucesso e validando inserts de parâmetros e gerações.

---

## Task 2: Motor de Geração do SPED Fiscal EFD ICMS/IPI (`SpedFiscalService`)
- **Objetivo:** Gerar arquivo oficial em formato pipe-delimited com Blocos 0, C, E, H, 1 e 9.
- **Arquivos:**
  - `src/modules/fiscal/sped-fiscal.service.ts`
  - `tests/modules/fiscal/sped-fiscal.service.test.ts`
- **Critérios de Sucesso:** Arquivo gerado com formatação estrita de cada registro (`0000`, `0150`, `0200`, `C100`, `C170`, `C190`, `E110`, `H005`, `H010`, `9900`, `9999`) e validação de totalizadores de linhas.

---

## Task 3: Motor de Geração do Sintegra Farmacêutico (`SintegraService`)
- **Objetivo:** Gerar arquivo oficial posicional de 126 colunas (Convênio ICMS 57/95).
- **Arquivos:**
  - `src/modules/fiscal/sintegra.service.ts`
  - `tests/modules/fiscal/sintegra.service.test.ts`
- **Critérios de Sucesso:** Registros 10, 11, 50, 54, 60M, 60A, 74 e 90 com larguras posicionais e preenchimentos exatos.

---

## Task 4: Motor de Auditoria e Pré-Validação Fiscal PVA (`SpedAuditService`)
- **Objetivo:** Verificar inconsistências fiscais em produtos, notas e estoque antes da exportação oficial.
- **Arquivos:**
  - `src/modules/fiscal/sped-audit.service.ts`
  - `tests/modules/fiscal/sped-audit.service.test.ts`
- **Critérios de Sucesso:** Detectar NCMs inválidos, divergências de CFOP x CST e itens de estoque sem custo unitário.

---

## Task 5: Formatador Térmico ESC/POS & Rotas Fastify REST
- **Objetivo:** Emitir resumo fiscal em cupom térmico e expor endpoints REST para geração, download e auditoria.
- **Arquivos:**
  - `src/modules/fiscal/sped-formatter.ts`
  - `src/modules/fiscal/sped.routes.ts`
  - `src/api/routes.ts`
  - `tests/modules/fiscal/sped-formatter.test.ts`
  - `tests/api/routes.sped.test.ts`
- **Critérios de Sucesso:** Testes de rotas Fastify e formatação térmica passando com 100% de cobertura.

---

## Task 6: Interface Frontend React (`SpedFiscalPage.tsx`)
- **Objetivo:** Desenvolver tela completa com abas de Geração SPED/Sintegra, Bloco H (Inventário), Auditoria Pré-PVA e Histórico.
- **Arquivos:**
  - `frontend/src/types/sped.ts`
  - `frontend/src/services/api.ts`
  - `frontend/src/pages/SpedFiscalPage.tsx`
  - `frontend/src/types/index.ts`
  - `frontend/src/hooks/useStationMode.ts`
  - `frontend/src/App.tsx`
  - `frontend/tests/pages/SpedFiscalPage.test.tsx`
- **Critérios de Sucesso:** Vitest do frontend passando, typecheck sem erros e build web de produção executado com sucesso.

---

## Task 7: Auditoria de Homologação Final & Sincronização Git
- **Objetivo:** Rodar suíte completa de testes de todo o repositório, validar backend e frontend, e instruir o push para `origin/master`.
