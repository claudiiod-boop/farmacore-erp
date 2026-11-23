import { Database } from '../../database/connection';
import type {
  ClinicalPharmacist,
  ClinicalServiceItem,
  ClinicalAttendance,
  CreateAttendanceDTO,
  ClinicalProcedureRecord,
  ClinicalRapidTestRecord
} from './clinical.types';

export class ClinicalServicesService {
  constructor(private db: Database) {}

  // 1. Gestão de Farmacêuticos
  public registerPharmacist(dto: ClinicalPharmacist): ClinicalPharmacist {
    const cpfPure = dto.cpf.replace(/\D/g, '');
    const crfPure = dto.crfNumber.replace(/\D/g, '');

    const result = this.db
      .prepare(`
        INSERT INTO clinical_pharmacists (
          store_id, name, cpf, crf_number, crf_uf, email, phone, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        dto.storeId,
        dto.name.toUpperCase().trim(),
        cpfPure,
        crfPure,
        dto.crfUf.toUpperCase().trim(),
        dto.email || null,
        dto.phone ? dto.phone.replace(/\D/g, '') : null,
        dto.isActive !== false ? 1 : 0
      );

    return {
      ...dto,
      id: Number(result.lastInsertRowid),
      cpf: cpfPure,
      crfNumber: crfPure,
      crfUf: dto.crfUf.toUpperCase().trim()
    };
  }

  public listPharmacists(storeId: number): ClinicalPharmacist[] {
    const rows = this.db
      .prepare('SELECT * FROM clinical_pharmacists WHERE store_id = ? ORDER BY name ASC')
      .all(storeId) as any[];

    return rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      name: r.name,
      cpf: r.cpf,
      crfNumber: r.crf_number,
      crfUf: r.crf_uf,
      email: r.email,
      phone: r.phone,
      isActive: r.is_active === 1,
      createdAt: r.created_at
    }));
  }

  // 2. Catálogo de Serviços Clínicos
  public addServiceCatalogItem(item: ClinicalServiceItem): ClinicalServiceItem {
    const result = this.db
      .prepare(`
        INSERT INTO clinical_services_catalog (
          store_id, code, name, category, price, description, reference_values_json, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        item.storeId,
        item.code.toUpperCase().trim(),
        item.name.trim(),
        item.category,
        item.price,
        item.description || null,
        item.referenceValuesJson || null,
        item.isActive !== false ? 1 : 0
      );

    return {
      ...item,
      id: Number(result.lastInsertRowid),
      code: item.code.toUpperCase().trim()
    };
  }

  public listServiceCatalog(storeId: number): ClinicalServiceItem[] {
    const rows = this.db
      .prepare('SELECT * FROM clinical_services_catalog WHERE store_id = ? ORDER BY name ASC')
      .all(storeId) as any[];

    return rows.map((r) => ({
      id: r.id,
      storeId: r.store_id,
      code: r.code,
      name: r.name,
      category: r.category,
      price: Number(r.price),
      description: r.description,
      referenceValuesJson: r.reference_values_json,
      isActive: r.is_active === 1,
      createdAt: r.created_at
    }));
  }

  public seedDefaultServices(storeId: number): void {
    const defaults = [
      { code: 'TLR-GLU', name: 'Glicemia Capilar', category: 'TLR' as const, price: 15.0, description: 'Determinação de glicose no sangue total capilar' },
      { code: 'TLR-HBA1C', name: 'Hemoglobina Glicada (HbA1c)', category: 'TLR' as const, price: 55.0, description: 'Avaliação de controle glicêmico dos últimos 90 dias' },
      { code: 'TLR-CHOL', name: 'Perfil Lipídico / Colesterol Total', category: 'TLR' as const, price: 35.0, description: 'Triagem de colesterol total por punção digital' },
      { code: 'TLR-COV19', name: 'Covid-19 Antígeno Rápido', category: 'TLR' as const, price: 60.0, description: 'Detecção qualitativa de antígeno SARS-CoV-2' },
      { code: 'TLR-DENGUE', name: 'Dengue NS1 / IgG / IgM', category: 'TLR' as const, price: 65.0, description: 'Triagem rápida para vírus da Dengue' },
      { code: 'TLR-BHCG', name: 'Beta-hCG (Teste de Gravidez)', category: 'TLR' as const, price: 25.0, description: 'Detecção qualitativa da gonadotrofina coriônica humana' },
      { code: 'PROC-INJ', name: 'Aplicação de Medicamento Injetável', category: 'PROCEDURE' as const, price: 12.0, description: 'Administração IM ou SC com receituário médico' },
      { code: 'PROC-BP', name: 'Aferição de Pressão Arterial', category: 'PROCEDURE' as const, price: 5.0, description: 'Determinação de sístole, diástole e pulso' },
      { code: 'PROC-INH', name: 'Inalação / Nebulização', category: 'PROCEDURE' as const, price: 18.0, description: 'Administração de aerossóis por nebulizador de ar comprimido' },
      { code: 'PROC-TEMP', name: 'Medição de Temperatura Corporal', category: 'PROCEDURE' as const, price: 3.0, description: 'Termometria clínica axilar ou infravermelha' },
    ];

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO clinical_services_catalog (
        store_id, code, name, category, price, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    for (const s of defaults) {
      insert.run(storeId, s.code, s.name, s.category, s.price, s.description);
    }
  }

  // 3. Atendimentos Clínicos & Anamnese
  public createAttendance(dto: CreateAttendanceDTO): ClinicalAttendance {
    const code = `AT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

    const result = this.db
      .prepare(`
        INSERT INTO clinical_attendances (
          attendance_code, store_id, pharmacist_id, patient_name, patient_cpf,
          patient_birth_date, patient_gender, patient_phone, patient_address,
          blood_pressure_systolic, blood_pressure_diastolic, heart_rate,
          temperature, oxygen_saturation, anamnesis_notes, allergies,
          continuous_medications, status, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', 0.0)
      `)
      .run(
        code,
        dto.storeId,
        dto.pharmacistId,
        dto.patientName.toUpperCase().trim(),
        dto.patientCpf ? dto.patientCpf.replace(/\D/g, '') : null,
        dto.patientBirthDate || null,
        dto.patientGender || null,
        dto.patientPhone ? dto.patientPhone.replace(/\D/g, '') : null,
        dto.patientAddress || null,
        dto.bloodPressureSystolic || null,
        dto.bloodPressureDiastolic || null,
        dto.heartRate || null,
        dto.temperature || null,
        dto.oxygenSaturation || null,
        dto.anamnesisNotes || null,
        dto.allergies || null,
        dto.continuousMedications || null
      );

    const id = Number(result.lastInsertRowid);
    return this.getAttendanceById(id)!;
  }

  public addRapidTest(attendanceId: number, test: ClinicalRapidTestRecord): ClinicalRapidTestRecord {
    const att = this.db.prepare('SELECT status FROM clinical_attendances WHERE id = ?').get(attendanceId) as any;
    if (!att) throw new Error('Atendimento não encontrado');
    if (att.status !== 'IN_PROGRESS') throw new Error('Atendimento não está em andamento');

    const result = this.db
      .prepare(`
        INSERT INTO clinical_rapid_tests (
          attendance_id, service_catalog_id, test_type, reagent_name,
          reagent_batch, reagent_expiration, reagent_ms_registration,
          result_value, result_interpretation, reference_range
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        attendanceId,
        test.serviceCatalogId || null,
        test.testType,
        test.reagentName.trim(),
        test.reagentBatch.trim(),
        test.reagentExpiration,
        test.reagentMsRegistration.trim(),
        test.resultValue.trim(),
        test.resultInterpretation,
        test.referenceRange || null
      );

    return {
      ...test,
      id: Number(result.lastInsertRowid),
      attendanceId
    };
  }

  public addProcedure(attendanceId: number, proc: ClinicalProcedureRecord): ClinicalProcedureRecord {
    const att = this.db.prepare('SELECT status FROM clinical_attendances WHERE id = ?').get(attendanceId) as any;
    if (!att) throw new Error('Atendimento não encontrado');
    if (att.status !== 'IN_PROGRESS') throw new Error('Atendimento não está em andamento');

    const result = this.db
      .prepare(`
        INSERT INTO clinical_procedures (
          attendance_id, service_catalog_id, procedure_type, medication_name,
          medication_batch, application_site, prescriber_name, prescriber_crm, details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        attendanceId,
        proc.serviceCatalogId || null,
        proc.procedureType,
        proc.medicationName || null,
        proc.medicationBatch || null,
        proc.applicationSite || null,
        proc.prescriberName || null,
        proc.prescriberCrm || null,
        proc.detailsJson || null
      );

    return {
      ...proc,
      id: Number(result.lastInsertRowid),
      attendanceId
    };
  }

  public completeAttendance(attendanceId: number): ClinicalAttendance {
    const att = this.db.prepare('SELECT * FROM clinical_attendances WHERE id = ?').get(attendanceId) as any;
    if (!att) throw new Error('Atendimento não encontrado');
    if (att.status !== 'IN_PROGRESS') throw new Error('Atendimento já foi finalizado ou cancelado');

    // Calcular total com base nos serviços vinculados
    const tests = this.db
      .prepare(`
        SELECT csc.price FROM clinical_rapid_tests crt
        LEFT JOIN clinical_services_catalog csc ON csc.id = crt.service_catalog_id
        WHERE crt.attendance_id = ?
      `)
      .all(attendanceId) as any[];

    const procs = this.db
      .prepare(`
        SELECT csc.price FROM clinical_procedures cp
        LEFT JOIN clinical_services_catalog csc ON csc.id = cp.service_catalog_id
        WHERE cp.attendance_id = ?
      `)
      .all(attendanceId) as any[];

    const total = [...tests, ...procs].reduce((acc, row) => acc + (Number(row.price) || 0), 0);

    // Gerar número oficial da DSF (Declaração de Serviço Farmacêutico)
    const currentYear = new Date().getFullYear();
    const countRow = this.db
      .prepare("SELECT COUNT(id) as total FROM clinical_attendances WHERE dsf_number IS NOT NULL AND dsf_number LIKE ?")
      .get(`DSF-${att.store_id}-${currentYear}-%`) as any;
    const nextSeq = (Number(countRow?.total) || 0) + 1;
    const dsfNumber = `DSF-${att.store_id}-${currentYear}-${String(nextSeq).padStart(5, '0')}`;

    this.db
      .prepare(`
        UPDATE clinical_attendances SET
          status = 'COMPLETED',
          dsf_number = ?,
          total_amount = ?,
          completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(dsfNumber, total, attendanceId);

    return this.getAttendanceById(attendanceId)!;
  }

  public getAttendanceById(id: number): ClinicalAttendance | null {
    const row = this.db.prepare('SELECT * FROM clinical_attendances WHERE id = ?').get(id) as any;
    if (!row) return null;

    const pharmacist = this.db.prepare('SELECT * FROM clinical_pharmacists WHERE id = ?').get(row.pharmacist_id) as any;

    const procedures = this.db
      .prepare('SELECT * FROM clinical_procedures WHERE attendance_id = ? ORDER BY id ASC')
      .all(id) as any[];

    const rapidTests = this.db
      .prepare('SELECT * FROM clinical_rapid_tests WHERE attendance_id = ? ORDER BY id ASC')
      .all(id) as any[];

    return {
      id: row.id,
      attendanceCode: row.attendance_code,
      storeId: row.store_id,
      pharmacistId: row.pharmacist_id,
      patientName: row.patient_name,
      patientCpf: row.patient_cpf,
      patientBirthDate: row.patient_birth_date,
      patientGender: row.patient_gender,
      patientPhone: row.patient_phone,
      patientAddress: row.patient_address,
      bloodPressureSystolic: row.blood_pressure_systolic,
      bloodPressureDiastolic: row.blood_pressure_diastolic,
      heartRate: row.heart_rate,
      temperature: row.temperature,
      oxygenSaturation: row.oxygen_saturation,
      anamnesisNotes: row.anamnesis_notes,
      allergies: row.allergies,
      continuousMedications: row.continuous_medications,
      status: row.status,
      dsfNumber: row.dsf_number,
      totalAmount: Number(row.total_amount),
      createdAt: row.created_at,
      completedAt: row.completed_at,
      pharmacist: pharmacist ? {
        id: pharmacist.id,
        storeId: pharmacist.store_id,
        name: pharmacist.name,
        cpf: pharmacist.cpf,
        crfNumber: pharmacist.crf_number,
        crfUf: pharmacist.crf_uf,
        email: pharmacist.email,
        phone: pharmacist.phone,
        isActive: pharmacist.is_active === 1
      } : undefined,
      procedures: procedures.map(p => ({
        id: p.id,
        attendanceId: p.attendance_id,
        serviceCatalogId: p.service_catalog_id,
        procedureType: p.procedure_type,
        medicationName: p.medication_name,
        medicationBatch: p.medication_batch,
        applicationSite: p.application_site,
        prescriberName: p.prescriber_name,
        prescriberCrm: p.prescriber_crm,
        detailsJson: p.details_json,
        createdAt: p.created_at
      })),
      rapidTests: rapidTests.map(t => ({
        id: t.id,
        attendanceId: t.attendance_id,
        serviceCatalogId: t.service_catalog_id,
        testType: t.test_type,
        reagentName: t.reagent_name,
        reagentBatch: t.reagent_batch,
        reagentExpiration: t.reagent_expiration,
        reagentMsRegistration: t.reagent_ms_registration,
        resultValue: t.result_value,
        resultInterpretation: t.result_interpretation,
        referenceRange: t.reference_range,
        createdAt: t.created_at
      }))
    };
  }

  public listAttendances(storeId: number, filters?: { status?: string; patientName?: string }): ClinicalAttendance[] {
    let sql = 'SELECT id FROM clinical_attendances WHERE store_id = ?';
    const params: any[] = [storeId];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.patientName) {
      sql += ' AND patient_name LIKE ?';
      params.push(`%${filters.patientName}%`);
    }
    sql += ' ORDER BY id DESC';

    const rows = this.db.prepare(sql).all(...params) as { id: number }[];
    return rows.map(r => this.getAttendanceById(r.id)!).filter(Boolean);
  }
}
