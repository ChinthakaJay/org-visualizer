/** Text edits on the Org file: pure text in, text out, plus the line that changed. */

export interface TextEdit {
  text: string;
  /** 1-based line that changed, or null when the edit touched several. */
  line: number | null;
  /** The line before the edit; null for an added line. */
  before: string | null;
  /** The line after the edit. */
  after: string | null;
}

/** Append a line after the last non-blank line. */
export function addLine(text: string, line: string): TextEdit {
  const body = text.replace(/\s*$/, '');
  if (!body) return { text: `${line}\n`, line: 1, before: null, after: line };
  return { text: `${body}\n${line}\n`, line: body.split('\n').length + 1, before: null, after: line };
}

/** Define a Placeholder Person or Team by appending a stub line for it, ready to fill in. */
export function definePlaceholder(text: string, kind: 'person' | 'team', id: string): TextEdit {
  return addLine(text, kind === 'team' ? `team ${id} : ${id}` : `${id} : ${id}`);
}
