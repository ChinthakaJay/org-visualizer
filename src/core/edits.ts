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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Set key=value on the line that defines a Person or Team: a one-line edit. An existing value is
 * replaced, keeping column alignment where the new value fits; a missing key is added before any
 * trailing comment.
 */
export function setField(text: string, kind: 'person' | 'team', id: string, key: string, value: string): TextEdit {
  const lines = text.split('\n');
  const end = '(?=\\s|:|\\||$)';
  const re = kind === 'team' ? new RegExp(`^\\s*team\\s+${escapeRegExp(id)}${end}`) : new RegExp(`^\\s*${escapeRegExp(id)}${end}`);
  const i = lines.findIndex((l) => re.test(l) && (kind === 'team' || !/^\s*team\s/.test(l)));
  if (i < 0) return { text, line: null, before: null, after: null };

  const before = lines[i];
  const commentAt = before.search(/\s#/);
  const body = commentAt < 0 ? before : before.slice(0, commentAt + 1);
  const comment = commentAt < 0 ? '' : before.slice(commentAt + 1);
  const fieldRe = new RegExp(`(\\|\\s*${escapeRegExp(key)}\\s*=\\s*)([^|\\s]*)(\\s*)(?=\\||$)`);
  const m = body.match(fieldRe);
  let after: string;
  if (m) {
    const width = m[2].length + m[3].length;
    const pad = m[3].length === 0 ? '' : ' '.repeat(Math.max(1, width - value.length));
    after = body.replace(fieldRe, `$1${value}${pad}`) + comment;
  } else {
    after = body.replace(/\s*$/, ` | ${key}=${value}`) + (comment ? `  ${comment.trimStart()}` : '');
  }
  lines[i] = after;
  return { text: lines.join('\n'), line: i + 1, before, after };
}
