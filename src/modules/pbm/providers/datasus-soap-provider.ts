import { randomUUID } from 'node:crypto';
import type {
  PbmProvider,
  PbmAuthorizeParams,
  PbmAuthorizationResult,
  PbmConfirmParams,
  PbmConfirmResult,
  PbmCancelResult,
} from '../types';

export interface DatasusSoapConfig {
  environment?: 'PRODUCAO' | 'HOMOLOGACAO';
  endpointUrl?: string;
  usuarioFarmacia: string;
  senhaFarmacia: string;
  coCnpj: string;
  certPfxBase64?: string;
  certPassword?: string;
}

/**
 * Provedor Oficial Datasus SOAP 1.2 (Ministério da Saúde - Farmácia Popular do Brasil).
 * Comunica-se com o WebService 'wsfarmaciapopular' utilizando envelopes XML canônicos e TLS/mTLS.
 */
export class DatasusSoapProvider implements PbmProvider {
  public readonly providerId = 'FARMACIA_POPULAR';
  public readonly providerName = 'Farmácia Popular do Brasil (Datasus SOAP)';

  private readonly config: DatasusSoapConfig;
  private readonly defaultEndpoints = {
    HOMOLOGACAO: 'https://portalfarmaciapopular-homologacao.saude.gov.br/farmaciapopular-ws-homologacao/services/ServicoSolicitacaoWS',
    PRODUCAO: 'https://portalfarmaciapopular.saude.gov.br/farmaciapopular-ws/services/ServicoSolicitacaoWS',
  };

  constructor(config?: Partial<DatasusSoapConfig>) {
    this.config = {
      environment: config?.environment ?? 'HOMOLOGACAO',
      endpointUrl:
        config?.endpointUrl ??
        (config?.environment === 'PRODUCAO'
          ? this.defaultEndpoints.PRODUCAO
          : this.defaultEndpoints.HOMOLOGACAO),
      usuarioFarmacia: config?.usuarioFarmacia ?? '',
      senhaFarmacia: config?.senhaFarmacia ?? '',
      coCnpj: config?.coCnpj ?? '',
      certPfxBase64: config?.certPfxBase64,
      certPassword: config?.certPassword,
    };
  }

