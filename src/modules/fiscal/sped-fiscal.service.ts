import { Database } from '../../database/connection';
import type {
  AccountingParameters,
  SpedGenerationParams,
  SpedGenerationRecord,
  InventoryItemBlockH
} from './sped.types';

export class SpedFiscalService {
  constructor(private db: Database) {}

  public setAccountingParameters(params: AccountingParameters): AccountingParameters {
    const existing = this.db
      .prepare('SELECT id FROM accounting_parameters WHERE store_id = ?')
      .get(params.storeId) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(`
          UPDATE accounting_parameters SET
            accountant_name = ?,
            accountant_cpf = ?,
            accountant_crc = ?,
            accountant_cnpj = ?,
            accountant_email = ?,
            accountant_phone = ?,
            accountant_cep = ?,
            accountant_address = ?,
            accountant_city_code = ?,
            sped_profile = ?,
            sped_version = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE store_id = ?
        `)
        .run(
          params.accountantName,
          params.accountantCpf.replace(/\D/g, ''),
          params.accountantCrc,
          params.accountantCnpj ? params.accountantCnpj.replace(/\D/g, '') : null,
          params.accountantEmail || null,
          params.accountantPhone || null,
          params.accountantCep ? params.accountantCep.replace(/\D/g, '') : null,
          params.accountantAddress || null,
          params.accountantCityCode || null,
          params.spedProfile || 'A',
          params.spedVersion || '018',
          params.storeId
        );
      return { ...params, id: existing.id };
    } else {
      const result = this.db
        .prepare(`
          INSERT INTO accounting_parameters (
            store_id, accountant_name, accountant_cpf, accountant_crc,
            accountant_cnpj, accountant_email, accountant_phone,
            accountant_cep, accountant_address, accountant_city_code,
            sped_profile, sped_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          params.storeId,
          params.accountantName,
          params.accountantCpf.replace(/\D/g, ''),
          params.accountantCrc,
          params.accountantCnpj ? params.accountantCnpj.replace(/\D/g, '') : null,
          params.accountantEmail || null,
          params.accountantPhone || null,
          params.accountantCep ? params.accountantCep.replace(/\D/g, '') : null,
          params.accountantAddress || null,
          params.accountantCityCode || null,
          params.spedProfile || 'A',
          params.spedVersion || '018'
        );
      return { ...params, id: Number(result.lastInsertRowid) };
    }
  }

  public getAccountingParameters(storeId: number): AccountingParameters | null {
    const row = this.db
      .prepare('SELECT * FROM accounting_parameters WHERE store_id = ?')
      .get(storeId) as any;

    if (!row) return null;
    return {
      id: row.id,
      storeId: row.store_id,
      accountantName: row.accountant_name,
      accountantCpf: row.accountant_cpf,
      accountantCrc: row.accountant_crc,
      accountantCnpj: row.accountant_cnpj,
      accountantEmail: row.accountant_email,
      accountantPhone: row.accountant_phone,
      accountantCep: row.accountant_cep,
      accountantAddress: row.accountant_address,
      accountantCityCode: row.accountant_city_code,
      spedProfile: row.sped_profile,
      spedVersion: row.sped_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public getInventoryBlockH(storeId: number, inventoryDate?: string): InventoryItemBlockH[] {
    // Busca produtos que possuem saldo positivo em estoque
    const items = this.db
      .prepare(`
        SELECT 
          p.id as product_id,
          p.name as description,
          p.ean as ean,
          p.ncm,
          p.cest,
          COALESCE(SUM(b.quantity), 0) as quantity,
          COALESCE(
            (SELECT pii.unit_cost FROM purchase_invoice_items pii WHERE pii.product_id = p.id ORDER BY pii.id DESC LIMIT 1),
            p.pf,
            p.price * 0.6
          ) as average_cost
        FROM products p
        LEFT JOIN batches b ON b.product_id = p.id AND b.store_id = ?
        GROUP BY p.id
        HAVING quantity > 0
        ORDER BY p.name ASC
      `)
      .all(storeId) as any[];

    return items.map((it) => {
      const qty = Number(it.quantity) || 0;
      const cost = Number(it.average_cost) || 0;
      return {
        productId: it.product_id,
        internalCode: `PRD-${it.product_id}`,
        description: it.description,
        ean: it.ean || '',
        unit: 'UN',
        quantity: qty,
        averageCost: cost,
        totalValue: Number((qty * cost).toFixed(2)),
        possessionIndicator: '0',
        ncm: (it.ncm || '30049099').replace(/\D/g, ''),
        cest: it.cest ? String(it.cest).replace(/\D/g, '') : undefined
      };
    });
  }

  public async generateSpedFiscal(params: SpedGenerationParams): Promise<SpedGenerationRecord> {
    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(params.storeId) as any;
    const fiscalProfile = this.db.prepare('SELECT * FROM fiscal_profiles LIMIT 1').get() as any;

    let accounting = this.getAccountingParameters(params.storeId);
    if (!accounting) {
      accounting = {
        storeId: params.storeId,
        accountantName: 'CONTABILISTA RESPONSAVEL PADRAO',
        accountantCpf: '11122233344',
        accountantCrc: 'CRC-SP 999999/O',
        spedProfile: 'A',
        spedVersion: '018'
      };
    }

    const cnpj = (fiscalProfile?.cnpj || store?.cnpj || '00000000000100').replace(/\D/g, '');
    const ie = (fiscalProfile?.ie || store?.ie || 'ISENTO').replace(/\D/g, '');
    const companyName = fiscalProfile?.razao_social || store?.company_name || 'DROGARIA FARMACORE LTDA';
    const tradeName = fiscalProfile?.nome_fantasia || store?.name || 'DROGARIA FARMACORE';
    const state = fiscalProfile?.uf || store?.state || 'SP';
    const cityCode = fiscalProfile?.c_mun || store?.ibge_code || '3550308';
    const address = fiscalProfile?.logradouro || store?.street || 'RUA PRINCIPAL';
    const addressNum = fiscalProfile?.numero || store?.number || '100';
    const neighborhood = fiscalProfile?.bairro || store?.neighborhood || 'CENTRO';
    const zipCode = (fiscalProfile?.cep || store?.zip_code || '01001000').replace(/\D/g, '');
    const phone = (store?.phone || '11999998888').replace(/\D/g, '');
    const email = store?.email || 'fiscal@farmacore.com.br';

    const formatDateSped = (dStr: string) => {
      // Recebe YYYY-MM-DD e transforma em DDMMAAAA
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}${parts[1]}${parts[0]}`;
      }
      return dStr.replace(/\D/g, '');
    };

