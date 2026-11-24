import { getDatabase, Database } from '../../database/connection';
import type {
  RegulatoryReport,
  RegulatoryReportItem,
  RegulatoryPrescriptionRel,
  RegulatoryReportDetails,
  GenerateBmpoInput,
  GenerateRmnrInput,
  FileWithVisaInput,
  RegulatoryKpis,
  RegulatoryReportType,
} from './bmpo.types';

export class BmpoService {
  private db: Database;

  constructor(db?: Database) {
    this.db = db || getDatabase();
  }

  /**
   * Determina intervalo de datas (YYYY-MM-DD) para trimestres ou ano
   */
  private getPeriodDates(year: number, quarter?: number, month?: number): { startDate: string; endDate: string } {
    if (month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { startDate: start, endDate: end };
    }

    if (quarter) {
      switch (quarter) {
        case 1:
          return { startDate: `${year}-01-01`, endDate: `${year}-03-31` };
        case 2:
          return { startDate: `${year}-04-01`, endDate: `${year}-06-30` };
        case 3:
          return { startDate: `${year}-07-01`, endDate: `${year}-09-30` };
        case 4:
        default:
          return { startDate: `${year}-10-01`, endDate: `${year}-12-31` };
      }
    }

    // Ano inteiro
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  }

  /**
   * Gera o Balanço de Medicamentos Psicotrópicos e Outros (BMPO Trimestral ou Anual)
   */
  generateBmpo(input: GenerateBmpoInput): RegulatoryReportDetails {
    const storeId = input.store_id || 1;
    const { startDate, endDate } = this.getPeriodDates(input.period_year, input.period_quarter);

    const reportRes = this.db.prepare(`
      INSERT INTO regulatory_reports (
        store_id, report_type, period_year, period_quarter, pharmacist_name, pharmacist_crf, status, observations
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
    `).run(
      storeId,
      input.report_type,
      input.period_year,
      input.period_quarter || null,
      input.pharmacist_name,
      input.pharmacist_crf,
      input.observations || null
    );

    const reportId = Number(reportRes.lastInsertRowid);

    // Busca produtos controlados cadastrados
    const controlledProducts = this.db.prepare(`
      SELECT id, name, active_ingredient, control_type, ms_registration
      FROM products
      WHERE control_type IS NOT NULL AND control_type != 'NONE'
      ORDER BY control_type ASC, name ASC
    `).all() as Array<{
      id: number;
      name: string;
      active_ingredient: string;
      control_type: string;
      ms_registration?: string;
    }>;

    const reportItems: RegulatoryReportItem[] = [];

    for (const prod of controlledProducts) {
      // 1. Entradas (Compras / XML NF-e) no período
      const acquisitionsRow = this.db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM sngpc_movements
        WHERE product_id = ? AND movement_type = 'ENTRADA'
          AND movement_date >= ? AND movement_date <= ?
      `).get(prod.id, startDate, endDate) as { total: number };
      const acquisitions = acquisitionsRow?.total || 0;

      // 2. Saídas (Vendas no Balcão com Receita) no período
      const salesRow = this.db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM sngpc_movements
        WHERE product_id = ? AND movement_type IN ('SAIDA', 'SAIDA_VENDA')
          AND movement_date >= ? AND movement_date <= ?
      `).get(prod.id, startDate, endDate) as { total: number };
      const sales = salesRow?.total || 0;

      // 3. Perdas / Descarte PGRSS / Avarias no período
      const lossesRow = this.db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM sngpc_movements
        WHERE product_id = ? AND movement_type = 'PERDA'
          AND movement_date >= ? AND movement_date <= ?
      `).get(prod.id, startDate, endDate) as { total: number };
      const losses = lossesRow?.total || 0;

      // 4. Saldo atual em estoque físico (tabela batches)
      const currentStockRow = this.db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM batches
        WHERE product_id = ?
      `).get(prod.id) as { total: number };
      const currentStock = currentStockRow?.total || 0;

      // Saldo Inicial = Estoque Atual - Entradas no período + Saídas + Perdas
      // Se não houver movimentações, inicial_stock = current_stock
      const initialStock = Math.max(0, currentStock - acquisitions + sales + losses);
      const finalStock = initialStock + acquisitions - sales - losses;

