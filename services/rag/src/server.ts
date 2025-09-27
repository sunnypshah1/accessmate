import { Buffer } from 'node:buffer';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { log } from '@accessmate/diagnostics';
import { retrieveGuidelines, type QueryInput } from './ingest.js';

async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', (error) => reject(error));
  });
}

async function handleQuery(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const rawBody = await readBody(request);
    const payload = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    const query = normalizeQueryInput(payload);

    const matches = await retrieveGuidelines(query, { limit: payload?.limit ?? 5 });

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ matches }));
  } catch (error) {
    log.error('Failed to handle retrieval request', {
      error: error instanceof Error ? error.message : String(error),
    });
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        error: 'Invalid request payload',
      }),
    );
  }
}

function normalizeQueryInput(payload: any): QueryInput {
  const query: QueryInput = {};
  if (payload && typeof payload.ruleId === 'string') {
    query.ruleId = payload.ruleId;
  }
  if (payload && typeof payload.contextSnippet === 'string') {
    query.contextSnippet = payload.contextSnippet;
  }
  return query;
}

export function createHttpServer() {
  return createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/query') {
      await handleQuery(request, response);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not Found' }));
  });
}

export async function startServer(port = Number(process.env.PORT ?? 4100)) {
  const server = createHttpServer();
  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      log.info('RAG retrieval server listening', { port });
      resolve();
    });
  });
  return server;
}
