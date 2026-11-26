import crypto from 'crypto';
import { Database } from '../../database/connection';
import {
  PharmaceuticalStaff,
  PharmaceuticalShift,
  PharmaceuticalLogbookEntry,
  RegisterStaffDTO,
  ShiftDefinitionDTO,
  CreateLogbookEntryDTO,
  AssistanceKpis,
} from './pharmaceutical-assistance.types';

export class PharmaceuticalAssistanceService {
  constructor(private db: Database) {}

  public registerStaff(dto: RegisterStaffDTO): PharmaceuticalStaff {
    if (dto.role === 'RT_TITULAR') {
      // Regra CRF: se já houver um RT Titular ativo, marca como substituído/inativo ou valida
      const existingRt = this.db.prepare(`
        SELECT id FROM pharmaceutical_staff
        WHERE store_id = ? AND role = 'RT_TITULAR' AND is_active = 1
      `).get(dto.store_id) as { id: number } | undefined;

      if (existingRt) {
        this.db.prepare(`
          UPDATE pharmaceutical_staff SET role = 'RT_SUBSTITUTO' WHERE id = ?
        `).run(existingRt.id);
      }
    }

    const stmt = this.db.prepare(`
      INSERT INTO pharmaceutical_staff (
        store_id, name, cpf, crf_number, crf_uf, role, phone, email, crt_certificate_number, crt_validity_date, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const result = stmt.run(
      dto.store_id,
      dto.name.trim(),
      dto.cpf.trim(),
      dto.crf_number.trim(),
      dto.crf_uf.trim().toUpperCase(),
      dto.role,
      dto.phone || null,
      dto.email || null,
      dto.crt_certificate_number || null,
      dto.crt_validity_date || null
    );

    return this.getStaffById(Number(result.lastInsertRowid))!;
  }

  public getStaffById(id: number): PharmaceuticalStaff | null {
    const row = this.db.prepare(`SELECT * FROM pharmaceutical_staff WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      ...row,
      is_active: Number(row.is_active),
    };
  }

  public listStaff(storeId: number): PharmaceuticalStaff[] {
    const rows = this.db.prepare(`
      SELECT * FROM pharmaceutical_staff
      WHERE store_id = ?
      ORDER BY role = 'RT_TITULAR' DESC, is_active DESC, name ASC
    `).all(storeId) as any[];

    return rows.map((r) => ({
      ...r,
      is_active: Number(r.is_active),
    }));
  }

