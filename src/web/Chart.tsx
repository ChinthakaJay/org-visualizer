import type { PersonCard, Point, Scene, SceneLine, TeamBox } from '../core';
import { TEAM_HEADER } from '../core';

interface ChartProps {
  scene: Scene;
}

/** Draws a scene as SVG: Team boxes parent-first, then lines, then person cards on top. */
export function Chart({ scene }: ChartProps) {
  return (
    <svg
      className="chart-svg"
      xmlns="http://www.w3.org/2000/svg"
      width={scene.width}
      height={scene.height}
      viewBox={`0 0 ${scene.width} ${scene.height}`}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="arrow-head" />
        </marker>
      </defs>
      {scene.teams.map((t) => <TeamBoxView key={t.id} team={t} />)}
      {scene.lines.map((l, i) => <LineView key={i} line={l} />)}
      {scene.people.map((p) => <PersonCardView key={p.id} person={p} />)}
    </svg>
  );
}

function TeamBoxView({ team }: { team: TeamBox }) {
  return (
    <g className={`team depth-${Math.min(team.depth, 4)}${team.placeholder ? ' placeholder' : ''}`} data-team={team.id}>
      <rect className="team-box" x={team.x} y={team.y} width={team.width} height={team.height} rx={10} />
      <text className="team-title" x={team.x + 12} y={team.y + TEAM_HEADER / 2 + 5}>
        {team.title}
      </text>
    </g>
  );
}

function PersonCardView({ person }: { person: PersonCard }) {
  return (
    <g className={`card${person.placeholder ? ' placeholder' : ''}`} data-person={person.id}>
      <rect className="card-box" x={person.x} y={person.y} width={person.width} height={person.height} rx={8} />
      <text className="card-name" x={person.x + 12} y={person.y + 24}>
        {clip(person.name, 22)}
      </text>
    </g>
  );
}

function LineView({ line }: { line: SceneLine }) {
  return <path className={`line ${line.kind}`} d={pathOf(line.points)} markerEnd="url(#arrow)" />;
}

const pathOf = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

export const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
