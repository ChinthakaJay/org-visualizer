import type { Scene } from '../../src/core';

interface Rect { x: number; y: number; width: number; height: number }

export function box(scene: Scene, id: string) {
  const t = scene.teams.find((t) => t.id === id);
  if (!t) throw new Error(`no Team box "${id}" in scene`);
  return t;
}

export function card(scene: Scene, id: string) {
  const p = scene.people.find((p) => p.id === id);
  if (!p) throw new Error(`no person card "${id}" in scene`);
  return p;
}

export function line(scene: Scene, from: string, to: string, kind?: 'reporting' | 'dotted') {
  const l = scene.lines.find((l) => l.from === from && l.to === to && (!kind || l.kind === kind));
  if (!l) throw new Error(`no ${kind ?? ''} line ${from} → ${to} in scene`);
  return l;
}

export function contains(outer: Rect, inner: Rect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}
