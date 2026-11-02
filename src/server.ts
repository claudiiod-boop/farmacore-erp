import Fastify, { FastifyInstance } from 'fastify';
import { Database, getDatabase } from './database/connection';
import { runMigrations } from './database/migrator';
import { registerRoutes } from './api/routes';

export async function buildServer(db?: Database): Promise<FastifyInstance> {
  const database = db ?? getDatabase();
  runMigrations(database);

  const app = Fastify({
    logger: false,
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
