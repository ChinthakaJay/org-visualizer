import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type { Org, Person, Team } from './org';

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export interface TeamBox extends Rect {
  id: string;
  title: string;
  /** 0 for a top-level Team. */
  depth: number;
  line: number | null;
  placeholder: boolean;
}

export interface PersonCard extends Rect {
  id: string;
  name: string;
  role: string | null;
  fn: string | null;
  team: string | null;
  line: number | null;
  placeholder: boolean;
  /** Details shown on hover. Team and Manager are display names. */
  tooltip: {
    id: string;
    team: string | null;
    manager: string | null;
    line: number | null;
    extra: Record<string, string>;
  };
}

export interface SceneLine {
  kind: 'reporting' | 'dotted';
  /** The Manager, or the other end of a Dotted line. */
  from: string;
  /** The report. */
  to: string;
  /** Routed polyline in scene coordinates, from the `from` end to the `to` end. */
  points: Point[];
}

/** Everything the chart draws, in absolute coordinates. Team boxes come parent-first. */
export interface Scene {
  width: number;
  height: number;
  teams: TeamBox[];
  people: PersonCard[];
  lines: SceneLine[];
  /** For the status bar. People and Teams exclude Placeholders, which are counted together. */
  counts: { people: number; teams: number; placeholders: number };
}

/** The slice of the elkjs API that Build scene needs, so the browser can pass a Web Worker-backed instance. */
export interface LayoutEngine {
  layout(graph: ElkNode): Promise<ElkNode>;
}

export const CARD = { width: 180, height: 64 };
export const TEAM_HEADER = 36;
const TEAM_PAD = 14;

const ROOT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '24',
  'elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.padding': '[top=16,left=16,bottom=16,right=16]',
};

const teamNodeId = (id: string) => `t:${id}`;
const personNodeId = (id: string) => `p:${id}`;

let defaultEngine: Promise<LayoutEngine> | undefined;
function bundledEngine(): Promise<LayoutEngine> {
  defaultEngine ??= import('elkjs/lib/elk.bundled.js').then((m) => new m.default());
  return defaultEngine;
}

/** Lay out an Org as nested Team boxes, person cards and Reporting lines. */
export async function buildScene(org: Org, options: { engine?: LayoutEngine } = {}): Promise<Scene> {
  const engine = options.engine ?? (await bundledEngine());
  const { teams, people } = org;

  const childTeams = new Map<string | null, Team[]>([[null, []]]);
  const members = new Map<string | null, Person[]>([[null, []]]);
  for (const t of teams.values()) {
    childTeams.set(t.id, []);
    members.set(t.id, []);
  }
  for (const t of teams.values()) childTeams.get(t.parent && teams.has(t.parent) ? t.parent : null)!.push(t);
  for (const p of people.values()) members.get(p.team && teams.has(p.team) ? p.team : null)!.push(p);

  const personNode = (p: Person): ElkNode => ({ id: personNodeId(p.id), width: CARD.width, height: CARD.height });
  const teamNode = (t: Team): ElkNode => ({
    id: teamNodeId(t.id),
    layoutOptions: {
      'elk.padding': `[top=${TEAM_HEADER + 8},left=${TEAM_PAD},bottom=${TEAM_PAD},right=${TEAM_PAD}]`,
      'elk.nodeSize.constraints': 'MINIMUM_SIZE',
      'elk.nodeSize.minimum': `(${Math.max(160, t.title.length * 8 + 48)},${TEAM_HEADER + 24})`,
    },
    children: [...members.get(t.id)!.map(personNode), ...childTeams.get(t.id)!.map(teamNode)],
  });

  const edges: ElkExtendedEdge[] = [];
  const lineEnds = new Map<string, Omit<SceneLine, 'points'>>();
  const addLine = (kind: SceneLine['kind'], from: string, to: string) => {
    if (!people.has(from)) return;
    const id = `e${edges.length}`;
    // Reporting lines decide the top-down order; Dotted lines bend to fit around them.
    const layoutOptions = { 'elk.layered.priority.direction': kind === 'reporting' ? '10' : '0' };
    edges.push({ id, sources: [personNodeId(from)], targets: [personNodeId(to)], layoutOptions });
    lineEnds.set(id, { kind, from, to });
  };
  for (const p of people.values()) {
    if (p.manager) addLine('reporting', p.manager, p.id);
    for (const d of p.dotted) addLine('dotted', d, p.id);
  }

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: ROOT_OPTIONS,
    children: [...members.get(null)!.map(personNode), ...childTeams.get(null)!.map(teamNode)],
    edges,
  };
  const laid = await engine.layout(graph);

  const origin = new Map<string, Point>([['root', { x: 0, y: 0 }]]);
  const all = [...teams.values(), ...people.values()];
  const counts = {
    people: [...people.values()].filter((p) => !p.placeholder).length,
    teams: [...teams.values()].filter((t) => !t.placeholder).length,
    placeholders: all.filter((x) => x.placeholder).length,
  };
  const scene: Scene = { width: laid.width ?? 0, height: laid.height ?? 0, teams: [], people: [], lines: [], counts };

  const walk = (node: ElkNode, offset: Point, depth: number) => {
    for (const child of node.children ?? []) {
      const at = { x: offset.x + (child.x ?? 0), y: offset.y + (child.y ?? 0) };
      origin.set(child.id, at);
      const rect = { ...at, width: child.width ?? 0, height: child.height ?? 0 };
      const [kind, id] = [child.id.slice(0, 1), child.id.slice(2)];
      if (kind === 't') {
        const t = teams.get(id)!;
        scene.teams.push({ ...rect, id, title: t.title, depth, line: t.line, placeholder: t.placeholder });
        walk(child, at, depth + 1);
      } else {
        const p = people.get(id)!;
        scene.people.push({
          ...rect, id, name: p.name, role: p.role, fn: p.fn, team: p.team, line: p.line, placeholder: p.placeholder,
          tooltip: {
            id,
            team: p.team ? teams.get(p.team)?.title ?? p.team : null,
            manager: p.manager ? people.get(p.manager)?.name ?? p.manager : null,
            line: p.line,
            extra: p.extra,
          },
        });
      }
    }
  };
  walk(laid, { x: 0, y: 0 }, 0);

  for (const edge of laid.edges ?? []) {
    const container = (edge as ElkExtendedEdge & { container?: string }).container ?? 'root';
    const o = origin.get(container) ?? { x: 0, y: 0 };
    const shift = (p: Point) => ({ x: p.x + o.x, y: p.y + o.y });
    const points = (edge.sections ?? []).flatMap((s) => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint].map(shift));
    scene.lines.push({ ...lineEnds.get(edge.id)!, points });
  }

  return scene;
}
