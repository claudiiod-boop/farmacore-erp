import { Database } from '../../database/connection';
import {
  SatDevice,
  CfeSatDocument,
  CfeContingencyQueueItem,
  RegisterSatDeviceInput,
  IssueCfeInput,
  SatStatusResponse,
  SatFiscalKpis,
  CfeStatus
} from './sat.types';
import { randomBytes } from 'crypto';

export class SatFiscalService {
  constructor(private db: Database) {}

  /**
   * 1. Cadastro / Vinculação de Dispositivo SAT ao Caixa do PDV
   */
  async registerSatDevice(input: RegisterSatDeviceInput): Promise<SatDevice> {
    const store = this.db.prepare('SELECT id, state FROM stores WHERE id = ?').get(input.store_id) as any;
    if (!store) {
      throw new Error('STORE_NOT_FOUND');
    }

    const existingSerial = this.db
      .prepare('SELECT id, pos_station_id FROM sat_devices WHERE serial_number = ?')
      .get(input.serial_number) as any;

    if (existingSerial && existingSerial.pos_station_id !== input.pos_station_id) {
      throw new Error('SERIAL_NUMBER_ALREADY_LINKED');
    }

    const now = new Date().toISOString();

    if (existingSerial) {
      this.db.prepare(`
        UPDATE sat_devices
        SET model = COALESCE(?, model),
            sign_code = ?,
            firmware_version = COALESCE(?, firmware_version),
            status = 'ACTIVE',
            updated_at = ?
        WHERE id = ?
      `).run(input.model || null, input.sign_code, input.firmware_version || null, now, existingSerial.id);

      return (this.db.prepare('SELECT * FROM sat_devices WHERE id = ?').get(existingSerial.id) as SatDevice);
    }

    const ins = this.db.prepare(`
      INSERT INTO sat_devices (
        store_id, pos_station_id, serial_number, model, sign_code,
        status, firmware_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)
    `).run(
      input.store_id,
      input.pos_station_id,
      input.serial_number,
      input.model || 'BEMATECH_RB2000',
      input.sign_code,
      input.firmware_version || '01.00.00',
      now,
      now
    );

    return (this.db.prepare('SELECT * FROM sat_devices WHERE id = ?').get(ins.lastInsertRowid) as SatDevice);
  }

  /**
   * 2. Consulta Status Operacional do Aparelho SAT (Simula Driver DLL/libSAT)
   */
  async checkSatStatus(deviceId: number): Promise<SatStatusResponse> {
    const dev = this.db.prepare('SELECT * FROM sat_devices WHERE id = ?').get(deviceId) as any;
    if (!dev) {
      throw new Error('SAT_DEVICE_NOT_FOUND');
    }

    const now = new Date().toISOString();
    // Em produção comunica via DLL `ConsultarStatusOperacional(numeroSessao, codigoAtivacao)`
    const memoryUsed = Number((Math.random() * 20 + 10).toFixed(1)); // ex: 15.4% usado

    this.db.prepare(`
      UPDATE sat_devices
      SET last_status_check = ?, memory_percent_used = ?, updated_at = ?
      WHERE id = ?
    `).run(now, memoryUsed, now, deviceId);

    return {
      serial_number: dev.serial_number,
      status: 'OPERACIONAL',
      lan_ip: '192.168.1.150',
      memory_used_percent: memoryUsed,
      battery_level: 'ALTO',
      sefaz_transmission_status: 'CONECTADO',
      firmware_version: dev.firmware_version || '01.00.00'
    };
  }

