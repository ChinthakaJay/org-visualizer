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
