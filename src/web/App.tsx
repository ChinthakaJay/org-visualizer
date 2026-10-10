import { useEffect, useMemo, useRef, useState } from 'react';
import { parse } from '../core';
import { fetchOrgFile, watchOrgFile, type OrgFile } from './api';
import { ChartView, type ChartHandle } from './ChartView';
import { Editor, type EditorHandle } from './Editor';
import { ProblemsPanel } from './ProblemsPanel';
import { useAutosave, type SaveState } from './useAutosave';
import { useCollapse } from './useCollapse';
import { useScene } from './useScene';

export function App() {
  const [file, setFile] = useState<OrgFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgFile().then(setFile, (e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <div className="fatal">{error}</div>;
  if (!file) return <div className="loading">Loading…</div>;
  return <Workspace file={file} />;
}

function Workspace({ file }: { file: OrgFile }) {
  const editor = useRef<EditorHandle>(null);
  const chart = useRef<ChartHandle>(null);
  const [text, setText] = useState(file.text);
  const org = useMemo(() => parse(text), [text]);
  const collapse = useCollapse(file.path, org);
  const { scene, stale } = useScene(org, collapse.collapsed);
  /** What's on disk when it differs from our unsaved edits; drives the "Reload / Keep mine" banner. */
  const [conflict, setConflict] = useState<OrgFile | null>(null);
  const save = useAutosave(file, text, setConflict);

  const latest = useRef({ text, saved: save.saved });
  latest.current = { text, saved: save.saved };

  const loadFromDisk = (disk: OrgFile) => {
    editor.current?.replaceText(disk.text);
    setText(disk.text);
    save.setSaved({ text: disk.text, version: disk.version });
    save.setState('saved');
    setConflict(null);
  };

  useEffect(
    () =>
      watchOrgFile((disk) => {
        const { text: current, saved } = latest.current;
        if (disk.version === saved?.version) return;
        const unsaved = saved !== null && current !== saved.text;
        if (!unsaved || current === disk.text) loadFromDisk(disk);
        else setConflict(disk);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const keepMine = (disk: OrgFile) => {
    // Treat the disk version as seen, so the next autosave overwrites it on purpose.
    save.setSaved({ text: disk.text, version: disk.version });
    save.setState('unsaved');
    setConflict(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Org Visualizer</span>
        <span className="file-path" title={file.path}>{file.path}</span>
        <span className="spacer" />
        <SaveIndicator state={save.state} />
      </header>
      {conflict && (
        <div className="conflict-banner" role="alert">
          <span>The Org file changed on disk while you had unsaved edits.</span>
          <button onClick={() => loadFromDisk(conflict)}>Reload</button>
          <button onClick={() => keepMine(conflict)}>Keep mine</button>
        </div>
      )}
      <main className="panes">
        <section className="pane editor-pane">
          <Editor ref={editor} initialText={file.text} onChange={setText} problems={org.problems} />
          <ProblemsPanel problems={org.problems} onJump={(line) => editor.current?.goToLine(line)} />
        </section>
        <section className="pane chart-pane">
          <ChartView
            ref={chart}
            scene={scene}
            stale={stale}
            exportName={exportName(file.path)}
            onToggleTeam={collapse.toggle}
            toolbar={<CollapseControls collapse={collapse} />}
          />
        </section>
      </main>
      <footer className="status-bar">
        {scene && (
          <>
            <span>{plural(scene.counts.people, 'Person', 'People')}</span>
            <span>{plural(scene.counts.teams, 'Team', 'Teams')}</span>
            <span>{plural(scene.counts.placeholders, 'Placeholder', 'Placeholders')}</span>
          </>
        )}
      </footer>
    </div>
  );
}

/** "team-org.txt" → "team-org.svg" */
const exportName = (path: string) => (path.split(/[\\/]/).pop() ?? 'org').replace(/\.[^.]*$/, '') + '.svg';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function CollapseControls({ collapse }: { collapse: ReturnType<typeof useCollapse> }) {
  const depths = Array.from({ length: collapse.maxDepth + 1 }, (_, i) => i + 1);
  return (
    <>
      <button onClick={collapse.collapseAll}>Collapse all</button>
      <button onClick={collapse.expandAll}>Expand all</button>
      <label className="depth-select">
        Collapse to depth
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) collapse.collapseToDepth(Number(e.target.value));
          }}
        >
          <option value="">…</option>
          {depths.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
    </>
  );
}

const SAVE_LABELS: Record<SaveState, string> = {
  saved: 'Saved',
  unsaved: 'Unsaved changes',
  saving: 'Saving…',
  conflict: 'Not saved: file changed on disk',
  error: "Couldn't save",
};

function SaveIndicator({ state }: { state: SaveState }) {
  return <span className={`save-state ${state}`}>{SAVE_LABELS[state]}</span>;
}
