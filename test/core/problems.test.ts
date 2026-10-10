import { describe, expect, it } from 'vitest';
import { buildScene, parse } from '../../src/core';
import { box, card, contains, line } from './helpers';

const lines = (...ls: string[]) => ls.join('\n') + '\n';

describe('parse: basic syntax', () => {
  it('ignores comments and blank lines, and keeps line numbers', () => {
    const org = parse(lines('# a comment', '', 'team a : A   # trailing comment', 'x : X | team=a # note'));
    expect(org.teams.get('a')).toMatchObject({ title: 'A', line: 3 });
    expect(org.people.get('x')).toMatchObject({ name: 'X', team: 'a', line: 4 });
    expect(org.problems).toEqual([]);
  });

  it('reads lines in any order', () => {
    const org = parse(lines('x : X | team=b | reports=y', 'y : Y | team=a', 'team b : B | parent=a', 'team a : A'));
    expect(org.teams.get('b')).toMatchObject({ parent: 'a', placeholder: false });
    expect(org.people.get('x')).toMatchObject({ team: 'b', manager: 'y', placeholder: false });
    expect([...org.people.values()].filter((p) => p.placeholder)).toEqual([]);
    expect(org.problems).toEqual([]);
  });

  it('treats reports=? and a missing reports as no Reporting line', () => {
    const org = parse(lines('a : A | reports=?', 'b : B'));
    expect(org.people.get('a')!.manager).toBeNull();
    expect(org.people.get('b')!.manager).toBeNull();
    expect(org.people.size).toBe(2);
  });
});

describe('parse: Placeholders', () => {
  it('turns an unknown team= into a top-level Placeholder Team, with an info Problem on that line', () => {
    const org = parse(lines('team payments : Payments', 'dan : Dan | team=paymnts'));
    expect(org.teams.get('paymnts')).toMatchObject({ id: 'paymnts', title: 'paymnts', parent: null, line: null, placeholder: true });
    expect(org.problems).toEqual([{ severity: 'info', line: 2, message: expect.stringContaining('"paymnts"') }]);
  });

  it('turns an unknown parent= into a top-level Placeholder Team', () => {
    const org = parse(lines('team ml : ML | parent=platform'));
    expect(org.teams.get('platform')).toMatchObject({ placeholder: true, parent: null });
    expect(org.problems).toMatchObject([{ severity: 'info', line: 1 }]);
  });

  it('turns an unknown reports= into a Placeholder Person with no Team', () => {
    const org = parse(lines('eve : Eve | reports=frank'));
    expect(org.people.get('frank')).toMatchObject({ id: 'frank', name: 'frank', team: null, manager: null, line: null, placeholder: true });
    expect(org.problems).toMatchObject([{ severity: 'info', line: 1, message: expect.stringContaining('"frank"') }]);
  });

  it('makes one Placeholder for several references, with a Problem on each referencing line', () => {
    const org = parse(lines('a : A | reports=boss', 'b : B | reports=boss'));
    expect([...org.people.values()].filter((p) => p.placeholder)).toHaveLength(1);
    expect(org.problems.map((p) => p.line)).toEqual([1, 2]);
  });
});

