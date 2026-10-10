import { describe, expect, it } from 'vitest';
import { buildScene, parse } from '../../src/core';
import { card, line } from './helpers';

const lines = (...ls: string[]) => ls.join('\n') + '\n';

describe('parse: Person details', () => {
  it('reads role, fn and extra keys', () => {
    const org = parse(lines('ana : Ana Silva | role=Staff Engineer | fn=eng | met=2024-03 KubeCon | Slack=@ana'));
    expect(org.people.get('ana')).toMatchObject({
      role: 'Staff Engineer',
      fn: 'eng',
      extra: { met: '2024-03 KubeCon', slack: '@ana' },
    });
    expect(org.problems).toEqual([]);
  });

  it('leaves role, fn and extra empty when absent', () => {
    const org = parse(lines('ana : Ana'));
    expect(org.people.get('ana')).toMatchObject({ role: null, fn: null, dotted: [], extra: {} });
  });

  it('reads one or more Dotted lines', () => {
    const org = parse(lines('pm : PM | dotted=lead', 'lead : Lead', 'em : EM', 'x : X | dotted=lead, em'));
    expect(org.people.get('pm')!.dotted).toEqual(['lead']);
    expect(org.people.get('x')!.dotted).toEqual(['lead', 'em']);
  });

  it('turns an unknown dotted= id into a Placeholder Person, with a Problem on that line', () => {
    const org = parse(lines('pm : PM | dotted=lead'));
    expect(org.people.get('lead')).toMatchObject({ placeholder: true, team: null });
    expect(org.problems).toEqual([{ severity: 'info', line: 1, message: expect.stringContaining('"lead"') }]);
  });

  it('reports a Dotted line to yourself and drops it', () => {
    const org = parse(lines('pm : PM | dotted=pm, lead', 'lead : Lead'));
    expect(org.people.get('pm')!.dotted).toEqual(['lead']);
    expect(org.problems).toMatchObject([{ severity: 'error', line: 1 }]);
  });
});

const ORG = lines(
  'team product : Product',
  'team payments : Payments',
  'vp   : Vera Patel | team=product | role=VP Product | fn=product',
  'em   : Eli Moss   | team=payments | role=EM | fn=eng',
  'pm   : Pia Mohr   | team=payments | reports=em | dotted=vp | role=PM | fn=product | met=offsite',
);

describe('buildScene: Person details and Dotted lines', () => {
  it('puts the name, Role and Function on the card', async () => {
    const scene = await buildScene(parse(ORG));
    expect(card(scene, 'pm')).toMatchObject({ name: 'Pia Mohr', role: 'PM', fn: 'product' });
  });

  it('gives the card tooltip fields: id, Team, Manager, line and extra keys', async () => {
    const scene = await buildScene(parse(ORG));
    expect(card(scene, 'pm').tooltip).toEqual({
      id: 'pm',
      team: 'Payments',
      manager: 'Eli Moss',
      line: 5,
      extra: { met: 'offsite' },
    });
    expect(card(scene, 'vp').tooltip).toMatchObject({ manager: null, extra: {} });
  });

  it('draws a Dotted line separately from the Reporting line', async () => {
    const scene = await buildScene(parse(ORG));
    expect(line(scene, 'em', 'pm', 'reporting')).toBeDefined();
    const dotted = line(scene, 'vp', 'pm', 'dotted');
    expect(dotted.points.length).toBeGreaterThanOrEqual(2);
    expect(scene.lines).toHaveLength(2);
  });

  it('draws a Dotted line to a Placeholder Person', async () => {
    const scene = await buildScene(parse(lines('pm : PM | dotted=lead, mentor')));
    expect(line(scene, 'lead', 'pm', 'dotted')).toBeDefined();
    expect(line(scene, 'mentor', 'pm', 'dotted')).toBeDefined();
    expect(card(scene, 'lead').placeholder).toBe(true);
  });
});
