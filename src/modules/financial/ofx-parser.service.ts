import { ParsedOfxFile, ParsedOfxTransaction, BankTransactionType } from './bank-reconciliation.types';

export class OfxParserService {
  /**
   * Extrai o valor de uma tag OFX (suporta SGML sem fechamento e XML com fechamento).
   */
  private static extractTag(block: string, tag: string): string {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)(?:<\\/${tag}>)?`, 'i');
    const match = block.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Converte data no formato bancário YYYYMMDD ou YYYYMMDDHHMMSS para YYYY-MM-DD.
   */
  private static parseOfxDate(dateStr: string): string {
    if (!dateStr || dateStr.length < 8) return '';
    const clean = dateStr.trim();
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    return `${year}-${month}-${day}`;
  }

  /**
   * Decodifica entidades comuns de texto SGML/XML.
   */
  private static decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
  }

  /**
   * Processa conteúdo de arquivo OFX (versões 1.x e 2.x) e retorna estrutura padronizada.
   */
  static parse(ofxContent: string): ParsedOfxFile {
    if (!ofxContent || (!ofxContent.includes('<OFX>') && !ofxContent.includes('<ofx>'))) {
      throw new Error('Formato OFX inválido: cabeçalho ou bloco <OFX> ausente.');
    }

    const bankId = this.extractTag(ofxContent, 'BANKID') || '000';
    const accountId = this.extractTag(ofxContent, 'ACCTID') || '0000';
    const accountType = this.extractTag(ofxContent, 'ACCTTYPE') || 'CHECKING';
    const periodStart = this.parseOfxDate(this.extractTag(ofxContent, 'DTSTART'));
    const periodEnd = this.parseOfxDate(this.extractTag(ofxContent, 'DTEND'));

    const ledgerBalStr = this.extractTag(ofxContent, 'BALAMT') || '0.00';
    const ledgerBalance = parseFloat(ledgerBalStr.replace(',', '.')) || 0.0;

    // Isola as seções de transações <STMTTRN>
    const transactions: ParsedOfxTransaction[] = [];
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi;

    let match: RegExpExecArray | null;
    while ((match = stmtTrnRegex.exec(ofxContent)) !== null) {
      const block = match[1];

      const rawType = this.extractTag(block, 'TRNTYPE').toUpperCase();
      const rawDate = this.extractTag(block, 'DTPOSTED');
      const rawAmt = this.extractTag(block, 'TRNAMT');
      const fitid = this.extractTag(block, 'FITID');
      const checkNum = this.extractTag(block, 'CHECKNUM');
      const memo = this.decodeEntities(
        this.extractTag(block, 'MEMO') || this.extractTag(block, 'NAME') || 'Lançamento bancário'
      );

      const amount = parseFloat(rawAmt.replace(',', '.')) || 0.0;
      let type: BankTransactionType = 'OTHER';

      if (rawType === 'CREDIT' || amount > 0) {
        type = 'CREDIT';
      } else if (rawType === 'DEBIT' || amount < 0) {
        type = 'DEBIT';
      }

      if (fitid) {
        transactions.push({
          fitid,
          type,
          postedDate: this.parseOfxDate(rawDate),
          amount,
          documentNumber: checkNum || undefined,
          memo
        });
      }
    }

    return {
      bankId,
      accountId,
      accountType,
      periodStart: periodStart || (transactions[0]?.postedDate ?? ''),
      periodEnd: periodEnd || (transactions[transactions.length - 1]?.postedDate ?? ''),
      ledgerBalance,
      transactions
    };
  }
}
