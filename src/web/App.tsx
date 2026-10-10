import { useEffect, useRef, useState } from 'react';
import { fetchOrgFile, watchOrgFile, type OrgFile } from './api';
import { Chart } from './Chart';
import { Editor, type EditorHandle } from './Editor';
import { ProblemsPanel } from './ProblemsPanel';
import { useAutosave, type SaveState } from './useAutosave';
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
  const [text, setText] = useState(file.text);
  const { org, scene, stale } = useScene(text);
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
          {stale && <div className="stale-badge" role="status">Couldn't redraw. Showing the last good chart.</div>}
          <div className={`chart-viewport${stale ? ' stale' : ''}`}>{scene && <Chart scene={scene} />}</div>
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
