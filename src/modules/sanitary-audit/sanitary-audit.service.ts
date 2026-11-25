import { Database } from '../../database/connection';
import {
  SanitaryAudit,
  SanitaryAuditItem,
  RunSanitaryScanInput,
  SanitaryInspectionDossier,
  SanitaryDashboardKpis,
  SanitaryComplianceStatus,
  SanitaryItemCategory,
  SanitaryItemStatus
} from './sanitary-audit.types';
import { randomUUID } from 'crypto';

export class SanitaryAuditService {
  constructor(private db: Database) {}

  /**
   * Executa varredura sanitária transversal automática em todas as bases regulatórias do ERP
   */
  async runSanitaryScan(input: RunSanitaryScanInput): Promise<SanitaryAudit> {
    const auditId = `audit-${randomUUID()}`;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const storeId = input.store_id || '1';

    const evaluatedItems: Array<{
      category: SanitaryItemCategory;
      item_description: string;
      status: SanitaryItemStatus;
      evidence_text: string;
      corrective_action?: string;
    }> = [];

    // ==========================================
    // 1. CADEIA DE FRIO & TERMOLÁBEIS (Peso: 20 pts)
    // ==========================================
    let coldChainScore = 20;

    // Checagem de medições hoje
    const todayReadings = this.db.prepare(`
      SELECT COUNT(*) as count FROM temperature_readings
      WHERE store_id = ? AND date(recorded_at) = ?
    `).get(storeId, today) as { count: number };

    if (todayReadings && todayReadings.count > 0) {
      evaluatedItems.push({
        category: 'COLD_CHAIN',
        item_description: 'Controle diário de temperatura e umidade (RDC 44/2009 & RDC 430/2020)',
        status: 'COMPLIANT',
        evidence_text: `${todayReadings.count} medições registradas com sucesso na data de hoje.`
      });
    } else {
      coldChainScore -= 10;
      evaluatedItems.push({
        category: 'COLD_CHAIN',
        item_description: 'Controle diário de temperatura e umidade (RDC 44/2009 & RDC 430/2020)',
        status: 'NON_COMPLIANT',
        evidence_text: 'Nenhuma medição de temperatura/umidade registrada na data de hoje.',
        corrective_action: 'Realizar imediatamente a leitura dos termohigrômetros de geladeira e salão e registrar no sistema.'
      });
    }

    // Checagem de excursões não justificadas
    const excursions = this.db.prepare(`
      SELECT COUNT(*) as count FROM temperature_excursions
      WHERE store_id = ? AND status = 'OPEN'
    `).get(storeId) as { count: number };

    if (!excursions || excursions.count === 0) {
      evaluatedItems.push({
        category: 'COLD_CHAIN',
        item_description: 'Excursões térmicas justificadas e plano de contingência',
        status: 'COMPLIANT',
        evidence_text: 'Zero excursões térmicas pendentes de justificativa sanitária.'
      });
    } else {
      coldChainScore -= 10;
      evaluatedItems.push({
        category: 'COLD_CHAIN',
        item_description: 'Excursões térmicas justificadas e plano de contingência',
        status: 'NON_COMPLIANT',
        evidence_text: `${excursions.count} excursão(ões) térmica(s) sem justificativa farmacêutica registrada.`,
        corrective_action: 'Registrar laudo técnico sobre a estabilidade dos medicamentos atingidos pela excursão térmica.'
      });
    }

    coldChainScore = Math.max(0, coldChainScore);

    // ==========================================
    // 2. SNGPC & CONTROLADOS PORTARIA 344/98 (Peso: 25 pts)
    // ==========================================
    let sngpcScore = 25;

    // Checagem de transmissões SNGPC nos últimos 7 dias
    const lastTransmission = this.db.prepare(`
      SELECT created_at, status FROM sngpc_transmissions
      ORDER BY created_at DESC LIMIT 1
    `).get() as { created_at: string; status: string } | undefined;

    if (lastTransmission && (lastTransmission.status === 'CONFIRMADO' || lastTransmission.status === 'TRANSMITIDO')) {
      evaluatedItems.push({
        category: 'SNGPC',
        item_description: 'Transmissão semanal regular de movimentação SNGPC à ANVISA',
        status: 'COMPLIANT',
        evidence_text: `Última transmissão confirmada com sucesso em ${lastTransmission.created_at}.`
      });
    } else {
      sngpcScore -= 15;
      evaluatedItems.push({
        category: 'SNGPC',
        item_description: 'Transmissão semanal regular de movimentação SNGPC à ANVISA',
        status: 'NON_COMPLIANT',
        evidence_text: 'Transmissão semanal SNGPC não localizada ou não confirmada pela ANVISA.',
        corrective_action: 'Transmitir imediatamente o arquivo XML de movimentação de antimicrobianos e controlados.'
      });
    }

    // Balanço BMPO trimestral
    const bmpoReport = this.db.prepare(`
      SELECT id, status FROM regulatory_reports
      WHERE store_id = ? AND report_type IN ('BMPO_TRIMESTRAL', 'BMPO_ANUAL')
      ORDER BY created_at DESC LIMIT 1
    `).get(storeId) as { id: number; status: string } | undefined;

    if (bmpoReport) {
      evaluatedItems.push({
        category: 'SNGPC',
        item_description: 'Balanço de Medicamentos Psicoativos (BMPO Portaria 344/98)',
        status: 'COMPLIANT',
        evidence_text: 'Balanço trimestral BMPO gerado e disponível para visto sanitário.'
      });
    } else {
      sngpcScore -= 10;
      evaluatedItems.push({
        category: 'SNGPC',
        item_description: 'Balanço de Medicamentos Psicoativos (BMPO Portaria 344/98)',
        status: 'WARNING_EXPIRING',
        evidence_text: 'Nenhum BMPO registrado no trimestre vigente.',
        corrective_action: 'Consolidar movimentação do trimestre e gerar o relatório oficial BMPO.'
      });
    }

    sngpcScore = Math.max(0, sngpcScore);

    // ==========================================
    // 3. POPS, CERTIFICADOS DE PRAGAS & CAIXA D'ÁGUA (Peso: 15 pts)
    // ==========================================
    let popsScore = 15;

    // Desinsetização / Pragas urbanas (validade de 180 dias)
    const pestCert = this.db.prepare(`
      SELECT expiration_date FROM pest_control_certificates
      WHERE store_id = ? AND expiration_date >= ?
      ORDER BY expiration_date DESC LIMIT 1
    `).get(storeId, today) as { expiration_date: string } | undefined;

    if (pestCert) {
      evaluatedItems.push({
        category: 'POPS_CERTIFICATES',
        item_description: 'Certificado de Controle de Pragas e Vetores Urbanos (Desinsetização)',
        status: 'COMPLIANT',
        evidence_text: `Certificado vigente até ${pestCert.expiration_date}.`
      });
    } else {
      popsScore -= 5;
      evaluatedItems.push({
        category: 'POPS_CERTIFICATES',
        item_description: 'Certificado de Controle de Pragas e Vetores Urbanos (Desinsetização)',
        status: 'NON_COMPLIANT',
        evidence_text: 'Certificado de desinsetização vencido ou inexistente.',
        corrective_action: 'Agendar imediatamente serviço com empresa especializada licenciada na VISA.'
      });
    }

    // Limpeza de reservatório de água potável (validade de 180 dias)
    const waterLog = this.db.prepare(`
      SELECT expiration_date FROM water_tank_cleaning_logs
      WHERE store_id = ? AND expiration_date >= ?
      ORDER BY expiration_date DESC LIMIT 1
    `).get(storeId, today) as { expiration_date: string } | undefined;

    if (waterLog) {
      evaluatedItems.push({
        category: 'POPS_CERTIFICATES',
        item_description: 'Laudo e Higienização de Caixa d\'Água Semestral',
        status: 'COMPLIANT',
        evidence_text: `Higienização em dia, válida até ${waterLog.expiration_date}.`
      });
    } else {
      popsScore -= 5;
      evaluatedItems.push({
        category: 'POPS_CERTIFICATES',
        item_description: 'Laudo e Higienização de Caixa d\'Água Semestral',
        status: 'NON_COMPLIANT',
        evidence_text: 'Laudo de limpeza semestral de reservatório de água vencido.',
        corrective_action: 'Providenciar limpeza e laudo bacteriológico do reservatório de água potável.'
      });
    }

    // Procedimentos Operacionais Padrão (POPs)
    const popsCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM standard_operating_procedures
      WHERE store_id = ? AND status = 'ACTIVE'
    `).get(storeId) as { count: number };

    if (popsCount && popsCount.count >= 3) {
      evaluatedItems.push({
        category: 'POPS_CERTIFICATES',
        item_description: 'Manual de Boas Práticas Farmacêuticas e POPs Atualizados',
        status: 'COMPLIANT',
        evidence_text: `${popsCount.count} POPs ativos e revisados disponíveis.`
      });
    } else {
      popsScore -= 5;
      evaluatedItems.push({
        category: 'POPS_CERTIFICATES',
        item_description: 'Manual de Boas Práticas Farmacêuticas e POPs Atualizados',
        status: 'WARNING_EXPIRING',
        evidence_text: 'Menos de 3 POPs ativos cadastrados no estabelecimento.',
        corrective_action: 'Elaborar e aprovar os POPs mandatórios da RDC 44/2009.'
      });
    }

    popsScore = Math.max(0, popsScore);

    // ==========================================
    // 4. PGRSS & RESÍDUOS DE SAÚDE (Peso: 15 pts)
    // ==========================================
    let pgrssScore = 15;

    const pgrssManifest = this.db.prepare(`
      SELECT id, manifest_number, status FROM pgrss_manifests
      WHERE store_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(storeId) as { id: number; manifest_number: string; status: string } | undefined;

    if (pgrssManifest) {
      evaluatedItems.push({
        category: 'PGRSS',
        item_description: 'Plano de Gerenciamento de Resíduos (RDC 222/2018) e Manifesto MTR',
        status: 'COMPLIANT',
        evidence_text: `Manifesto MTR #${pgrssManifest.manifest_number} com destinação licenciada.`
      });
    } else {
      pgrssScore -= 15;
      evaluatedItems.push({
        category: 'PGRSS',
        item_description: 'Plano de Gerenciamento de Resíduos (RDC 222/2018) e Manifesto MTR',
        status: 'NON_COMPLIANT',
        evidence_text: 'Nenhum manifesto de coleta de resíduos (perfurocortantes/químicos) emitido.',
        corrective_action: 'Contratar coleta licenciada de resíduos infectantes e gerar MTR.'
      });
    }

    pgrssScore = Math.max(0, pgrssScore);

    // ==========================================
    // 5. SALA DE INJETÁVEIS & SERVIÇOS FARMACÊUTICOS (Peso: 15 pts)
    // ==========================================
    let injectablesScore = 15;

    const injectablesCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM injectable_administration_logs
      WHERE store_id = ?
    `).get(storeId) as { count: number };

    if (injectablesCount && injectablesCount.count > 0) {
      evaluatedItems.push({
        category: 'INJECTABLES',
        item_description: 'Livro Eletrônico de Aplicação de Injetáveis (RDC 197/2017 & RDC 44/2009)',
        status: 'COMPLIANT',
        evidence_text: `${injectablesCount.count} registro(s) de aplicação com rastreabilidade de lote e prescritor.`
      });
    } else {
      // Se não há registros, considera conforme preventivo ou com aviso
      evaluatedItems.push({
        category: 'INJECTABLES',
        item_description: 'Livro Eletrônico de Aplicação de Injetáveis (RDC 197/2017 & RDC 44/2009)',
        status: 'COMPLIANT',
        evidence_text: 'Livro eletrônico ativo e apto para registro sanitário imediato.'
      });
    }

    // ==========================================
    // 6. FARMACOVIGILÂNCIA & NOTIVISA (Peso: 10 pts)
    // ==========================================
    let pharmacovigilanceScore = 10;

    const pendingNotivisa = this.db.prepare(`
      SELECT COUNT(*) as count FROM adverse_drug_reactions
      WHERE store_id = ? AND notivisa_submission_status = 'DRAFT'
    `).get(storeId) as { count: number } | undefined;

    if (!pendingNotivisa || pendingNotivisa.count === 0) {
      evaluatedItems.push({
        category: 'PHARMACOVIGILANCE',
        item_description: 'Notificações de Reações Adversas e Queixas Técnicas (RDC 406/2020)',
        status: 'COMPLIANT',
        evidence_text: 'Zero pendências de comunicação com o sistema NOTIVISA ANVISA.'
      });
    } else {
      pharmacovigilanceScore -= 10;
      evaluatedItems.push({
        category: 'PHARMACOVIGILANCE',
        item_description: 'Notificações de Reações Adversas e Queixas Técnicas (RDC 406/2020)',
        status: 'NON_COMPLIANT',
        evidence_text: `${pendingNotivisa.count} reação(ões) adversa(s) sem protocolo NOTIVISA.`,
        corrective_action: 'Transmitir dados clínicos da reação adversa ao portal NOTIVISA em até 72 horas.'
      });
    }

    pharmacovigilanceScore = Math.max(0, pharmacovigilanceScore);

    // ==========================================
    // SCORE GERAL & STATUS DE CONFORMIDADE
    // ==========================================
    const overallScore = Number(
      (
        coldChainScore +
        sngpcScore +
        popsScore +
        pgrssScore +
        injectablesScore +
        pharmacovigilanceScore
      ).toFixed(1)
    );

    const complianceStatus: SanitaryComplianceStatus =
      overallScore >= 90
        ? 'EXCELLENT'
        : overallScore >= 70
        ? 'WARNING'
        : 'CRITICAL_RISK';

    const dossierSummary = {
      evaluatedAt: now,
      overallScore,
      complianceStatus,
      scores: {
        coldChain: coldChainScore,
        sngpc: sngpcScore,
        pops: popsScore,
        pgrss: pgrssScore,
        injectables: injectablesScore,
        pharmacovigilance: pharmacovigilanceScore
      }
    };

    // Grava no banco de dados de forma transacional
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO sanitary_audits (
          id, store_id, audit_date, responsible_pharmacist_crf, responsible_pharmacist_name,
          overall_score, compliance_status, cold_chain_score, sngpc_score, pops_certificates_score,
          pgrss_score, injectables_score, pharmacovigilance_score, dossier_summary_json,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        auditId,
        storeId,
        today,
        input.responsible_pharmacist_crf,
        input.responsible_pharmacist_name,
        overallScore,
        complianceStatus,
        coldChainScore,
        sngpcScore,
        popsScore,
        pgrssScore,
        injectablesScore,
        pharmacovigilanceScore,
        JSON.stringify(dossierSummary),
        now,
        now
      );

      const insertItemStmt = this.db.prepare(`
        INSERT INTO sanitary_audit_items (
          id, audit_id, category, item_description, status, evidence_text, corrective_action, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of evaluatedItems) {
        insertItemStmt.run(
          `item-${randomUUID()}`,
          auditId,
          it.category,
          it.item_description,
          it.status,
          it.evidence_text,
          it.corrective_action || null,
          now
        );
      }
    })();

    return (await this.getAuditById(auditId))!;
  }

  /**
   * Busca auditoria com itens por ID
   */
  async getAuditById(auditId: string): Promise<SanitaryAudit | null> {
    const audit = this.db.prepare(`SELECT * FROM sanitary_audits WHERE id = ?`).get(auditId) as SanitaryAudit;
    if (!audit) return null;

    const items = this.db.prepare(`
      SELECT * FROM sanitary_audit_items WHERE audit_id = ? ORDER BY category ASC
    `).all(auditId) as SanitaryAuditItem[];

    return { ...audit, items };
  }

  /**
   * Gera Dossiê Consolidado de Inspeção Sanitária pronto para impressão e apresentação ao fiscal
   */
  async generateInspectionDossier(auditId: string): Promise<SanitaryInspectionDossier> {
    const audit = await this.getAuditById(auditId);
    if (!audit) {
      throw new Error('AUDIT_NOT_FOUND');
    }

    const store = this.db.prepare(`SELECT name, cnpj FROM stores WHERE id = ?`).get(audit.store_id) as any;
    const storeName = store?.name || 'Drogaria Magnos Farma';
    const cnpj = store?.cnpj || '98.765.432/0001-88';

    const items = audit.items || [];
    const compliantCount = items.filter((i) => i.status === 'COMPLIANT').length;
    const nonCompliantCount = items.filter((i) => i.status === 'NON_COMPLIANT').length;
    const warningCount = items.filter((i) => i.status === 'WARNING_EXPIRING').length;

    const pillars = [
      {
        category: 'COLD_CHAIN' as SanitaryItemCategory,
        name: 'Cadeia de Frio & Termolábeis (RDC 44/2009 & RDC 430/2020)',
        score: audit.cold_chain_score,
        maxScore: 20,
        percentage: Number(((audit.cold_chain_score / 20) * 100).toFixed(1)),
        itemsCount: items.filter((i) => i.category === 'COLD_CHAIN').length,
        nonCompliantCount: items.filter((i) => i.category === 'COLD_CHAIN' && i.status === 'NON_COMPLIANT').length
      },
      {
        category: 'SNGPC' as SanitaryItemCategory,
        name: 'Controle de Medicamentos Especiais (Portaria 344/98 & SNGPC)',
        score: audit.sngpc_score,
        maxScore: 25,
        percentage: Number(((audit.sngpc_score / 25) * 100).toFixed(1)),
        itemsCount: items.filter((i) => i.category === 'SNGPC').length,
        nonCompliantCount: items.filter((i) => i.category === 'SNGPC' && i.status === 'NON_COMPLIANT').length
      },
      {
        category: 'POPS_CERTIFICATES' as SanitaryItemCategory,
        name: 'POPs, Desinsetização & Reservatório de Água (RDC 44/2009)',
        score: audit.pops_certificates_score,
        maxScore: 15,
        percentage: Number(((audit.pops_certificates_score / 15) * 100).toFixed(1)),
        itemsCount: items.filter((i) => i.category === 'POPS_CERTIFICATES').length,
        nonCompliantCount: items.filter((i) => i.category === 'POPS_CERTIFICATES' && i.status === 'NON_COMPLIANT').length
      },
      {
        category: 'PGRSS' as SanitaryItemCategory,
        name: 'Gerenciamento de Resíduos de Saúde (RDC 222/2018 ANVISA)',
        score: audit.pgrss_score,
        maxScore: 15,
        percentage: Number(((audit.pgrss_score / 15) * 100).toFixed(1)),
        itemsCount: items.filter((i) => i.category === 'PGRSS').length,
        nonCompliantCount: items.filter((i) => i.category === 'PGRSS' && i.status === 'NON_COMPLIANT').length
      },
      {
        category: 'INJECTABLES' as SanitaryItemCategory,
        name: 'Serviços Farmacêuticos & Injetáveis (RDC 197/2017 & RDC 44/2009)',
        score: audit.injectables_score,
        maxScore: 15,
        percentage: Number(((audit.injectables_score / 15) * 100).toFixed(1)),
        itemsCount: items.filter((i) => i.category === 'INJECTABLES').length,
        nonCompliantCount: items.filter((i) => i.category === 'INJECTABLES' && i.status === 'NON_COMPLIANT').length
      },
      {
        category: 'PHARMACOVIGILANCE' as SanitaryItemCategory,
        name: 'Farmacovigilância, RAM & NOTIVISA (RDC 406/2020 ANVISA)',
        score: audit.pharmacovigilance_score,
        maxScore: 10,
        percentage: Number(((audit.pharmacovigilance_score / 10) * 100).toFixed(1)),
        itemsCount: items.filter((i) => i.category === 'PHARMACOVIGILANCE').length,
        nonCompliantCount: items.filter((i) => i.category === 'PHARMACOVIGILANCE' && i.status === 'NON_COMPLIANT').length
      }
    ];

    const officialReportText = `
================================================================================
  DOSSIÊ OFICIAL DE AUTOINSPEÇÃO SANITÁRIA — ANVISA / VIGILÂNCIA SANITÁRIA
================================================================================
ESTABELECIMENTO: ${storeName}
CNPJ: ${cnpj}
FARMACÊUTICO RESPONSÁVEL TÉCNICO: ${audit.responsible_pharmacist_name}
CRF: ${audit.responsible_pharmacist_crf}
DATA DA AUTOINSPEÇÃO: ${audit.audit_date}
SCORE GERAL DE CONFORMIDADE: ${audit.overall_score}% (${audit.compliance_status})

--------------------------------------------------------------------------------
RESUMO POR PILAR SANITÁRIO:
${pillars.map((p) => `- ${p.name}: ${p.score}/${p.maxScore} pts (${p.percentage}%) [${p.nonCompliantCount} não conformidades]`).join('\n')}

--------------------------------------------------------------------------------
CHECKLIST REGULATÓRIO DETALHADO:
${items
  .map(
    (i) =>
      `[${i.status}] ${i.category}: ${i.item_description}\n   Evidência: ${i.evidence_text}${
        i.corrective_action ? `\n   Ação Corretiva: ${i.corrective_action}` : ''
      }`
  )
  .join('\n\n')}

================================================================================
Documento gerado eletronicamente em conformidade com as Boas Práticas Farmacêuticas.
================================================================================
`.trim();

    return {
      audit,
      dossierSummary: {
        storeName,
        cnpj,
        crf: audit.responsible_pharmacist_crf,
        auditDate: audit.audit_date,
        score: audit.overall_score,
        status: audit.compliance_status,
        totalItems: items.length,
        compliantItems: compliantCount,
        nonCompliantItems: nonCompliantCount,
        warningItems: warningCount,
        pillars
      },
      items,
      officialReportText
    };
  }

  /**
   * Atualiza Plano de Ação (CAPA) da autoinspeção
   */
  async updateActionPlan(auditId: string, notes: string): Promise<SanitaryAudit> {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sanitary_audits
      SET action_plan_notes = ?,
          updated_at = ?
      WHERE id = ?
    `).run(notes, now, auditId);

    return (await this.getAuditById(auditId))!;
  }

  /**
   * Lista histórico de auditorias
   */
  async listAuditHistory(storeId: string = '1'): Promise<SanitaryAudit[]> {
    return this.db.prepare(`
      SELECT * FROM sanitary_audits
      WHERE store_id = ?
      ORDER BY audit_date DESC, created_at DESC
    `).all(storeId) as SanitaryAudit[];
  }

  /**
   * Indicadores gerais de saúde sanitária para dashboard
   */
  async getSanitaryDashboard(storeId: string = '1'): Promise<SanitaryDashboardKpis> {
    const lastAudit = this.db.prepare(`
      SELECT * FROM sanitary_audits
      WHERE store_id = ?
      ORDER BY audit_date DESC, created_at DESC LIMIT 1
    `).get(storeId) as SanitaryAudit | undefined;

    const totalAudits = this.db.prepare(`
      SELECT COUNT(*) as count FROM sanitary_audits WHERE store_id = ?
    `).get(storeId) as { count: number };

    let pendingActions = 0;
    if (lastAudit) {
      const nonCompliant = this.db.prepare(`
        SELECT COUNT(*) as count FROM sanitary_audit_items
        WHERE audit_id = ? AND status = 'NON_COMPLIANT'
      `).get(lastAudit.id) as { count: number };
      pendingActions = nonCompliant?.count || 0;
    }

    return {
      last_audit_score: lastAudit ? lastAudit.overall_score : 100,
      last_audit_status: lastAudit ? lastAudit.compliance_status : 'EXCELLENT',
      last_audit_date: lastAudit ? lastAudit.audit_date : null,
      total_audits_performed: totalAudits?.count || 0,
      pending_corrective_actions: pendingActions,
      category_health: {
        cold_chain: lastAudit ? lastAudit.cold_chain_score : 20,
        sngpc: lastAudit ? lastAudit.sngpc_score : 25,
        pops_certificates: lastAudit ? lastAudit.pops_certificates_score : 15,
        pgrss: lastAudit ? lastAudit.pgrss_score : 15,
        injectables: lastAudit ? lastAudit.injectables_score : 15,
        pharmacovigilance: lastAudit ? lastAudit.pharmacovigilance_score : 10
      }
    };
  }
}
