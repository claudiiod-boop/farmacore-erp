export interface TransmissionResult {
  success: boolean;
  cStat: number;
  xMotivo: string;
  protocolNumber?: string;
  protocolDate?: string;
  xmlAuthorized?: string;
}

export interface CancellationResult {
  success: boolean;
  cStat: number;
  xMotivo: string;
  cancellationProtocol?: string;
  cancellationDate?: string;
}

export interface NfceTransmissionProvider {
  transmit(xmlSigned: string, tpAmb: number): Promise<TransmissionResult>;
  cancel(
    chNFe: string,
    protocolNumber: string,
    reason: string,
    tpAmb: number
  ): Promise<CancellationResult>;
}
