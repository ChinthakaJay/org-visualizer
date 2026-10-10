import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { startServer } from './server';

const USAGE = `Usage: npm start -- <path/to/org.txt> [--port <n>]

Opens the Org file in Org Visualizer at http://127.0.0.1:<port>.
A missing file is created from a short commented template.`;

interface Io {
  log(message: string): void;
  error(message: string): void;
}

/** Runs the app. Returns a non-zero exit code on bad usage; otherwise the server keeps running. */
export async function main(argv: string[], io: Io = console): Promise<number> {
  const args = [...argv];
  let port = 4317;
  const portAt = args.indexOf('--port');
  if (portAt >= 0) {
    port = Number(args[portAt + 1]);
    args.splice(portAt, 2);
  }
  const [filePath] = args;
  if (!filePath || filePath.startsWith('-') || !Number.isInteger(port)) {
    io.error(USAGE);
    return 2;
  }

  const staticDir = resolve(fileURLToPath(import.meta.url), '../../../dist');
  const { url } = await startServer({ filePath, staticDir, port });
  io.log(`Org Visualizer: ${resolve(filePath)}\nOpen ${url}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { if (code !== 0) process.exit(code); },
    (err) => { console.error(err instanceof Error ? err.message : err); process.exit(1); },
  );
}