  /**
   * 3. Emissão de Cupom Fiscal Eletrônico CF-e-SAT Modelo 59
   */
  async issueCfeSat(input: IssueCfeInput): Promise<CfeSatDocument> {
    const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(input.sale_id) as any;
    if (!sale) {
      throw new Error('SALE_NOT_FOUND');
    }

    const alreadyIssued = this.db
      .prepare("SELECT id FROM cfe_sat_documents WHERE sale_id = ? AND status != 'CANCELLED'")
      .get(input.sale_id);

    if (alreadyIssued) {
      throw new Error('CFE_ALREADY_ISSUED');
    }

    const device = this.db.prepare('SELECT * FROM sat_devices WHERE id = ?').get(input.sat_device_id) as any;
    if (!device) {
      throw new Error('SAT_DEVICE_NOT_FOUND');
    }
    if (device.status !== 'ACTIVE') {
      throw new Error('SAT_DEVICE_NOT_ACTIVE');
    }

    const store = this.db.prepare('SELECT * FROM stores WHERE id = ?').get(device.store_id) as any;
    const items = this.db.prepare(`
      SELECT si.*, p.name, p.ean, p.active_ingredient, p.stripe, p.control_type
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(input.sale_id) as any[];

    // Numeração sequencial do CF-e para este aparelho
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM cfe_sat_documents WHERE sat_device_id = ?
    `).get(input.sat_device_id) as { count: number };
    const cfeNumber = countRow.count + 1;

    // Número aleatório da sessão (6 dígitos)
    const sessionRandom = Math.floor(100000 + Math.random() * 900000);

    // Chave de acesso de 44 dígitos
    // cUF (35 SP) + AAMM + CNPJ (14) + mod (59) + nserie (9) + nCFe (6) + cNF (6) + cDV (1)
    const ufCode = store?.state === 'CE' ? '23' : '35';
    const yearMonth = new Date().toISOString().slice(2, 7).replace('-', '');
    const cleanCnpj = (store?.cnpj || '11111111000111').replace(/\D/g, '').padStart(14, '0');
    const serialFormatted = device.serial_number.replace(/\D/g, '').padStart(9, '0');
    const cfeFormatted = String(cfeNumber).padStart(6, '0');
    const cnfCode = String(sessionRandom).padStart(6, '0');

    const keyWithoutDv = `${ufCode}${yearMonth}${cleanCnpj}59${serialFormatted}${cfeFormatted}${cnfCode}`;
    const dv = this.calculateMod11(keyWithoutDv);
    const accessKey = `${keyWithoutDv}${dv}`;

    // Monta o XML
    const xmlSent = `<?xml version="1.0" encoding="UTF-8"?><CFe><infCFe versaoDadosEnt="0.08"><ide><CNPJ>${cleanCnpj}</CNPJ><signAC>${device.sign_code}</signAC><numeroCaixa>${device.pos_station_id}</numeroCaixa></ide><emit><CNPJ>${cleanCnpj}</CNPJ><IE>${store?.ie || 'ISENTO'}</IE></emit><dest>${input.customer_cpf ? `<CPF>${input.customer_cpf.replace(/\D/g, '')}</CPF>` : ''}</dest><total><vCFe>${sale.total_amount.toFixed(2)}</vCFe></total></infCFe></CFe>`;

    const now = new Date().toISOString();
    const xmlSigned = `<?xml version="1.0" encoding="UTF-8"?><CFe><infCFe Id="CFe${accessKey}" versaoDadosEnt="0.08"><ide><nserieSAT>${device.serial_number}</nserieSAT><nCFe>${cfeNumber}</nCFe><dEmi>${now.slice(0, 10).replace(/-/g, '')}</dEmi><hEmi>${now.slice(11, 19).replace(/:/g, '')}</hEmi></ide><Signature>SAT_SIGNATURE_HASH_${randomBytes(8).toString('hex')}</Signature></infCFe></CFe>`;

    // QR Code SEFAZ Payload
    const qrPayload = `${accessKey}|${now.replace(/[-:TZ.]/g, '').slice(0, 14)}|${sale.total_amount.toFixed(2)}|${input.customer_cpf ? input.customer_cpf.replace(/\D/g, '') : ''}|SAT_AUTH_HASH`;

    const isOffline = !!input.force_offline_contingency;
    const docStatus: CfeStatus = isOffline ? 'SYNC_PENDING' : 'AUTHORIZED';

    let newDocId = 0;

    this.db.transaction(() => {
      const ins = this.db.prepare(`
        INSERT INTO cfe_sat_documents (
          sale_id, store_id, sat_device_id, access_key, cfe_number,
          session_random_number, total_amount, discount_amount, net_amount,
          xml_sent, xml_signed, qr_code_payload, sefaz_status_code,
          sefaz_status_message, status, issued_at, created_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `).run(
        input.sale_id,
        device.store_id,
        input.sat_device_id,
        accessKey,
        cfeNumber,
        sessionRandom,
        sale.total_amount,
        sale.discount_amount || 0.0,
        sale.total_amount,
        xmlSent,
        xmlSigned,
        qrPayload,
        isOffline ? '06001' : '06000',
        isOffline ? 'Emitido em contingência off-line SAT' : 'Emitido com sucesso',
        docStatus,
        now,
        now
      );

      newDocId = Number(ins.lastInsertRowid);

      if (isOffline) {
        this.db.prepare(`
          INSERT INTO cfe_sat_contingency_queue (
            cfe_id, sat_device_id, status, retry_count, created_at
          ) VALUES (?, ?, 'PENDING', 0, ?)
        `).run(newDocId, input.sat_device_id, now);
      }
    })();

    return (this.db.prepare('SELECT * FROM cfe_sat_documents WHERE id = ?').get(newDocId) as CfeSatDocument);
  }

