import { describe, it, expect, beforeEach } from 'vitest';
import { DatasusMockProvider } from '../../../src/modules/pbm/providers/datasus-mock-provider';
import type { PbmAuthorizeParams } from '../../../src/modules/pbm/types';

describe('DatasusMockProvider (Farmácia Popular Simulator)', () => {
  let provider: DatasusMockProvider;

  // CPF válido gerado por algoritmo módulo 11
  const validCpf = '11144477735';

  beforeEach(() => {
    provider = new DatasusMockProvider();
  });

  it('should authorize 100% free medications (Hypertension, Diabetes, Asthma)', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Maria de Souza',
      patientBirthDate: '1970-05-15',
      doctorCrm: '12345',
      doctorUf: 'SP',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: 1,
          ean: '7891234567890',
          msRegistration: '100430001',
          productName: 'Losartana Potassica 50mg 30 comp',
          quantity: 1,
          unitPrice: 15.0,
          dailyDose: 1,
        },
        {
          productId: 2,
          ean: '7891234567891',
          msRegistration: '100430002',
          productName: 'Metformina 850mg 30 comp',
          quantity: 2,
          unitPrice: 10.0,
          dailyDose: 2,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(true);
    expect(res.authorizationProtocol).toMatch(/^FP\d{8}\d{6}$/);
    expect(res.totalGrossAmount).toBe(35.0);
    expect(res.subsidyAmount).toBe(35.0);
    expect(res.patientCopayAmount).toBe(0.0);
    expect(res.items).toHaveLength(2);
    expect(res.items[0].programType).toBe('GRATUITO');
    expect(res.items[0].subsidyTotalPrice).toBe(15.0);
    expect(res.items[0].patientTotalPrice).toBe(0.0);
    expect(res.items[1].programType).toBe('GRATUITO');
    expect(res.items[1].subsidyTotalPrice).toBe(20.0);
    expect(res.items[1].patientTotalPrice).toBe(0.0);
  });

  it('should authorize co-payment medications (Dyslipidemia, Parkinson) with up to 90% subsidy', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Jose Silva',
      patientBirthDate: '1965-01-20',
      doctorCrm: '54321',
      doctorUf: 'RJ',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: 10,
          ean: '7899999999010',
          msRegistration: '100430010',
          productName: 'Sinvastatina 20mg 30 comp',
          quantity: 1,
          unitPrice: 20.0,
          dailyDose: 1,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(true);
    expect(res.items[0].programType).toBe('CO_PAGAMENTO');
    expect(res.items[0].unitGrossPrice).toBe(20.0);
    // Subsídio de 90%: 18.00 | Paciente: 2.00
    expect(res.items[0].subsidyTotalPrice).toBe(18.0);
    expect(res.items[0].patientTotalPrice).toBe(2.0);
    expect(res.subsidyAmount).toBe(18.0);
    expect(res.patientCopayAmount).toBe(2.0);
  });

  it('should grant 100% subsidy for all medications when isBolsaFamilia is true', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Ana Clara',
      patientBirthDate: '1988-11-03',
      doctorCrm: '99887',
      doctorUf: 'MG',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      isBolsaFamilia: true,
      items: [
        {
          productId: 10,
          ean: '7899999999010',
          msRegistration: '100430010',
          productName: 'Sinvastatina 20mg 30 comp', // Normalmente co-pagamento
          quantity: 2,
          unitPrice: 20.0,
          dailyDose: 1,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(true);
    expect(res.items[0].programType).toBe('GRATUITO');
    expect(res.items[0].subsidyTotalPrice).toBe(40.0);
    expect(res.items[0].patientTotalPrice).toBe(0.0);
    expect(res.subsidyAmount).toBe(40.0);
    expect(res.patientCopayAmount).toBe(0.0);
  });

  it('should reject authorization if CPF ends in 99 (30-day interval violation)', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: '11144477799', // final 99 simula bloqueio de 30 dias
      patientName: 'Lucas Oliveira',
      doctorCrm: '11223',
      doctorUf: 'PR',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: 1,
          ean: '7891234567890',
          msRegistration: '100430001',
          productName: 'Losartana Potassica 50mg',
          quantity: 1,
          unitPrice: 10.0,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(false);
    expect(res.errorMessage).toContain('71: QUANTIDADE MAXIMA MENSAL ATINGIDA');
  });

  it('should reject authorization if prescription date is older than 180 days for general medications', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 181);

    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Carlos Prado',
      doctorCrm: '33445',
      doctorUf: 'SC',
      prescriptionDate: oldDate.toISOString().slice(0, 10),
      items: [
        {
          productId: 1,
          ean: '7891234567890',
          msRegistration: '100430001',
          productName: 'Losartana Potassica 50mg',
          quantity: 1,
          unitPrice: 12.0,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(false);
    expect(res.errorMessage).toMatch(/RECEITA.*VENCIDA|VALIDADE.*EXPIRADA/i);
  });

  it('should accept authorization for contraceptives with prescription up to 365 days', async () => {
    const validContraceptiveDate = new Date();
    validContraceptiveDate.setDate(validContraceptiveDate.getDate() - 250); // > 180 mas <= 365

    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Juliana Lima',
      patientBirthDate: '1995-03-10',
      doctorCrm: '77889',
      doctorUf: 'RS',
      prescriptionDate: validContraceptiveDate.toISOString().slice(0, 10),
      items: [
        {
          productId: 20,
          ean: '7891112223334',
          msRegistration: '100430050',
          productName: 'Anticoncepcional Enantato de Noretisterona + Valerato de Estradiol',
          quantity: 1,
          unitPrice: 18.0,
          dailyDose: 1,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(true);
    expect(res.items[0].programType).toBe('GRATUITO');
    expect(res.subsidyAmount).toBe(18.0);
    expect(res.patientCopayAmount).toBe(0.0);
  });

  it('should reject diapers for patients under 60 years old without CID laudo', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Roberto Jovem',
      patientBirthDate: '1985-06-20', // ~41 anos (< 60)
      doctorCrm: '44556',
      doctorUf: 'BA',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: 30,
          ean: '7890000000030',
          msRegistration: '100430099',
          productName: 'Fralda Geriatrica Descartavel Tamanho G',
          quantity: 40,
          unitPrice: 1.5,
          dailyDose: 4,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(false);
    expect(res.errorMessage).toMatch(/RESTRICAO ETARIA|IDADE MINIMA.*60/i);
  });

  it('should accept diapers for patients under 60 years old when CID laudo is provided', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: validCpf,
      patientName: 'Roberto Jovem com Laudo',
      patientBirthDate: '1985-06-20', // < 60 anos
      doctorCrm: '44556',
      doctorUf: 'BA',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      cidLaudo: 'R32', // Incontinência urinária não especificada
      items: [
        {
          productId: 30,
          ean: '7890000000030',
          msRegistration: '100430099',
          productName: 'Fralda Geriatrica Descartavel Tamanho G',
          quantity: 40,
          unitPrice: 1.5,
          dailyDose: 4,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(true);
    expect(res.items[0].programType).toBe('CO_PAGAMENTO');
  });

  it('should reject invalid CPF digits', async () => {
    const params: PbmAuthorizeParams = {
      providerId: 'FARMACIA_POPULAR',
      patientCpf: '111.444.777-00', // Dígitos verificadores incorretos
      patientName: 'Invalido Silva',
      doctorCrm: '11111',
      doctorUf: 'SP',
      prescriptionDate: new Date().toISOString().slice(0, 10),
      items: [
        {
          productId: 1,
          ean: '7891234567890',
          msRegistration: '100430001',
          productName: 'Losartana Potassica 50mg',
          quantity: 1,
          unitPrice: 10.0,
        },
      ],
    };

    const res = await provider.authorize(params);

    expect(res.success).toBe(false);
    expect(res.errorMessage).toMatch(/CPF.*INVALIDO/i);
  });

  it('should confirm authorization and return official receipt number', async () => {
    const confirmRes = await provider.confirm({
      authorizationProtocol: 'FP20261116000001',
      saleId: 105,
      fiscalKeyNfce: '35261112345678000190650010000001051000001058',
      nfceNumber: 105,
    });

    expect(confirmRes.success).toBe(true);
    expect(confirmRes.authorizationProtocol).toBe('FP20261116000001');
    expect(confirmRes.receiptNumber).toBeDefined();
    expect(confirmRes.confirmedAt).toBeDefined();
  });

  it('should cancel authorization and return cancellation protocol', async () => {
    const cancelRes = await provider.cancel('FP20261116000001', 'Desistencia do cliente no caixa');

    expect(cancelRes.success).toBe(true);
    expect(cancelRes.cancellationProtocol).toContain('FP20261116000001');
    expect(cancelRes.message).toBeDefined();
  });
});
