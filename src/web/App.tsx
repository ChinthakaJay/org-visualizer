import { useEffect, useRef, useState } from 'react';
import { fetchOrgFile, type OrgFile } from './api';
import { Chart } from './Chart';
import { Editor, type EditorHandle } from './Editor';
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
  const { scene, stale } = useScene(text);
  const save = useAutosave(file, text, () => {});

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Org Visualizer</span>
        <span className="file-path" title={file.path}>{file.path}</span>
        <span className="spacer" />
        <SaveIndicator state={save.state} />
      </header>
      <main className="panes">
        <section className="pane editor-pane">
          <Editor ref={editor} initialText={file.text} onChange={setText} />
        </section>
        <section className="pane chart-pane">
          {stale && <div className="stale-badge" role="status">Couldn't redraw. Showing the last good chart.</div>}
          <div className={`chart-viewport${stale ? ' stale' : ''}`}>{scene && <Chart scene={scene} />}</div>
        </section>
      </main>
    </div>
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
