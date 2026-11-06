import type {
  CancellationResult,
  NfceTransmissionProvider,
  TransmissionResult,
} from './provider.interface';

export class SefazMockProvider implements NfceTransmissionProvider {
  async transmit(xmlSigned: string, tpAmb: number): Promise<TransmissionResult> {
    if (!xmlSigned.includes('<Signature')) {
      return {
        success: false,
        cStat: 297,
        xMotivo: 'Rejeicao: Assinatura Difere do Calculado',
      };
    }

    const match = xmlSigned.match(/Id="NFe([0-9]{44})"/);
    const chNFe = match ? match[1] : '';

    const protocolNumber = `135${new Date().getFullYear()}${Math.floor(
      100000000 + Math.random() * 900000000
    )}`;
    const protocolDate = new Date().toISOString();

    const xmlAuthorized = `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">${xmlSigned}<protNFe versao="4.00"><infProt><tpAmb>${tpAmb}</tpAmb><verAplic>MOCK_SEFAZ_4.00</verAplic><chNFe>${chNFe}</chNFe><dhRecbto>${protocolDate}</dhRecbto><nProt>${protocolNumber}</nProt><digVal>MOCK_DIGEST_VAL</digVal><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></nfeProc>`;

    return {
      success: true,
      cStat: 100,
      xMotivo: 'Autorizado o uso da NF-e',
      protocolNumber,
      protocolDate,
      xmlAuthorized,
    };
  }

  async cancel(
    _chNFe: string,
    _protocolNumber: string,
    reason: string,
    _tpAmb: number
  ): Promise<CancellationResult> {
    if (reason.length < 15) {
      return {
        success: false,
        cStat: 494,
        xMotivo: 'Rejeicao: Chassi invalido ou justificativa menor que 15 caracteres',
      };
    }

    return {
      success: true,
      cStat: 135,
      xMotivo: 'Evento registrado e vinculado a NF-e',
      cancellationProtocol: `135${Date.now()}`,
      cancellationDate: new Date().toISOString(),
    };
  }
}
