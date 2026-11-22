import { describe, it, expect } from 'vitest';
import { OfxParserService } from '../../../src/modules/financial/ofx-parser.service';

describe('OfxParserService', () => {
  const sampleSgmlOfx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260601120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>341
<ACCTID>0057-12345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601
<DTEND>20260605
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260601100000[-03:EST]
<TRNAMT>1250.75
<FITID>20260601001
<CHECKNUM>00001
<MEMO>DEP DINHEIRO LOTERICA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260602143000
<TRNAMT>-450.00
<FITID>20260602002
<MEMO>PAG BOLETO DISTR PROFARMA
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260603080000
<TRNAMT>3890.20
<FITID>20260603003
<MEMO>LIQ CIELO CARTAO
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>15420.50
<DTASOF>20260605
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  const sampleXmlOfx = `<?xml version="1.0" encoding="utf-8" ?>
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKACCTFROM>
          <BANKID>001</BANKID>
          <ACCTID>1234-99999-0</ACCTID>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260701</DTSTART>
          <DTEND>20260702</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260701120000</DTPOSTED>
            <TRNAMT>-25.00</TRNAMT>
            <FITID>BB-001</FITID>
            <MEMO>TARIFA MENSAL CONTA</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>5000.00</BALAMT>
          <DTASOF>20260702</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;

  it('should parse standard SGML OFX 1.x format correctly', () => {
    const result = OfxParserService.parse(sampleSgmlOfx);

    expect(result.bankId).toBe('341');
    expect(result.accountId).toBe('0057-12345-6');
    expect(result.periodStart).toBe('2026-06-01');
    expect(result.periodEnd).toBe('2026-06-05');
    expect(result.ledgerBalance).toBe(15420.50);
    expect(result.transactions).toHaveLength(3);

    const t1 = result.transactions[0];
    expect(t1.fitid).toBe('20260601001');
    expect(t1.type).toBe('CREDIT');
    expect(t1.postedDate).toBe('2026-06-01');
    expect(t1.amount).toBe(1250.75);
    expect(t1.documentNumber).toBe('00001');
    expect(t1.memo).toBe('DEP DINHEIRO LOTERICA');

    const t2 = result.transactions[1];
    expect(t2.fitid).toBe('20260602002');
    expect(t2.type).toBe('DEBIT');
    expect(t2.postedDate).toBe('2026-06-02');
    expect(t2.amount).toBe(-450.00);
    expect(t2.memo).toBe('PAG BOLETO DISTR PROFARMA');
  });

  it('should parse XML OFX 2.x format with closing tags correctly', () => {
    const result = OfxParserService.parse(sampleXmlOfx);

    expect(result.bankId).toBe('001');
    expect(result.accountId).toBe('1234-99999-0');
    expect(result.periodStart).toBe('2026-07-01');
    expect(result.periodEnd).toBe('2026-07-02');
    expect(result.ledgerBalance).toBe(5000.00);
    expect(result.transactions).toHaveLength(1);

    const t1 = result.transactions[0];
    expect(t1.fitid).toBe('BB-001');
    expect(t1.type).toBe('DEBIT');
    expect(t1.postedDate).toBe('2026-07-01');
    expect(t1.amount).toBe(-25.00);
    expect(t1.memo).toBe('TARIFA MENSAL CONTA');
  });

  it('should throw descriptive error when OFX content has no transactions list or account info', () => {
    expect(() => {
      OfxParserService.parse('INVALID NON-OFX CONTENT');
    }).toThrow(/formato ofx inválido/i);
  });
});
