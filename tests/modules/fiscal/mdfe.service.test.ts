import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDatabase, Database } from '../../../src/database/connection';
import { runMigrations } from '../../../src/database/migrator';
import { MdfeFiscalService } from '../../../src/modules/fiscal/mdfe.service';

describe('MdfeFiscalService Unit Tests', () => {
  let db: Database;
  let service: MdfeFiscalService;

  beforeEach(() => {
    db = getDatabase(':memory:');
    runMigrations(db);
    service = new MdfeFiscalService(db);

    db.prepare(`
      INSERT OR IGNORE INTO stores (
        id, name, cnpj, ie, street, number, neighborhood, city, state, zip_code
      ) VALUES (
        1, 'CD Central FarmaCore SP', '11.222.333/0001-44', '123.456.789.000',
        'Rodovia Anhanguera', 'Km 25', 'Jardim CD', 'São Paulo', 'SP', '05000-000'
      )
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('1. Cria rascunho de MDF-e agrupando NF-es de transferência de medicamentos', async () => {
    const mdfe = await service.createMdfeDraft({
      store_id: 1,
      series: 1,
      uf_start: 'SP',
      uf_end: 'RJ',
      driver_name: 'Antônio Carlos',
      driver_cpf: '123.456.789-00',
      vehicle_plate: 'BRA-2E19',
      vehicle_rntrc: 'RNTRC-SP-998877',
      insurance_company_name: 'Porto Seguro Cargas',
      insurance_policy_number: 'APOLICE-FARMA-2026',
      items: [
        {
          nfe_access_key: '35261111222333000144550010000000011000000019',
          nfe_number: 1,
          cargo_value_brl: 35000.0,
          weight_kg: 180.5
        },
        {
          nfe_access_key: '35261111222333000144550010000000021000000024',
          nfe_number: 2,
          cargo_value_brl: 45000.0,
          weight_kg: 220.0
        }
      ]
    });

    expect(mdfe.id).toBeDefined();
    expect(mdfe.mdfe_number).toBe(1);
    expect(mdfe.total_nfe_count).toBe(2);
    expect(mdfe.total_cargo_value_brl).toBe(80000.0);
    expect(mdfe.total_weight_kg).toBe(400.5);
    expect(mdfe.status).toBe('DRAFT');
    expect(mdfe.access_key).toHaveLength(44);
  });

  it('2. Autoriza MDF-e junto à SEFAZ gerando protocolo e DAMDFE formatado', async () => {
    const draft = await service.createMdfeDraft({
      store_id: 1,
      uf_start: 'SP',
      uf_end: 'MG',
      driver_name: 'Marcos Souza',
      driver_cpf: '222.333.444-55',
      vehicle_plate: 'LOG-5544',
      items: [
        {
          nfe_access_key: '35261111222333000144550010000000031000000030',
          cargo_value_brl: 15000.0,
          weight_kg: 50.0
        }
      ]
    });

    const authorized = await service.authorizeMdfe(draft.id);

    expect(authorized.status).toBe('AUTHORIZED');
    expect(authorized.sefaz_protocol).toBeDefined();
    expect(authorized.xml_content).toContain('<mdfeProc');
    expect(authorized.damdfe_content).toContain('DAMDFE');
    expect(authorized.damdfe_content).toContain('LOG-5544');
  });

  it('3. Emite DAMDFE formatado para conferência de tráfego rodoviário', async () => {
    const draft = await service.createMdfeDraft({
      store_id: 1,
      uf_start: 'SP',
      uf_end: 'SP',
      driver_name: 'Lucas Pereira',
      driver_cpf: '333.444.555-66',
      vehicle_plate: 'FAR-9090',
      items: [
        {
          nfe_access_key: '35261111222333000144550010000000041000000045',
          cargo_value_brl: 12000.0,
          weight_kg: 40.0
        }
      ]
    });

    await service.authorizeMdfe(draft.id);
    const damdfe = await service.generateDamdfe(draft.id);

    expect(damdfe.access_key).toHaveLength(44);
    expect(damdfe.damdfe_text).toContain('DOCUMENTO AUXILIAR DE MANIFESTO');
    expect(damdfe.damdfe_text).toContain('FAR-9090');
    expect(damdfe.damdfe_text).toContain('Lucas Pereira');
  });

  it('4. Encerra MDF-e após entrega das mercadorias na filial de destino', async () => {
    const draft = await service.createMdfeDraft({
      store_id: 1,
      uf_start: 'SP',
      uf_end: 'RJ',
      driver_name: 'Antônio Carlos',
      driver_cpf: '123.456.789-00',
      vehicle_plate: 'BRA-2E19',
      items: [
        {
          nfe_access_key: '35261111222333000144550010000000051000000050',
          cargo_value_brl: 50000.0,
          weight_kg: 300.0
        }
      ]
    });

    await service.authorizeMdfe(draft.id);
    const closed = await service.closeMdfe(draft.id, {
      closure_reason: 'Carga descarregada com conferência 100% aprovada'
    });

    expect(closed.status).toBe('CLOSED');
    expect(closed.closed_at).toBeDefined();
    expect(closed.closure_reason).toContain('Carga descarregada');
  });

  it('5. Cancela MDF-e autorizado com justificativa técnica', async () => {
    const draft = await service.createMdfeDraft({
      store_id: 1,
      uf_start: 'SP',
      uf_end: 'PR',
      driver_name: 'Roberto Dias',
      driver_cpf: '999.888.777-66',
      vehicle_plate: 'CUR-1010',
      items: [
        {
          nfe_access_key: '35261111222333000144550010000000061000000066',
          cargo_value_brl: 20000.0,
          weight_kg: 100.0
        }
      ]
    });

    await service.authorizeMdfe(draft.id);
    const cancelled = await service.cancelMdfe(draft.id, {
      justification: 'Avaria no veículo transportador antes de iniciar a viagem intermunicipal'
    });

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelled_at).toBeDefined();
    expect(cancelled.cancellation_reason).toContain('Avaria no veículo');
  });

  it('6. Retorna KPIs consolidados de manifestos em trânsito e carga transportada', async () => {
    const kpis = await service.getMdfeKpis(1);

    expect(kpis.total_manifests).toBeDefined();
    expect(kpis.authorized_in_transit).toBeDefined();
    expect(kpis.closed_count).toBeDefined();
    expect(kpis.total_transported_cargo_brl).toBeDefined();
  });
});