  /**
   * 4. Sincronização em Lote de Cupons Emitidos em Contingência Off-line
   */
  async syncContingencyBatch(deviceId: number): Promise<{ transmitted_count: number; items: CfeContingencyQueueItem[] }> {
    const pendingItems = this.db.prepare(`
      SELECT q.*, c.access_key, c.total_amount
      FROM cfe_sat_contingency_queue q
      JOIN cfe_sat_documents c ON q.cfe_id = c.id
      WHERE q.sat_device_id = ? AND q.status = 'PENDING'
    `).all(deviceId) as CfeContingencyQueueItem[];

    if (pendingItems.length === 0) {
      return { transmitted_count: 0, items: [] };
    }

    const now = new Date().toISOString();

    this.db.transaction(() => {
      const updateQueue = this.db.prepare(`
        UPDATE cfe_sat_contingency_queue
        SET status = 'TRANSMITTED', last_attempt_at = ?
        WHERE id = ?
      `);

      const updateDoc = this.db.prepare(`
        UPDATE cfe_sat_documents
        SET status = 'AUTHORIZED', sefaz_status_code = '06000', sefaz_status_message = 'Transmitido e autorizado pela SEFAZ'
        WHERE id = ?
      `);

      for (const item of pendingItems) {
        updateQueue.run(now, item.id);
        updateDoc.run(item.cfe_id);
      }
    })();

    return {
      transmitted_count: pendingItems.length,
      items: pendingItems
    };
  }

  /**
   * 5. Cancelamento do CF-e (Prazo regulatório máximo de 30 minutos - Portaria CAT 147/2012)
   */
  async cancelLastCfe(cfeId: number, justification: string): Promise<CfeSatDocument> {
    const doc = this.db.prepare('SELECT * FROM cfe_sat_documents WHERE id = ?').get(cfeId) as any;
    if (!doc) {
      throw new Error('CFE_NOT_FOUND');
    }
    if (doc.status === 'CANCELLED') {
      throw new Error('CFE_ALREADY_CANCELLED');
    }

    // Validação do prazo regulatório de 30 minutos
    const issuedTime = new Date(doc.issued_at).getTime();
    const currentTime = new Date().getTime();
    const diffMinutes = (currentTime - issuedTime) / (1000 * 60);

    if (diffMinutes > 30) {
      throw new Error('CANCELLATION_DEADLINE_EXCEEDED');
    }

    const now = new Date().toISOString();
    const cancelXml = `<?xml version="1.0" encoding="UTF-8"?><CFeCanc><infCFe chCanc="${doc.access_key}"><ide><dEmi>${now.slice(0, 10)}</dEmi></ide><just>${justification}</just></infCFe></CFeCanc>`;

    this.db.prepare(`
      UPDATE cfe_sat_documents
      SET status = 'CANCELLED',
          cancelled_at = ?,
          cancel_xml = ?,
          sefaz_status_code = '07000',
          sefaz_status_message = 'Cancelado com sucesso'
      WHERE id = ?
    `).run(now, cancelXml, cfeId);

    return (this.db.prepare('SELECT * FROM cfe_sat_documents WHERE id = ?').get(cfeId) as CfeSatDocument);
  }

