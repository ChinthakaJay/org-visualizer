import { forwardRef, memo, useState } from 'react';
import type { Hue, PersonCard, Point, Scene, SceneLine, TeamBox, TeamColour } from '../core';
import { TEAM_HEADER } from '../core';
import { CHART_CSS } from './chartStyles';

interface ChartProps {
  scene: Scene;
  /** The viewport's pan and zoom, as an SVG transform. */
  transform: string;
  /** Collapse or expand a Team (clicking its header, or a Collapsed team's box). */
  onToggleTeam?(id: string): void;
  /** Clicking a card or a Team's title selects its line in the Org file. */
  onSelectLine?(line: number): void;
  /** The element to highlight, as "person:<id>" or "team:<id>". */
  highlight?: string | null;
  /** "+ Define" on a Placeholder Person or Team. */
  onDefine?(kind: 'person' | 'team', id: string): void;
}

interface Hover {
  person: PersonCard;
  x: number;
  y: number;
}

/** Draws a scene as SVG: Team boxes parent-first, then lines, then person cards on top. */
export const Chart = forwardRef<SVGSVGElement, ChartProps>(function Chart({ scene, transform, onToggleTeam, onSelectLine, onDefine, highlight = null }, ref) {
  const [hover, setHover] = useState<Hover | null>(null);
  return (
    <>
      <svg ref={ref} className="chart-svg" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <style>{CHART_CSS}</style>
          <marker id="arrow-reporting" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="arrow-head reporting" />
          </marker>
          <marker id="arrow-dotted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1,1 L9,5 L1,9" className="arrow-head dotted" />
          </marker>
        </defs>
        <g className="viewport-transform" transform={transform}>
          <SceneContent
            scene={scene}
            onHover={setHover}
            onToggleTeam={onToggleTeam}
            onSelectLine={onSelectLine}
            onDefine={onDefine}
            highlight={highlight}
          />
        </g>
      </svg>
      {hover && <Tooltip {...hover} />}
    </>
  );
});

/** The drawing itself; memoised so panning and zooming only touch the transform. */
interface SceneContentProps {
  scene: Scene;
  onHover(h: Hover | null): void;
  onToggleTeam?(id: string): void;
  onSelectLine?(line: number): void;
  onDefine?(kind: 'person' | 'team', id: string): void;
  highlight: string | null;
}

const SceneContent = memo(function SceneContent({ scene, onHover, onToggleTeam, onSelectLine, onDefine, highlight }: SceneContentProps) {
  return (
    <>
      {scene.teams.map((t) => (
        <TeamBoxView
          key={t.id}
          team={t}
          onToggle={onToggleTeam}
          onSelectLine={onSelectLine}
          onDefine={onDefine}
          highlighted={highlight === `team:${t.id}`}
        />
      ))}
      {scene.lines.map((l, i) => <LineView key={i} line={l} />)}
      {scene.people.map((p) => (
        <PersonCardView
          key={p.id}
          person={p}
          highlighted={highlight === `person:${p.id}`}
          onSelectLine={onSelectLine}
          onDefine={onDefine}
          onHover={(e) => onHover(e && { person: p, x: e.clientX, y: e.clientY })}
        />
      ))}
    </>
  );
});

interface TeamBoxViewProps {
  team: TeamBox;
  highlighted: boolean;
  onToggle?(id: string): void;
  onSelectLine?(line: number): void;
  onDefine?(kind: 'person' | 'team', id: string): void;
}

