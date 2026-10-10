import type { Org, Rect, Scene } from '../core';

export interface ChartElement {
  /** "person:<id>" or "team:<id>", as the chart's highlight expects. */
  key: string;
  rect: Rect;
}

/**
 * The chart element showing whatever an Org file line defines: its card or Team box, or, when it's
 * hidden inside a Collapsed team, that collapsed box. Null for lines that define nothing.
 */
export function elementForLine(org: Org, scene: Scene, line: number): ChartElement | null {
  const person = [...org.people.values()].find((p) => p.line === line);
  const team = person ? undefined : [...org.teams.values()].find((t) => t.line === line);
  if (!person && !team) return null;

  if (person) {
    const card = scene.people.find((c) => c.id === person.id);
    if (card) return { key: `person:${card.id}`, rect: card };
  }
  // Walk up the team tree to the box that's actually drawn.
  for (let t = person ? (person.team ? org.teams.get(person.team) : undefined) : team; t; t = t.parent ? org.teams.get(t.parent) : undefined) {
    const box = scene.teams.find((b) => b.id === t!.id);
    if (box && (box.collapsed || t === team)) return { key: `team:${box.id}`, rect: box };
  }
  return null;
}
