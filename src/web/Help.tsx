import { useEffect, useRef, useState, type ReactNode } from 'react';
import { COLOUR_NAMES, SAMPLE, WALKTHROUGHS, type StepResult } from '../core';
import { OrgWorkbench, type WorkbenchHandle } from './OrgWorkbench';

type Tab = 'syntax' | 'walkthroughs' | 'keys';

const TABS: { id: Tab; label: string }[] = [
  { id: 'syntax', label: 'Syntax reference' },
  { id: 'walkthroughs', label: 'Walkthroughs' },
  { id: 'keys', label: 'Keyboard & mouse' },
];

/**
 * Full-screen Help: a sandbox with its own sample Org file, editor and chart, beside the references.
 * Nothing here touches the real Org file or autosave.
 */
export function Help({ onClose }: { onClose(): void }) {
  const [tab, setTab] = useState<Tab>('syntax');
  const sandbox = useRef<WorkbenchHandle>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc in the search box closes its results, and in the sandbox editor it belongs to the editor.
      const inField = e.target instanceof HTMLInputElement || (e.target instanceof Element && e.target.closest('.cm-editor'));
      if (e.key === 'Escape' && !inField) onClose();
    };
    window.addEventListener('keydown', onKey);
    dialog.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="help" role="dialog" aria-modal="true" aria-label="Help" ref={dialog} tabIndex={-1}>
      <header className="help-header">
        <span className="app-name">Help</span>
        <span className="help-note">A sandbox with its own sample file. Nothing here changes your Org file.</span>
        <span className="spacer" />
        <button
          onClick={() => {
            sandbox.current?.replaceText(SAMPLE);
            sandbox.current?.setCollapsed([]);
          }}
        >
          Reset sample
        </button>
        <button className="help-close" onClick={onClose} aria-label="Close Help">Close</button>
      </header>
      <div className="help-body">
        <aside className="help-side">
          <nav className="help-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="help-content" role="tabpanel">
            {tab === 'syntax' && <SyntaxReference />}
            {tab === 'walkthroughs' && <Walkthroughs sandbox={sandbox} />}
            {tab === 'keys' && <KeyboardReference />}
          </div>
        </aside>
        <div className="help-sandbox">
          <OrgWorkbench ref={sandbox} initialText={SAMPLE} collapseKey={null} exportName="sample.svg" />
        </div>
      </div>
    </div>
  );
}

/** Step-by-step walkthroughs that apply each edit to the sandbox and show the line that changed. */
function Walkthroughs({ sandbox }: { sandbox: React.RefObject<WorkbenchHandle | null> }) {
  const [active, setActive] = useState<number | null>(null);
  const [done, setDone] = useState(0);
  const [change, setChange] = useState<StepResult | null>(null);

  const start = (i: number) => {
    setActive(i);
    setDone(0);
    setChange(null);
    sandbox.current?.replaceText(SAMPLE);
    sandbox.current?.setCollapsed([]);
  };

  const runStep = (i: number) => {
    const s = sandbox.current;
    if (active === null || !s) return;
    const result = WALKTHROUGHS[active].steps[i].run(s.getText());
    if (result.text !== s.getText()) s.applyEdit(result.text, result.line, { select: true });
    if (result.collapse) s.setCollapsed(result.collapse);
    setChange(result);
    setDone(i + 1);
  };

  const walkthrough = active === null ? null : WALKTHROUGHS[active];
  return (
    <div className="walkthroughs">
      <p>Each walkthrough starts from the sample and shows how a real-world change becomes a one-line edit.</p>
      <div className="walkthrough-list">
        {WALKTHROUGHS.map((w, i) => (
          <button key={w.name} className={i === active ? 'on' : ''} aria-pressed={i === active} onClick={() => start(i)}>
            {w.name}
          </button>
        ))}
      </div>
      {walkthrough && (
        <section className="walkthrough">
          <h3>{walkthrough.name}</h3>
          <p>{walkthrough.description}</p>
          <ol className="walkthrough-steps">
            {walkthrough.steps.map((step, i) => (
              <li key={step.label}>
                <button
                  className={i < done ? 'done' : i === done ? 'next' : ''}
                  disabled={i !== done}
                  onClick={() => runStep(i)}
                >
                  {step.label}
                </button>
              </li>
            ))}
          </ol>
          {done === walkthrough.steps.length && (
            <p className="walkthrough-end">
              Done. <button className="link" onClick={() => start(active!)}>Start again</button>
            </p>
          )}
          {change && <ChangeView change={change} />}
        </section>
      )}
    </div>
  );
}

