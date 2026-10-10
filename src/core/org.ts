/** The parsed Org file: two independent trees (Team → Parent team, Person → Manager) plus Problems. */

export type Severity = 'error' | 'warning' | 'info';

export interface Problem {
  severity: Severity;
  /** 1-based line in the Org file. */
  line: number;
  message: string;
}

export interface Team {
  id: string;
  title: string;
  parent: string | null;
  /** A valid `color=` override (a name or hex), inherited by sub-teams. */
  colour: string | null;
  /** 1-based line that defines the Team; null for a Placeholder. */
  line: number | null;
  placeholder: boolean;
}

export interface Person {
  id: string;
  name: string;
  team: string | null;
  manager: string | null;
  /** Ids of People this Person has a Dotted line to. */
  dotted: string[];
  /** Free-text job title. */
  role: string | null;
  /** The kind of work, open-ended (eng, product, ops…). */
  fn: string | null;
  /** Any other key=value notes, shown only in the tooltip. */
  extra: Record<string, string>;
  /** 1-based line that defines the Person; null for a Placeholder. */
  line: number | null;
  placeholder: boolean;
}

export interface Org {
  teams: Map<string, Team>;
  people: Map<string, Person>;
  problems: Problem[];
}

/** Each Team's depth in the team tree: 0 for a top-level Team. */
export function teamDepths(org: Org): Map<string, number> {
  const depths = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    const parent = org.teams.get(id)?.parent;
    // Parse cuts Team loops, so walking up always ends.
    const depth = parent && org.teams.has(parent) ? depthOf(parent) + 1 : 0;
    depths.set(id, depth);
    return depth;
  };
  for (const id of org.teams.keys()) depthOf(id);
  return depths;
}

/** A Team and the Teams containing it, innermost first. Empty for no Team. */
export function teamChain(org: Pick<Org, 'teams'>, teamId: string | null): Team[] {
  const chain: Team[] = [];
  // Parse cuts Team loops, so walking up always ends.
  for (let t = teamId ? org.teams.get(teamId) : undefined; t; t = t.parent ? org.teams.get(t.parent) : undefined) chain.push(t);
  return chain;
}
