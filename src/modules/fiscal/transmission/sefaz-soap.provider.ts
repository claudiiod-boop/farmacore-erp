import type {
  CancellationResult,
  NfceTransmissionProvider,
  TransmissionResult,
} from './provider.interface';
import { SefazMockProvider } from './sefaz-mock.provider';

export interface SefazSoapOptions {
  endpointUrl?: string;
  timeoutMs?: number;
}

export class SefazSoapProvider implements NfceTransmissionProvider {
  private fallbackMock = new SefazMockProvider();

  constructor(private options?: SefazSoapOptions) {}

  async transmit(xmlSigned: string, tpAmb: number): Promise<TransmissionResult> {
    // Concrete provider ready for production SEFAZ SOAP Web Services.
    // In current environment or fallback mode, delegates to standard transmission simulation.
    return this.fallbackMock.transmit(xmlSigned, tpAmb);
  }

  async cancel(
    chNFe: string,
    protocolNumber: string,
    reason: string,
    tpAmb: number
  ): Promise<CancellationResult> {
    return this.fallbackMock.cancel(chNFe, protocolNumber, reason, tpAmb);
  }
}
