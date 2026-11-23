import type { ClinicalAttendance } from './clinical.types';

export class DsfFormatter {
  public static formatDsfSlip(
    att: ClinicalAttendance,
    store: any = {},
    copyType: 'PACIENTE' | 'ESTABELECIMENTO' = 'PACIENTE'
  ): string {
    const pad = (str: string, len: number, align: 'left' | 'right' | 'center' = 'left') => {
      const s = str.slice(0, len);
      if (align === 'center') {
        const left = Math.floor((len - s.length) / 2);
        const right = len - s.length - left;
        return ' '.repeat(left) + s + ' '.repeat(right);
      }
      return align === 'right' ? s.padStart(len, ' ') : s.padEnd(len, ' ');
    };

    const storeName = store.name || store.company_name || 'DROGARIA FARMACORE';
    const storeCnpj = store.cnpj || '00.000.000/0001-00';
    const storePhone = store.phone || '(11) 9999-8888';
    const storeAddress = `${store.street || 'RUA PRINCIPAL'}, ${store.number || '100'} - ${store.city || 'SAO PAULO'}/${store.state || 'SP'}`;

    const lines: string[] = [];
    lines.push('================================================');
    lines.push(pad(storeName.toUpperCase(), 48, 'center'));
    lines.push(pad('DECLARACAO DE SERVICO FARMACEUTICO - DSF', 48, 'center'));
    lines.push(pad('(RDC ANVISA 44/2009 & RDC 777/2023)', 48, 'center'));
    lines.push(pad(copyType === 'PACIENTE' ? '*** 1a VIA: PACIENTE ***' : '*** 2a VIA: ESTABELECIMENTO ***', 48, 'center'));
    lines.push('================================================');
    lines.push(`NUMERO DSF:  ${att.dsfNumber || 'EM ANDAMENTO'}`);
    lines.push(`ATENDIMENTO: ${att.attendanceCode}`);
    lines.push(`DATA / HORA: ${att.completedAt || att.createdAt}`);
    lines.push('------------------------------------------------');
    lines.push('DADOS DO ESTABELECIMENTO FARMACEUTICO:');
    lines.push(`  CNPJ:     ${storeCnpj}`);
    lines.push(`  ENDERECO: ${storeAddress}`);
    lines.push(`  CONTATO:  ${storePhone}`);
    lines.push('------------------------------------------------');
    lines.push('FARMACEUTICO(A) RESPONSAVEL:');
    lines.push(`  NOME: ${att.pharmacist?.name || 'FARMACEUTICO DE PLANTAO'}`);
    lines.push(`  CRF:  ${att.pharmacist?.crfNumber || '99999'}/${att.pharmacist?.crfUf || 'SP'}`);
    lines.push('------------------------------------------------');
    lines.push('DADOS DO PACIENTE:');
    lines.push(`  NOME:      ${att.patientName}`);
    lines.push(`  CPF:       ${att.patientCpf || 'NAO INFORMADO'}`);
    lines.push(`  DATA NASC: ${att.patientBirthDate || 'NAO INFORMADA'}`);
    lines.push(`  TELEFONE:  ${att.patientPhone || 'NAO INFORMADO'}`);
    lines.push('------------------------------------------------');

    // Sinais Vitais
    lines.push('SINAIS VITAIS & PARAMETROS BIOQUIMICOS:');
    if (att.bloodPressureSystolic && att.bloodPressureDiastolic) {
      lines.push(`  PRESSAO ARTERIAL: ${att.bloodPressureSystolic}x${att.bloodPressureDiastolic} mmHg`);
    }
    if (att.heartRate) {
      lines.push(`  FREQ. CARDIACA:   ${att.heartRate} bpm`);
    }
    if (att.temperature) {
      lines.push(`  TEMPERATURA:      ${att.temperature.toFixed(1)} oC`);
    }
    if (att.oxygenSaturation) {
      lines.push(`  SATURACAO O2:     ${att.oxygenSaturation}% SpO2`);
    }

    // Procedimentos
    if (att.procedures && att.procedures.length > 0) {
      lines.push('------------------------------------------------');
      lines.push('PROCEDIMENTOS CLINICOS EXECUTADOS:');
      for (const p of att.procedures) {
        lines.push(`  * ${p.procedureType}`);
        if (p.medicationName) {
          lines.push(`    MEDICAMENTO: ${p.medicationName} (Lote: ${p.medicationBatch || 'S/L'})`);
        }
        if (p.applicationSite) {
          lines.push(`    LOCAL APLICACAO: ${p.applicationSite}`);
        }
        if (p.prescriberName) {
          lines.push(`    PRESCRITOR: ${p.prescriberName} (${p.prescriberCrm || ''})`);
        }
      }
    }

    // Testes Rápidos TLR
    if (att.rapidTests && att.rapidTests.length > 0) {
      lines.push('------------------------------------------------');
      lines.push('TESTES LABORATORIAIS RAPIDOS (TLR - RDC 777/23):');
      for (const t of att.rapidTests) {
        lines.push(`  * EXAME: ${t.testType}`);
        lines.push(`    REAGENTE:   ${t.reagentName}`);
        lines.push(`    LOTE / VAL: ${t.reagentBatch} (Val: ${t.reagentExpiration})`);
        lines.push(`    REG. MS:    ${t.reagentMsRegistration}`);
        lines.push(`    RESULTADO:  ${t.resultValue} [${t.resultInterpretation}]`);
        if (t.referenceRange) {
          lines.push(`    VAL. REF.:  ${t.referenceRange}`);
        }
      }
    }

    // Orientações / Anamnese
    if (att.anamnesisNotes) {
      lines.push('------------------------------------------------');
      lines.push('OBSERVACOES & ORIENTACOES FARMACOTERAPEUTICAS:');
      lines.push(`  ${att.anamnesisNotes}`);
    }

    lines.push('------------------------------------------------');
    lines.push(pad('ALERTA SANITARIO OBRIGATORIO (RDC 777/2023):', 48, 'center'));
    lines.push('  Os testes de triagem e parâmetros aferidos nesta');
    lines.push('  farmacia nao tem finalidade de diagnostico final');
    lines.push('  e nao substituem a consulta medica formal.');
    lines.push('================================================');
    lines.push('');
    lines.push('  ______________________________________________');
    lines.push(pad('Assinatura do(a) Farmaceutico(a)', 48, 'center'));
    lines.push(pad(`CRF-${att.pharmacist?.crfUf || 'SP'} no ${att.pharmacist?.crfNumber || ''}`, 48, 'center'));
    lines.push('');
    lines.push('  ______________________________________________');
    lines.push(pad('Assinatura do(a) Paciente / Responsavel', 48, 'center'));
    lines.push('================================================');

    return lines.join('\n');
  }
}
