import { describe, expect, it } from 'vitest';
import { format, parse, SAMPLE, TEMPLATE } from '../../src/core';

/** Everything parse makes of the text, in a form toEqual can compare. */
const meaning = (text: string) => {
  const org = parse(text);
  return { teams: [...org.teams.values()], people: [...org.people.values()], problems: org.problems };
};

const MESSY = [
  '# a comment   ',
  '   ',
  'team   fintech   :   FinTech   |parent = group|color=  purple  ',
  '  alice:Alice  Smith|team=payments |reports = bob   # manager, for now  ',
  'bob : Bob | dotted=a, b',
  'zoe',
  'team payments:Payments|parent=fintech',
  'kim :',
  'kim2 : Kim | | team=x |',
  'broken Alice | team=x',
  'bad : Bad   | not a field',
  'dup   :   Alice  ',
  'url : Url | link=http://x#y',
].join('\n');

describe('format', () => {
  it('normalises the spacing of Person and Team lines', () => {
    expect(format('team   fintech   :   FinTech   |parent = group|color=  purple  ')).toBe(
      'team fintech : FinTech | parent=group | color=purple',
    );
    expect(format('  alice:Alice  Smith|team=payments |reports = bob')).toBe('alice : Alice  Smith | team=payments | reports=bob');
  });

  it('puts spaces around a colon written with none', () => {
    expect(format('team payments:Payments|parent=fintech')).toBe('team payments : Payments | parent=fintech');
    expect(format('dan:Dan')).toBe('dan : Dan');
  });

  it('keeps values, ids without a name, and empty names as they are', () => {
    expect(format('bob : Bob | dotted=a, b')).toBe('bob : Bob | dotted=a, b');
    expect(format('  zoe  ')).toBe('zoe');
    expect(format('kim   :  ')).toBe('kim :');
  });

  it('keeps empty fields without adding or dropping a "|"', () => {
    expect(format('kim : Kim ||team=x|')).toBe('kim : Kim | | team=x |');
  });

  it('puts one space before a trailing comment and leaves its text alone', () => {
    expect(format('alice : Alice | reports=bob   # manager,  for now  ')).toBe('alice : Alice | reports=bob # manager,  for now');
    expect(format('url : Url | link=http://x#y')).toBe('url : Url | link=http://x#y');
  });

  it('leaves blank lines and comment-only lines exactly as they are', () => {
    expect(format('   \n# a comment   \n   # indented')).toBe('   \n# a comment   \n   # indented');
  });

  it("leaves lines it can't read exactly as they are", () => {
    expect(format('broken Alice  |  team=x')).toBe('broken Alice  |  team=x');
    expect(format('bad :  Bad   | not a field')).toBe('bad :  Bad   | not a field');
    expect(format('  |  team=x')).toBe('  |  team=x');
  });

  it('keeps Windows line endings', () => {
    expect(format('a  :  A\r\nb : B  \r\n')).toBe('a : A\r\nb : B\r\n');
  });

  it('never changes what the file means', () => {
    expect(meaning(format(MESSY))).toEqual(meaning(MESSY));
    expect(format(MESSY).split('\n')).toHaveLength(MESSY.split('\n').length);
  });

  it('changes nothing when run a second time', () => {
    expect(format(format(MESSY))).toBe(format(MESSY));
  });

  it('leaves the sample and the template unchanged', () => {
    expect(format(SAMPLE)).toBe(SAMPLE);
    expect(format(TEMPLATE)).toBe(TEMPLATE);
  });
});
