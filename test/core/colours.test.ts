import { describe, expect, it } from 'vitest';
import { buildScene, parse, type Scene } from '../../src/core';
import { box, card } from './helpers';

const lines = (...ls: string[]) => ls.join('\n') + '\n';
const sceneOf = (...ls: string[]) => buildScene(parse(lines(...ls)));
const colourOf = (scene: Scene, id: string) => box(scene, id).colour;

describe('Team colours', () => {
  it("keeps a top-level Team's colour when other Teams are added or removed", async () => {
    const alone = colourOf(await sceneOf('team fintech : FinTech'), 'fintech');
    const crowded = colourOf(
      await sceneOf('team aaa : A', 'team fintech : FinTech', 'team zzz : Z', 'team platform : Platform', 'team risk : Risk | parent=fintech'),
      'fintech',
    );
    expect(alone).not.toBeNull();
    expect(crowded).toEqual(alone);
  });

  it("doesn't depend on the order of lines", async () => {
    const a = await sceneOf('team x : X', 'team y : Y');
    const b = await sceneOf('team y : Y', 'team x : X');
    expect(colourOf(a, 'x')).toEqual(colourOf(b, 'x'));
    expect(colourOf(a, 'y')).toEqual(colourOf(b, 'y'));
  });

  it('spreads different top-level Teams across the palette', async () => {
    const ids = ['fintech', 'platform', 'risk', 'growth', 'data', 'infra', 'sales', 'legal'];
    const scene = await sceneOf(...ids.map((id) => `team ${id} : ${id}`));
    const hues = new Set(ids.map((id) => colourOf(scene, id)!.hue));
    expect(hues.size).toBeGreaterThanOrEqual(4);
  });

  it("gives sub-teams shades of their top-level Team's hue, by depth", async () => {
    const scene = await sceneOf('team a : A', 'team b : B | parent=a', 'team c : C | parent=b');
    const [a, b, c] = ['a', 'b', 'c'].map((id) => colourOf(scene, id)!);
    expect(b.hue).toBe(a.hue);
    expect(c.hue).toBe(a.hue);
    expect([a.shade, b.shade, c.shade]).toEqual([0, 1, 2]);
  });

  it('lets color= override the hue for a Team and every sub-team below it', async () => {
    const scene = await sceneOf(
      'team a : A',
      'team b : B | parent=a | color=#ff0000',
      'team c : C | parent=b',
      'team d : D | parent=a',
    );
    expect(colourOf(scene, 'b')).toMatchObject({ hue: 0, saturation: 100 });
    expect(colourOf(scene, 'c')).toMatchObject({ hue: 0, saturation: 100, shade: 2 });
    expect(colourOf(scene, 'd')!.hue).toBe(colourOf(scene, 'a')!.hue);
  });

  it('accepts named colours', async () => {
    const scene = await sceneOf('team a : A | color=green', 'team b : B | color=Grey');
    expect(colourOf(scene, 'a')!.hue).toBe(140);
    expect(colourOf(scene, 'b')!.saturation).toBe(0);
  });

  it('warns about a colour it doesn\'t know and falls back to the usual hue', async () => {
    const org = parse(lines('team a : A | color=blurple'));
    expect(org.problems).toEqual([{ severity: 'warning', line: 1, message: expect.stringContaining('blurple') }]);
    const plain = colourOf(await sceneOf('team a : A'), 'a');
    expect(colourOf(await buildScene(org), 'a')).toEqual(plain);
  });

  it('draws Placeholder Teams with no colour (neutral grey) and dashed', async () => {
    const scene = await sceneOf('x : X | team=unknown');
    expect(box(scene, 'unknown')).toMatchObject({ placeholder: true, colour: null });
  });

  it("tints each card with its Team's colour, and leaves loose cards untinted", async () => {
    const scene = await sceneOf('team a : A', 'team b : B | parent=a', 'x : X | team=b', 'y : Y | reports=z');
    expect(card(scene, 'x').tint).toEqual(colourOf(scene, 'b'));
    expect(card(scene, 'y').tint).toBeNull();
    expect(card(scene, 'z').tint).toBeNull();
  });
});
