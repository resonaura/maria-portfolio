import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCompress from '@fastify/compress';
import fastifyHttpProxy from '@fastify/http-proxy';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(
  __dirname,
  process.env.BUILD_OUTPUT_PATH || 'dist'
);
const port = Number(process.env.PORT) || 2979;
const host = process.env.HOST || '0.0.0.0';
// Where the @maria-portfolio/api image-optimization service is reachable from
// this process. In a co-located deploy (single host/container group) the
// default loopback address is correct; set API_URL to point elsewhere otherwise.
const apiUrl = process.env.API_URL || 'http://127.0.0.1:4100';

const app = Fastify({ logger: true });

await app.register(fastifyCompress);

// Proxy image requests to the api service so the browser only ever talks to
// this single public port, mirroring the Vite dev-server proxy in vite.config.ts.
await app.register(fastifyHttpProxy, {
  upstream: apiUrl,
  prefix: '/img',
  rewritePrefix: '/img'
});
await app.register(fastifyHttpProxy, {
  upstream: apiUrl,
  prefix: '/img-manifest',
  rewritePrefix: '/img-manifest'
});

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