  public setShifts(
    storeId: number,
    staffId: number,
    shifts: Array<{ day_of_week: number; start_time: string; end_time: string }>
  ): PharmaceuticalShift[] {
    const deleteTx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM pharmaceutical_shifts WHERE store_id = ? AND staff_id = ?`).run(storeId, staffId);

      const insertStmt = this.db.prepare(`
        INSERT INTO pharmaceutical_shifts (store_id, staff_id, day_of_week, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `);

      for (const s of shifts) {
        insertStmt.run(storeId, staffId, s.day_of_week, s.start_time, s.end_time);
      }
    });

    deleteTx();

    return this.db.prepare(`
      SELECT * FROM pharmaceutical_shifts
      WHERE store_id = ? AND staff_id = ?
      ORDER BY day_of_week ASC, start_time ASC
    `).all(storeId, staffId) as PharmaceuticalShift[];
  }

  public listShifts(storeId: number): Array<PharmaceuticalShift & { staff_name: string; crf: string }> {
    return this.db.prepare(`
      SELECT s.*, p.name as staff_name, (p.crf_number || '/' || p.crf_uf) as crf
      FROM pharmaceutical_shifts s
      JOIN pharmaceutical_staff p ON s.staff_id = p.id
      WHERE s.store_id = ? AND s.is_active = 1
      ORDER BY s.day_of_week ASC, s.start_time ASC
    `).all(storeId) as any[];
  }

  public recordLogbookEntry(dto: CreateLogbookEntryDTO): PharmaceuticalLogbookEntry {
    const entryDate = dto.entry_date || new Date().toISOString().replace('T', ' ').substring(0, 19);

    const canonicalData = `${dto.store_id}|${dto.staff_id}|${dto.entry_type}|${dto.title.trim()}|${entryDate}`;
    const hash = crypto.createHash('sha256').update(canonicalData, 'utf8').digest('hex');

    const stmt = this.db.prepare(`
      INSERT INTO pharmaceutical_logbook_entries (
        store_id, staff_id, entry_type, title, description,
        crf_inspector_name, crf_inspection_term_number, action_taken, entry_date, sha256_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      dto.store_id,
      dto.staff_id,
      dto.entry_type,
      dto.title.trim(),
      dto.description.trim(),
      dto.crf_inspector_name?.trim() || null,
      dto.crf_inspection_term_number?.trim() || null,
      dto.action_taken?.trim() || null,
      entryDate,
      hash
    );

    return this.getLogbookEntryById(Number(result.lastInsertRowid))!;
  }

  public getLogbookEntryById(id: number): PharmaceuticalLogbookEntry | null {
    const row = this.db.prepare(`SELECT * FROM pharmaceutical_logbook_entries WHERE id = ?`).get(id) as any;
    return row || null;
  }

  public listLogbookEntries(storeId: number, limit = 50): Array<PharmaceuticalLogbookEntry & { staff_name: string; crf: string }> {
    return this.db.prepare(`
      SELECT e.*, p.name as staff_name, (p.crf_number || '/' || p.crf_uf) as crf
      FROM pharmaceutical_logbook_entries e
      JOIN pharmaceutical_staff p ON e.staff_id = p.id
      WHERE e.store_id = ?
      ORDER BY e.entry_date DESC, e.id DESC
      LIMIT ?
    `).all(storeId, limit) as any[];
  }

  public generateLogbookExtract(storeId: number, startDate?: string, endDate?: string): {
    store: any;
    rtStaff: PharmaceuticalStaff | null;
    entries: any[];
    generatedAt: string;
    totalEntries: number;
    extractHash: string;
  } {
    const store = this.db.prepare(`SELECT id, name, cnpj FROM stores WHERE id = ?`).get(storeId) as any;
    const rtStaff = this.db.prepare(`
      SELECT * FROM pharmaceutical_staff
      WHERE store_id = ? AND role = 'RT_TITULAR' AND is_active = 1
    `).get(storeId) as PharmaceuticalStaff | undefined;

    let query = `
      SELECT e.*, p.name as staff_name, (p.crf_number || '/' || p.crf_uf) as crf
      FROM pharmaceutical_logbook_entries e
      JOIN pharmaceutical_staff p ON e.staff_id = p.id
      WHERE e.store_id = ?
    `;
    const params: any[] = [storeId];

    if (startDate) {
      query += ` AND e.entry_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND e.entry_date <= ?`;
      params.push(endDate);
    }
    query += ` ORDER BY e.entry_date ASC, e.id ASC`;

    const entries = this.db.prepare(query).all(...params) as any[];
    const generatedAt = new Date().toISOString();

    const canonicalContent = `${storeId}|${generatedAt}|${entries.map((e) => e.sha256_hash).join(',')}`;
    const extractHash = crypto.createHash('sha256').update(canonicalContent, 'utf8').digest('hex');

    return {
      store: store || { id: storeId, name: 'Farmácia', cnpj: '' },
      rtStaff: rtStaff || null,
      entries,
      generatedAt,
      totalEntries: entries.length,
      extractHash,
    };
  }

  public getAssistanceKpis(storeId: number): AssistanceKpis {
    const activeStaff = this.db.prepare(`
      SELECT * FROM pharmaceutical_staff
      WHERE store_id = ? AND is_active = 1
    `).all(storeId) as PharmaceuticalStaff[];

    const rt = activeStaff.find((s) => s.role === 'RT_TITULAR');

    let crtDaysRemaining: number | undefined;
    if (rt?.crt_validity_date) {
      const validity = new Date(rt.crt_validity_date).getTime();
      const now = new Date().getTime();
      crtDaysRemaining = Math.ceil((validity - now) / (1000 * 60 * 60 * 24));
    }

    const shifts = this.db.prepare(`
      SELECT start_time, end_time FROM pharmaceutical_shifts
      WHERE store_id = ? AND is_active = 1
    `).all(storeId) as Array<{ start_time: string; end_time: string }>;

    let totalWeeklyHours = 0;
    for (const sh of shifts) {
      const [h1, m1] = sh.start_time.split(':').map(Number);
      const [h2, m2] = sh.end_time.split(':').map(Number);
      const duration = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
      if (duration > 0) totalWeeklyHours += duration;
    }

    const totalEntries = this.db.prepare(`
      SELECT COUNT(*) as count FROM pharmaceutical_logbook_entries WHERE store_id = ?
    `).get(storeId) as { count: number };

    const inspections = this.db.prepare(`
      SELECT COUNT(*) as count FROM pharmaceutical_logbook_entries
      WHERE store_id = ? AND entry_type IN ('INSPECTION_CRF', 'INSPECTION_VISA')
    `).get(storeId) as { count: number };

    return {
      totalActivePharmacists: activeStaff.length,
      hasActiveRT: !!rt,
      activeRtName: rt?.name,
      crtCertificateNumber: rt?.crt_certificate_number || undefined,
      crtValidityDate: rt?.crt_validity_date || undefined,
      crtDaysRemaining,
      totalWeeklyHoursCovered: Number(totalWeeklyHours.toFixed(1)),
      totalLogbookEntries: totalEntries?.count || 0,
      recentInspectionsCount: inspections?.count || 0,
    };
  }
}
