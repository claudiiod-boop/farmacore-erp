import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  verifyWebhookSignature,
  requireRole,
  maskSensitiveValue,
} from '../../src/middlewares/security.middleware';

describe('Security Middleware & Hardening Suite', () => {
  describe('verifyWebhookSignature', () => {
    const secret = 'super-secret-key-12345';
    const payload = { orderId: 'PED-999', total: 150.5 };

    it('1. Deve aceitar token direto simples ou formato Bearer', () => {
      expect(verifyWebhookSignature(secret, payload, secret)).toBe(true);
      expect(verifyWebhookSignature(secret, payload, `Bearer ${secret}`)).toBe(true);
    });

    it('2. Deve aceitar assinatura HMAC-SHA256 válida (com ou sem prefixo sha256=)', () => {
      const rawBody = JSON.stringify(payload);
      const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      expect(verifyWebhookSignature(secret, payload, hash)).toBe(true);
      expect(verifyWebhookSignature(secret, payload, `sha256=${hash}`)).toBe(true);
    });

    it('3. Deve rejeitar requisição com assinatura adulterada ou incorreta', () => {
      const invalidHash = '0000000000000000000000000000000000000000000000000000000000000000';
      expect(verifyWebhookSignature(secret, payload, invalidHash)).toBe(false);
      expect(verifyWebhookSignature(secret, payload, 'Bearer invalid-token')).toBe(false);
    });

    it('4. Deve rejeitar se o header de assinatura estiver ausente quando o secret for obrigatório', () => {
      expect(verifyWebhookSignature(secret, payload, undefined)).toBe(false);
      expect(verifyWebhookSignature(secret, payload, '')).toBe(false);
    });

    it('5. Deve permitir requisições quando o canal não possui secret cadastrado (modo aberto)', () => {
      expect(verifyWebhookSignature('', payload, undefined)).toBe(true);
    });
  });

  describe('maskSensitiveValue', () => {
    it('deve mascarar credenciais retornando asteriscos e manter null/undefined', () => {
      expect(maskSensitiveValue('minha-chave-secreta')).toBe('********');
      expect(maskSensitiveValue(null)).toBeNull();
      expect(maskSensitiveValue(undefined)).toBeNull();
    });
  });

  describe('requireRole', () => {
    it('deve bloquear operadores com papéis não autorizados com HTTP 403', async () => {
      const middleware = requireRole(['ADMIN', 'GERENTE']);
      let statusSent: number | null = null;
      let bodySent: any = null;

      const mockReq: any = {
        headers: {
          'x-operator-role': 'BALCONISTA',
        },
      };

      const mockReply: any = {
        status(code: number) {
          statusSent = code;
          return this;
        },
        send(data: any) {
          bodySent = data;
          return this;
        },
      };

      await middleware(mockReq, mockReply);
      expect(statusSent).toBe(403);
      expect(bodySent?.error).toBe('FORBIDDEN_ACCESS');
    });

    it('deve permitir operadores autorizados (ex: ADMIN)', async () => {
      const middleware = requireRole(['ADMIN', 'GERENTE']);
      let statusSent: number | null = null;

      const mockReq: any = {
        headers: {
          'x-operator-role': 'ADMIN',
        },
      };

      const mockReply: any = {
        status(code: number) {
          statusSent = code;
          return this;
        },
        send() {
          return this;
        },
      };

      await middleware(mockReq, mockReply);
      expect(statusSent).toBeNull();
    });
  });
});