      // Registra o item do balanço
      const itemInsert = this.db.prepare(`
        INSERT INTO regulatory_report_items (
          report_id, product_id, active_ingredient, therapeutic_class, control_list, presentation, unit_measure, initial_stock, acquisitions, sales, losses, final_stock
        ) VALUES (?, ?, ?, ?, ?, ?, 'CX', ?, ?, ?, ?, ?)
      `).run(
        reportId,
        prod.id,
        prod.active_ingredient || prod.name,
        'Psicotrópico / Controlado Portaria 344',
        prod.control_type,
        prod.name,
        initialStock,
        acquisitions,
        sales,
        losses,
        finalStock
      );

      reportItems.push({
        id: Number(itemInsert.lastInsertRowid),
        report_id: reportId,
        product_id: prod.id,
        product_name: prod.name,
        active_ingredient: prod.active_ingredient || prod.name,
        therapeutic_class: 'Psicotrópico / Controlado Portaria 344',
        control_list: prod.control_type,
        presentation: prod.name,
        unit_measure: 'CX',
        initial_stock: initialStock,
        acquisitions,
        sales,
        losses,
        final_stock: finalStock,
      });
    }

    return this.getReportById(reportId)!;
  }

  /**
   * Gera a Relação Mensal de Notificações de Receita (RMNRA ou RMNRB)
   */
  generateRmnr(input: GenerateRmnrInput): RegulatoryReportDetails {
    const storeId = input.store_id || 1;
    const { startDate, endDate } = this.getPeriodDates(input.period_year, undefined, input.period_month);

    const reportRes = this.db.prepare(`
      INSERT INTO regulatory_reports (
        store_id, report_type, period_year, period_month, pharmacist_name, pharmacist_crf, status, observations
      ) VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
    `).run(
      storeId,
      input.report_type,
      input.period_year,
      input.period_month,
      input.pharmacist_name,
      input.pharmacist_crf,
      input.observations || null
    );

    const reportId = Number(reportRes.lastInsertRowid);

    // Tipos de receitas a filtrar:
    // RMNRA: 'A' (Notificação de Receita A - Amarela)
    // RMNRB: 'B' ou 'B2' (Notificação de Receita B - Azul)
    const targetType = input.report_type === 'RMNRA' ? 'A' : 'B';

    const prescriptions = this.db.prepare(`
      SELECT 
        p.id as prescription_id,
        p.pre_sale_id,
        p.doctor_name,
        p.doctor_crm,
        p.doctor_uf,
        p.prescription_type,
        p.prescription_date,
        p.patient_name,
        p.buyer_name,
        p.buyer_cpf,
        p.notification_number,
        psi.product_id,
        psi.quantity,
        b.batch_number,
        prod.name as product_name
      FROM prescriptions p
      JOIN pre_sales ps ON p.pre_sale_id = ps.id
      JOIN pre_sale_items psi ON ps.id = psi.pre_sale_id
      JOIN products prod ON psi.product_id = prod.id
      LEFT JOIN batches b ON psi.batch_id = b.id
      WHERE (p.prescription_type = ? OR (? = 'B' AND p.prescription_type = 'B2'))
        AND p.prescription_date >= ? AND p.prescription_date <= ?
      ORDER BY p.prescription_date ASC, p.id ASC
    `).all(targetType, targetType, startDate, endDate) as Array<{
      prescription_id: number;
      pre_sale_id: number;
      doctor_name: string;
      doctor_crm: string;
      doctor_uf: string;
      prescription_type: string;
      prescription_date: string;
      patient_name: string;
      buyer_name?: string;
      buyer_cpf?: string;
      notification_number?: string;
      product_id: number;
      quantity: number;
      batch_number?: string;
      product_name: string;
    }>;

    for (const pr of prescriptions) {
      this.db.prepare(`
        INSERT INTO regulatory_prescriptions_rel (
          report_id, sale_id, product_id, prescription_notification_number, notification_type,
          dispensation_date, prescriber_name, prescriber_register_number, prescriber_uf,
          patient_name, buyer_name, buyer_document, quantity_dispensed, batch_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        reportId,
        pr.pre_sale_id,
        pr.product_id,
        pr.notification_number || `NOTIF-${pr.prescription_type}-${pr.prescription_id}`,
        pr.prescription_type,
        pr.prescription_date,
        pr.doctor_name,
        pr.doctor_crm,
        pr.doctor_uf,
        pr.patient_name,
        pr.buyer_name || pr.patient_name,
        pr.buyer_cpf || '000.000.000-00',
        pr.quantity,
        pr.batch_number || 'L-PADRAO'
      );
    }

    return this.getReportById(reportId)!;
  }

  /**
   * Protocolo de Entrega Oficial na Vigilância Sanitária (VISA)
   */
  fileReportWithVisa(input: FileWithVisaInput): RegulatoryReportDetails {
    const report = this.getReportById(input.report_id);
    if (!report) {
      throw new Error(`Relatório ID ${input.report_id} não encontrado.`);
    }

    this.db.prepare(`
      UPDATE regulatory_reports
      SET status = 'FILED_WITH_VISA',
          visa_protocol_number = ?,
          visa_filing_date = ?,
          observations = COALESCE(?, observations),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.visa_protocol_number,
      input.visa_filing_date,
      input.observations || null,
      input.report_id
    );

    return this.getReportById(input.report_id)!;
  }

  /**
   * Busca relatório por ID com itens e prescrições
   */
  getReportById(id: number): RegulatoryReportDetails | null {
    const report = this.db.prepare(`
      SELECT * FROM regulatory_reports WHERE id = ?
    `).get(id) as RegulatoryReport | undefined;

    if (!report) return null;

    const items = this.db.prepare(`
      SELECT rri.*, p.name as product_name
      FROM regulatory_report_items rri
      JOIN products p ON rri.product_id = p.id
      WHERE rri.report_id = ?
      ORDER BY rri.control_list ASC, p.name ASC
    `).all(id) as RegulatoryReportItem[];

    const prescriptions = this.db.prepare(`
      SELECT rpr.*, p.name as product_name
      FROM regulatory_prescriptions_rel rpr
      JOIN products p ON rpr.product_id = p.id
      WHERE rpr.report_id = ?
      ORDER BY rpr.dispensation_date ASC, rpr.id ASC
    `).all(id) as RegulatoryPrescriptionRel[];

    return {
      ...report,
      items,
      prescriptions,
    };
  }

  /**
   * Lista relatórios gerados
   */
  listReports(storeId: number = 1, reportType?: RegulatoryReportType): RegulatoryReport[] {
    let sql = 'SELECT * FROM regulatory_reports WHERE store_id = ?';
    const params: any[] = [storeId];

    if (reportType) {
      sql += ' AND report_type = ?';
      params.push(reportType);
    }

    sql += ' ORDER BY period_year DESC, COALESCE(period_quarter, period_month, 0) DESC, id DESC';

    return this.db.prepare(sql).all(...params) as RegulatoryReport[];
  }

  /**
   * Exclusão de rascunhos de relatórios
   */
  deleteReport(id: number): void {
    const report = this.getReportById(id);
    if (!report) {
      throw new Error(`Relatório ID ${id} não encontrado.`);
    }

    if (report.status === 'FILED_WITH_VISA') {
      throw new Error('CANNOT_DELETE_FILED_REPORT: Relatório já protocolado junto à Vigilância Sanitária não pode ser excluído.');
    }

    this.db.prepare('DELETE FROM regulatory_reports WHERE id = ?').run(id);
  }

  /**
   * KPIs regulatórios para o painel
   */
  getRegulatoryKpis(storeId: number = 1): RegulatoryKpis {
    const totalReports = (this.db.prepare(`
      SELECT COUNT(*) as count FROM regulatory_reports WHERE store_id = ?
    `).get(storeId) as { count: number }).count;

    const filedReports = (this.db.prepare(`
      SELECT COUNT(*) as count FROM regulatory_reports WHERE store_id = ? AND status = 'FILED_WITH_VISA'
    `).get(storeId) as { count: number }).count;

    const pendingFilings = (this.db.prepare(`
      SELECT COUNT(*) as count FROM regulatory_reports WHERE store_id = ? AND status != 'FILED_WITH_VISA'
    `).get(storeId) as { count: number }).count;

    const rmnraCount = (this.db.prepare(`
      SELECT COUNT(*) as count FROM regulatory_reports WHERE store_id = ? AND report_type = 'RMNRA'
    `).get(storeId) as { count: number }).count;

    const rmnrbCount = (this.db.prepare(`
      SELECT COUNT(*) as count FROM regulatory_reports WHERE store_id = ? AND report_type = 'RMNRB'
    `).get(storeId) as { count: number }).count;

    return {
      total_reports: totalReports,
      filed_reports: filedReports,
      pending_filings: pendingFilings,
      rmnra_count: rmnraCount,
      rmnrb_count: rmnrbCount,
    };
  }

  /**
   * Gera documento oficial formatado para impressão padrão A4
   */
  generateOfficialPrintDocument(id: number): string {
    const report = this.getReportById(id);
    if (!report) {
      throw new Error(`Relatório ID ${id} não encontrado.`);
    }

    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(report.store_id) as any || {
      name: 'FarmaCore Matriz',
      cnpj: '12.345.678/0001-90',
      address: 'Av. Brasil, 1500',
    };

    const periodLabel = report.period_quarter
      ? `${report.period_quarter}º Trimestre de ${report.period_year}`
      : report.period_month
      ? `Mês ${String(report.period_month).padStart(2, '0')}/${report.period_year}`
      : `Exercício Anual de ${report.period_year}`;

    const lines: string[] = [
      '========================================================================================',
      '                     REPÚBLICA FEDERATIVA DO BRASIL                                    ',
      '              MINISTÉRIO DA SAÚDE — AGÊNCIA NACIONAL DE VIGILÂNCIA SANITÁRIA           ',
      '                        PORTARIA SVS/MS Nº 344/1998 E RDC Nº 22/2014                   ',
      '========================================================================================',
      `DOCUMENTO: ${report.report_type} — ${periodLabel}`,
      `ESTABELECIMENTO: ${store.name || 'FarmaCore Drogaria'} | CNPJ: ${store.cnpj || '00.000.000/0001-00'}`,
      `RESPONSÁVEL TÉCNICO: ${report.pharmacist_name} | ${report.pharmacist_crf}`,
      `STATUS: ${report.status} ${report.visa_protocol_number ? `| PROTOCOLO VISA: ${report.visa_protocol_number}` : ''}`,
      '----------------------------------------------------------------------------------------',
    ];

    if (report.report_type.startsWith('BMPO')) {
      lines.push('DEMONSTRATIVO DE MOVIMENTAÇÃO DE ESTOQUE DE SUBSTÂNCIAS E MEDICAMENTOS:');
      lines.push('SUBSTÂNCIA / PRODUTO               | LISTA | INICIAL | ENTRADAS | SAÍDAS | PERDAS | FINAL');
      lines.push('----------------------------------------------------------------------------------------');
      for (const it of report.items) {
        const nameCol = (it.active_ingredient || it.product_name || '').substring(0, 32).padEnd(34, ' ');
        const listCol = (it.control_list || '').padEnd(5, ' ');
        const iniCol = String(it.initial_stock).padStart(7, ' ');
        const acqCol = String(it.acquisitions).padStart(8, ' ');
        const salCol = String(it.sales).padStart(6, ' ');
        const losCol = String(it.losses).padStart(6, ' ');
        const finCol = String(it.final_stock).padStart(6, ' ');
        lines.push(`${nameCol} | ${listCol} | ${iniCol} | ${acqCol} | ${salCol} | ${losCol} | ${finCol}`);
      }
    } else {
      lines.push('RELAÇÃO NOMINAL DE NOTIFICAÇÕES DE RECEITAS RETIDAS NO PERÍODO:');
      lines.push('Nº NOTIFICAÇÃO   | DATA       | MÉDICO (CRM/UF)          | PACIENTE             | QTD');
      lines.push('----------------------------------------------------------------------------------------');
      for (const pr of report.prescriptions) {
        const notifCol = pr.prescription_notification_number.substring(0, 16).padEnd(16, ' ');
        const dateCol = pr.dispensation_date.substring(0, 10).padEnd(10, ' ');
        const docCol = `${pr.prescriber_name} (${pr.prescriber_register_number}/${pr.prescriber_uf})`.substring(0, 24).padEnd(24, ' ');
        const patCol = pr.patient_name.substring(0, 20).padEnd(20, ' ');
        const qtdCol = String(pr.quantity_dispensed).padStart(4, ' ');
        lines.push(`${notifCol} | ${dateCol} | ${docCol} | ${patCol} | ${qtdCol}`);
      }
    }

    lines.push('========================================================================================');
    lines.push('TERMO DE RESPONSABILIDADE E ENCERRAMENTO:');
    lines.push('Declaramos sob as penas da lei que as informações prestadas neste relatório conferem');
    lines.push('fielmente com os livros de registro e arquivos físicos de receituários do estabelecimento.');
    lines.push('');
    lines.push('__________________________________________         __________________________________________');
    lines.push(`       ${report.pharmacist_name}                            Representante Legal do Estabelecimento   `);
    lines.push(`           ${report.pharmacist_crf}                                        CNPJ: ${store.cnpj || ''}        `);
    lines.push('========================================================================================');

    return lines.join('\n');
  }
}