  /**
   * 6. Leiaute Térmico Padronizado 80mm de Extrato CF-e-SAT
   */
  async getExtratoThermalLayout(cfeId: number): Promise<string> {
    const doc = this.db.prepare(`
      SELECT c.*, s.name as store_name, s.cnpj as store_cnpj, s.ie as store_ie, s.street, s.number, s.city, s.state
      FROM cfe_sat_documents c
      JOIN stores s ON c.store_id = s.id
      WHERE c.id = ?
    `).get(cfeId) as any;

    if (!doc) throw new Error('CFE_NOT_FOUND');

    const items = this.db.prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(doc.sale_id) as any[];

    // Formata a chave em grupos de 4 dígitos
    const formattedKey = doc.access_key.replace(/(\d{4})/g, '$1 ').trim();

    let text = `================================================\n`;
    text += `             ${doc.store_name?.toUpperCase() || 'FARMACIA FARMACORE'}\n`;
    text += `CNPJ: ${doc.store_cnpj}  IE: ${doc.store_ie || 'ISENTO'}\n`;
    text += `${doc.street || 'RUA PRINCIPAL'}, ${doc.number || '100'} - ${doc.city || 'SP'} / ${doc.state || 'SP'}\n`;
    text += `------------------------------------------------\n`;
    text += `       Extrato No. ${String(doc.cfe_number).padStart(6, '0')}\n`;
    text += `       CUPOM FISCAL ELETRONICO - SAT\n`;
    text += `------------------------------------------------\n`;
    text += `#|COD|DESC|QTD|UN|VL UN R$|(VL TR R$)*|VL ITEM R$\n`;

    let i = 1;
    for (const it of items) {
      const lineTotal = (it.quantity * it.unit_price).toFixed(2);
      text += `${String(i).padStart(3, '0')} ${it.product_name.slice(0, 20).padEnd(20)} ${it.quantity} UN x ${it.unit_price.toFixed(2)} = ${lineTotal}\n`;
      i++;
    }

    text += `------------------------------------------------\n`;
    text += `TOTAL BRUTO R$                             ${doc.total_amount.toFixed(2)}\n`;
    if (doc.discount_amount > 0) {
      text += `DESCONTO R$                                ${doc.discount_amount.toFixed(2)}\n`;
    }
    text += `TOTAL LIQUIDO R$                           ${doc.net_amount.toFixed(2)}\n`;
    text += `------------------------------------------------\n`;
    text += `SAT No. ${(doc.sat_device_id || 1).toString().padStart(9, '0')}\n`;
    text += `Data/Hora Emissao: ${doc.issued_at?.slice(0, 19).replace('T', ' ')}\n`;
    text += `CHAVE DE ACESSO CF-e:\n`;
    text += `${formattedKey}\n`;
    text += `------------------------------------------------\n`;
    text += `[QR CODE SEFAZ CONSULTA PUBLICA]:\n`;
    text += `${doc.qr_code_payload}\n`;
    text += `================================================\n`;

    return text;
  }

  /**
   * 7. Listagem de Cupons SAT
   */
  async listCfeDocuments(storeId?: number, status?: CfeStatus): Promise<CfeSatDocument[]> {
    let query = `SELECT * FROM cfe_sat_documents WHERE 1=1`;
    const params: any[] = [];

    if (storeId) {
      query += ` AND store_id = ?`;
      params.push(storeId);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    query += ` ORDER BY id DESC`;
    return this.db.prepare(query).all(...params) as CfeSatDocument[];
  }

  /**
   * 8. KPIs Fiscais do SAT
   */
  async getSatKpis(storeId?: number): Promise<SatFiscalKpis> {
    const storeFilter = storeId ? 'WHERE store_id = ?' : '';
    const storeParam = storeId ? [storeId] : [];

    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total_cfe,
        SUM(CASE WHEN status = 'AUTHORIZED' THEN net_amount ELSE 0 END) as authorized_val,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_count
      FROM cfe_sat_documents
      ${storeFilter}
    `).get(...storeParam) as any;

    const pendingQueue = this.db.prepare(`
      SELECT COUNT(*) as count FROM cfe_sat_contingency_queue WHERE status = 'PENDING'
    `).get() as { count: number };

    const activeDevices = this.db.prepare(`
      SELECT COUNT(*) as count FROM sat_devices WHERE status = 'ACTIVE' ${storeId ? 'AND store_id = ?' : ''}
    `).get(...storeParam) as { count: number };

    return {
      total_cfe_issued: stats?.total_cfe || 0,
      total_authorized_amount: Number((stats?.authorized_val || 0).toFixed(2)),
      total_cancelled_count: stats?.cancelled_count || 0,
      pending_contingency_count: pendingQueue?.count || 0,
      active_devices_count: activeDevices?.count || 0
    };
  }

  /**
   * Algoritmo de Módulo 11 para Dígito Verificador do Cupom Fiscal Eletrônico
   */
  private calculateMod11(input: string): number {
    let sum = 0;
    let weight = 2;

    for (let i = input.length - 1; i >= 0; i--) {
      sum += Number(input[i]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }

    const remainder = sum % 11;
    if (remainder === 0 || remainder === 1) return 0;
    return 11 - remainder;
  }
}