/** The exact line a step changed, before and after, or a note when it wasn't a single line. */
function ChangeView({ change }: { change: StepResult }) {
  return (
    <div className="change" role="status">
      {change.line !== null && (
        <>
          <div className="change-title">Line {change.line}</div>
          {change.before !== null && <pre className="minus">- {change.before}</pre>}
          <pre className="plus">+ {change.after}</pre>
        </>
      )}
      {change.note && <div className="change-note">{change.note}</div>}
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <pre className="help-code">{children}</pre>;
}

function SyntaxReference() {
  return (
    <>
      <p>The Org file holds one fact per line, in any order. Everything after <code>#</code> is a comment.</p>

      <h3>Teams</h3>
      <Code>{'team <id> : <Title> | parent=<team-id> | color=<colour>'}</Code>
      <p>A Team with no <code>parent=</code> is top-level. Move a whole Team, with everything in it, by changing its <code>parent=</code>.</p>
      <Code>{'team fintech  : FinTech\nteam payments : Payments | parent=fintech'}</Code>

      <h3>People</h3>
      <Code>{'<id> : <Name> | team=<team-id> | reports=<id or ?> | role=<text> | fn=<function>'}</Code>
      <ul>
        <li><code>team=</code> puts the Person in a Team.</li>
        <li><code>reports=</code> is their Manager, drawn as a Reporting line. Leave it out, or write <code>reports=?</code>, when you don't know.</li>
        <li><code>role=</code> is the job title, shown on the card.</li>
        <li><code>fn=</code> is the Function, the kind of work (for example <code>eng</code>, <code>product</code>, <code>ops</code>). Any word works; it shows as a badge.</li>
        <li>Any other <code>key=value</code> is kept as a note and shown when you hover the card.</li>
      </ul>
      <Code>{'alice : Alice Smith | team=payments | reports=bob | role=EM | fn=eng | met=2024 offsite'}</Code>

      <h3>Dotted lines</h3>
      <p>A matrix link to someone other than the Manager. It's drawn dashed and never replaces the Reporting line. List several with commas.</p>
      <Code>{'gia : Gia Lam | team=cards | reports=alice | dotted=vp, carol'}</Code>

      <h3>Team colours</h3>
      <p>
        Each top-level Team gets its own colour, and sub-teams take shades of it. Set <code>color=</code> on a Team to choose
        one; its sub-teams inherit it. Use <code>#rrggbb</code> or a name: {COLOUR_NAMES.join(', ')}.
      </p>
      <Code>{'team growth : Growth | color=green'}</Code>

      <h3>Partial knowledge</h3>
      <p>
        A Manager, Dotted-line contact or Team you mention but haven't defined is drawn as a dashed Placeholder. Add its line,
        or click <b>+ Define</b> on it, and it becomes a normal card or Team.
      </p>

      <h3>Problems</h3>
      <p>
        Mistakes show as markers in the editor and in the Problems list: lines that can't be read, duplicate ids (the first line
        wins), a Team inside its own sub-team, Reporting-line loops, and someone reporting to themselves. The chart still draws.
      </p>
    </>
  );
}

function KeyboardReference() {
  const rows: [string, string][] = [
    ['Pan', 'Drag the chart'],
    ['Zoom', 'Scroll wheel or trackpad pinch over the chart, or the − and + buttons'],
    ['See everything', 'Fit'],
    ['Collapse or expand a Team', "Click the Team's header, or click a Collapsed team. With the header focused, Enter or Space"],
    ['Collapse many at once', 'Collapse all, Expand all, Collapse to depth'],
    ['Jump to a line', "Click a person card or a Team's title, or a Problem in the Problems list"],
    ['See what a line means', 'Put the cursor on it: its card or Team is highlighted, and the chart pans to it'],
    ['Find someone', 'Type in the search box, then ↑ ↓ and Enter, or click a result'],
    ['Details', 'Hover a person card'],
    ['Define a Placeholder', 'Click + Define on it'],
    ['Undo / redo in the editor', '⌘Z / ⇧⌘Z (Ctrl+Z / Ctrl+Y)'],
    ['Find and replace text in the editor', 'Find, or ⌘F (Ctrl+F). Replace is in the same panel'],
    ['Tidy the spacing of every line', 'Format, or ⇧⌥F (Shift+Alt+F). Lines that can\'t be read are left alone'],
    ['Close Help', 'Esc'],
  ];
  return (
    <dl className="help-keys">
      {rows.map(([what, how]) => (
        <div key={what}>
          <dt>{what}</dt>
          <dd>{how}</dd>
        </div>
      ))}
    </dl>
  );
}
