import Fastify, { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { Database, getDatabase } from './database/connection';
import { runMigrations } from './database/migrator';
import { seedCatalogIfEmpty } from './database/seeds/seed-catalog';
import { registerRoutes } from './api/routes';

export async function buildServer(db?: Database): Promise<FastifyInstance> {
  const database = db ?? getDatabase();
  runMigrations(database);
  seedCatalogIfEmpty(database);

  const app = Fastify({
    logger: false,
  });

  // Proteção contra Força Bruta e DoS (Rate Limiting de 300 req/min por IP)
  await app.register(rateLimit, {
    max: process.env.NODE_ENV === 'test' ? 100000 : 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Taxa limite de requisições excedida. Máximo de ${context.max} requisições por ${context.after}.`,
    }),
  });

  // Headers de Segurança HTTP (Anti-Clickjacking, X-Content-Type-Options)
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  await registerRoutes(app, database);
  await app.ready();

  return app;
}

export async function startServer(port = 3000, host = '0.0.0.0'): Promise<FastifyInstance> {
  const app = await buildServer();
  await app.listen({ port, host });
  console.log(`FarmaCore ERP Server listening on http://${host}:${port}`);
  return app;
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  startServer(port, host).catch((err) => {
    console.error('Failed to start FarmaCore server:', err);
    process.exit(1);
  });
}
