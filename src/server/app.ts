import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { env } from './env';
import { registerAuthPlugin } from './auth/plugin';
import { registerAuthRoutes } from './auth/routes';
import { registerUsersRoutes } from './users/routes';
import { registerTeacherGroupsRoutes } from './teacher-groups/routes';
import { registerClassesRoutes } from './classes/routes';
import { registerAssignmentsRoutes } from './assignments/routes';
import { registerSubmissionsRoutes } from './submissions/routes';
import { registerGradesRoutes } from './grades/routes';
import { registerStatsRoutes } from './stats/routes';

// Create and configure Fastify instance.
export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register cookie plugin (for JWT storage).
  await fastify.register(fastifyCookie);

  // Register CORS plugin (allow frontend to call API).
  await fastify.register(fastifyCors, {
    origin: true,
    credentials: true,
  });

  // Register auth plugin (provides requireAuth, requireRole middleware).
  await registerAuthPlugin(fastify);

  // Register all route modules.
  await registerAuthRoutes(fastify);
  await registerUsersRoutes(fastify);
  await registerTeacherGroupsRoutes(fastify);
  await registerClassesRoutes(fastify);
  await registerAssignmentsRoutes(fastify);
  await registerSubmissionsRoutes(fastify);
  await registerGradesRoutes(fastify);
  await registerStatsRoutes(fastify);

  // Health check endpoint.
  fastify.get('/health', async (_request, reply) => {
    return reply.send({ ok: true });
  });

  return fastify;
}
