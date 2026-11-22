import { Database } from '../../database/connection';
import type { SpedAuditDivergence, SpedValidationResult } from './sped.types';

export class SpedAuditService {
  constructor(private db: Database) {}

  public auditStoreFiscalData(storeId: number, generationId?: number): SpedValidationResult {
    const divergences: SpedAuditDivergence[] = [];

    // 1. Auditoria de Contabilista (Bloco 0100)
    const accounting = this.db
      .prepare('SELECT * FROM accounting_parameters WHERE store_id = ?')
      .get(storeId) as any;

    if (!accounting) {
      divergences.push({
        generationId,
        severity: 'ERROR',
        entityType: 'ACCOUNTING',
        description: 'Parâmetros contábeis não configurados para a filial',
        recommendation: 'Cadastre o contabilista responsável, CPF e CRC no módulo contábil'
      });
    } else {
      if (!accounting.accountant_crc || accounting.accountant_crc.trim() === '') {
        divergences.push({
          generationId,
          severity: 'ERROR',
          entityType: 'ACCOUNTING',
          fieldName: 'accountant_crc',
          description: 'CRC do contador não informado',
          recommendation: 'Preencha o registro do CRC do contabilista'
        });
      }
      const cpfPure = (accounting.accountant_cpf || '').replace(/\D/g, '');
      if (cpfPure.length !== 11) {
        divergences.push({
          generationId,
          severity: 'ERROR',
          entityType: 'ACCOUNTING',
          fieldName: 'accountant_cpf',
          description: 'CPF do contador inválido ou incompleto',
          recommendation: 'Informe um CPF de 11 dígitos válido'
        });
      }
    }

    // 2. Auditoria Cadastral de Produtos (Bloco 0200)
    const products = this.db
      .prepare('SELECT id, name, ncm, cest, cfop, csosn_icms FROM products WHERE is_active = 1')
      .all() as any[];

    for (const pr of products) {
      const ncmPure = (pr.ncm || '').replace(/\D/g, '');
      if (ncmPure.length !== 8) {
        divergences.push({
          generationId,
          severity: 'ERROR',
          entityType: 'PRODUCT',
          entityId: String(pr.id),
          fieldName: 'ncm',
          description: `Produto "${pr.name}" possui NCM inválido: "${pr.ncm || ''}"`,
          recommendation: 'Informe um código NCM oficial de 8 dígitos da TIPI'
        });
      }

      // Se CFOP de ST (5405 ou 1403), exige CEST e CST/CSOSN coerente
      const cfop = String(pr.cfop || '');
      if (cfop === '5405' || cfop === '1403') {
        const cestPure = (pr.cest || '').replace(/\D/g, '');
        if (cestPure.length !== 7) {
          divergences.push({
            generationId,
            severity: 'WARNING',
            entityType: 'PRODUCT',
            entityId: String(pr.id),
            fieldName: 'cest',
            description: `Produto "${pr.name}" tributado por ST sem código CEST válido`,
            recommendation: 'Vincule o CEST de 7 dígitos do segmento farmacêutico (Convênio 142/18)'
          });
        }

        const csosn = String(pr.csosn_icms || '');
        if (csosn !== '500' && csosn !== '060' && csosn !== '60') {
          divergences.push({
            generationId,
            severity: 'ERROR',
            entityType: 'PRODUCT',
            entityId: String(pr.id),
            fieldName: 'csosn_icms',
            description: `Produto "${pr.name}" com CFOP ${cfop} (ST), porém com CSOSN/CST ${csosn}`,
            recommendation: 'Utilize CSOSN 500 (Simples Nacional) ou CST 060 (Regime Normal) para Substituição Tributária'
          });
        }
      }
    }

    // 3. Auditoria do Bloco H (Inventário Físico e Custo Médio)
    const inventory = this.db
      .prepare(`
        SELECT 
          p.id, p.name,
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
      `)
      .all(storeId) as any[];

    for (const item of inventory) {
      const cost = Number(item.unit_cost) || 0;
      if (cost <= 0) {
        divergences.push({
          generationId,
          severity: 'ERROR',
          entityType: 'INVENTORY',
          entityId: String(item.id),
          fieldName: 'unit_cost',
          description: `Produto "${item.name}" possui estoque físico (${item.quantity} un) com custo unitário zero`,
          recommendation: 'Atribua o preço de fábrica (PF) ou cadastre a NF-e de compra com o custo real da mercadoria'
        });
      }
    }

    // Se generationId for fornecido, grava as divergências na tabela de auditoria
    if (generationId) {
      const insertDiv = this.db.prepare(`
        INSERT INTO sped_audit_divergences (
          generation_id, severity, entity_type, entity_id, field_name, description, recommendation
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const d of divergences) {
        insertDiv.run(
          generationId,
          d.severity,
          d.entityType,
          d.entityId || null,
          d.fieldName || null,
          d.description,
          d.recommendation || null
        );
      }
    }

    const totalErrors = divergences.filter(d => d.severity === 'ERROR').length;
    const totalWarnings = divergences.filter(d => d.severity === 'WARNING').length;

    return {
      isValid: totalErrors === 0,
      totalErrors,
      totalWarnings,
      divergences
    };
  }
}