describe('parse: Problems', () => {
  it('reports an unparseable line, saying what was expected', () => {
    const org = parse(lines('team a : A', '!!! nonsense', 'b : B'));
    expect(org.problems).toEqual([{ severity: 'error', line: 2, message: expect.stringMatching(/expected/i) }]);
    expect(org.people.has('b')).toBe(true);
  });

  it('reports a field that isn\'t key=value', () => {
    const org = parse(lines('a : A | team payments'));
    expect(org.problems).toEqual([{ severity: 'error', line: 1, message: expect.stringContaining('key=value') }]);
  });

  it('reports a duplicate id with the line of the first definition, and ignores the later line', () => {
    const org = parse(lines('alice : Alice | team=a', 'team a : A', 'alice : Alice Again | team=b', 'team a : A2'));
    expect(org.people.get('alice')).toMatchObject({ name: 'Alice', line: 1 });
    expect(org.teams.get('a')).toMatchObject({ title: 'A', line: 2 });
    expect(org.teams.has('b')).toBe(false);
    expect(org.problems).toEqual([
      { severity: 'error', line: 3, message: expect.stringContaining('line 1') },
      { severity: 'error', line: 4, message: expect.stringContaining('line 2') },
    ]);
  });

  it('lets a Team and a Person share an id', () => {
    const org = parse(lines('team risk : Risk', 'risk : Risk Bot | team=risk'));
    expect(org.problems).toEqual([]);
  });

  it('reports a Team loop on the looping Team\'s line and shows that Team at the top level', () => {
    const org = parse(lines('team a : A | parent=c', 'team b : B | parent=a', 'team c : C | parent=b'));
    expect(org.problems).toEqual([{ severity: 'error', line: 1, message: expect.stringMatching(/team loop/i) }]);
    expect(org.teams.get('a')!.parent).toBeNull();
    expect(org.teams.get('b')!.parent).toBe('a');
    expect(org.teams.get('c')!.parent).toBe('b');
  });

  it('reports a Team that is its own Parent team', () => {
    const org = parse(lines('team a : A | parent=a'));
    expect(org.problems).toMatchObject([{ severity: 'error', line: 1 }]);
    expect(org.teams.get('a')!.parent).toBeNull();
  });

  it('reports a Reporting-line loop once, as a warning, and keeps the Reporting lines', () => {
    const org = parse(lines('a : A | reports=c', 'b : B | reports=a', 'c : C | reports=b'));
    expect(org.problems).toEqual([{ severity: 'warning', line: 1, message: expect.stringMatching(/reporting loop/i) }]);
    expect(org.people.get('a')!.manager).toBe('c');
  });

  it('reports someone reporting to themselves and drops that Reporting line', () => {
    const org = parse(lines('a : A | reports=a'));
    expect(org.problems).toEqual([{ severity: 'error', line: 1, message: expect.stringContaining('themselves') }]);
    expect(org.people.get('a')!.manager).toBeNull();
  });

  it('lists Problems in line order', () => {
    const org = parse(lines('a : A | reports=a', 'team t : T | parent=t', '???'));
    expect(org.problems.map((p) => p.line)).toEqual([1, 2, 3]);
  });
});

const SAMPLE = lines(
  "# org.txt: one fact per line, order doesn't matter",
  'team fintech  : FinTech',
  'team platform : Platform',
  'team payments : Payments  | parent=fintech',
  'team risk     : Risk      | parent=fintech',
  'team cards    : Cards     | parent=payments',
  '',
  'bob   : Bob Jones   | team=fintech  | role=Director',
  'alice : Alice Smith | team=payments | reports=bob   | role=EM',
  'dan   : Dan Ruiz    | team=cards    | reports=alice',
  'gia   : Gia Lam     | team=cards    | reports=alice',
  'carol : Carol Lee   | team=risk     | reports=bob',
  'eve   : Eve Park    | team=risk     | reports=frank   # frank not listed yet',
  'hal   : Hal Ng      | team=platform | reports=carol   # reports across teams',
  'zoe   : Zoe Kim     | reports=?                       # team and manager unknown',
);

