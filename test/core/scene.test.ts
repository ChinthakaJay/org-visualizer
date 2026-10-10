import { describe, expect, it } from 'vitest';
import { buildScene, parse, type Scene } from '../../src/core';
import { box, card, contains, line } from './helpers';

const ORG = `
team fintech  : FinTech
team platform : Platform
team payments : Payments  | parent=fintech
team cards    : Cards     | parent=payments
bob   : Bob Jones   | team=fintech
alice : Alice Smith | team=payments | reports=bob
dan   : Dan Ruiz    | team=cards    | reports=alice
hal   : Hal Ng      | team=platform | reports=alice
`;

describe('buildScene: geometry', () => {
  let scene: Scene;
  it('lays out the Org', async () => {
    scene = await buildScene(parse(ORG));
    expect(scene.teams).toHaveLength(4);
    expect(scene.people).toHaveLength(4);
  });

  it('puts each card inside its Team box', () => {
    expect(contains(box(scene, 'fintech'), card(scene, 'bob'))).toBe(true);
    expect(contains(box(scene, 'payments'), card(scene, 'alice'))).toBe(true);
    expect(contains(box(scene, 'cards'), card(scene, 'dan'))).toBe(true);
    expect(contains(box(scene, 'platform'), card(scene, 'hal'))).toBe(true);
  });

  it('puts each sub-team box inside its Parent team box', () => {
    expect(contains(box(scene, 'fintech'), box(scene, 'payments'))).toBe(true);
    expect(contains(box(scene, 'payments'), box(scene, 'cards'))).toBe(true);
    expect(contains(box(scene, 'fintech'), box(scene, 'platform'))).toBe(false);
  });

  it('draws each Manager above their report, including across Team boxes', () => {
    const above = (m: string, r: string) => card(scene, m).y + card(scene, m).height <= card(scene, r).y;
    expect(above('bob', 'alice')).toBe(true);
    expect(above('alice', 'dan')).toBe(true);
    expect(above('alice', 'hal')).toBe(true);
  });

  it('draws a Reporting line from each Manager to their report, starting and ending at the cards', () => {
    expect(scene.lines).toHaveLength(3);
    const l = line(scene, 'alice', 'hal');
    expect(l.kind).toBe('reporting');
    const start = l.points[0];
    const end = l.points[l.points.length - 1];
    expect(touches(card(scene, 'alice'), start)).toBe(true);
    expect(touches(card(scene, 'hal'), end)).toBe(true);
  });

  it('carries the defining line number on boxes and cards', () => {
    expect(box(scene, 'payments').line).toBe(4);
    expect(card(scene, 'dan').line).toBe(8);
  });

  it('gives an overall size that contains everything', () => {
    const all = { x: 0, y: 0, width: scene.width, height: scene.height };
    for (const t of scene.teams) expect(contains(all, t)).toBe(true);
  });
});

function touches(r: { x: number; y: number; width: number; height: number }, p: { x: number; y: number }) {
  const eps = 1;
  return p.x >= r.x - eps && p.x <= r.x + r.width + eps && p.y >= r.y - eps && p.y <= r.y + r.height + eps;
}
