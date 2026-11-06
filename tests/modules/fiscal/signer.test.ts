import { describe, it, expect } from 'vitest';
import {
  signXml,
  canonicalizeXml,
  computeDigestValue,
  createTestCertificate,
} from '../../../src/modules/fiscal/signer';
import * as crypto from 'node:crypto';

describe('XML-DSig A1 Digital Signer', () => {
  const sampleXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe35261112345678000195650010000001001123456780" versao="4.00"><ide><cUF>35</cUF><natOp>VENDA</natOp><mod>65</mod><nNF>100</nNF></ide><emit><CNPJ>12345678000195</CNPJ><xNome>DROGARIA TESTE</xNome></emit><total><ICMSTot><vNF>100.00</vNF></ICMSTot></total></infNFe></NFe>`;

  it('should canonicalize XML snippet removing whitespace differences and declaration', () => {
    const raw = `<?xml version="1.0" encoding="UTF-8"?>
    <infNFe   Id="NFe123"   versao="4.00" >
      <ide>
        <cUF>35</cUF>
      </ide>
    </infNFe>`;

    const canonical = canonicalizeXml(raw);

    expect(canonical).not.toContain('<?xml');
    expect(canonical).not.toContain('\r');
    expect(canonical).toContain('<infNFe Id="NFe123" versao="4.00">');
  });

  it('should compute base64 SHA-1 digest value of infNFe node', () => {
    const infNFeXml = `<infNFe Id="NFe35261112345678000195650010000001001123456780" versao="4.00"><ide><cUF>35</cUF></ide></infNFe>`;
    const digest = computeDigestValue(infNFeXml);

    expect(typeof digest).toBe('string');
    expect(digest.length).toBeGreaterThan(0);

    // Verify it is a valid base64 representation of a 20-byte SHA-1 hash (28 chars with padding)
    const buf = Buffer.from(digest, 'base64');
    expect(buf.length).toBe(20);
  });

  it('should sign XML and append Signature element with SignedInfo, SignatureValue, and KeyInfo', () => {
    const { xmlSigned, digestValue, signatureValue } = signXml(sampleXml);

    expect(xmlSigned).toContain('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">');
    expect(xmlSigned).toContain('<SignedInfo');
    expect(xmlSigned).toContain('<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>');
    expect(xmlSigned).toContain('<Reference URI="#NFe35261112345678000195650010000001001123456780">');
    expect(xmlSigned).toContain(`<DigestValue>${digestValue}</DigestValue>`);
    expect(xmlSigned).toContain(`<SignatureValue>${signatureValue}</SignatureValue>`);
    expect(xmlSigned).toContain('<KeyInfo><X509Data><X509Certificate>');
    expect(xmlSigned.endsWith('</Signature></NFe>')).toBe(true);
  });

  it('should verify signature mathematically using the public key', () => {
    const testCert = createTestCertificate();
    const { xmlSigned, signatureValue } = signXml(sampleXml, testCert.pfxBase64);

    // Extract SignedInfo
    const signedInfoMatch = xmlSigned.match(/<SignedInfo[\s\S]*?<\/SignedInfo>/);
    expect(signedInfoMatch).not.toBeNull();
    const canonicalSignedInfo = canonicalizeXml(signedInfoMatch![0]);

    // Verify using RSA-SHA1 with public key from test certificate
    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(canonicalSignedInfo, 'utf8');
    const isValid = verifier.verify(testCert.certPem, signatureValue, 'base64');

    expect(isValid).toBe(true);
  });

  it('should generate test certificate and keys with createTestCertificate', () => {
    const cert = createTestCertificate();

    expect(cert.pfxBase64).toBeDefined();
    expect(cert.certPem).toContain('BEGIN');
    expect(cert.keyPem).toContain('BEGIN PRIVATE KEY');
  });
});
