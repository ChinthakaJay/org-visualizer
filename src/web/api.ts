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
