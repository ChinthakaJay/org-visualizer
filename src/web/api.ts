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
