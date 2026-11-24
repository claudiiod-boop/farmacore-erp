import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { SanitizationService } from '../../../src/modules/sanitization/sanitization.service';

describe('SanitizationService', () => {
  let db: Database;
  let service: SanitizationService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new SanitizationService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Sanitization Logs', () => {
    it('should create and verify a sanitization log', () => {
      const log = service.createSanitizationLog({
        storeId: 1,
        sectorName: 'SALA_INJETAIS',
        cleaningType: 'TERMINAL',
        scheduledDate: '2026-11-24',
        chemicalProduct: 'Quaternário de Amônio 5ª Geração',
        performedBy: 'Carlos Higienização',
        notes: 'Desinfecção completa das bancadas e maçanetas',
      });

      expect(log.id).toBeGreaterThan(0);
      expect(log.status).toBe('COMPLETED');
      expect(log.verified_by_pharmacist).toBeNull();

      const verified = service.verifySanitizationLog(log.id, 'CRF-SP 45678');
      expect(verified.verified_by_pharmacist).toBe('CRF-SP 45678');
      expect(verified.verified_at).toBeDefined();
    });

    it('should list sanitization logs with sector and status filters', () => {
      service.createSanitizationLog({
        sectorName: 'SALA_INJETAIS',
        cleaningType: 'ROUTINE',
        scheduledDate: '2026-11-24',
        chemicalProduct: 'Álcool 70%',
        performedBy: 'Ana',
      });

      service.createSanitizationLog({
        sectorName: 'ESTOQUE_CENTRAL',
        cleaningType: 'ROUTINE',
        scheduledDate: '2026-11-24',
        chemicalProduct: 'Cloro Diluído',
        performedBy: 'João',
      });

      const injetaveis = service.listSanitizationLogs({ sectorName: 'SALA_INJETAIS' });
      expect(injetaveis.length).toBe(1);
      expect(injetaveis[0].sector_name).toBe('SALA_INJETAIS');
    });

    it('should throw validation error when required fields are missing', () => {
      expect(() => {
        service.createSanitizationLog({
          sectorName: '',
          cleaningType: 'ROUTINE',
          scheduledDate: '2026-11-24',
          chemicalProduct: 'Álcool 70%',
          performedBy: 'Ana',
        });
      }).toThrow('Nome do setor é obrigatório');
    });
  });

  describe('Pest Control Certificates', () => {
    it('should register certificate and auto-calculate 180 days expiration', () => {
      const cert = service.registerPestControlCertificate({
        storeId: 1,
        serviceProviderName: 'BioDedetizadora Ambiental',
        serviceProviderCnpj: '11.222.333/0001-44',
        sanitaryLicenseNumber: 'VISA-PR-2026-789',
        certificateNumber: 'LAUDO-PST-2026-001',
        applicationDate: '2026-11-20',
        targetPests: 'Baratas, Ratos e Formigas',
        chemicalAgentsUsed: 'Deltametrina, Brodifacoum',
        technicalResponsiblePest: 'Dr. Roberto CRBio 5544',
        pharmacistApprovalCrf: 'CRF-SP 9999',
      });

      expect(cert.id).toBeGreaterThan(0);
      expect(cert.expiration_date).toBeDefined();
      expect(cert.status).toBe('VALID');

      const active = service.getActivePestControlCertificate(1);
      expect(active?.certificate_number).toBe('LAUDO-PST-2026-001');
    });

    it('should detect expired certificate correctly', () => {
      const expired = service.registerPestControlCertificate({
        storeId: 1,
        serviceProviderName: 'Antiga Dedetizadora',
        serviceProviderCnpj: '11.222.333/0001-44',
        sanitaryLicenseNumber: 'VISA-2025',
        certificateNumber: 'LAUDO-PST-2025-OLD',
        applicationDate: '2025-01-01',
        expirationDate: '2025-07-01',
        targetPests: 'Baratas',
        chemicalAgentsUsed: 'Deltametrina',
        technicalResponsiblePest: 'CRBio 1111',
        pharmacistApprovalCrf: 'CRF-SP 9999',
      });

      expect(expired.status).toBe('EXPIRED');
    });
  });

  describe('Water Tank Cleaning', () => {
    it('should register water tank cleaning with potability', () => {
      const cleaning = service.registerWaterTankCleaning({
        storeId: 1,
        serviceProvider: 'LimpaÁgua Engenharia',
        cleaningDate: '2026-11-20',
        potabilityReportNumber: 'LAB-AGUA-9988',
        potabilityStatus: 'POTABLE_COMPLIANT',
        responsibleCleaner: 'Manoel Técnico',
        pharmacistCrf: 'CRF-SP 9999',
      });

      expect(cleaning.id).toBeGreaterThan(0);
      expect(cleaning.status).toBe('VALID');
      expect(cleaning.potability_status).toBe('POTABLE_COMPLIANT');

      const active = service.getActiveWaterTankCleaning(1);
      expect(active?.service_provider).toBe('LimpaÁgua Engenharia');
    });
  });

  describe('Standard Operating Procedures (SOPs)', () => {
    it('should create and update SOP with versioning', () => {
      const sop = service.createOrUpdateSop({
        storeId: 1,
        sopCode: 'POP-AMB-001',
        title: 'Higienização de Superfícies da Sala de Injetáveis',
        category: 'HIGIENE_AMBIENTAL',
        version: '1.0',
        effectiveDate: '2026-11-24',
        authorName: 'Farmacêutica Mariana',
        reviewerPharmacistCrf: 'CRF-SP 12345',
        contentSummary: 'Passo a passo com álcool 70% e quaternário de amônio',
      });

      expect(sop.id).toBeGreaterThan(0);
      expect(sop.status).toBe('ACTIVE');

      // Atualiza versão
      const updated = service.createOrUpdateSop({
        storeId: 1,
        sopCode: 'POP-AMB-001',
        title: 'Higienização de Superfícies da Sala de Injetáveis - Revisão 2',
        category: 'HIGIENE_AMBIENTAL',
        version: '2.0',
        effectiveDate: '2026-11-24',
        authorName: 'Farmacêutica Mariana',
        reviewerPharmacistCrf: 'CRF-SP 12345',
        contentSummary: 'Incluído protocolo de registro fotográfico',
      });

      expect(updated.id).toBe(sop.id);
      expect(updated.version).toBe('2.0');
    });
  });

  describe('Compliance Overview & VISA Score', () => {
    it('should return high compliance score when certificates and cleanings are up to date', () => {
      // 1. Dedetização válida
      service.registerPestControlCertificate({
        storeId: 1,
        serviceProviderName: 'BioDedetizadora',
        serviceProviderCnpj: '11.222.333/0001-44',
        sanitaryLicenseNumber: 'VISA-PR-2026',
        certificateNumber: 'LAUDO-PST-2026-A',
        applicationDate: '2026-11-20',
        targetPests: 'Baratas',
        chemicalAgentsUsed: 'Deltametrina',
        technicalResponsiblePest: 'CRBio 5544',
        pharmacistApprovalCrf: 'CRF-SP 9999',
      });

      // 2. Caixa d'Água válida
      service.registerWaterTankCleaning({
        storeId: 1,
        serviceProvider: 'LimpaÁgua',
        cleaningDate: '2026-11-20',
        potabilityStatus: 'POTABLE_COMPLIANT',
        responsibleCleaner: 'Manoel',
        pharmacistCrf: 'CRF-SP 9999',
      });

      // 3. Higienização do mês
      service.createSanitizationLog({
        storeId: 1,
        sectorName: 'SALAO_VENDAS',
        cleaningType: 'ROUTINE',
        scheduledDate: '2026-11-24',
        chemicalProduct: 'Álcool 70%',
        performedBy: 'Carla',
      });

      // 4. POP ativo
      service.createOrUpdateSop({
        storeId: 1,
        sopCode: 'POP-001',
        title: 'POP Geral',
        category: 'GERAL',
        effectiveDate: '2026-11-24',
        authorName: 'Mariana',
        reviewerPharmacistCrf: 'CRF-SP 9999',
        contentSummary: 'Resumo',
      });

      const overview = service.getComplianceOverview(1);
      expect(overview.score).toBeGreaterThanOrEqual(90);
      expect(overview.overallCompliant).toBe(true);
      expect(overview.pestControl.status).toBe('VALID');
      expect(overview.waterTank.status).toBe('VALID');
      expect(overview.sanitizationsMonth.totalCompleted).toBe(1);
      expect(overview.sops.totalActive).toBe(1);
    });
  });
});
