import type { Org, Person, Problem, Team } from './org';

const ID = /^[A-Za-z_][\w.-]*$/;

/** Parse Org file text into Teams, People and Problems. Lines may come in any order. */
export function parse(text: string): Org {
  const teams = new Map<string, Team>();
  const people = new Map<string, Person>();
  const problems: Problem[] = [];

  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const content = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!content) return;

    const [head, ...fields] = content.split('|').map((s) => s.trim());
    const attrs: Record<string, string> = {};
    for (const field of fields) {
      if (!field) continue;
      const m = field.match(/^([\w-]+)\s*=\s*(.*)$/);
      if (m) attrs[m[1].toLowerCase()] = m[2].trim();
    }

    const m = head.match(/^(?:(team)\s+)?(\S+)\s*(?::\s*(.*))?$/);
    if (!m || !ID.test(m[2])) return;
    const [, teamKeyword, id, label] = m;
    const name = (label ?? '').trim() || id;

    if (teamKeyword) {
      teams.set(id, { id, title: name, parent: attrs.parent || null, line, placeholder: false });
    } else {
      const manager = attrs.reports && attrs.reports !== '?' ? attrs.reports : null;
      people.set(id, { id, name, team: attrs.team || null, manager, line, placeholder: false });
    }
  });

  return { teams, people, problems };
}