    const dtIni = formatDateSped(params.periodStart);
    const dtFin = formatDateSped(params.periodEnd);
    const purpose = params.purpose ?? 0;
    const version = accounting.spedVersion || '018';
    const profile = accounting.spedProfile || 'A';

    const lines: string[] = [];
    const regCounts: Record<string, number> = {};

    const addLine = (line: string) => {
      lines.push(line);
      const reg = line.split('|')[1];
      if (reg) {
        regCounts[reg] = (regCounts[reg] || 0) + 1;
      }
    };

    // ==========================================
    // BLOCO 0: Abertura, Identificação e Referências
    // ==========================================
    const b0Start = lines.length;
    addLine(`|0000|${version}|${purpose}|${dtIni}|${dtFin}|${companyName.toUpperCase()}|${cnpj}||${state}|${ie}|${cityCode}|||${profile}|1|`);
    addLine('|0001|0|');
    addLine(`|0005|${tradeName.toUpperCase()}|${zipCode}|${address.toUpperCase()}|${addressNum}|S/C|${neighborhood.toUpperCase()}|${phone}||${email}|`);
    addLine(
      `|0100|${accounting.accountantName.toUpperCase()}|${accounting.accountantCpf}|${accounting.accountantCrc}|${accounting.accountantCnpj || ''}|${accounting.accountantCep || zipCode}|${accounting.accountantAddress || address}|S/N||${neighborhood.toUpperCase()}|${phone}||${accounting.accountantEmail || email}|${cityCode}|`
    );

    // Participantes (Fornecedores de compras registradas no período)
    const purchases = this.db
      .prepare(`
        SELECT DISTINCT supplier_cnpj, supplier_name, supplier_ie
        FROM purchase_invoices
        WHERE supplier_cnpj IS NOT NULL
      `)
      .all() as any[];

    for (const p of purchases) {
      const pCnpj = (p.supplier_cnpj || '').replace(/\D/g, '');
      const pIe = (p.supplier_ie || '').replace(/\D/g, '');
      const pName = (p.supplier_name || 'FORNECEDOR').toUpperCase();
      addLine(`|0150|FORN-${pCnpj}|${pName}|1058|${pCnpj}||${pIe}|${cityCode}||${address.toUpperCase()}|100||CENTRO|`);
    }

    // Unidades de Medida
    addLine('|0190|UN|UNIDADE|');
    addLine('|0190|CX|CAIXA|');

    // Cadastro de Itens (Produtos)
    const products = this.db
      .prepare('SELECT id, name, ean, ncm, cest, price FROM products ORDER BY id ASC')
      .all() as any[];

