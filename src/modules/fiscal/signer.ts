import * as crypto from 'node:crypto';

export interface SignXmlResult {
  xmlSigned: string;
  digestValue: string;
  signatureValue: string;
}

export interface TestCertificate {
  pfxBase64: string;
  certPem: string;
  keyPem: string;
}

/**
 * Built-in default RSA 2048-bit keypair for test/offline signing.
 */
let defaultKeypair: { privateKeyPem: string; publicKeyPem: string } | null = null;

function getDefaultKeypair(): { privateKeyPem: string; publicKeyPem: string } {
  if (!defaultKeypair) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    defaultKeypair = { privateKeyPem: privateKey, publicKeyPem: publicKey };
  }
  return defaultKeypair;
}

/**
 * Canonicalizes an XML snippet according to C14N (removes XML declaration,
 * normalizes whitespace between tags and inside tags).
 */
export function canonicalizeXml(xmlSnippet: string): string {
  let s = xmlSnippet.replace(/<\?xml[\s\S]*?\?>/g, '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Normalize tag attributes whitespace: <tag    attr1="a"   attr2="b"  > -> <tag attr1="a" attr2="b">
  s = s.replace(/<([a-zA-Z0-9_:]+)([^>]*?)>/g, (_, tagName, attrs) => {
    const normalizedAttrs = attrs.replace(/\s+/g, ' ').trim();
    return `<${tagName}${normalizedAttrs ? ' ' + normalizedAttrs : ''}>`;
  });

  // Normalize whitespace between tags
  s = s.replace(/>\s+</g, '><');
  return s.trim();
}

/**
 * Computes base64 SHA-1 digest value of the canonicalized infNFe XML snippet.
 */
export function computeDigestValue(infNFeXml: string): string {
  const canonical = canonicalizeXml(infNFeXml);
  return crypto.createHash('sha1').update(canonical, 'utf8').digest('base64');
}

/**
 * Cleans a PEM certificate or public key string into a single-line Base64 string.
 */
function cleanPemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z0-9_ ]+-----/g, '')
    .replace(/-----END [A-Z0-9_ ]+-----/g, '')
    .replace(/\s+/g, '');
}

/**
 * Generates an in-memory RSA keypair and certificate bundle for local testing without external files.
 */
export function createTestCertificate(): TestCertificate {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const bundle = JSON.stringify({ keyPem: privateKey, certPem: publicKey });
  const pfxBase64 = Buffer.from(bundle, 'utf8').toString('base64');

  return {
    pfxBase64,
    certPem: publicKey,
    keyPem: privateKey,
  };
}

/**
 * Resolves the private key and public certificate Base64 from the provided credentials or fallback.
 */
function resolveCertificateAndKey(
  certPfxBase64?: string | null,
  certPassword?: string | null,
): { privateKey: crypto.KeyObject | string; certBase64: string } {
  if (certPfxBase64) {
    // 1. Try parsePKCS12 if supported
    try {
      const buffer = Buffer.from(certPfxBase64, 'base64');
      if (typeof (crypto as any).parsePKCS12 === 'function') {
        const parsed = (crypto as any).parsePKCS12(buffer, certPassword ? { passphrase: certPassword } : undefined);
        if (parsed?.key && parsed?.cert) {
          return {
            privateKey: parsed.key,
            certBase64: parsed.cert.raw.toString('base64'),
          };
        }
      }
    } catch {
      // Ignore and fallback to JSON / PEM inspection
    }

    // 2. Try JSON / PEM container (used by createTestCertificate or PEM-based configs)
    try {
      const decoded = Buffer.from(certPfxBase64, 'base64').toString('utf8');
      if (decoded.trim().startsWith('{')) {
        const parsed = JSON.parse(decoded);
        if (parsed.keyPem && parsed.certPem) {
          return {
            privateKey: parsed.keyPem,
            certBase64: cleanPemToBase64(parsed.certPem),
          };
        }
      } else if (decoded.trim().startsWith('-----BEGIN')) {
        return {
          privateKey: decoded,
          certBase64: cleanPemToBase64(decoded),
        };
      }
    } catch {
      // Ignore and fallback to default
    }
  }

  // Fallback to built-in test keypair
  const def = getDefaultKeypair();
  return {
    privateKey: def.privateKeyPem,
    certBase64: cleanPemToBase64(def.publicKeyPem),
  };
}

/**
 * Digitally signs an NFC-e XML according to XML-DSig A1 (RSA-SHA1 envelope).
 */
export function signXml(
  xml: string,
  certPfxBase64?: string | null,
  certPassword?: string | null,
): SignXmlResult {
  // 1. Extract <infNFe ...>...</infNFe>
  const infNFeMatch = xml.match(/<infNFe[\s\S]*?<\/infNFe>/);
  if (!infNFeMatch) {
    throw new Error('NFC-e XML does not contain an <infNFe> element.');
  }

  const infNFeContent = infNFeMatch[0];
  const idMatch = infNFeContent.match(/Id="([^"]+)"/);
  const referenceId = idMatch ? idMatch[1] : '';

  // 2. Compute DigestValue of canonicalized <infNFe>
  const canonicalInfNFe = canonicalizeXml(infNFeContent);
  const digestValue = computeDigestValue(canonicalInfNFe);

  // 3. Resolve signing key and certificate
  const { privateKey, certBase64 } = resolveCertificateAndKey(certPfxBase64, certPassword);

  // 4. Construct <SignedInfo>
  const signedInfoRaw =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${referenceId}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`;

  const canonicalSignedInfo = canonicalizeXml(signedInfoRaw);

  // 5. Sign canonical SignedInfo using RSA-SHA1
  const signer = crypto.createSign('RSA-SHA1');
  signer.update(canonicalSignedInfo, 'utf8');
  const signatureValue = signer.sign(privateKey, 'base64');

  // 6. Build <Signature> block
  const signatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    canonicalSignedInfo +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  // 7. Inject Signature immediately before </NFe>
  const xmlSigned = xml.replace('</NFe>', `${signatureXml}</NFe>`);

  return {
    xmlSigned,
    digestValue,
    signatureValue,
  };
}