describe('walkthrough: partial knowledge', () => {
  it('starts with Frank as a Placeholder Manager', () => {
    const org = parse(SAMPLE);
    expect(org.people.get('frank')).toMatchObject({ placeholder: true, team: null });
    expect(org.problems).toEqual([{ severity: 'info', line: 13, message: expect.any(String) }]);
  });

  it('adds Ivy with an unknown Team and Manager as Placeholders, drawn loose and dashed', async () => {
    const org = parse(SAMPLE + 'ivy   : Ivy Chen    | team=ml | reports=kai\n');
    expect(org.teams.get('ml')).toMatchObject({ placeholder: true, parent: null });
    expect(org.people.get('kai')).toMatchObject({ placeholder: true, team: null });

    const scene = await buildScene(org);
    expect(box(scene, 'ml').placeholder).toBe(true);
    expect(contains(box(scene, 'ml'), card(scene, 'ivy'))).toBe(true);
    const kai = card(scene, 'kai');
    expect(kai.placeholder).toBe(true);
    for (const t of scene.teams) expect(contains(t, kai)).toBe(false);
    expect(line(scene, 'kai', 'ivy').kind).toBe('reporting');
  });

  it('turns each Placeholder into a normal card or Team as its line is added', () => {
    let text = SAMPLE + 'ivy   : Ivy Chen    | team=ml | reports=kai\n';
    text += 'kai   : Kai Wu      | team=ml | role=Head of ML\n';
    expect(parse(text).people.get('kai')).toMatchObject({ placeholder: false, team: 'ml' });
    text += 'team ml       : Machine Learning | parent=platform\n';
    expect(parse(text).teams.get('ml')).toMatchObject({ placeholder: false, parent: 'platform', title: 'Machine Learning' });
    text += 'frank : Frank Ode   | team=risk | role=Risk Lead\n';
    const org = parse(text);
    expect([...org.people.values(), ...org.teams.values()].filter((x) => x.placeholder)).toEqual([]);
    expect(org.problems).toEqual([]);
  });
});

describe('walkthrough: mistakes', () => {
  const steps = [
    (t: string) => t.replace('team=cards    | reports=alice\ngia', 'team=paymnts  | reports=alice\ngia'),
    (t: string) => t.replace('team fintech  : FinTech', 'team fintech  : FinTech | parent=cards'),
    (t: string) => t.replace('team=fintech  | role=Director', 'team=fintech  | role=Director | reports=dan'),
    (t: string) => t + 'alice : Alice Smith | team=risk\n',
  ];
  const after = (n: number) => steps.slice(0, n).reduce((t, step) => step(t), SAMPLE);

  it('a misspelt Team id shows as a Placeholder Team with a Problem on that line', () => {
    const org = parse(after(1));
    expect(org.teams.get('paymnts')).toMatchObject({ placeholder: true });
    expect(org.people.get('dan')!.team).toBe('paymnts');
    expect(org.problems).toContainEqual({ severity: 'info', line: 10, message: expect.stringContaining('"paymnts"') });
  });

  it('a Team loop is an error on the looping Team\'s line, and that Team moves to the top level', () => {
    const org = parse(after(2));
    expect(org.problems).toContainEqual({ severity: 'error', line: 2, message: expect.stringMatching(/team loop/i) });
    expect(org.teams.get('fintech')!.parent).toBeNull();
  });

  it('a Reporting-line loop is a warning on the offending line', () => {
    const org = parse(after(3));
    expect(org.problems).toContainEqual({ severity: 'warning', line: 8, message: expect.stringMatching(/reporting loop/i) });
  });

  it('a duplicate Person is an error naming the first line, and the later line is ignored', async () => {
    const org = parse(after(4));
    expect(org.problems).toContainEqual({ severity: 'error', line: 16, message: expect.stringContaining('line 9') });
    expect(org.people.get('alice')!.team).toBe('payments');

    const scene = await buildScene(org);
    expect(scene.people.filter((p) => p.id === 'alice')).toHaveLength(1);
    expect(line(scene, 'dan', 'bob').kind).toBe('reporting');
  });
});

describe('buildScene: counts for the status bar', () => {
  it('counts People, Teams and Placeholders', async () => {
    const scene = await buildScene(parse(SAMPLE + 'ivy : Ivy | team=ml\n'));
    expect(scene.counts).toEqual({ people: 9, teams: 5, placeholders: 2 });
  });
});
