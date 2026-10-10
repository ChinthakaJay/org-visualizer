import { useEffect, useState } from 'react';
import { buildScene, parse, type Scene } from '../core';
import { fetchOrgFile, type OrgFile } from './api';
import { Chart } from './Chart';
import { Editor } from './Editor';
import { layoutEngine } from './layout';

export function App() {
  const [file, setFile] = useState<OrgFile | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgFile()
      .then(async (f) => {
        setFile(f);
        setScene(await buildScene(parse(f.text), { engine: layoutEngine }));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) return <div className="fatal">{error}</div>;
  if (!file) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-name">Org Visualizer</span>
        <span className="file-path" title={file.path}>{file.path}</span>
      </header>
      <main className="panes">
        <section className="pane editor-pane">
          <Editor text={file.text} />
        </section>
        <section className="pane chart-pane">
          <div className="chart-viewport">{scene && <Chart scene={scene} />}</div>
        </section>
      </main>
    </div>
  );
}
