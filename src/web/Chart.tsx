import { useState } from 'react';
import type { PersonCard, Point, Scene, SceneLine, TeamBox } from '../core';
import { TEAM_HEADER } from '../core';

interface ChartProps {
  scene: Scene;
}

interface Hover {
  person: PersonCard;
  x: number;
  y: number;
}

/** Draws a scene as SVG: Team boxes parent-first, then lines, then person cards on top. */
export function Chart({ scene }: ChartProps) {
  const [hover, setHover] = useState<Hover | null>(null);

  return (
    <>
      <svg
        className="chart-svg"
        xmlns="http://www.w3.org/2000/svg"
        width={scene.width}
        height={scene.height}
        viewBox={`0 0 ${scene.width} ${scene.height}`}
      >
        <defs>
          <marker id="arrow-reporting" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrow-head reporting" />
          </marker>
          <marker id="arrow-dotted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1,1 L9,5 L1,9" className="arrow-head dotted" />
          </marker>
        </defs>
        {scene.teams.map((t) => <TeamBoxView key={t.id} team={t} />)}
        {scene.lines.map((l, i) => <LineView key={i} line={l} />)}
        {scene.people.map((p) => (
          <PersonCardView
            key={p.id}
            person={p}
            onHover={(e) => setHover(e && { person: p, x: e.clientX, y: e.clientY })}
          />
        ))}
      </svg>
      {hover && <Tooltip {...hover} />}
    </>
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

const BADGE_CHAR_WIDTH = 6.4;

function PersonCardView({ person, onHover }: { person: PersonCard; onHover(e: React.MouseEvent | null): void }) {
  const { x, y, width, height } = person;
  const fn = person.fn ? clip(person.fn, 12) : null;
  const badgeWidth = fn ? fn.length * BADGE_CHAR_WIDTH + 12 : 0;
  const roleX = x + 12 + (fn ? badgeWidth + 6 : 0);
  return (
    <g
      className={`card${person.placeholder ? ' placeholder' : ''}`}
      data-person={person.id}
      onMouseMove={onHover}
      onMouseLeave={() => onHover(null)}
    >
      <rect className="card-box" x={x} y={y} width={width} height={height} rx={8} />
      <text className="card-name" x={x + 12} y={y + 24}>{clip(person.name, 22)}</text>
      {fn && (
        <g className="fn-badge">
          <rect x={x + 12} y={y + 34} width={badgeWidth} height={17} rx={8.5} />
          <text x={x + 12 + badgeWidth / 2} y={y + 46} textAnchor="middle">{fn}</text>
        </g>
      )}
      {person.role && (
        <text className="card-role" x={roleX} y={y + 46}>
          {clip(person.role, Math.floor((x + width - 10 - roleX) / 6.6))}
        </text>
      )}
      {person.placeholder && !person.role && (
        <text className="card-role" x={x + 12} y={y + 46}>Not defined yet</text>
      )}
    </g>
  );
}

function LineView({ line }: { line: SceneLine }) {
  return <path className={`line ${line.kind}`} d={pathOf(line.points)} markerEnd={`url(#arrow-${line.kind})`} />;
}

function Tooltip({ person, x, y }: Hover) {
  const t = person.tooltip;
  const rows: [string, string][] = [
    ['Id', t.id],
    ['Team', t.team ?? '—'],
    ['Manager', t.manager ?? '—'],
    ['Line', t.line === null ? 'not defined yet' : String(t.line)],
    ...Object.entries(t.extra),
  ];
  return (
    <div className="tooltip" role="tooltip" style={tooltipPosition(x, y)}>
      <div className="tooltip-title">{person.name}</div>
      {person.role && <div className="tooltip-role">{person.role}{person.fn ? ` · ${person.fn}` : ''}</div>}
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

/** Below-right of the pointer, flipped above or left when it would run off the window. */
function tooltipPosition(x: number, y: number): React.CSSProperties {
  const flipX = x > window.innerWidth - 320;
  const flipY = y > window.innerHeight - 220;
  return {
    ...(flipX ? { right: window.innerWidth - x + 14 } : { left: x + 14 }),
    ...(flipY ? { bottom: window.innerHeight - y + 14 } : { top: y + 14 }),
  };
}

const pathOf = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

export const clip = (s: string, max: number) => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s);