function TeamBoxView({ team, highlighted, onToggle, onSelectLine, onDefine }: TeamBoxViewProps) {
  const { x, y, width, height } = team;
  const toggle = onToggle && (() => onToggle(team.id));
  const label = `${team.collapsed ? 'Expand' : 'Collapse'} ${team.title}`;
  const keyToggle = (e: React.KeyboardEvent) => {
    if (toggle && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      toggle();
    }
  };
  return (
    <g
      className={`team${team.placeholder ? ' placeholder' : ''}${team.collapsed ? ' collapsed' : ''}${highlighted ? ' highlight' : ''}`}
      data-team={team.id}
      style={colourVars(team.colour)}
    >
      <rect className="team-box" x={x} y={y} width={width} height={height} rx={10} />
      {/* The header (or a whole Collapsed team) is the collapse / expand target. */}
      <rect
        className="team-hit"
        x={x} y={y} width={width} height={team.collapsed ? height : TEAM_HEADER} rx={10}
        role={toggle ? 'button' : undefined}
        tabIndex={toggle ? 0 : undefined}
        aria-label={toggle ? label : undefined}
        aria-expanded={toggle ? !team.collapsed : undefined}
        onClick={toggle}
        onKeyDown={keyToggle}
      >
        <title>{label}</title>
      </rect>
      <text className="team-chevron" x={x + 12} y={y + TEAM_HEADER / 2 + 5}>{team.collapsed ? '▸' : '▾'}</text>
      <text
        className={`team-title${team.line !== null && onSelectLine ? ' link' : ''}`}
        x={x + 28}
        y={y + TEAM_HEADER / 2 + 5}
        onClick={(e) => {
          // The title is the jump-to-line target; the rest of the header collapses or expands.
          if (team.line === null || !onSelectLine) return;
          e.stopPropagation();
          onSelectLine(team.line);
        }}
      >
        {clip(team.title, Math.floor((width - 40) / 7.5))}
        {team.line !== null && <title>Go to line {team.line}</title>}
      </text>
      {team.counts && (
        <text className="team-counts" x={x + 28} y={y + TEAM_HEADER + 18}>
          {countLabel(team.counts.people, 'Person', 'People')}
          {team.counts.teams > 0 && ` · ${countLabel(team.counts.teams, 'sub-team', 'sub-teams')}`}
        </text>
      )}
      {team.placeholder && onDefine && (
        <DefineButton x={x + width - 76} y={y + 8} label={`Define Team ${team.id}`} onClick={() => onDefine('team', team.id)} />
      )}
    </g>
  );
}

/** The "+ Define" action on a Placeholder: adds a line that defines it to the Org file. */
function DefineButton({ x, y, label, onClick }: { x: number; y: number; label: string; onClick(): void }) {
  return (
    <g
      className="define-button"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <title>{label}: add a line for it to the Org file</title>
      <rect x={x} y={y} width={66} height={20} rx={10} />
      <text x={x + 33} y={y + 14} textAnchor="middle">+ Define</text>
    </g>
  );
}

const countLabel = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const BADGE_CHAR_WIDTH = 6.4;

interface PersonCardViewProps {
  person: PersonCard;
  highlighted: boolean;
  onSelectLine?(line: number): void;
  onDefine?(kind: 'person' | 'team', id: string): void;
  onHover(e: React.MouseEvent | null): void;
}

function PersonCardView({ person, highlighted, onSelectLine, onDefine, onHover }: PersonCardViewProps) {
  const { x, y, width, height } = person;
  const fn = person.fn ? clip(person.fn, 12) : null;
  const badgeWidth = fn ? fn.length * BADGE_CHAR_WIDTH + 12 : 0;
  const roleX = x + 12 + (fn ? badgeWidth + 6 : 0);
  return (
    <g
      className={`card${person.placeholder ? ' placeholder' : ''}${highlighted ? ' highlight' : ''}`}
      data-person={person.id}
      onClick={() => person.line !== null && onSelectLine?.(person.line)}
      style={colourVars(person.tint)}
      onMouseMove={onHover}
      onMouseLeave={() => onHover(null)}
    >
      <rect className="card-box" x={x} y={y} width={width} height={height} rx={8} />
      <text className="card-name" x={x + 12} y={y + 24}>{clip(person.name, 22)}</text>
      {fn && (
        <g className="fn-badge" style={fnColourVars(person.fnColour)}>
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
      {person.placeholder && onDefine && (
        <DefineButton x={x + width - 76} y={y + 8} label={`Define ${person.id}`} onClick={() => onDefine('person', person.id)} />
      )}
    </g>
  );
}

function LineView({ line }: { line: SceneLine }) {
  // Lines run from the Manager to the report; the arrowhead sits at the Manager's end (reversed by
  // orient="auto-start-reverse"), so a line reads "reports to".
  return <path className={`line ${line.kind}`} d={pathOf(line.points)} markerStart={`url(#arrow-${line.kind})`} />;
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

const MAX_SHADE = 4;

/** Team colour as the custom properties the chart styles read. */
function colourVars(colour: TeamColour | null): React.CSSProperties | undefined {
  if (!colour) return undefined;
  return { '--h': colour.hue, '--s': colour.saturation, '--shade': Math.min(colour.shade, MAX_SHADE) } as React.CSSProperties;
}

/** Function colour as the custom properties the badge styles read. */
function fnColourVars(colour: Hue | null): React.CSSProperties | undefined {
  if (!colour) return undefined;
  return { '--fh': colour.hue, '--fs': colour.saturation } as React.CSSProperties;
}

const pathOf = (points: Point[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');

export const clip = (s: string, max: number) => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s);
