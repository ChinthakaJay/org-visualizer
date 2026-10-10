import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core';

describe('parse: basic Team and Person lines', () => {
  it('reads a Team with a title and a Parent team', () => {
    const org = parse('team fintech : FinTech\nteam payments : Payments | parent=fintech\n');

    expect(org.teams.get('fintech')).toMatchObject({ id: 'fintech', title: 'FinTech', parent: null, line: 1, placeholder: false });
    expect(org.teams.get('payments')).toMatchObject({ id: 'payments', title: 'Payments', parent: 'fintech', line: 2 });
  });

  it('reads a Person with a name, a Team and a Manager', () => {
    const org = parse('team payments : Payments\nbob : Bob Jones\nalice : Alice Smith | team=payments | reports=bob\n');

    expect(org.people.get('alice')).toMatchObject({ id: 'alice', name: 'Alice Smith', team: 'payments', manager: 'bob', line: 3, placeholder: false });
    expect(org.people.get('bob')).toMatchObject({ id: 'bob', name: 'Bob Jones', team: null, manager: null, line: 2 });
    expect(org.problems).toEqual([]);
  });

  it('reads a line with no spaces around the colon', () => {
    const org = parse('team payments:Payments|parent=fintech\ndan:Dan|team=payments\n');
    expect(org.teams.get('payments')).toMatchObject({ title: 'Payments', parent: 'fintech' });
    expect(org.people.get('dan')).toMatchObject({ name: 'Dan', team: 'payments' });
    expect(org.problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('uses the id as the name when no name is given', () => {
    const org = parse('kai\n');
    expect(org.people.get('kai')).toMatchObject({ name: 'kai' });
  });
});