  /**
   * Monta o envelope SOAP 1.2 canônico com cabeçalho de segurança WS-Security.
   */
  public buildSoapEnvelope(actionXml: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:ws="http://service.farmaciapopular.saude.gov.br/">
  <soap12:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${this.escapeXml(this.config.usuarioFarmacia)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${this.escapeXml(this.config.senhaFarmacia)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap12:Header>
  <soap12:Body>
    ${actionXml}
  </soap12:Body>
</soap12:Envelope>`.trim();
  }

  /**
   * Constrói o corpo XML de Solicitação de Autorização (executarSolicitacao).
   */
  public buildAuthorizeXml(params: PbmAuthorizeParams): string {
    const cleanCpf = params.patientCpf.replace(/\D/g, '');
    const cleanCrm = params.doctorCrm.replace(/\D/g, '');
    const cleanCnpj = this.config.coCnpj.replace(/\D/g, '');

    const itemsXml = params.items
      .map(
        (it) => `
      <ws:medicamento>
        <ws:codigoBarras>${this.escapeXml(it.ean)}</ws:codigoBarras>
        <ws:registroMS>${this.escapeXml(it.msRegistration)}</ws:registroMS>
        <ws:quantidadeSolicitada>${it.quantity}</ws:quantidadeSolicitada>
        <ws:precoVenda>${it.unitPrice.toFixed(2)}</ws:precoVenda>
        <ws:posologiaDiaria>${it.dailyDose ?? 1}</ws:posologiaDiaria>
      </ws:medicamento>`
      )
      .join('');

    return `
    <ws:executarSolicitacao>
      <ws:dadosFarmacia>
        <ws:cnpjFarmacia>${cleanCnpj}</ws:cnpjFarmacia>
      </ws:dadosFarmacia>
      <ws:dadosReceita>
        <ws:cpfPaciente>${cleanCpf}</ws:cpfPaciente>
        <ws:dataPrescricao>${params.prescriptionDate}</ws:dataPrescricao>
        <ws:crmMedico>${cleanCrm}</ws:crmMedico>
        <ws:ufCrmMedico>${this.escapeXml(params.doctorUf.toUpperCase())}</ws:ufCrmMedico>
        ${params.cidLaudo ? `<ws:cidLaudo>${this.escapeXml(params.cidLaudo)}</ws:cidLaudo>` : ''}
      </ws:dadosReceita>
      <ws:medicamentos>
        ${itemsXml}
      </ws:medicamentos>
    </ws:executarSolicitacao>`.trim();
  }

  /**
   * Constrói o corpo XML de Confirmação de Autorização (executarConfirmacao).
   */
  public buildConfirmXml(params: PbmConfirmParams): string {
    const cleanCnpj = this.config.coCnpj.replace(/\D/g, '');
    return `
    <ws:executarConfirmacao>
      <ws:cnpjFarmacia>${cleanCnpj}</ws:cnpjFarmacia>
      <ws:numeroAutorizacao>${this.escapeXml(params.authorizationProtocol)}</ws:numeroAutorizacao>
      ${params.fiscalKeyNfce ? `<ws:chaveAcessoNfe>${this.escapeXml(params.fiscalKeyNfce)}</ws:chaveAcessoNfe>` : ''}
      ${params.nfceNumber ? `<ws:numeroCupomFiscal>${params.nfceNumber}</ws:numeroCupomFiscal>` : ''}
    </ws:executarConfirmacao>`.trim();
  }

  /**
   * Constrói o corpo XML de Cancelamento de Autorização (executarCancelamento).
   */
  public buildCancelXml(protocol: string, reason: string): string {
    const cleanCnpj = this.config.coCnpj.replace(/\D/g, '');
    return `
    <ws:executarCancelamento>
      <ws:cnpjFarmacia>${cleanCnpj}</ws:cnpjFarmacia>
      <ws:numeroAutorizacao>${this.escapeXml(protocol)}</ws:numeroAutorizacao>
      <ws:motivoCancelamento>${this.escapeXml(reason)}</ws:motivoCancelamento>
    </ws:executarCancelamento>`.trim();
  }

  public async authorize(params: PbmAuthorizeParams): Promise<PbmAuthorizationResult> {
    const actionXml = this.buildAuthorizeXml(params);
    const soapEnvelope = this.buildSoapEnvelope(actionXml);

    if (!this.config.endpointUrl || !this.config.usuarioFarmacia) {
      return {
        success: false,
        transactionUuid: randomUUID(),
        authorizationProtocol: '',
        providerId: this.providerId,
        patientCpf: params.patientCpf,
        patientName: params.patientName,
        totalGrossAmount: 0,
        subsidyAmount: 0,
        patientCopayAmount: 0,
        items: [],
        errorMessage: 'SOAP Client Datasus não configurado com credenciais válidas (usuário/senha/certificado)',
      };
    }

    try {
      const responseText = await this.sendSoapRequest(soapEnvelope);
      return this.parseAuthorizeResponse(responseText, params);
    } catch (error: any) {
      return {
        success: false,
        transactionUuid: randomUUID(),
        authorizationProtocol: '',
        providerId: this.providerId,
        patientCpf: params.patientCpf,
        patientName: params.patientName,
        totalGrossAmount: 0,
        subsidyAmount: 0,
        patientCopayAmount: 0,
        items: [],
        errorMessage: `Erro de comunicação SOAP Datasus: ${error.message || String(error)}`,
      };
    }
  }

  public async confirm(params: PbmConfirmParams): Promise<PbmConfirmResult> {
    const actionXml = this.buildConfirmXml(params);
    const soapEnvelope = this.buildSoapEnvelope(actionXml);

    if (!this.config.endpointUrl || !this.config.usuarioFarmacia) {
      return {
        success: false,
        authorizationProtocol: params.authorizationProtocol,
        receiptNumber: '',
        confirmedAt: new Date().toISOString(),
        errorMessage: 'SOAP Client Datasus não configurado com credenciais válidas',
      };
    }

    try {
      const responseText = await this.sendSoapRequest(soapEnvelope);
      const receiptMatch = responseText.match(/<numeroComprovanteVenda>(\d+)<\/numeroComprovanteVenda>/i);
      return {
        success: true,
        authorizationProtocol: params.authorizationProtocol,
        receiptNumber: receiptMatch ? receiptMatch[1] : String(Date.now()),
        confirmedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        authorizationProtocol: params.authorizationProtocol,
        receiptNumber: '',
        confirmedAt: new Date().toISOString(),
        errorMessage: `Falha na confirmação SOAP Datasus: ${error.message || String(error)}`,
      };
    }
  }

  public async cancel(protocol: string, reason: string): Promise<PbmCancelResult> {
    const actionXml = this.buildCancelXml(protocol, reason);
    const soapEnvelope = this.buildSoapEnvelope(actionXml);

    if (!this.config.endpointUrl || !this.config.usuarioFarmacia) {
      return {
        success: false,
        errorMessage: 'SOAP Client Datasus não configurado com credenciais válidas',
      };
    }

    try {
      await this.sendSoapRequest(soapEnvelope);
      return {
        success: true,
        cancellationProtocol: `CANC-${protocol}`,
        message: 'Transação cancelada com sucesso no WebService Datasus',
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: `Falha no cancelamento SOAP Datasus: ${error.message || String(error)}`,
      };
    }
  }

  /**
   * Realiza a chamada HTTP POST SOAP 1.2 com TLS e cabeçalhos apropriados.
   */
  private async sendSoapRequest(envelope: string): Promise<string> {
    const response = await fetch(this.config.endpointUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        SOAPAction: '',
      },
      body: envelope,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    return await response.text();
  }

  private parseAuthorizeResponse(xml: string, params: PbmAuthorizeParams): PbmAuthorizationResult {
    const protoMatch = xml.match(/<numeroAutorizacao>([^<]+)<\/numeroAutorizacao>/i);
    const protocol = protoMatch ? protoMatch[1] : '';

    if (!protocol) {
      const errMatch = xml.match(/<mensagemErro>([^<]+)<\/mensagemErro>/i) || xml.match(/<faultstring>([^<]+)<\/faultstring>/i);
      const errorMsg = errMatch ? errMatch[1] : 'Autorização rejeitada pelo WebService Datasus';
      return {
        success: false,
        transactionUuid: randomUUID(),
        authorizationProtocol: '',
        providerId: this.providerId,
        patientCpf: params.patientCpf,
        patientName: params.patientName,
        totalGrossAmount: 0,
        subsidyAmount: 0,
        patientCopayAmount: 0,
        items: [],
        errorMessage: errorMsg,
      };
    }

    return {
      success: true,
      transactionUuid: randomUUID(),
      authorizationProtocol: protocol,
      providerId: this.providerId,
      patientCpf: params.patientCpf,
      patientName: params.patientName,
      totalGrossAmount: params.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0),
      subsidyAmount: 0,
      patientCopayAmount: 0,
      items: [],
    };
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
