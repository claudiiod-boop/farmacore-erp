import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import {
  TreatmentAdherenceService,
  TreatmentError,
} from '../../../src/modules/crm/treatment-adherence.service';
import type {
  TreatmentItemInput,
  UpcomingRefillsFilter,
} from '../../../src/modules/crm/types';

describe('TreatmentAdherenceService (Adesão a Tratamento Contínuo e Alerta de Recompra Preditiva)', () => {
  let db: Database;
  let service: TreatmentAdherenceService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new TreatmentAdherenceService(db);

    // Cria Loja 1
    db.prepare(
      `INSERT OR IGNORE INTO stores (id, code, name, company_name, cnpj, ie, is_headquarters, street, number, neighborhood, city, state, zip_code, ibge_code, is_active)
       VALUES (1, 'LJ01', 'FarmaCore Matriz', 'FarmaCore Drogaria Ltda', '12.345.678/0001-90', '123456789', 1, 'Rua Central', '100', 'Centro', 'São Paulo', 'SP', '01001-000', '3550308', 1)`
    ).run();

    // Cria Clientes de Teste
    db.prepare(
      `INSERT INTO customers (id, store_id, name, cpf, phone, email)
       VALUES (1, 1, 'Maria Oliveira', '123.456.789-00', '(11) 98765-4321', 'maria.oliveira@email.com')`
    ).run();

    db.prepare(
      `INSERT INTO customers (id, store_id, name, cpf, phone, email)
       VALUES (2, 1, 'João da Silva', '987.654.321-99', '(11) 91234-5678', 'joao.silva@email.com')`
    ).run();

    // Cria Produtos de Teste (medicamentos de uso contínuo)
    db.prepare(
      `INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES (1, '7891111111111', 'Losartana Potássica 50mg 30 comp', 'Losartana Potássica 50mg', '1.0000.0001', 'TARJA_VERMELHA', 'LIBERADO', 40.0, 30.0, 25.0, 1)`
    ).run();

    db.prepare(
      `INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES (2, '7892222222222', 'Metformina 850mg 60 comp', 'Cloridrato de Metformina 850mg', '1.0000.0002', 'TARJA_VERMELHA', 'LIBERADO', 35.0, 25.0, 20.0, 1)`
    ).run();

    db.prepare(
      `INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
       VALUES (3, '7893333333333', 'Atenolol 25mg 30 comp', 'Atenolol 25mg', '1.0000.0003', 'TARJA_VERMELHA', 'LIBERADO', 28.0, 20.0, 15.0, 1)`
    ).run();

    // Cria Vendas de Teste
    db.prepare(`INSERT INTO sales (id, total_amount) VALUES (101, 50.0)`).run();
    db.prepare(`INSERT INTO sales (id, total_amount) VALUES (102, 75.0)`).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('registerTreatmentFromSale', () => {
    it('deve registrar tratamento a partir de venda com cálculo correto de totalDaysSupply e expectedRefillDate (30 comp, 1/dia = 30 dias)', () => {
      const items: TreatmentItemInput[] = [
        {
          productId: 1,
          unitsPerBox: 30,
          boxesPurchased: 1,
          dailyDose: 1.0,
          startDate: '2026-11-20',
          notes: 'Uso contínuo para hipertensão',
        },
      ];

      const treatments = service.registerTreatmentFromSale({
        saleId: 101,
        customerId: 1,
        items,
      });

      expect(treatments).toHaveLength(1);
      const t = treatments[0];
      expect(t.customerId).toBe(1);
      expect(t.productId).toBe(1);
      expect(t.saleId).toBe(101);
      expect(t.unitsPerBox).toBe(30);
      expect(t.boxesPurchased).toBe(1);
      expect(t.dailyDose).toBe(1.0);
      expect(t.totalDaysSupply).toBe(30);
      expect(t.startDate).toBe('2026-11-20');
      expect(t.expectedRefillDate).toBe('2026-12-20');
      expect(t.status).toBe('ACTIVE');
      expect(t.notes).toBe('Uso contínuo para hipertensão');
    });

    it('deve calcular corretamente 60 comp, 2 comp/dia = 30 dias', () => {
      const treatments = service.registerTreatmentFromSale(101, 1, [
        {
          productId: 2,
          unitsPerBox: 60,
          boxesPurchased: 1,
          dailyDose: 2.0,
          startDate: '2026-11-20',
        },
      ]);

      expect(treatments).toHaveLength(1);
      expect(treatments[0].totalDaysSupply).toBe(30);
      expect(treatments[0].expectedRefillDate).toBe('2026-12-20');
    });

    it('deve calcular corretamente 30 comp, 0.5 comp/dia = 60 dias', () => {
      const treatments = service.registerTreatmentFromSale({
        saleId: 101,
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 0.5,
            startDate: '2026-11-20',
          },
        ],
      });

      expect(treatments).toHaveLength(1);
      expect(treatments[0].totalDaysSupply).toBe(60);
      expect(treatments[0].expectedRefillDate).toBe('2027-01-19');
    });

    it('deve tratar compras de múltiplas caixas (boxesPurchased = 2)', () => {
      const treatments = service.registerTreatmentFromSale({
        saleId: 101,
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 2,
            dailyDose: 1.0,
            startDate: '2026-11-20',
          },
        ],
      });

      expect(treatments).toHaveLength(1);
      // Math.floor((30 * 2) / 1) = 60 dias
      expect(treatments[0].boxesPurchased).toBe(2);
      expect(treatments[0].totalDaysSupply).toBe(60);
      expect(treatments[0].expectedRefillDate).toBe('2027-01-19');
    });

    it('deve lançar erro semântico CUSTOMER_NOT_FOUND se o cliente não existir', () => {
      expect(() => {
        service.registerTreatmentFromSale({
          saleId: 101,
          customerId: 99999,
          items: [
            {
              productId: 1,
              unitsPerBox: 30,
              boxesPurchased: 1,
              dailyDose: 1.0,
            },
          ],
        });
      }).toThrowError(TreatmentError);

      try {
        service.registerTreatmentFromSale(101, 99999, [{ productId: 1 }]);
      } catch (err: any) {
        expect(err).toBeInstanceOf(TreatmentError);
        expect(err.code).toBe('CUSTOMER_NOT_FOUND');
      }
    });

    it('deve ignorar itens sem dados válidos de posologia (dailyDose <= 0 ou unitsPerBox <= 0)', () => {
      const treatments = service.registerTreatmentFromSale({
        saleId: 101,
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0, // Válido
            startDate: '2026-11-20',
          },
          {
            productId: 2,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 0, // Inválido!
          },
          {
            productId: 3,
            unitsPerBox: -10, // Inválido!
            boxesPurchased: 1,
            dailyDose: 1.0,
          },
        ],
      });

      // Apenas o item válido deve ser persistido
      expect(treatments).toHaveLength(1);
      expect(treatments[0].productId).toBe(1);
    });

    it('deve atualizar ou encadear se o paciente já possui tratamento ativo do mesmo produto', () => {
      // 1º registro de tratamento para Maria (Losartana)
      const first = service.registerTreatmentFromSale({
        saleId: 101,
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-11-01',
          },
        ],
      });
      expect(first[0].status).toBe('ACTIVE');
      expect(first[0].expectedRefillDate).toBe('2026-12-01');

      // 2º registro da mesma medicação para Maria na venda 102
      const second = service.registerTreatmentFromSale({
        saleId: 102,
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-12-01',
          },
        ],
      });

      expect(second).toHaveLength(1);
      expect(second[0].status).toBe('ACTIVE');
      expect(second[0].expectedRefillDate).toBe('2026-12-31');

      // O tratamento anterior deve ter sido atualizado para REFILLED
      const history = service.getCustomerTreatments(1);
      expect(history).toHaveLength(2);

      const oldTreatment = history.find((t) => t.id === first[0].id);
      expect(oldTreatment?.status).toBe('REFILLED');

      const activeTreatment = history.find((t) => t.id === second[0].id);
      expect(activeTreatment?.status).toBe('ACTIVE');
    });
  });

  describe('listUpcomingRefills', () => {
    beforeEach(() => {
      // Maria: Losartana com término em 2026-11-23 (3 dias à frente de 2026-11-20)
      service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-10-24', // 30 dias -> término em 2026-11-23
          },
        ],
      });

      // João: Metformina com término em 2026-11-25 (5 dias à frente de 2026-11-20)
      service.registerTreatmentFromSale({
        customerId: 2,
        items: [
          {
            productId: 2,
            unitsPerBox: 60,
            boxesPurchased: 1,
            dailyDose: 2.0,
            startDate: '2026-10-26', // 30 dias -> término em 2026-11-25
          },
        ],
      });

      // Maria: Atenolol com término em 2026-12-10 (20 dias à frente de 2026-11-20)
      service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 3,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-11-10', // 30 dias -> término em 2026-12-10
          },
        ],
      });
    });

    it('deve retornar pacientes cujo medicamento deve terminar dentro do horizonte configurado (daysAhead: 5)', () => {
      const filter: UpcomingRefillsFilter = {
        daysAhead: 5,
        referenceDate: '2026-11-20',
      };

      const upcoming = service.listUpcomingRefills(filter);

      // Deve incluir Maria (término 23/11) e João (término 25/11), excluindo Atenolol (10/12)
      expect(upcoming).toHaveLength(2);
      expect(upcoming[0].customerName).toBe('Maria Oliveira');
      expect(upcoming[0].expectedRefillDate).toBe('2026-11-23');
      expect(upcoming[1].customerName).toBe('João da Silva');
      expect(upcoming[1].expectedRefillDate).toBe('2026-11-25');
    });

    it('deve juntar dados do cliente (nome, telefone, email) e do produto (nome, dosagem/ingrediente ativo)', () => {
      const upcoming = service.listUpcomingRefills({
        daysAhead: 5,
        referenceDate: '2026-11-20',
      });

      const mariaRefill = upcoming.find((u) => u.customerName === 'Maria Oliveira');
      expect(mariaRefill).toBeDefined();
      expect(mariaRefill?.customerPhone).toBe('(11) 98765-4321');
      expect(mariaRefill?.customerEmail).toBe('maria.oliveira@email.com');
      expect(mariaRefill?.productName).toContain('Losartana Potássica');
      expect(mariaRefill?.dosage || mariaRefill?.productDosage).toBe('Losartana Potássica 50mg');
    });

    it('deve excluir tratamentos já finalizados (REFILLED, DISCONTINUED)', () => {
      // Pega o ID do tratamento da Maria (Losartana) e marca como REFILLED
      const listBefore = service.listUpcomingRefills({
        daysAhead: 5,
        referenceDate: '2026-11-20',
      });
      const mariaTreatmentId = listBefore[0].treatmentId;

      service.recordRefill(mariaTreatmentId);

      // Agora a listagem com daysAhead: 5 deve retornar apenas o João
      const listAfter = service.listUpcomingRefills({
        daysAhead: 5,
        referenceDate: '2026-11-20',
      });
      expect(listAfter).toHaveLength(1);
      expect(listAfter[0].customerName).toBe('João da Silva');

      // Se descontinuar o João, a lista fica vazia
      service.discontinueTreatment(listAfter[0].treatmentId, 'Paciente trocou de médico');

      const listEmpty = service.listUpcomingRefills({
        daysAhead: 5,
        referenceDate: '2026-11-20',
      });
      expect(listEmpty).toHaveLength(0);
    });

    it('deve ordenar por data prevista de término (expectedRefillDate ASC)', () => {
      const upcoming = service.listUpcomingRefills({
        daysAhead: 30,
        referenceDate: '2026-11-20',
      });

      expect(upcoming.length).toBeGreaterThanOrEqual(3);
      for (let i = 0; i < upcoming.length - 1; i++) {
        expect(upcoming[i].expectedRefillDate <= upcoming[i + 1].expectedRefillDate).toBe(true);
      }
    });
  });

  describe('markAsContacted', () => {
    it('deve atualizar status para CONTACTED, carimbo em last_contacted_at e notas da intervenção farmacêutica', () => {
      const treatments = service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-11-01',
          },
        ],
      });
      const id = treatments[0].id;

      const updated = service.markAsContacted(
        id,
        'Paciente contatada via WhatsApp; confirmou que restam 2 comprimidos e virá amanhã'
      );

      expect(updated.id).toBe(id);
      expect(updated.status).toBe('CONTACTED');
      expect(updated.lastContactedAt).toBeTruthy();
      expect(updated.notes).toContain('Paciente contatada via WhatsApp');

      // Verifica persistência no banco
      const history = service.getCustomerTreatments(1);
      expect(history[0].status).toBe('CONTACTED');
      expect(history[0].lastContactedAt).toBeTruthy();
    });

    it('deve lançar erro semântico TREATMENT_NOT_FOUND para ID inexistente', () => {
      expect(() => {
        service.markAsContacted(99999, 'Contato tentado');
      }).toThrowError(TreatmentError);

      try {
        service.markAsContacted(99999, 'Contato tentado');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TreatmentError);
        expect(err.code).toBe('TREATMENT_NOT_FOUND');
      }
    });
  });

  describe('recordRefill', () => {
    it('deve marcar o tratamento anterior como REFILLED', () => {
      const treatments = service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-11-01',
          },
        ],
      });
      const id = treatments[0].id;

      const refilled = service.recordRefill(id);
      expect(refilled.id).toBe(id);
      expect(refilled.status).toBe('REFILLED');

      const history = service.getCustomerTreatments(1);
      expect(history[0].status).toBe('REFILLED');
    });

    it('deve lançar erro TREATMENT_NOT_FOUND para ID inexistente', () => {
      expect(() => {
        service.recordRefill(99999);
      }).toThrowError(TreatmentError);
    });
  });

  describe('discontinueTreatment', () => {
    it('deve marcar status como DISCONTINUED com motivo registrado nas notas', () => {
      const treatments = service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 1,
            unitsPerBox: 30,
            boxesPurchased: 1,
            dailyDose: 1.0,
            startDate: '2026-11-01',
            notes: 'Tratamento de base',
          },
        ],
      });
      const id = treatments[0].id;

      const discontinued = service.discontinueTreatment(id, 'Efeito colateral relatado (tosse seca)');
      expect(discontinued.id).toBe(id);
      expect(discontinued.status).toBe('DISCONTINUED');
      expect(discontinued.notes).toContain('Efeito colateral relatado (tosse seca)');

      const history = service.getCustomerTreatments(1);
      expect(history[0].status).toBe('DISCONTINUED');
    });

    it('deve lançar erro TREATMENT_NOT_FOUND se o tratamento não existir', () => {
      expect(() => {
        service.discontinueTreatment(99999, 'Motivo qualquer');
      }).toThrowError(TreatmentError);
    });
  });

  describe('getCustomerTreatments', () => {
    it('deve retornar histórico completo de tratamentos do paciente ordenado por data de início decrescente', () => {
      // Insere tratamentos em datas diferentes
      service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 1,
            startDate: '2026-08-01',
            unitsPerBox: 30,
            dailyDose: 1.0,
          },
        ],
      });

      service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 2,
            startDate: '2026-10-15',
            unitsPerBox: 60,
            dailyDose: 2.0,
          },
        ],
      });

      service.registerTreatmentFromSale({
        customerId: 1,
        items: [
          {
            productId: 3,
            startDate: '2026-11-01',
            unitsPerBox: 30,
            dailyDose: 1.0,
          },
        ],
      });

      const history = service.getCustomerTreatments(1);
      expect(history).toHaveLength(3);
      // Ordem decrescente de start_date
      expect(history[0].startDate).toBe('2026-11-01');
      expect(history[1].startDate).toBe('2026-10-15');
      expect(history[2].startDate).toBe('2026-08-01');
    });

    it('deve lançar CUSTOMER_NOT_FOUND para cliente inexistente', () => {
      expect(() => {
        service.getCustomerTreatments(99999);
      }).toThrowError(TreatmentError);
    });
  });
});
