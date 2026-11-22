import { Database } from '../../database/connection';
import type { SpedGenerationParams, SpedGenerationRecord, InventoryItemBlockH } from './sped.types';

export class SintegraService {
  constructor(private db: Database) {}

  private padRight(value: string | null | undefined, length: number): string {
    const str = (value || '').toUpperCase();
    return str.slice(0, length).padEnd(length, ' ');
  }

  private padZeros(value: number | string | null | undefined, length: number): string {
    const numStr = String(value || 0).replace(/\D/g, '');
    return numStr.slice(0, length).padStart(length, '0');
  }

  private padAmount(amount: number, length: number, decimals: number = 2): string {
    const fixed = Math.round(amount * Math.pow(10, decimals));
    return String(fixed).padStart(length, '0').slice(-length);
  }

  private formatDateSintegra(dateStr: string): string {
    // Recebe YYYY-MM-DD e retorna AAAAMMDD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[0]}${parts[1]}${parts[2]}`;
    }
    return dateStr.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  }

  public async generateSintegra(params: SpedGenerationParams): Promise<SpedGenerationRecord> {
    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(params.storeId) as any;
    const fiscalProfile = this.db.prepare('SELECT * FROM fiscal_profiles LIMIT 1').get() as any;

    const cnpj = (fiscalProfile?.cnpj || store?.cnpj || '00000000000100').replace(/\D/g, '');
    const ie = (fiscalProfile?.ie || store?.ie || 'ISENTO').replace(/\D/g, '');
    const companyName = fiscalProfile?.razao_social || store?.company_name || 'DROGARIA FARMACORE LTDA';
    const city = fiscalProfile?.municipio || store?.city || 'SAO PAULO';
    const state = fiscalProfile?.uf || store?.state || 'SP';
    const phone = (store?.phone || '11999998888').replace(/\D/g, '');
    const address = fiscalProfile?.logradouro || store?.street || 'RUA PRINCIPAL';
    const addressNum = fiscalProfile?.numero || store?.number || '100';
    const neighborhood = fiscalProfile?.bairro || store?.neighborhood || 'CENTRO';
    const zipCode = (fiscalProfile?.cep || store?.zip_code || '01001000').replace(/\D/g, '');

    const dtIni = this.formatDateSintegra(params.periodStart);
    const dtFin = this.formatDateSintegra(params.periodEnd);
    const purpose = params.purpose === 1 ? '2' : '1'; // 1 = Normal, 2 = Retificação total

    const lines: string[] = [];
    const recordCounters: Record<string, number> = {
      '10': 0,
      '11': 0,
      '50': 0,
      '54': 0,
      '60': 0,
      '74': 0,
      '90': 0
    };

    const addLine = (type: string, content: string) => {
      // Garante exatos 126 caracteres
      const fixedLine = content.slice(0, 126).padEnd(126, ' ');
      lines.push(fixedLine);
      recordCounters[type] = (recordCounters[type] || 0) + 1;
    };

    // ==========================================
    // REGISTRO 10: Mestre do Estabelecimento
    // ==========================================
    const r10 =
      '10' +
      this.padZeros(cnpj, 14) +
      this.padRight(ie, 14) +
      this.padRight(companyName, 35) +
      this.padRight(city, 30) +
      this.padRight(state, 2) +
      this.padZeros(phone, 10) +
      dtIni +
      dtFin +
      '3' + // Estrutura 3 (Convênio 57/95 com alt. 76/03)
      '3' + // Totalidade das operações
      purpose;
    addLine('10', r10);

    // ==========================================
    // REGISTRO 11: Dados Complementares
    // ==========================================
    const r11 =
      '11' +
      this.padRight(address, 34) +
      this.padZeros(addressNum, 5) +
      this.padRight('SALA 1', 22) +
      this.padRight(neighborhood, 15) +
      this.padZeros(zipCode, 8) +
      this.padRight(companyName, 28) +
      this.padZeros(phone, 12);
    addLine('11', r11);

    // ==========================================
    // REGISTRO 50 & 54: Notas Fiscais de Compra (Modelo 55)
    // ==========================================
    const purchases = this.db
      .prepare(`
        SELECT id, supplier_cnpj, supplier_ie, invoice_number, invoice_series,
               issue_date, total_invoice_amount, total_products_amount, created_at
        FROM purchase_invoices
        ORDER BY id ASC
      `)
      .all() as any[];

    let totalDocs = 0;
    let totalIcmsDebit = 0;
    let totalIcmsCredit = 0;
    let totalIcmsSt = 0;

    for (const inv of purchases) {
      totalDocs++;
      const pCnpj = (inv.supplier_cnpj || '').replace(/\D/g, '');
      const pIe = (inv.supplier_ie || 'ISENTO').replace(/\D/g, '');
      const invDate = this.formatDateSintegra((inv.issue_date || inv.created_at || params.periodStart).substring(0, 10));
      const nNf = inv.invoice_number || inv.id;
      const serie = String(inv.invoice_series || 1).padStart(3, '0');
      const invTotal = Number(inv.total_invoice_amount) || 0;

      // Registro 50 (Capa da NF)
      const r50 =
        '50' +
        this.padZeros(pCnpj, 14) +
        this.padRight(pIe, 14) +
        invDate +
        this.padRight(state, 2) +
        '55' +
        this.padRight(serie, 3) +
        this.padZeros(nNf, 6) +
        '1403' + // CFOP Compra ST
        'T' + // Terceiros
        this.padAmount(invTotal, 13, 2) +
        this.padAmount(0, 13, 2) + // Base ICMS (ST Isento na entrada)
        this.padAmount(0, 13, 2) + // Valor ICMS
        this.padAmount(invTotal, 13, 2) + // Isentas / Não tributadas
        this.padAmount(0, 13, 2) + // Outras
        '0000' + // Alíquota 0.00%
        'N';
      addLine('50', r50);

      // Itens da compra (Registro 54)
      const items = this.db
        .prepare('SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id = ? ORDER BY item_index ASC')
        .all(inv.id) as any[];

      for (const it of items) {
        const itemIdx = this.padZeros(it.item_index || 1, 3);
        const itemEan = this.padRight(it.ean || `PRD-${it.product_id}`, 14);
        const itemQty = Number(it.quantity) || 1;
        const itemTotal = Number(it.total_cost) || 0;

        const r54 =
          '54' +
          this.padZeros(pCnpj, 14) +
          '55' +
          this.padRight(serie, 3) +
          this.padZeros(nNf, 6) +
          '1403' +
          '060' + // CST 060 ICMS-ST
          itemIdx +
          itemEan +
          this.padAmount(itemQty, 11, 3) +
          this.padAmount(itemTotal, 12, 2) +
          this.padAmount(0, 12, 2) + // Desconto
          this.padAmount(0, 12, 2) + // Base ICMS
          this.padAmount(0, 12, 2) + // Base ICMS-ST
          this.padAmount(0, 12, 2) + // Valor IPI
          '0000'; // Alíquota
        addLine('54', r54);
      }
    }

    // ==========================================
    // REGISTRO 60M & 60A: Resumo Diário NFC-e (Modelo 65)
    // ==========================================
    const salesDaily = this.db
      .prepare(`
        SELECT 
          substr(s.created_at, 1, 10) as sale_date,
          COUNT(s.id) as doc_count,
          SUM(s.total_amount - s.discount_amount) as daily_total,
          MIN(fi.n_nf) as min_doc,
          MAX(fi.n_nf) as max_doc
        FROM sales s
        LEFT JOIN nfce_invoices fi ON fi.sale_id = s.id AND fi.status = 'AUTORIZADA'
        WHERE s.status = 'COMPLETED'
        GROUP BY sale_date
        ORDER BY sale_date ASC
      `)
      .all() as any[];

    for (const d of salesDaily) {
      totalDocs += Number(d.doc_count) || 0;
      const dDate = this.formatDateSintegra(d.sale_date);
      const dTotal = Number(d.daily_total) || 0;
      const minDoc = d.min_doc || 1;
      const maxDoc = d.max_doc || d.doc_count;

      // 60M (Mestre da Redução Diária NFC-e)
      const r60M =
        '60M' +
        dDate +
        this.padRight('NFCE-PDV-01', 20) + // Série equipamento
        '001' + // Ordem
        '65' + // Modelo 65
        this.padZeros(minDoc, 6) +
        this.padZeros(maxDoc, 6) +
        this.padZeros(1, 6) + // CRZ
        this.padZeros(1, 6) + // CRO
        this.padAmount(dTotal, 16, 2) +
        this.padAmount(dTotal, 16, 2) +
        ''.padEnd(30, ' ');
      addLine('60', r60M);

      // 60A (Analítico da Redução Diária: F1 = Substituição Tributária Farmácia)
      const r60A =
        '60A' +
        dDate +
        this.padRight('NFCE-PDV-01', 20) +
        'F1  ' + // F1 = ICMS Substituição Tributária Farmácia
        this.padAmount(dTotal, 12, 2) +
        ''.padEnd(79, ' ');
      addLine('60', r60A);
    }

    // ==========================================
    // REGISTRO 74: Inventário de Estoque
    // ==========================================
    let totalInvVal = 0;
    if (params.includeInventory) {
      const invDate = this.formatDateSintegra(params.inventoryDate || params.periodEnd);
      const items = this.db
        .prepare(`
          SELECT 
            p.id,
            p.ean,
            p.name,
            COALESCE(SUM(b.quantity), 0) as quantity,
            COALESCE(
              (SELECT pii.unit_cost FROM purchase_invoice_items pii WHERE pii.product_id = p.id ORDER BY pii.id DESC LIMIT 1),
              p.pf,
              p.price * 0.6
            ) as unit_cost
          FROM products p
          LEFT JOIN batches b ON b.product_id = p.id AND b.store_id = ?
          GROUP BY p.id
          HAVING quantity > 0
          ORDER BY p.name ASC
        `)
        .all(params.storeId) as any[];

      for (const it of items) {
        const itQty = Number(it.quantity) || 0;
        const itCost = Number(it.unit_cost) || 0;
        const itTotal = Number((itQty * itCost).toFixed(2));
        totalInvVal += itTotal;

        const r74 =
          '74' +
          invDate +
          this.padRight(it.ean || `PRD-${it.id}`, 14) +
          this.padAmount(itQty, 13, 3) +
          this.padAmount(itTotal, 13, 2) +
          '1' + // Código de Posse: 1 = Mercadoria do informante em seu poder
          this.padZeros(0, 14) +
          ''.padEnd(14, ' ') +
          ''.padEnd(2, ' ') +
          ''.padEnd(45, ' ');
        addLine('74', r74);
      }
    }

    // ==========================================
    // REGISTRO 90: Totalização do Arquivo
    // ==========================================
    // 90 conta os registros 50, 54, 60, 74 e ele mesmo
    recordCounters['90'] = 1;
    let r90 =
      '90' +
      this.padZeros(cnpj, 14) +
      this.padRight(ie, 14) +
      '50' +
      this.padZeros(recordCounters['50'], 8) +
      '54' +
      this.padZeros(recordCounters['54'], 8) +
      '60' +
      this.padZeros(recordCounters['60'], 8);

    if (recordCounters['74'] > 0) {
      r90 += '74' + this.padZeros(recordCounters['74'], 8);
    }
    r90 += '99' + this.padZeros(lines.length + 1, 8) + '1';
    addLine('90', r90);

    const fileContent = lines.join('\r\n') + '\r\n';
    const fileName = `SINTEGRA_${cnpj}_${params.periodStart.replace(/-/g, '')}_${params.periodEnd.replace(/-/g, '')}.txt`;

    const totalLines = lines.length;
    const insertResult = this.db
      .prepare(`
        INSERT INTO sped_generations (
          store_id, generation_type, period_start, period_end, purpose,
          file_name, file_content, total_lines, total_documents,
          total_icms_debit, total_icms_credit, total_icms_st,
          inventory_date, total_inventory_value, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        params.storeId,
        'SINTEGRA',
        params.periodStart,
        params.periodEnd,
        params.purpose ?? 0,
        fileName,
        fileContent,
        totalLines,
        totalDocs,
        totalIcmsDebit,
        totalIcmsCredit,
        totalIcmsSt,
        params.includeInventory ? params.inventoryDate || params.periodEnd : null,
        totalInvVal,
        'GENERATED',
        params.notes || null
      );

    return {
      id: Number(insertResult.lastInsertRowid),
      storeId: params.storeId,
      generationType: 'SINTEGRA',
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      purpose: (params.purpose ?? 0) as 0 | 1,
      fileName,
      fileContent,
      totalLines,
      totalDocuments: totalDocs,
      totalIcmsDebit,
      totalIcmsCredit,
      totalIcmsSt,
      inventoryDate: params.includeInventory ? params.inventoryDate || params.periodEnd : null,
      totalInventoryValue: totalInvVal,
      status: 'GENERATED',
      notes: params.notes || null,
      createdAt: new Date().toISOString()
    };
  }
}
