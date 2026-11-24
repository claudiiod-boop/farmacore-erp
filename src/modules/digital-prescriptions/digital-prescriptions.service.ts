import { Database } from '../../database/connection';
import type {
  DigitalPrescription,
  DigitalPrescriptionItem,
  RegisterDigitalPrescriptionInput,
  ValidatePrescriptionResult,
  DispensePrescriptionInput,
} from './digital-prescriptions.types';

export class DigitalPrescriptionService {
  constructor(private db: Database) {}

  /**
   * Cadastra ou importa uma receita digital (Memed, CFM, Conexa, etc.)
   */
  registerPrescription(input: RegisterDigitalPrescriptionInput): DigitalPrescription {
    const existing = this.getPrescriptionByCode(input.prescriptionCode);
    if (existing) {
      throw new Error(`Receita digital com código '${input.prescriptionCode}' já está cadastrada.`);
    }

    const days = input.expiresInDays ?? (input.prescriptionType === 'ANTIMICROBIAL' ? 10 : 30);
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + days);
    const expiresAt = expiresDate.toISOString().slice(0, 19).replace('T', ' ');

    let prescriptionId = 0;

    this.db.transaction(() => {
      const stmt = this.db.prepare(`
        INSERT INTO digital_prescriptions (
          prescription_code, access_token, prescriber_name, prescriber_crm,
          prescriber_uf, prescriber_cpf, patient_name, patient_cpf,
          patient_birth_date, icp_signature_valid, icp_cert_issuer,
          prescription_type, expires_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID')
      `);

      const res = stmt.run(
        input.prescriptionCode.trim(),
        input.accessToken || null,
        input.prescriberName.trim(),
        input.prescriberCrm.trim(),
        input.prescriberUf.trim().toUpperCase(),
        input.prescriberCpf || null,
        input.patientName.trim(),
        input.patientCpf || null,
        input.patientBirthDate || null,
        input.icpSignatureValid !== false ? 1 : 0,
        input.icpCertIssuer || 'AC Syngular / ITI ICP-Brasil',
        input.prescriptionType,
        expiresAt
      );

      prescriptionId = Number(res.lastInsertRowid);

      // Inserir itens prescritos
      const itemStmt = this.db.prepare(`
        INSERT INTO digital_prescription_items (
          prescription_id, medication_name, product_id, dosage,
          quantity_prescribed, quantity_dispensed, instructions
        ) VALUES (?, ?, ?, ?, ?, 0, ?)
      `);

      for (const item of input.items) {
        itemStmt.run(
          prescriptionId,
          item.medicationName,
          item.productId || null,
          item.dosage || null,
          item.quantityPrescribed,
          item.instructions || null
        );
      }
    })();

