import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATE } from '../../src/core';
import { main } from '../../src/server/cli';
import { startServer, type RunningServer } from '../../src/server/server';

let dir: string;
let webDir: string;
let running: RunningServer | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'org-visualizer-'));
  webDir = join(dir, 'web');
  await mkdir(webDir);
  await writeFile(join(webDir, 'index.html'), '<!doctype html><title>Org Visualizer</title>');
});

afterEach(async () => {
  await running?.close();
  running = undefined;
  await rm(dir, { recursive: true, force: true });
});

const start = async (file: string) => {
  running = await startServer({ filePath: file, port: 0, staticDir: webDir });
  return running;
};

describe('server: reading the Org file', () => {
  it('returns the text, the path and a version stamp', async () => {
    const file = join(dir, 'org.txt');
    await writeFile(file, 'team a : A\n');
    const { url } = await start(file);

    const res = await fetch(`${url}/api/file`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ path: file, text: 'team a : A\n' });
    expect(typeof body.version).toBe('string');
  });

  it('gives a different version stamp once the text changes', async () => {
    const file = join(dir, 'org.txt');
    await writeFile(file, 'a\n');
    const { url } = await start(file);
    const v1 = (await (await fetch(`${url}/api/file`)).json()).version;
    await writeFile(file, 'b\n');
    const v2 = (await (await fetch(`${url}/api/file`)).json()).version;
    expect(v2).not.toBe(v1);
  });

  it('creates a missing Org file from the template and serves it', async () => {
    const file = join(dir, 'new-org.txt');
    const { url } = await start(file);

    expect(await readFile(file, 'utf8')).toBe(TEMPLATE);
    const body = await (await fetch(`${url}/api/file`)).json();
    expect(body.text).toBe(TEMPLATE);
  });

  it('serves the front end', async () => {
    const { url } = await start(join(dir, 'org.txt'));
    const res = await fetch(`${url}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Org Visualizer');
  });
});

describe('server: safety', () => {
  it('listens on 127.0.0.1 only', async () => {
    const { address } = await start(join(dir, 'org.txt'));
    expect(address).toBe('127.0.0.1');
  });

  it('refuses a request naming any other file path', async () => {
    const file = join(dir, 'org.txt');
    await writeFile(join(dir, 'secret.txt'), 'secret');
    const { url } = await start(file);

    const res = await fetch(`${url}/api/file?path=${encodeURIComponent(join(dir, 'secret.txt'))}`);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('secret');
  });

  it('accepts a request naming the Org file itself', async () => {
    const file = join(dir, 'org.txt');
    const { url } = await start(file);
    const res = await fetch(`${url}/api/file?path=${encodeURIComponent(file)}`);
    expect(res.status).toBe(200);
  });

  it('refuses to serve files outside the front end through path traversal', async () => {
    const file = join(dir, 'org.txt');
    await writeFile(file, 'top secret colleague notes');
    const { url } = await start(file);

    for (const path of ['/../org.txt', '/%2e%2e/org.txt', '/org.txt', '/..%2forg.txt']) {
      const res = await fetch(`${url}${path}`);
      expect(await res.text()).not.toContain('top secret');
    }
  });

  it('refuses requests addressed to a host other than localhost', async () => {
    const { port } = await start(join(dir, 'org.txt'));
    const status = await new Promise<number | undefined>((ok, fail) => {
      request({ host: '127.0.0.1', port, path: '/api/file', headers: { host: 'evil.example' } }, (res) => {
        res.resume();
        ok(res.statusCode);
      }).on('error', fail).end();
    });
    expect(status).toBe(403);
  });
});

describe('cli', () => {
  it('prints usage and exits non-zero when no path is given', async () => {
    const errors: string[] = [];
    const code = await main([], { error: (s: string) => errors.push(s), log: () => {} });
    expect(code).not.toBe(0);
    expect(errors.join('\n')).toMatch(/usage/i);
  });
});

describe('server: saving the Org file', () => {
  const save = (url: string, body: unknown) =>
    fetch(`${url}/api/file`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  it('saves the text when the client sends the current version', async () => {
    const file = join(dir, 'org.txt');
    await writeFile(file, 'a : A\n');
    const { url } = await start(file);
    const { version } = await (await fetch(`${url}/api/file`)).json();

    const res = await save(url, { text: 'a : Alice\n', baseVersion: version });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(await readFile(file, 'utf8')).toBe('a : Alice\n');
    expect(body.version).not.toBe(version);
    expect((await (await fetch(`${url}/api/file`)).json()).version).toBe(body.version);
  });

  it('rejects a save with a stale version and leaves the file on disk untouched', async () => {
    const file = join(dir, 'org.txt');
    await writeFile(file, 'a : A\n');
    const { url } = await start(file);
    const { version } = await (await fetch(`${url}/api/file`)).json();
    await writeFile(file, 'a : Changed outside\n');

    const res = await save(url, { text: 'a : Mine\n', baseVersion: version });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ text: 'a : Changed outside\n' });
    expect(await readFile(file, 'utf8')).toBe('a : Changed outside\n');
  });

  it('rejects a save without text', async () => {
    const file = join(dir, 'org.txt');
    const { url } = await start(file);
    const res = await save(url, { baseVersion: 'x' });
    expect(res.status).toBe(400);
  });
});
