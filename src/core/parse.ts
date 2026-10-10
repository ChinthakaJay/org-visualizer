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
      else problems.push({ severity: 'error', line, message: `"${field}" isn't key=value` });
    }

    const m = head.match(/^(?:(team)\s+)?(\S+)\s*(?::\s*(.*))?$/);
    if (!m || !ID.test(m[2])) {
      problems.push({ severity: 'error', line, message: `Can't read "${head}". Expected "<id> : <Name>" or "team <id> : <Title>"` });
      return;
    }
    const [, teamKeyword, id, label] = m;
    const name = (label ?? '').trim() || id;
    const existing = teamKeyword ? teams.get(id) : people.get(id);
    if (existing) {
      const kind = teamKeyword ? 'Team' : 'Person';
      problems.push({ severity: 'error', line, message: `${kind} "${id}" is already defined on line ${existing.line}; this line is ignored` });
      return;
    }

    if (teamKeyword) {
      teams.set(id, { id, title: name, parent: attrs.parent || null, line, placeholder: false });
    } else {
      const manager = attrs.reports && attrs.reports !== '?' ? attrs.reports : null;
      people.set(id, { id, name, team: attrs.team || null, manager, line, placeholder: false });
    }
  });

  resolve(teams, people, problems);
  problems.sort((a, b) => a.line - b.line);
  return { teams, people, problems };
}

/** Create Placeholders for unknown ids, cut Team loops, and flag impossible Reporting lines. */
function resolve(teams: Map<string, Team>, people: Map<string, Person>, problems: Problem[]) {
  const placeholderTeam = (id: string, why: string, line: number) => {
    if (!teams.has(id)) teams.set(id, { id, title: id, parent: null, line: null, placeholder: true });
    if (teams.get(id)!.placeholder) {
      problems.push({ severity: 'info', line, message: `Team "${id}" isn't defined (${why}), so it's drawn as a dashed Placeholder` });
    }
  };
  const placeholderPerson = (id: string, why: string, line: number) => {
    if (!people.has(id)) people.set(id, { id, name: id, team: null, manager: null, line: null, placeholder: true });
    if (people.get(id)!.placeholder) {
      problems.push({ severity: 'info', line, message: `${why} "${id}" isn't listed yet, so they're drawn as a dashed Placeholder` });
    }
  };

  for (const t of [...teams.values()]) {
    if (t.parent) placeholderTeam(t.parent, `Parent team of ${t.id}`, t.line!);
  }

  // A Team can't sit inside itself: if walking up from t comes back to t, cut t's parent link.
  for (const t of teams.values()) {
    const path = [t.id];
    let cur = t;
    while (cur.parent) {
      if (cur.parent === t.id) {
        problems.push({ severity: 'error', line: t.line!, message: `Team loop: ${[...path, t.id].join(' → ')}. "${t.id}" is shown at the top level until this is fixed` });
        t.parent = null;
        break;
      }
      // t leads into a loop it isn't part of; that loop's own walk reports it.
      if (path.includes(cur.parent)) break;
      path.push(cur.parent);
      cur = teams.get(cur.parent)!;
    }
  }

  for (const p of [...people.values()]) {
    if (p.placeholder) continue;
    if (p.team) placeholderTeam(p.team, `Team of ${p.id}`, p.line!);
    if (p.manager === p.id) {
      problems.push({ severity: 'error', line: p.line!, message: `${p.id} reports to themselves; that Reporting line is dropped` });
      p.manager = null;
    } else if (p.manager) {
      placeholderPerson(p.manager, 'Manager', p.line!);
    }
  }

  const loopsSeen = new Set<string>();
  for (const p of people.values()) {
    const path = [p.id];
    let cur = p;
    while (cur.manager) {
      if (path.includes(cur.manager)) {
        const key = [...path].sort().join();
        if (cur.manager === p.id && !loopsSeen.has(key)) {
          loopsSeen.add(key);
          problems.push({ severity: 'warning', line: p.line!, message: `Reporting loop: ${[...path, p.id].join(' → ')}` });
        }
        break;
      }
      path.push(cur.manager);
      cur = people.get(cur.manager)!;
    }
  }
}