    for (const pr of products) {
      const prCode = `PRD-${pr.id}`;
      const prName = (pr.name || 'MEDICAMENTO').toUpperCase();
      const prEan = pr.ean || '';
      const prNcm = (pr.ncm || '30049099').replace(/\D/g, '');
      const prCest = pr.cest ? String(pr.cest).replace(/\D/g, '') : '';
      addLine(`|0200|${prCode}|${prName}|${prEan}||UN|00|${prNcm}|||${prCest}|18.00||`);
    }

    // Encerramento Bloco 0
    const b0Count = lines.length - b0Start + 1;
    addLine(`|0990|${b0Count}|`);

    // ==========================================
    // BLOCO C: Documentos Fiscais - Mercadorias
    // ==========================================
    const bCStart = lines.length;
    addLine('|C001|0|');

    let totalDocs = 0;
    let totalIcmsDebit = 0;
    let totalIcmsCredit = 0;
    let totalIcmsSt = 0;

    // Entradas: Compras (NF-e modelo 55)
    const invoices = this.db
      .prepare(`
        SELECT id, access_key, invoice_number, invoice_series, supplier_cnpj, total_invoice_amount, issue_date, created_at
        FROM purchase_invoices
        ORDER BY id ASC
      `)
      .all() as any[];

    for (const inv of invoices) {
      totalDocs++;
      const fornId = `FORN-${(inv.supplier_cnpj || '').replace(/\D/g, '')}`;
      const invTotal = Number(inv.total_invoice_amount) || 0;
      const invDate = formatDateSped((inv.issue_date || inv.created_at || params.periodStart).substring(0, 10));
      const nNf = inv.invoice_number || inv.id;
      const serie = inv.invoice_series || 1;
      const docKey = inv.access_key || `352605${(inv.supplier_cnpj || cnpj).replace(/\D/g, '').padStart(14, '0')}5500${serie}${String(nNf).padStart(9, '0')}1000000010`;

      addLine(
        `|C100|0|1|${fornId}|55|00|${serie}|${nNf}|${docKey}|${invDate}|${invDate}|${invTotal.toFixed(2)}|1|0.00|0.00|${invTotal.toFixed(2)}|0|0.00|0.00|0.00|0.00|${invTotal.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|`
      );

      // C190 Analítico da NF-e
      addLine(`|C190|060|1403|0.00|${invTotal.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|`);
    }

    // Saídas: Vendas NFC-e (modelo 65)
    const sales = this.db
      .prepare(`
        SELECT s.id, (s.total_amount - s.discount_amount) as net_amount, s.created_at, fi.ch_nfe, fi.n_nf, fi.serie
        FROM sales s
        LEFT JOIN nfce_invoices fi ON fi.sale_id = s.id AND fi.status = 'AUTORIZADA'
        WHERE s.status = 'COMPLETED'
        ORDER BY s.id ASC
      `)
      .all() as any[];

    for (const sale of sales) {
      totalDocs++;
      const saleTotal = Number(sale.net_amount) || 0;
      const saleDate = formatDateSped((sale.created_at || params.periodStart).substring(0, 10));
      const nNf = sale.n_nf || sale.id;
      const serie = sale.serie || 1;
      const chNFe = sale.ch_nfe || `352605${cnpj}6500${serie}${String(nNf).padStart(9, '0')}1000000010`;

      addLine(
        `|C100|1|0||65|00|${serie}|${nNf}|${chNFe}|${saleDate}|${saleDate}|${saleTotal.toFixed(2)}|1|0.00|0.00|${saleTotal.toFixed(2)}|0|0.00|0.00|0.00|0.00|${saleTotal.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|`
      );

      // C190 Analítico da NFC-e (Substituição Tributária Farmacêutica: CST 060 / CFOP 5405)
      addLine(`|C190|060|5405|0.00|${saleTotal.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|`);
    }

    const bCCount = lines.length - bCStart + 1;
    addLine(`|C990|${bCCount}|`);

    // ==========================================
    // BLOCO E: Apuração do ICMS Próprio e ICMS-ST
    // ==========================================
    const bEStart = lines.length;
    addLine('|E001|0|');
    addLine(`|E100|${dtIni}|${dtFin}|`);
    addLine(
      `|E110|${totalIcmsDebit.toFixed(2)}|0.00|0.00|0.00|${totalIcmsCredit.toFixed(2)}|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|`
    );
    addLine(`|E200|${state}|${dtIni}|${dtFin}|`);
    addLine(
      `|E210|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|0.00|${totalIcmsSt.toFixed(2)}|`
    );

    const bECount = lines.length - bEStart + 1;
    addLine(`|E990|${bECount}|`);

    // ==========================================
    // BLOCO H: Inventário Físico & Contábil
    // ==========================================
    const bHStart = lines.length;
    let totalInvVal = 0;

