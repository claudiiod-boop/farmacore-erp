import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { CompoundingService } from '../../../src/modules/compounding/compounding.service';

describe('CompoundingService — Gestão Magistral, Quarentena & Boas Práticas (RDC 67/2007)', () => {
  let db: Database;
  let service: CompoundingService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new CompoundingService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Quarentena e Liberação de Matérias-Primas', () => {
    it('should enter batch in QUARANTINE by default and allow release by pharmacist', () => {
      const mat = service.createRawMaterial({
        name: 'Zinco Quelato 20%',
        dcb: '09332',
        apparent_density: 0.65,
        default_unit: 'mg',
        cost_per_unit: 0.04,
      });

      const batch = service.createRawMaterialBatch({
        raw_material_id: mat.id!,
        batch_number: 'LOTE-ZN-01',
        supplier: 'Infinity Pharma',
        potency_percent: 100.0,
        moisture_percent: 0.0,
        report_number: 'LAUDO-ZN-001',
        expiration_date: '2028-06-30',
        current_stock: 500.0,
      });

      expect(batch.status).toBe('QUARANTINE');

      // Farmacêutico aprova após conferência de laudo
      const released = service.releaseRawMaterialBatch(batch.id!, 'FARMACEUTICA_CLARA');
      expect(released.status).toBe('APPROVED');
      expect(released.released_by).toBe('FARMACEUTICA_CLARA');
    });

    it('should reject batch with reason when analytical tests fail', () => {
      const mat = service.createRawMaterial({
        name: 'Cafeina Anidra',
        apparent_density: 0.50,
      });

      const batch = service.createRawMaterialBatch({
        raw_material_id: mat.id!,
        batch_number: 'LOTE-CAF-99',
        supplier: 'Purifarma',
        potency_percent: 85.0, // Teor muito abaixo da especificação
        report_number: 'LAUDO-CAF-99',
        expiration_date: '2027-12-31',
      });

      const rejected = service.rejectRawMaterialBatch(
        batch.id!,
        'FARMACEUTICA_CLARA',
        'Teor de 85.0% abaixo do limite farmacopeico minimo (98.5%)'
      );

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejection_reason).toContain('abaixo do limite farmacopeico');
    });
  });

  describe('Criação de Ordem de Manipulação & Ficha de Pesagem', () => {
    it('should block order creation if raw material has no APPROVED batch (quarantine block)', () => {
      const mat = service.createRawMaterial({
        name: 'Melatonina 99%',
        apparent_density: 0.55,
      });

      // Lote ainda em quarentena
      service.createRawMaterialBatch({
        raw_material_id: mat.id!,
        batch_number: 'LOTE-MEL-01',
        supplier: 'Fagron',
        report_number: 'LAUDO-001',
        expiration_date: '2028-01-01',
        status: 'QUARANTINE',
      });

      expect(() =>
        service.createOrder(
          {
            patient_name: 'Ana Souza',
            prescriber_name: 'Dr. Roberto',
            prescriber_crm: '12345',
            pharmaceutical_form: 'CAPSULA',
            total_units: 30,
          },
          [{ rawMaterialId: mat.id!, prescribedDose: 5.0 }]
        )
      ).toThrow(/não possui lotes aprovados em estoque/i);
    });

    it('should create order, compute capsule sizing and weighing items with FC and FEq', () => {
      // 1. Cadastra e aprova matéria prima
      const mat = service.createRawMaterial({
        name: 'Vitamina C (Acido Ascorbico)',
        apparent_density: 0.70,
        cost_per_unit: 0.02,
      });

      const batch = service.createRawMaterialBatch({
        raw_material_id: mat.id!,
        batch_number: 'LOTE-VITC-01',
        supplier: 'Fagron',
        potency_percent: 98.0,
        moisture_percent: 2.0, // FC = 1.0412
        report_number: 'LAUDO-VITC',
        expiration_date: '2028-12-31',
        status: 'QUARANTINE',
      });
      service.releaseRawMaterialBatch(batch.id!, 'FARM_CLARA');

      // 2. Cria ordem
      const order = service.createOrder(
        {
          patient_name: 'Ana Souza',
          prescriber_name: 'Dr. Roberto',
          prescriber_crm: '12345',
          pharmaceutical_form: 'CAPSULA',
          total_units: 60,
          directions: 'Tomar 1 cápsula pela manhã',
        },
        [{ rawMaterialId: mat.id!, prescribedDose: 500.0 }]
      );

      expect(order.id).toBeDefined();
      expect(order.order_number).toMatch(/^OM-\d{6}-\d{4}$/);
      expect(order.status).toBe('AWAITING_WEIGHING');
      expect(order.capsule_size).toBeDefined();
      expect(order.target_weight_per_unit).toBeGreaterThan(500);

      const item = order.items![0];
      expect(item.factor_correction).toBe(1.0412);
      expect(item.corrected_dose_per_unit).toBe(520.6); // 500 * 1.0412
      expect(item.total_dose_to_weigh).toBe(31236); // 520.6 * 60
    });
  });

  describe('Fluxo Completo de Pesagem, Controle de Qualidade e Rótulo Magistral', () => {
    it('should weigh item, approve quality control and generate legal RDC 67 label', () => {
      // Setup
      const mat = service.createRawMaterial({
        name: 'Coenzima Q10',
        apparent_density: 0.60,
        cost_per_unit: 0.10,
      });
      const batch = service.createRawMaterialBatch({
        raw_material_id: mat.id!,
        batch_number: 'LOTE-Q10-01',
        supplier: 'Galena',
        potency_percent: 100.0,
        moisture_percent: 0.0,
        report_number: 'LAUDO-Q10',
        expiration_date: '2028-12-31',
      });
      service.releaseRawMaterialBatch(batch.id!, 'FARM_CLARA');

      const order = service.createOrder(
        {
          patient_name: 'Beatriz Martins',
          prescriber_name: 'Dr. Carlos Eduardo',
          prescriber_crm: '54321',
          prescriber_uf: 'SP',
          pharmaceutical_form: 'CAPSULA',
          total_units: 30,
          directions: 'Tomar 1 cápsula ao almoço',
          warnings: 'Uso interno. Mantenha em temperatura ambiente (15 a 30°C).',
        },
        [{ rawMaterialId: mat.id!, prescribedDose: 100.0 }]
      );

      // 1. Pesagem na balança analítica
      const itemId = order.items![0].id!;
      const weighedOrder = service.weighItem(
        order.id!,
        itemId,
        order.items![0].total_dose_to_weigh,
        'MANIPULADOR_PEDRO'
      );

      expect(weighedOrder.status).toBe('QUALITY_CONTROL');

      // 2. Controle de Qualidade (Peso Médio)
      const targetWeight = weighedOrder.target_weight_per_unit!;
      const qcOrder = service.evaluateQualityControl(
        order.id!,
        targetWeight * 1.02, // 2% de desvio (aprovado)
        'FARMACEUTICA_CLARA'
      );

      expect(qcOrder.status).toBe('READY');
      expect(qcOrder.quality_status).toBe('APPROVED');
      expect(qcOrder.expires_at).toBeDefined();

      // 3. Rótulo Magistral (RDC 67)
      const label = service.generateMagistralLabel(order.id!);
      expect(label).toContain('FARMACORE FARMACIA MAGISTRAL');
      expect(label).toContain('BOAS PRATICAS DE MANIPULACAO - RDC 67/2007');
      expect(label).toContain('PACIENTE: BEATRIZ MARTINS');
      expect(label).toContain('PRESCRITOR: DR. CARLOS EDUARDO (CRM/UF: 54321/SP)');
      expect(label).toContain('Coenzima Q10 ..... 100 mg');
      expect(label).toContain('Tomar 1 cápsula ao almoço');
      expect(label).toContain('VENDA SOB PRESCRICAO MEDICA');
    });

    it('should reject formula if average weight deviates beyond tolerance', () => {
      const mat = service.createRawMaterial({ name: 'Zinco', apparent_density: 0.6 });
      const b = service.createRawMaterialBatch({
        raw_material_id: mat.id!,
        batch_number: 'B1',
        supplier: 'S1',
        report_number: 'R1',
        expiration_date: '2028-01-01',
      });
      service.releaseRawMaterialBatch(b.id!, 'FARM_CLARA');

      const order = service.createOrder(
        {
          patient_name: 'Teste Desvio',
          prescriber_name: 'Dr. Teste',
          prescriber_crm: '0000',
          total_units: 30,
        },
        [{ rawMaterialId: mat.id!, prescribedDose: 100 }]
      );

      service.weighItem(order.id!, order.items![0].id!, 3000, 'MANIPULADOR_PEDRO');

      // Peso teórico ~200mg, medido 250mg -> desvio 25% > 10%
      expect(() =>
        service.evaluateQualityControl(order.id!, 250.0, 'FARMACEUTICA_CLARA')
      ).toThrow(/Controle de qualidade REPROVADO/i);

      const rejectedOrder = service.getOrderById(order.id!)!;
      expect(rejectedOrder.quality_status).toBe('REJECTED');
    });
  });
});
