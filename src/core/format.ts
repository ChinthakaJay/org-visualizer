import { HEAD, ID } from './parse';

/**
 * Tidy the spacing of Org file text without changing what it means: one space either side of ":"
 * and "|", "key=value" with no spaces, one space before a trailing comment, and no leading or
 * trailing whitespace. Lines are never reordered. Blank lines, comment-only lines and lines that
 * can't be read are left exactly as they are.
 */
export function format(text: string): string {
  return text.split('\n').map(formatLine).join('\n');
}

function formatLine(raw: string): string {
  const cr = raw.endsWith('\r') ? '\r' : '';
  const line = cr ? raw.slice(0, -1) : raw;
  if (!line.trim() || line.trimStart().startsWith('#')) return raw;

  // A comment starts at a "#" that begins the line or follows whitespace, as in parse.
  const commentAt = line.search(/(^|\s)#/);
  const content = commentAt < 0 ? line : line.slice(0, commentAt);
  const comment = commentAt < 0 ? '' : line.slice(line.indexOf('#', commentAt)).trimEnd();

  const [head, ...fields] = content.split('|').map((s) => s.trim());
  const m = head.match(HEAD);
  if (!m || !ID.test(m[2])) return raw;
  const [, teamKeyword, id, label] = m;
  let out = `${teamKeyword ? 'team ' : ''}${id}${label === undefined ? '' : label ? ` : ${label.trim()}` : ' :'}`;

  for (const field of fields) {
    if (!field) {
      out += ' |';
      continue;
    }
    const f = field.match(/^([\w-]+)\s*=\s*(.*)$/);
    if (!f) return raw;
    out += ` | ${f[1]}=${f[2].trim()}`;
  }
  return `${out}${comment ? ` ${comment}` : ''}${cr}`;
}
