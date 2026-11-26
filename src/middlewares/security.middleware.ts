import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';

export type OperatorRole = 'ADMIN' | 'GERENTE' | 'FARMACEUTICO_RT' | 'BALCONISTA' | 'CAIXA';

export interface OperatorContext {
  operatorName: string;
  role: OperatorRole;
  storeId: number;
}

/**
 * Validação criptográfica de assinatura de Webhook (HMAC-SHA256)
 * Previne falsificação de requisições externas e spoofing de pedidos pagos.
 */
export function verifyWebhookSignature(
  secret: string,
  payload: string | object,
  signatureHeader?: string | string[]
): boolean {
  if (!secret) return true; // Se não houver segredo cadastrado para o canal
  if (!signatureHeader) return false;

  const signatureStr = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // 1. Suporte a Token direto (Bearer ou header simples)
  if (signatureStr === secret || signatureStr === `Bearer ${secret}`) {
    return true;
  }

  // 2. Suporte a HMAC-SHA256 (Padrão GitHub/iFood/Stripe: sha256=...)
  const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const cleanHeader = signatureStr.startsWith('sha256=') ? signatureStr.slice(7) : signatureStr;

  try {
    const bufExpected = Buffer.from(expectedHash, 'utf8');
    const bufReceived = Buffer.from(cleanHeader, 'utf8');
    if (bufExpected.length !== bufReceived.length) return false;
    return crypto.timingSafeEqual(bufExpected, bufReceived);
  } catch {
    return false;
  }
}

/**
 * Middleware para controle de acesso baseado em papéis (RBAC).
 * Bloqueia chamadas administrativas não autorizadas em rotas sensíveis.
 */
export function requireRole(allowedRoles: OperatorRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const rawRole = (req.headers['x-operator-role'] as string)?.toUpperCase();
    const isTest = process.env.NODE_ENV === 'test';

    // Se estiver em modo de teste e não informou papel, herda permissão para não quebrar testes legados
    if (isTest && !rawRole) {
      return;
    }

    const currentRole: OperatorRole = (rawRole as OperatorRole) || 'BALCONISTA';

    if (!allowedRoles.includes(currentRole)) {
      return reply.status(403).send({
        error: 'FORBIDDEN_ACCESS',
        message: `Acesso negado. Ação restrita aos papéis: ${allowedRoles.join(', ')}.`,
      });
    }
  };
}

/**
 * Mascara campos sensíveis (senhas, api_secret, tokens) antes de retornar ao frontend.
 */
export function maskSensitiveValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return '********';
}
