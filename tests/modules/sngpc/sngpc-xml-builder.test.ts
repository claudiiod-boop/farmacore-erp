import { describe, it, expect } from 'vitest';
import {
  buildSngpcXml,
  SngpcXmlParams,
  SngpcXmlEntryItem,
  SngpcXmlSaleItem,
} from '../../../src/modules/sngpc/sngpc-xml-builder';

describe('SNGPC XML Builder (Anvisa RDC 27/2007 & Portaria 344/98)', () => {
  const baseParams: SngpcXmlParams = {
    cnpjEmissor: '12.345.678/0001-95',
    cpfTransmissor: '123.456.789-01',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    entries: [],
    sales: [],
  };

  it('should generate valid SNGPC XML envelope with canonical namespace and header', () => {
    const { xml, hash } = buildSngpcXml(baseParams);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<mensagemSNGPC xmlns="urn:sngpc-schema">');
    expect(xml).toContain('<cabecalho>');
    expect(xml).toContain('<cnpjEmissor>12345678000195</cnpjEmissor>');
    expect(xml).toContain('<cpfTransmissor>12345678901</cpfTransmissor>');
    expect(xml).toContain('<dataInicio>2026-11-01</dataInicio>');
    expect(xml).toContain('<dataFim>2026-11-07</dataFim>');
    expect(xml).toContain('</cabecalho>');
    expect(xml).toContain('<corpo>');
    expect(xml).toContain('<medicamentos>');
    expect(xml).toContain('</medicamentos>');
    expect(xml).toContain('</corpo>');
    expect(xml).toContain('</mensagemSNGPC>');

    // SHA-1 hash verification
    expect(hash).toMatch(/^[a-f0-9]{40}$/);
  });

  it('should format entradaMedicamentos correctly for purchase invoices', () => {
    const entries: SngpcXmlEntryItem[] = [
      {
        invoiceNumber: 12345,
        issueDate: '2026-11-02',
        supplierCnpj: '98.765.432/0001-00',
        msRegistration: '1.0043.0021.001-4',
        batchNumber: 'LOT-CLONA-001',
        quantity: 50,
      },
    ];

    const { xml } = buildSngpcXml({
      ...baseParams,
      entries,
    });

    expect(xml).toContain('<entradaMedicamentos>');
    expect(xml).toContain('<notaFiscalEntradaMedicamento>');
    expect(xml).toContain('<numeroNotaFiscal>12345</numeroNotaFiscal>');
    expect(xml).toContain('<tipoOperacaoNotaFiscal>1</tipoOperacaoNotaFiscal>');
    expect(xml).toContain('<dataNotaFiscal>2026-11-02</dataNotaFiscal>');
    expect(xml).toContain('<cnpjOrigem>98765432000100</cnpjOrigem>');
    expect(xml).toContain('<cnpjDestino>12345678000195</cnpjDestino>');
    expect(xml).toContain('<dadosMedicamento>');
    expect(xml).toContain('<registroMSMedicamento>1004300210014</registroMSMedicamento>');
    expect(xml).toContain('<numeroLoteMedicamento>LOT-CLONA-001</numeroLoteMedicamento>');
    expect(xml).toContain('<quantidadeMedicamento>50</quantidadeMedicamento>');
    expect(xml).toContain('<unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>');
    expect(xml).toContain('</dadosMedicamento>');
    expect(xml).toContain('</notaFiscalEntradaMedicamento>');
    expect(xml).toContain('</entradaMedicamentos>');
  });

  it('should format saidaMedicamentoVendaAoConsumidor correctly for prescriptions and buyers', () => {
    const sales: SngpcXmlSaleItem[] = [
      {
        prescriptionType: 'B1_AZUL',
        notificationNumber: 'NOTIF-8877',
        prescriptionDate: '2026-11-03',
        doctorName: 'Dr. Roberto Carlos & Cia',
        doctorCrm: '123456',
        doctorUf: 'SP',
        patientName: 'Maria Antônia',
        buyerName: 'Carlos Eduardo',
        buyerCpf: '111.222.333-44',
        buyerDocType: '1',
        msRegistration: '1.0043.0021.001-4',
        batchNumber: 'LOT-CLONA-001',
        quantity: 2,
      },
    ];

    const { xml } = buildSngpcXml({
      ...baseParams,
      sales,
    });

    expect(xml).toContain('<saidaMedicamentoVendaAoConsumidor>');
    expect(xml).toContain('<tipoReceituarioMedicamento>3</tipoReceituarioMedicamento>'); // B1_AZUL maps to 3
    expect(xml).toContain('<numeroNotificacaoReceita>NOTIF-8877</numeroNotificacaoReceita>');
    expect(xml).toContain('<dataPrescricaoMedicamento>2026-11-03</dataPrescricaoMedicamento>');
    expect(xml).toContain('<prescritor>');
    expect(xml).toContain('<nomePrescritor>Dr. Roberto Carlos &amp; Cia</nomePrescritor>');
    expect(xml).toContain('<numeroRegistroProfissional>123456</numeroRegistroProfissional>');
    expect(xml).toContain('<conselhoProfissional>CRM</conselhoProfissional>');
    expect(xml).toContain('<ufConselhoProfissional>SP</ufConselhoProfissional>');
    expect(xml).toContain('</prescritor>');
    expect(xml).toContain('<usoMedicamento>1</usoMedicamento>');
    expect(xml).toContain('<comprador>');
    expect(xml).toContain('<nomeComprador>Carlos Eduardo</nomeComprador>');
    expect(xml).toContain('<tipoDocumento>1</tipoDocumento>');
    expect(xml).toContain('<numeroDocumento>11122233344</numeroDocumento>');
    expect(xml).toContain('<orgaoExpedidor>SSP</orgaoExpedidor>');
    expect(xml).toContain('<ufEmissaoDocumento>SP</ufEmissaoDocumento>');
    expect(xml).toContain('</comprador>');
    expect(xml).toContain('<medicamentoVenda>');
    expect(xml).toContain('<registroMSMedicamento>1004300210014</registroMSMedicamento>');
    expect(xml).toContain('<numeroLoteMedicamento>LOT-CLONA-001</numeroLoteMedicamento>');
    expect(xml).toContain('<quantidadeMedicamento>2</quantidadeMedicamento>');
    expect(xml).toContain('<unidadeMedidaMedicamento>1</unidadeMedidaMedicamento>');
    expect(xml).toContain('</medicamentoVenda>');
    expect(xml).toContain('</saidaMedicamentoVendaAoConsumidor>');
  });

  it('should escape XML special characters properly in names and strings', () => {
    const sales: SngpcXmlSaleItem[] = [
      {
        prescriptionType: '1',
        notificationNumber: 'NOTIF<1>&2"3\'',
        prescriptionDate: '2026-11-04',
        doctorName: 'Dr. <Fausto> & Son',
        doctorCrm: '998877',
        doctorUf: 'RJ',
        patientName: 'João & "Maria"',
        buyerName: 'Pedro & \'Paulo\'',
        buyerCpf: '99988877766',
        msRegistration: '1234567890123',
        batchNumber: 'LOTE<SPECIAL>',
        quantity: 1,
      },
    ];

    const { xml } = buildSngpcXml({
      ...baseParams,
      sales,
    });

    expect(xml).toContain('Dr. &lt;Fausto&gt; &amp; Son');
    expect(xml).toContain('NOTIF&lt;1&gt;&amp;2&quot;3&apos;');
    expect(xml).toContain('João &amp; &quot;Maria&quot;');
    expect(xml).toContain('Pedro &amp; &apos;Paulo&apos;');
    expect(xml).toContain('LOTE&lt;SPECIAL&gt;');
  });

  it('should map various prescription types correctly to Anvisa code', () => {
    const makeSale = (type: string): SngpcXmlSaleItem => ({
      prescriptionType: type,
      notificationNumber: '123',
      prescriptionDate: '2026-11-01',
      doctorName: 'Dr. Teste',
      doctorCrm: '1234',
      doctorUf: 'SP',
      patientName: 'Paciente',
      buyerName: 'Comprador',
      buyerCpf: '12345678900',
      msRegistration: '1234567890123',
      batchNumber: 'L1',
      quantity: 1,
    });

    const typesMap = [
      { input: 'A1_AMARELA', expected: '2' },
      { input: 'AMARELA', expected: '2' },
      { input: 'B1_AZUL', expected: '3' },
      { input: 'AZUL', expected: '3' },
      { input: 'B2_AZUL', expected: '4' },
      { input: 'ESPECIAL', expected: '5' },
      { input: 'C1_BRANCA', expected: '1' },
      { input: 'ANTIMICROBIANO', expected: '1' },
      { input: '2', expected: '2' },
      { input: '3', expected: '3' },
    ];

    for (const { input, expected } of typesMap) {
      const { xml } = buildSngpcXml({
        ...baseParams,
        sales: [makeSale(input)],
      });
      expect(xml).toContain(`<tipoReceituarioMedicamento>${expected}</tipoReceituarioMedicamento>`);
    }
  });
});
