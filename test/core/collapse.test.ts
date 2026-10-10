import { describe, expect, it } from 'vitest';
import { buildScene, parse, teamDepths } from '../../src/core';
import { box, card, contains } from './helpers';

const ORG = `
team fintech  : FinTech
team platform : Platform
team payments : Payments  | parent=fintech
team cards    : Cards     | parent=payments
team risk     : Risk      | parent=fintech
bob   : Bob   | team=fintech
alice : Alice | team=payments | reports=bob
dan   : Dan   | team=cards    | reports=alice
gia   : Gia   | team=cards    | reports=alice | dotted=carol
carol : Carol | team=risk     | reports=bob
hal   : Hal   | team=platform | reports=alice | dotted=alice
ivy   : Ivy   | team=platform | reports=dan
zoe   : Zoe   | reports=dan
`;

const sceneWith = (...collapsed: string[]) => buildScene(parse(ORG), new Set(collapsed));
const ends = (l: { kind: string; from: string; to: string; fromKind: string; toKind: string }) =>
  `${l.kind}:${l.fromKind}:${l.from}->${l.toKind}:${l.to}`;

describe('buildScene: Collapsed teams', () => {
  it('draws a Collapsed team as one box without its contents', async () => {
    const scene = await sceneWith('payments');
    expect(box(scene, 'payments')).toMatchObject({ collapsed: true });
    expect(scene.teams.map((t) => t.id)).not.toContain('cards');
    expect(scene.people.map((p) => p.id)).not.toEqual(expect.arrayContaining(['alice']));
    expect(scene.people.map((p) => p.id).sort()).toEqual(['bob', 'carol', 'hal', 'ivy', 'zoe']);
    expect(contains(box(scene, 'fintech'), box(scene, 'payments'))).toBe(true);
  });

  it('counts every Person and sub-team inside a Collapsed team, at any depth', async () => {
    const scene = await sceneWith('fintech');
    expect(box(scene, 'fintech').counts).toEqual({ people: 5, teams: 3 });
    const expanded = await sceneWith();
    expect(box(expanded, 'fintech')).toMatchObject({ collapsed: false, counts: null });
  });

  it('reroutes lines into and out of a Collapsed team to its box', async () => {
    const scene = await sceneWith('cards');
    expect(scene.lines.map(ends)).toEqual(
      expect.arrayContaining([
        'reporting:person:alice->team:cards',
        'dotted:person:carol->team:cards',
        'reporting:team:cards->person:ivy',
        'reporting:team:cards->person:zoe',
      ]),
    );
  });

  it('merges duplicate lines to the same box, keeping Reporting and Dotted lines apart', async () => {
    const scene = await sceneWith('cards');
    // dan and gia both report to alice: one merged Reporting line.
    expect(scene.lines.filter((l) => ends(l) === 'reporting:person:alice->team:cards')).toHaveLength(1);

    const platform = await sceneWith('platform');
    // hal reports to alice and has a Dotted line to alice: one of each survives.
    expect(platform.lines.map(ends).filter((e) => e.endsWith('->team:platform')).sort()).toEqual([
      'dotted:person:alice->team:platform',
      'reporting:person:alice->team:platform',
      'reporting:person:dan->team:platform',
    ]);
  });

  it('drops lines with both ends inside the same Collapsed team', async () => {
    const scene = await sceneWith('fintech');
    expect(scene.lines.map(ends).sort()).toEqual([
      'dotted:team:fintech->person:hal',
      'reporting:team:fintech->person:hal',
      'reporting:team:fintech->person:ivy',
      'reporting:team:fintech->person:zoe',
    ]);
  });

  it('routes to the outermost Collapsed team when Collapsed teams are nested', async () => {
    const scene = await sceneWith('cards', 'payments', 'fintech');
    expect(scene.teams.map((t) => t.id).sort()).toEqual(['fintech', 'platform']);
    expect(scene.lines.map(ends)).toContain('reporting:team:fintech->person:ivy');
  });

  it('ends a rerouted line at the collapsed box', async () => {
    const scene = await sceneWith('cards');
    const l = scene.lines.find((l) => ends(l) === 'reporting:person:alice->team:cards')!;
    const end = l.points[l.points.length - 1];
    const b = box(scene, 'cards');
    expect(end.x).toBeGreaterThanOrEqual(b.x - 1);
    expect(end.x).toBeLessThanOrEqual(b.x + b.width + 1);
    expect(Math.abs(end.y - b.y)).toBeLessThanOrEqual(1);
    const start = l.points[0];
    expect(start.y).toBeCloseTo(card(scene, 'alice').y + card(scene, 'alice').height, 0);
  });

  it('ignores collapsed ids that are not Teams', async () => {
    const scene = await sceneWith('nope', 'bob');
    expect(scene.people.map((p) => p.id)).toContain('bob');
    expect(scene.teams.every((t) => !t.collapsed)).toBe(true);
  });
});

describe('teamDepths', () => {
  it('gives each Team its depth in the team tree, for "Collapse to depth N"', () => {
    const depths = teamDepths(parse(ORG + 'x : X | team=ghost\n'));
    expect(Object.fromEntries(depths)).toEqual({ fintech: 0, platform: 0, payments: 1, cards: 2, risk: 1, ghost: 0 });
  });
});