    const created = this.getPrescriptionByCode(input.prescriptionCode);
    if (!created) {
      throw new Error('Falha ao recuperar receita digital recém-criada.');
    }
    return created;
  }

  /**
   * Consulta uma receita digital por código
   */
  getPrescriptionByCode(code: string): DigitalPrescription | null {
    const row = this.db
      .prepare('SELECT * FROM digital_prescriptions WHERE prescription_code = ?')
      .get(code.trim()) as any;

    if (!row) return null;

    const items = this.db
      .prepare('SELECT * FROM digital_prescription_items WHERE prescription_id = ? ORDER BY id ASC')
      .all(row.id) as DigitalPrescriptionItem[];

    return {
      ...row,
      icp_signature_valid: Boolean(row.icp_signature_valid),
      items,
    };
  }

  /**
   * Valida autenticidade ICP-Brasil, data de validade e se já foi dispensada
   */
  validatePrescription(code: string): ValidatePrescriptionResult {
    const prescription = this.getPrescriptionByCode(code);
    if (!prescription) {
      return {
        isValid: false,
        canDispense: false,
        status: 'REVOKED',
        message: `Receita digital '${code}' não encontrada na base de prescrições.`,
      };
    }

    // 1. Validar integridade da assinatura ICP-Brasil
    if (!prescription.icp_signature_valid) {
      return {
        isValid: false,
        canDispense: false,
        status: prescription.status,
        message: `Assinatura digital ICP-Brasil inválida ou certificado do médico revogado/não confiável.`,
        prescription,
      };
    }

    // 2. Verificar se já foi dispensada (Antifraude / Dupla Dispensação)
    if (prescription.status === 'DISPENSED') {
      return {
        isValid: true,
        canDispense: false,
        status: 'DISPENSED',
        message: `Receita já dispensada em ${prescription.dispensed_at} (Filial #${prescription.dispensed_store_id}) pelo CRF ${prescription.dispensed_pharmacist_crf}. Reutilização bloqueada por segurança.`,
        prescription,
      };
    }

    // 3. Verificar validade regulamentar
    const now = new Date();
    const exp = new Date(prescription.expires_at);
    if (now > exp) {
      this.db
        .prepare("UPDATE digital_prescriptions SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(prescription.id);

      prescription.status = 'EXPIRED';
      return {
        isValid: true,
        canDispense: false,
        status: 'EXPIRED',
        message: `Receita digital vencida em ${prescription.expires_at}. Prazo regulamentar expirado.`,
        prescription,
      };
    }

    return {
      isValid: true,
      canDispense: true,
      status: 'VALID',
      message: `Receita digital autêntica ICP-Brasil emitida por ${prescription.prescriber_name} (${prescription.prescriber_crm}/${prescription.prescriber_uf}). Válida para dispensação.`,
      prescription,
    };
  }

  /**
   * Realiza a baixa / carimbo eletrônico de dispensação com CRF do farmacêutico
   */
  dispensePrescription(code: string, input: DispensePrescriptionInput): DigitalPrescription {
    const validation = this.validatePrescription(code);
    if (!validation.canDispense || !validation.prescription) {
      throw new Error(`Dispensação bloqueada: ${validation.message}`);
    }

    if (!input.pharmacistCrf || !input.pharmacistCrf.trim()) {
      throw new Error('O CRF do Farmacêutico dispensador é obrigatório para baixa sanitária.');
    }

    const prescription = validation.prescription;
    const digitalStamp = `STAMP-${prescription.prescription_code}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    this.db.transaction(() => {
      // 1. Atualizar status da prescrição
      this.db
        .prepare(`
          UPDATE digital_prescriptions
          SET status = 'DISPENSED',
              dispensed_at = CURRENT_TIMESTAMP,
              dispensed_store_id = ?,
              dispensed_pharmacist_crf = ?,
              dispensed_pre_sale_id = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          input.storeId,
          input.pharmacistCrf.trim(),
          input.preSaleId || null,
          prescription.id
        );

      // 2. Registrar carimbo no histórico de dispensações
      this.db
        .prepare(`
          INSERT INTO digital_prescription_dispensations (
            prescription_id, store_id, pre_sale_id, pharmacist_name, pharmacist_crf, digital_stamp
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          prescription.id,
          input.storeId,
          input.preSaleId || null,
          input.pharmacistName.trim(),
          input.pharmacistCrf.trim(),
          digitalStamp
        );

      // 3. Atualizar itens como dispensados
      this.db
        .prepare(`
          UPDATE digital_prescription_items
          SET quantity_dispensed = quantity_prescribed
          WHERE prescription_id = ?
        `)
        .run(prescription.id);
    })();

    const updated = this.getPrescriptionByCode(code);
    if (!updated) {
      throw new Error('Falha ao recuperar receita após dispensação.');
    }
    return updated;
  }

  /**
   * Lista receitas para histórico/auditoria
   */
  listPrescriptions(options?: { status?: string; limit?: number }): DigitalPrescription[] {
    let sql = 'SELECT * FROM digital_prescriptions';
    const params: any[] = [];

    if (options?.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(options?.limit ?? 50);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map((r) => {
      const items = this.db
        .prepare('SELECT * FROM digital_prescription_items WHERE prescription_id = ?')
        .all(r.id) as DigitalPrescriptionItem[];

      return {
        ...r,
        icp_signature_valid: Boolean(r.icp_signature_valid),
        items,
      };
    });
  }
}
