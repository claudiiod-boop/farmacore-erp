import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SelfCheckoutService } from '../../../src/modules/self-checkout/self-checkout.service';

describe('SelfCheckoutService', () => {
  let db: Database;
  let service: SelfCheckoutService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SelfCheckoutService(db);

    // Kiosk terminal
    db.prepare(`
      INSERT OR IGNORE INTO kiosk_terminals (id, store_id, terminal_code, name, mode, is_active)
      VALUES (1, 1, 'TOTEM-01', 'Totem Entrada', 'SELF_PRE_SALE', 1)
    `).run();

    // 1. Produto OTC Livre (Vitamina C)
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (1, '7891234567890', 'Vitamina C 1g Efervescente', 'Acido Ascorbico', '1004300010011', 'SEM_TARJA', 'NAO_CONTROLADO', 25.0, 15.0, 20.0, 1)
    `).run();

    // Lote do Produto 1
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (1, 1, 'L-VIT-01', '2026-01-01', '2027-12-31', 30, 0)
    `).run();

    // 2. Medicamento Tarjado Restrito (Amoxicilina Tarja Vermelha)
    db.prepare(`
      INSERT INTO products (id, ean, name, active_ingredient, ms_registration, stripe, control_type, pmc, pf, price, is_active)
      VALUES (2, '7899999999999', 'Amoxicilina 500mg 21 caps', 'Amoxicilina', '1004300010022', 'VERMELHA_SOB_RECEITA', 'NAO_CONTROLADO', 35.0, 20.0, 28.0, 1)
    `).run();

    // Lote do Produto 2
    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, expiration_date, quantity, reserved_quantity)
      VALUES (2, 2, 'L-AMX-01', '2026-01-01', '2027-12-31', 20, 0)
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Inicia sessão de autoatendimento no Totem com código exclusivo', () => {
    const session = service.startSession({
      kioskId: 1,
      storeId: 1,
      customerCpf: '111.222.333-44',
      customerName: 'Renato Santos',
    });

    expect(session.id).toBeGreaterThan(0);
    expect(session.session_code).toContain('SC-');
    expect(session.status).toBe('OPEN');
    expect(session.customer_name).toBe('Renato Santos');
  });

  it('2. Bipa item OTC livre e calcula subtotal e total com sucesso', () => {
    const session = service.startSession({ kioskId: 1 });

    const scanRes = service.scanItem({
      sessionId: session.id,
      eanOrCode: '7891234567890',
      quantity: 2,
    });

    expect(scanRes.allowed).toBe(true);
    expect(scanRes.blocked).toBe(false);
    expect(scanRes.session.items?.length).toBe(1);
    expect(scanRes.session.total_amount).toBe(40.0);
  });

  it('3. Bloqueia bipe de medicamento tarjado e gera senha prioritária para o balcão', () => {
    const session = service.startSession({ kioskId: 1, customerName: 'Camila Lima' });

    const scanRes = service.scanItem({
      sessionId: session.id,
      eanOrCode: '7899999999999',
    });

    expect(scanRes.allowed).toBe(false);
    expect(scanRes.blocked).toBe(true);
    expect(scanRes.blockedReason).toContain('exige retenção de receita médica');
    expect(scanRes.queueTicketNumber).toBeDefined();
    expect(scanRes.session.status).toBe('BLOCKED_REQUIRES_PHARMACIST');
  });

  it('4. Inicia pagamento touch via PIX e gera payload QR Code', () => {
    const session = service.startSession({ kioskId: 1 });
    service.scanItem({ sessionId: session.id, eanOrCode: '7891234567890', quantity: 1 });

    const payRes = service.initiatePayment(session.id, 'PIX');

    expect(payRes.paymentMethod).toBe('PIX');
    expect(payRes.totalAmount).toBe(20.0);
    expect(payRes.pixQrCodePayload).toContain('BR.GOV.BCB.PIX');

    const updated = service.getSessionById(session.id);
    expect(updated?.status).toBe('PAYING');
  });

  it('5. Conclui venda autônoma com baixa atômica de estoque, emissão de NFC-e e cupom térmico', () => {
    const session = service.startSession({ kioskId: 1, customerCpf: '123.456.789-00' });
    service.scanItem({ sessionId: session.id, eanOrCode: '7891234567890', quantity: 2 });
    service.initiatePayment(session.id, 'PIX');

    const saleRes = service.finalizeSale(session.id);

    expect(saleRes.status).toBe('PAID');
    expect(saleRes.saleId).toBeGreaterThan(0);
    expect(saleRes.nfceKey.length).toBe(44);
    expect(saleRes.totalAmount).toBe(40.0);
    expect(saleRes.thermalReceipt).toContain('TERMINAL DE AUTOATENDIMENTO TOUCH');
    expect(saleRes.thermalReceipt).toContain('NFC-e AUTORIZADA SEFAZ COM SUCESSO');

    // Confirma baixa no lote de estoque (30 - 2 = 28)
    const batch = db.prepare('SELECT quantity FROM batches WHERE id = 1').get() as any;
    expect(batch.quantity).toBe(28);
  });

  it('6. Remove item do carrinho e recalcula totais', () => {
    const session = service.startSession({ kioskId: 1 });
    const scanRes = service.scanItem({ sessionId: session.id, eanOrCode: '7891234567890', quantity: 1 });
    const itemId = scanRes.itemAdded!.id;

    const updated = service.removeItem(session.id, itemId);
    expect(updated.items?.length).toBe(0);
    expect(updated.total_amount).toBe(0);
  });

  it('7. Retorna KPIs consolidados do totem', () => {
    const session = service.startSession({ kioskId: 1 });
    service.scanItem({ sessionId: session.id, eanOrCode: '7891234567890', quantity: 1 });
    service.initiatePayment(session.id, 'PIX');
    service.finalizeSale(session.id);

    const kpis = service.getKpis(1);
    expect(kpis.totalSessionsToday).toBe(1);
    expect(kpis.completedSessionsToday).toBe(1);
    expect(kpis.totalRevenueToday).toBe(20.0);
  });
});
