import { describe, expect, it } from 'vitest';
import { definePlaceholder, parse } from '../../src/core';

describe('definePlaceholder', () => {
  const TEXT = 'team risk : Risk\neve : Eve | team=risk | reports=frank\nivy : Ivy | team=ml\n';

  it('appends a Person stub line for a Placeholder Person, and the Placeholder becomes a normal Person', () => {
    expect(parse(TEXT).people.get('frank')!.placeholder).toBe(true);

    const edit = definePlaceholder(TEXT, 'person', 'frank');

    expect(edit).toEqual({
      text: TEXT + 'frank : frank\n',
      line: 4,
      before: null,
      after: 'frank : frank',
    });
    const org = parse(edit.text);
    expect(org.people.get('frank')).toMatchObject({ placeholder: false, line: 4 });
    expect(org.problems.filter((p) => p.message.includes('"frank"'))).toEqual([]);
  });

  it('appends a Team stub line for a Placeholder Team, and the Placeholder becomes a normal Team', () => {
    const edit = definePlaceholder(TEXT, 'team', 'ml');

    expect(edit.after).toBe('team ml : ml');
    expect(edit.line).toBe(4);
    const org = parse(edit.text);
    expect(org.teams.get('ml')).toMatchObject({ placeholder: false, line: 4 });
    expect(org.people.get('ivy')!.team).toBe('ml');
  });

  it('adds the line directly after the last non-blank line, keeping one final newline', () => {
    const edit = definePlaceholder('a : A | reports=b\n\n\n', 'person', 'b');
    expect(edit.text).toBe('a : A | reports=b\nb : b\n');
    expect(edit.line).toBe(2);
  });

  it('works on text with no final newline', () => {
    const edit = definePlaceholder('a : A | reports=b', 'person', 'b');
    expect(edit.text).toBe('a : A | reports=b\nb : b\n');
    expect(edit.line).toBe(2);
  });

  it('works on empty text', () => {
    const edit = definePlaceholder('', 'team', 'x');
    expect(edit.text).toBe('team x : x\n');
    expect(edit.line).toBe(1);
  });
});
