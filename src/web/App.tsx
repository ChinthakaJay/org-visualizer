import { useEffect, useRef, useState } from 'react';
import { TEMPLATE } from '../core';
import { fetchOrgFile, watchOrgFile, type OrgFile } from './api';
import { Help } from './Help';
import { OrgWorkbench, type WorkbenchHandle } from './OrgWorkbench';
import { useAutosave, type SaveState } from './useAutosave';

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
  const workbench = useRef<WorkbenchHandle>(null);
  const [text, setText] = useState(file.text);
  /** What's on disk when it differs from our unsaved edits; drives the "Reload / Keep mine" banner. */
  const [conflict, setConflict] = useState<OrgFile | null>(null);
  const save = useAutosave(file, text, setConflict);
  // Help opens by itself while the file is still the untouched template.
  const [helpOpen, setHelpOpen] = useState(file.text === TEMPLATE);

  const latest = useRef({ text, saved: save.saved });
  latest.current = { text, saved: save.saved };

  const loadFromDisk = (disk: OrgFile) => {
    workbench.current?.replaceText(disk.text);
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
        <button className="help-button" onClick={() => setHelpOpen(true)} aria-haspopup="dialog">Help</button>
      </header>
      {conflict && (
        <div className="conflict-banner" role="alert">
          <span>The Org file changed on disk while you had unsaved edits.</span>
          <button onClick={() => loadFromDisk(conflict)}>Reload</button>
          <button onClick={() => keepMine(conflict)}>Keep mine</button>
        </div>
      )}
      <OrgWorkbench
        ref={workbench}
        initialText={file.text}
        onChange={setText}
        collapseKey={file.path}
        exportName={exportName(file.path)}
      />
      {helpOpen && <Help onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

/** "team-org.txt" → "team-org.svg" */
const exportName = (path: string) => (path.split(/[\\/]/).pop() ?? 'org').replace(/\.[^.]*$/, '') + '.svg';

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
