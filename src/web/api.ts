export interface OrgFile {
  path: string;
  text: string;
  version: string;
}

export async function fetchOrgFile(): Promise<OrgFile> {
  const res = await fetch('/api/file');
  if (!res.ok) throw new Error(`Couldn't read the Org file (${res.status})`);
  return res.json();
}

export type SaveResult = { ok: true; version: string } | { ok: false; disk: OrgFile };

/** Saves only if the file on disk is still `baseVersion`; otherwise returns what's on disk now. */
export async function saveOrgFile(text: string, baseVersion: string): Promise<SaveResult> {
  const res = await fetch('/api/file', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, baseVersion }),
  });
  if (res.status === 409) return { ok: false, disk: await res.json() };
  if (!res.ok) throw new Error(`Couldn't save the Org file (${res.status})`);
  return { ok: true, version: (await res.json()).version };
}

/**
 * Calls `onChange` with the Org file whenever it changes on disk outside the app.
 * After a dropped connection reconnects, it re-reads the file in case a change was missed.
 */
export function watchOrgFile(onChange: (file: OrgFile) => void): () => void {
  const source = new EventSource('/api/events');
  let opened = false;
  source.addEventListener('change', (e) => onChange(JSON.parse((e as MessageEvent).data)));
  source.addEventListener('open', () => {
    if (opened) fetchOrgFile().then(onChange, () => {});
    opened = true;
  });
  return () => source.close();
}
