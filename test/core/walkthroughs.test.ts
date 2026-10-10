import { describe, expect, it } from 'vitest';
import { format, parse, SAMPLE, setField, WALKTHROUGHS, type Org, type StepResult } from '../../src/core';

/** Runs every step of a walkthrough from the sample, returning each step's result and Org. */
function play(name: string) {
  const walkthrough = WALKTHROUGHS.find((w) => w.name === name);
  if (!walkthrough) throw new Error(`no walkthrough "${name}"`);
  let text = SAMPLE;
  return walkthrough.steps.map((step) => {
    const result: StepResult = step.run(text);
    text = result.text;
    return { result, org: parse(text) };
  });
}

const placeholders = (org: Org) =>
  [...org.people.values(), ...org.teams.values()].filter((x) => x.placeholder).map((x) => x.id).sort();

describe('walkthroughs', () => {
  it('offers all nine walkthroughs', () => {
    expect(WALKTHROUGHS.map((w) => w.name)).toEqual([
      'New Manager',
      'Person changes Team',
      'Team re-org',
      'Partial knowledge',
      'Mistakes',
      'Dotted line',
      'Function',
      'Team colour',
      'Collapse and expand',
    ]);
    for (const w of WALKTHROUGHS) {
      expect(w.description).not.toBe('');
      expect(w.steps.length).toBeGreaterThan(0);
    }
  });

  it('starts from a sample with no problems beyond one Placeholder Manager', () => {
    expect(parse(SAMPLE).problems).toMatchObject([{ severity: 'info', line: 15 }]);
  });

  it('New Manager: Alice now reports to Carol and stays in Payments', () => {
    const [step] = play('New Manager');
    expect(step.result).toMatchObject({
      line: 11,
      before: 'alice : Alice Smith | team=payments | reports=bob | role=EM | fn=eng',
      after: 'alice : Alice Smith | team=payments | reports=carol | role=EM | fn=eng',
    });
    expect(step.org.people.get('alice')).toMatchObject({ manager: 'carol', team: 'payments' });
  });

  it('Person changes Team: Eve moves to Payments and keeps her Manager', () => {
    const [step] = play('Person changes Team');
    expect(step.result).toMatchObject({
      line: 15,
      after: 'eve : Eve Park | team=payments | reports=frank # frank not listed yet',
    });
    expect(step.org.people.get('eve')).toMatchObject({ team: 'payments', manager: 'frank' });
  });

  it('Team re-org: whole Teams move by editing only Team lines', () => {
    const steps = play('Team re-org');
    expect(steps[0].result).toMatchObject({ line: 7, after: 'team cards : Cards | parent=platform' });
    expect(steps[0].org.teams.get('cards')!.parent).toBe('platform');
    expect(steps[0].org.people.get('dan')!.team).toBe('cards');

    expect(steps[1].result).toMatchObject({ line: 6, after: 'team risk : Risk | parent=payments' });

    const last = steps[2];
    // Three lines change; the step points at the new Team line and notes the other two.
    expect(last.result).toMatchObject({ line: 18, before: null, after: 'team group : Group Tech' });
    expect(last.result.note).toBeTruthy();
    expect(last.org.teams.get('group')).toMatchObject({ title: 'Group Tech', parent: null, placeholder: false });
    expect(last.org.teams.get('fintech')!.parent).toBe('group');
    expect(last.org.teams.get('platform')!.parent).toBe('group');
    expect(last.org.problems).toMatchObject([{ severity: 'info' }]);
    // Nobody's own line changed.
    const personLines = (t: string) => t.split('\n').filter((l) => /^[a-z]+\s*:/.test(l));
    expect(personLines(last.result.text)).toEqual(personLines(SAMPLE));
  });

  it('Partial knowledge: Placeholders appear, then become real as their lines are added', () => {
    const steps = play('Partial knowledge');
    expect(steps[0].result).toMatchObject({ before: null, after: 'ivy : Ivy Chen | team=ml | reports=kai' });
    expect(placeholders(steps[0].org)).toEqual(['frank', 'kai', 'ml']);
    expect(placeholders(steps[1].org)).toEqual(['frank', 'ml']);
    expect(placeholders(steps[2].org)).toEqual(['frank']);
    expect(steps[2].org.teams.get('ml')).toMatchObject({ title: 'Machine Learning', parent: 'platform' });
    expect(placeholders(steps[3].org)).toEqual([]);
    expect(steps[3].org.problems).toEqual([]);
  });

  it('Mistakes: each mistake is reported on its line and the Org still holds together', () => {
    const steps = play('Mistakes');
    expect(steps[0].org.teams.get('paymnts')!.placeholder).toBe(true);
    expect(steps[0].org.problems).toContainEqual({ severity: 'info', line: 12, message: expect.stringContaining('"paymnts"') });

    expect(steps[1].org.problems).toContainEqual({ severity: 'error', line: 3, message: expect.stringMatching(/team loop/i) });
    expect(steps[1].org.teams.get('fintech')!.parent).toBeNull();

    expect(steps[2].org.problems).toContainEqual({ severity: 'warning', line: 10, message: expect.stringMatching(/reporting loop/i) });

    const last = steps[3];
    expect(last.result.line).toBe(18);
    expect(last.org.problems).toContainEqual({ severity: 'error', line: 18, message: expect.stringContaining('line 11') });
    expect(last.org.people.get('alice')!.team).toBe('payments');
    expect(last.org.problems.map((p) => p.severity).sort()).toEqual(['error', 'error', 'info', 'info', 'warning']);
  });

  it('Dotted line: Gia gets Dotted lines to Carol, then to a new VP too, keeping her Manager', () => {
    const steps = play('Dotted line');
    expect(steps[0].result.after).toBe('gia : Gia Lam | team=cards | reports=alice | role=PM | fn=product | dotted=carol');
    expect(steps[0].org.people.get('gia')).toMatchObject({ manager: 'alice', dotted: ['carol'] });
    const last = steps[steps.length - 1].org;
    expect(last.people.get('gia')!.dotted).toEqual(['carol', 'vp']);
    expect(last.people.get('vp')).toMatchObject({ placeholder: false, fn: 'product' });
  });

  it('Function: Functions are set and changed with one edit each', () => {
    const steps = play('Function');
    expect(steps[0].result.after).toBe('hal : Hal Ng | team=platform | reports=carol | fn=ops # reports across teams');
    expect(steps[0].org.people.get('hal')!.fn).toBe('ops');
    expect(steps[1].result.after).toBe('dan : Dan Ruiz | team=cards | reports=alice | fn=data');
    expect(steps[1].org.people.get('dan')!.fn).toBe('data');
  });

  it('Team colour: a colour on a Team is inherited by its sub-teams, and can be overridden lower down', () => {
    const steps = play('Team colour');
    expect(steps[0].result.after).toBe('team fintech : FinTech | color=purple');
    expect(steps[0].org.teams.get('fintech')!.colour).toBe('purple');
    expect(steps[1].result.after).toBe('team cards : Cards | parent=payments | color=#e11d48');
    expect(steps[1].org.problems).toMatchObject([{ severity: 'info' }]);
  });

  it('only ever writes formatted lines', () => {
    for (const w of WALKTHROUGHS) {
      let text = SAMPLE;
      for (const step of w.steps) {
        text = step.run(text).text;
        expect(format(text), `${w.name}: ${step.label}`).toBe(text);
      }
    }
  });

  it('Collapse and expand: steps change the view, never the file', () => {
    const steps = play('Collapse and expand');
    for (const { result } of steps) {
      expect(result.text).toBe(SAMPLE);
      expect(result.line).toBeNull();
      expect(result.note).toBeTruthy();
    }
    expect(steps.map(({ result }) => result.collapse)).toEqual([['payments'], ['fintech', 'payments'], []]);
  });
});

describe('setField', () => {
  it('replaces a value and keeps the column alignment where the new value fits', () => {
    const r = setField('a     : A | team=risk     | reports=b\n', 'person', 'a', 'team', 'cards');
    expect(r.after).toBe('a     : A | team=cards    | reports=b');
  });

  it('adds a missing field before a trailing comment', () => {
    const r = setField('a : A   # note\n', 'person', 'a', 'fn', 'eng');
    expect(r).toMatchObject({ line: 1, before: 'a : A   # note', after: 'a : A | fn=eng # note' });
  });

  it('finds Teams and People by exact id, even with dots and dashes', () => {
    const text = 'team a.b : AB\nteam a : A\na-b : AB\na : A\n';
    expect(setField(text, 'team', 'a', 'parent', 'x').line).toBe(2);
    expect(setField(text, 'person', 'a', 'team', 'x').line).toBe(4);
    expect(setField(text, 'person', 'a-b', 'team', 'x').line).toBe(3);
  });

  it('leaves the text alone when the id is not defined', () => {
    const r = setField('a : A\n', 'person', 'zz', 'team', 'x');
    expect(r).toEqual({ text: 'a : A\n', line: null, before: null, after: null });
  });
});
