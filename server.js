import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(
  __dirname,
  process.env.BUILD_OUTPUT_PATH || 'dist'
);
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

const app = Fastify({ logger: true });

await app.register(fastifyCompress);
await app.register(fastifyStatic, {
  root: distDir,
  setHeaders(reply, filePath) {
    if (filePath.endsWith('index.html')) {
      reply.header('Cache-Control', 'no-cache');
    } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      reply.header('Cache-Control', 'public, max-age=3600');
    }
  }
});

app.setNotFoundHandler((_req, reply) => {
  reply.sendFile('index.html');
});

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
