import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { definePlaceholder, parse } from '../core';
import { fetchOrgFile, watchOrgFile, type OrgFile } from './api';
import { ChartView, type ChartHandle } from './ChartView';
import { Editor, type EditorHandle } from './Editor';
import { elementForLine } from './linking';
import { ProblemsPanel } from './ProblemsPanel';
import { Search, type SearchResult } from './Search';
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
  const [cursorLine, setCursorLine] = useState(0);
  const linked = useMemo(() => (scene ? elementForLine(org, scene, cursorLine) : null), [org, scene, cursorLine]);

  // Pan to the linked element when the cursor moves to a new line (not on every redraw while typing).
  const linkedRef = useRef(linked);
  linkedRef.current = linked;
  useEffect(() => {
    if (linkedRef.current) chart.current?.reveal(linkedRef.current.rect);
  }, [cursorLine]);

  const selectLine = useCallback((line: number) => editor.current?.goToLine(line), []);
  const define = useCallback((kind: 'person' | 'team', id: string) => {
    const e = editor.current;
    if (!e) return;
    const edit = definePlaceholder(e.getText(), kind, id);
    e.applyEdit(edit.text, edit.line);
  }, []);

  // A picked search result: highlighted until the cursor moves, and panned to once it's drawn.
  const [found, setFound] = useState<{ key: string; revealed: boolean } | null>(null);
  const pickResult = (r: SearchResult) => {
    if (r.kind === 'person') collapse.expandTo(org.people.get(r.id)?.team ?? null);
    else collapse.expandTo(org.teams.get(r.id)?.parent ?? null);
    setFound({ key: `${r.kind}:${r.id}`, revealed: false });
  };
  useEffect(() => {
    if (!scene || !found || found.revealed) return;
    const [kind, id] = [found.key.slice(0, found.key.indexOf(':')), found.key.slice(found.key.indexOf(':') + 1)];
    const element = kind === 'person' ? scene.people.find((p) => p.id === id) : scene.teams.find((t) => t.id === id);
    if (!element) return; // still hidden: wait for the redraw after expanding
    chart.current?.reveal(element);
    setFound({ ...found, revealed: true });
  }, [scene, found]);
  const onCursorLine = useCallback((line: number) => {
    setCursorLine(line);
    setFound(null);
  }, []);
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
          <Editor
            ref={editor}
            initialText={file.text}
            onChange={setText}
            problems={org.problems}
            onCursorLine={onCursorLine}
          />
          <ProblemsPanel problems={org.problems} onJump={(line) => editor.current?.goToLine(line)} />
        </section>
        <section className="pane chart-pane">
          <ChartView
            ref={chart}
            scene={scene}
            stale={stale}
            exportName={exportName(file.path)}
            onToggleTeam={collapse.toggle}
            onSelectLine={selectLine}
            onDefine={define}
            highlight={found?.key ?? linked?.key ?? null}
            toolbar={
              <>
                <Search org={org} onPick={pickResult} />
                <CollapseControls collapse={collapse} />
              </>
            }
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
