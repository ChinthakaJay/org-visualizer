import { createHash } from 'node:crypto';
import { watch } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, dirname, extname, resolve, sep } from 'node:path';
import { TEMPLATE } from '../core/template';

/** ADR-0002: the server owns one Org file, binds to 127.0.0.1, and touches nothing else. */
export interface ServerOptions {
  filePath: string;
  /** Folder holding the built front end. */
  staticDir: string;
  /** 0 picks a free port. */
  port: number;
}

export interface RunningServer {
  url: string;
  address: string;
  port: number;
  close(): Promise<void>;
}

const HOST = '127.0.0.1';
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost']);
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export const versionOf = (text: string) => createHash('sha1').update(text).digest('hex');

export async function startServer(options: ServerOptions): Promise<RunningServer> {
  const filePath = resolve(options.filePath);
  const staticDir = resolve(options.staticDir);

  if (!(await exists(filePath))) await writeFile(filePath, TEMPLATE, 'utf8');

  const readOrg = async () => {
    const text = await readFile(filePath, 'utf8');
    return { path: filePath, text, version: versionOf(text) };
  };

  /** The version last written by us or announced to clients, so our own saves aren't echoed as outside edits. */
  let knownVersion = (await readOrg()).version;

  /** Saves only if the file on disk is still the version the client last saw. */
  const save = async (text: string, baseVersion: string): Promise<[number, unknown]> => {
    const current = await readOrg();
    if (current.version !== baseVersion) return [409, current];
    knownVersion = versionOf(text);
    await writeFile(filePath, text, 'utf8');
    return [200, { version: knownVersion }];
  };

  const listeners = new Set<ServerResponse>();
  const announce = (event: string, data: unknown) => {
    for (const res of listeners) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Watch the folder, not the file: many editors (and git) save by replacing the file.
  let debounce: NodeJS.Timeout | undefined;
  const watcher = watch(dirname(filePath), (_type, name) => {
    if (name !== null && name !== basename(filePath)) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      serialized(async () => {
        const current = await readOrg().catch(() => null);
        if (!current || current.version === knownVersion) return;
        knownVersion = current.version;
        announce('change', current);
      });
    }, 40);
  });

  const openEvents = (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
    res.write(': connected\n\n');
    listeners.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(ping);
      listeners.delete(res);
    });
  };

  let queue: Promise<unknown> = Promise.resolve();
  const serialized = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const hostname = (req.headers.host ?? '').replace(/:\d+$/, '');
    if (!ALLOWED_HOSTS.has(hostname)) return send(res, 403, 'Forbidden');

    const url = new URL(req.url ?? '/', 'http://localhost');
    const named = url.searchParams.get('path');
    if (named !== null && resolve(named) !== filePath) return send(res, 403, 'Only the Org file this server was started with is available');

    if (url.pathname === '/api/file' && req.method === 'GET') return sendJson(res, 200, await readOrg());
    if (url.pathname === '/api/file' && req.method === 'PUT') {
      const body = await readJson(req);
      if (typeof body?.text !== 'string' || typeof body?.baseVersion !== 'string') return send(res, 400, 'Expected { text, baseVersion }');
      return sendJson(res, ...(await serialized(() => save(body.text, body.baseVersion))));
    }
    if (url.pathname === '/api/events' && req.method === 'GET') return openEvents(req, res);
    if (url.pathname.startsWith('/api/')) return send(res, 404, 'Not found');

    return serveStatic(res, staticDir, url.pathname);
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => send(res, 500, String(err?.message ?? err)));
  });

  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(options.port, HOST, () => ok());
  });
  const { address, port } = server.address() as AddressInfo;

  return {
    url: `http://${HOST}:${port}`,
    address,
    port,
    close: () => new Promise((ok) => {
      watcher.close();
      clearTimeout(debounce);
      for (const res of listeners) res.end();
      server.closeAllConnections();
      server.close(() => ok());
    }),
  };
}

async function serveStatic(res: ServerResponse, root: string, pathname: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  const target = resolve(root, '.' + decoded);
  if (target !== root && !target.startsWith(root + sep)) return send(res, 403, 'Forbidden');

  const file = (await isFile(target)) ? target : resolve(root, 'index.html');
  if (!(await isFile(file))) return send(res, 404, 'Front end not built. Run `npm run build`.');
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}

const MAX_BODY = 5 * 1024 * 1024;

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function send(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function exists(path: string) {
  return stat(path).then(() => true, () => false);
}

async function isFile(path: string) {
  return stat(path).then((s) => s.isFile(), () => false);
}
