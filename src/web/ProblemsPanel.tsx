import { useState } from 'react';
import type { Problem } from '../core';

const ICON: Record<Problem['severity'], string> = { error: '●', warning: '▲', info: 'ℹ' };

/** The collapsible "Problems (n)" list under the editor. Clicking a Problem jumps to its line. */
export function ProblemsPanel({ problems, onJump }: { problems: Problem[]; onJump(line: number): void }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`problems${open ? ' open' : ''}`}>
      <button className="problems-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chevron">{open ? '▾' : '▸'}</span> Problems ({problems.length})
      </button>
      {open && (
        <ul className="problems-list">
          {problems.length === 0 && <li className="problems-empty">No problems found.</li>}
          {problems.map((p, i) => (
            <li key={i}>
              <button className={`problem ${p.severity}`} onClick={() => onJump(p.line)}>
                <span className="problem-icon" aria-label={p.severity}>{ICON[p.severity]}</span>
                <span className="problem-line">Line {p.line}</span>
                <span className="problem-message">{p.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