    if (params.includeInventory) {
      const invDateSped = formatDateSped(params.inventoryDate || params.periodEnd);
      const invItems = this.getInventoryBlockH(params.storeId, params.inventoryDate);
      totalInvVal = invItems.reduce((acc, it) => acc + it.totalValue, 0);

      addLine('|H001|0|');
      addLine(`|H005|${invDateSped}|${totalInvVal.toFixed(2)}|01|`);

      for (const item of invItems) {
        addLine(
          `|H010|${item.internalCode}|${item.unit}|${item.quantity.toFixed(3)}|${item.averageCost.toFixed(6)}|${item.totalValue.toFixed(2)}|${item.possessionIndicator}||1.1.01.01||`
        );
      }
    } else {
      addLine('|H001|1|'); // Sem dados informados
    }

    const bHCount = lines.length - bHStart + 1;
    addLine(`|H990|${bHCount}|`);

    // ==========================================
    // BLOCO 1: Outras Informações
    // ==========================================
    const b1Start = lines.length;
    addLine('|1001|0|');
    addLine('|1010|N|N|N|N|N|N|N|N|N|');
    const b1Count = lines.length - b1Start + 1;
    addLine(`|1990|${b1Count}|`);

    // ==========================================
    // BLOCO 9: Controle e Encerramento
    // ==========================================
    const b9Start = lines.length;
    addLine('|9001|0|');

    // Adiciona 9900 para cada registro gerado
    regCounts['9001'] = 1;
    regCounts['9990'] = 1;
    regCounts['9999'] = 1;

    // Ordena registros alfabeticamente
    const sortedRegs = Object.keys(regCounts).sort();
    // 9900 contará ele mesmo para cada tipo de registro + 1 pelo próprio 9900
    regCounts['9900'] = sortedRegs.length + 1;

    for (const reg of sortedRegs) {
      addLine(`|9900|${reg}|${regCounts[reg]}|`);
    }
    addLine(`|9900|9900|${regCounts['9900']}|`);

    const b9Count = lines.length - b9Start + 2; // +1 pelo 9990
    addLine(`|9990|${b9Count}|`);

    const totalLines = lines.length + 1; // +1 pelo 9999
    addLine(`|9999|${totalLines}|`);

    const fileContent = lines.join('\r\n') + '\r\n';
    const fileName = `SPED_EFD_${cnpj}_${params.periodStart.replace(/-/g, '')}_${params.periodEnd.replace(/-/g, '')}.txt`;

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
        'SPED_EFD',
        params.periodStart,
        params.periodEnd,
        purpose,
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
      generationType: 'SPED_EFD',
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      purpose,
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

  public getGenerationById(id: number): SpedGenerationRecord | null {
    const row = this.db.prepare('SELECT * FROM sped_generations WHERE id = ?').get(id) as any;
    if (!row) return null;

    const divergences = this.db
      .prepare('SELECT * FROM sped_audit_divergences WHERE generation_id = ? ORDER BY id ASC')
      .all(id) as any[];

    return {
      id: row.id,
      storeId: row.store_id,
      generationType: row.generation_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      purpose: row.purpose,
      fileName: row.file_name,
      fileContent: row.file_content,
      totalLines: row.total_lines,
      totalDocuments: row.total_documents,
      totalIcmsDebit: row.total_icms_debit,
      totalIcmsCredit: row.total_icms_credit,
      totalIcmsSt: row.total_icms_st,
      inventoryDate: row.inventory_date,
      totalInventoryValue: row.total_inventory_value,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      divergences: divergences.map(d => ({
        id: d.id,
        generationId: d.generation_id,
        severity: d.severity,
        entityType: d.entity_type,
        entityId: d.entity_id,
        fieldName: d.field_name,
        description: d.description,
        recommendation: d.recommendation,
        createdAt: d.created_at
      }))
    };
  }

  public listGenerations(storeId: number, type?: string): SpedGenerationRecord[] {
    let sql = 'SELECT * FROM sped_generations WHERE store_id = ?';
    const params: any[] = [storeId];
    if (type) {
      sql += ' AND generation_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY id DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      storeId: row.store_id,
      generationType: row.generation_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      purpose: row.purpose,
      fileName: row.file_name,
      fileContent: row.file_content,
      totalLines: row.total_lines,
      totalDocuments: row.total_documents,
      totalIcmsDebit: row.total_icms_debit,
      totalIcmsCredit: row.total_icms_credit,
      totalIcmsSt: row.total_icms_st,
      inventoryDate: row.inventory_date,
      totalInventoryValue: row.total_inventory_value,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at
    }));
  }
}
