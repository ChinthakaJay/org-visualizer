import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { definePlaceholder, parse } from '../core';
import { ChartView, type ChartHandle } from './ChartView';
import { Editor, type EditorHandle } from './Editor';
import { elementForLine } from './linking';
import { ProblemsPanel } from './ProblemsPanel';
import { Search, type SearchResult } from './Search';
import { useCollapse } from './useCollapse';
import { useScene } from './useScene';

export interface WorkbenchHandle extends EditorHandle {
  /** Collapse or expand Teams, as the chart's own controls would. */
  setCollapsed(ids: Iterable<string>): void;
}

interface OrgWorkbenchProps {
  initialText: string;
  onChange?(text: string): void;
  /** Where collapse state is remembered (the Org file path), or null to keep it in memory only. */
  collapseKey: string | null;
  exportName: string;
}

/**
 * The editor and the chart side by side, linked both ways, with Problems, search, collapse and the
 * status bar. Used for the real Org file and for the Help sandbox.
 */
export const OrgWorkbench = forwardRef<WorkbenchHandle, OrgWorkbenchProps>(function OrgWorkbench(
  { initialText, onChange, collapseKey, exportName },
  ref,
) {
  const editor = useRef<EditorHandle>(null);
  const chart = useRef<ChartHandle>(null);
  const [text, setText] = useState(initialText);
  const org = useMemo(() => parse(text), [text]);
  const collapse = useCollapse(collapseKey, org);
  const { scene, stale } = useScene(org, collapse.collapsed);
  const [cursorLine, setCursorLine] = useState(0);
  const linked = useMemo(() => (scene ? elementForLine(org, scene, cursorLine) : null), [org, scene, cursorLine]);

  const handlers = useRef({ onChange });
  handlers.current = { onChange };
  const changed = useCallback((next: string) => {
    setText(next);
    handlers.current.onChange?.(next);
  }, []);

  useImperativeHandle(ref, () => ({
    getText: () => editor.current!.getText(),
    replaceText: (t) => editor.current!.replaceText(t),
    goToLine: (n) => editor.current!.goToLine(n),
    applyEdit: (t, n, o) => editor.current!.applyEdit(t, n, o),
    setCollapsed: collapse.setCollapsed,
  }), [collapse.setCollapsed]);

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

  return (
    <>
      <main className="panes">
        <section className="pane editor-pane">
          <Editor ref={editor} initialText={initialText} onChange={changed} problems={org.problems} onCursorLine={onCursorLine} />
          <ProblemsPanel problems={org.problems} onJump={selectLine} />
        </section>
        <section className="pane chart-pane">
          <ChartView
            ref={chart}
            scene={scene}
            stale={stale}
            exportName={exportName}
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
    </>
  );
});

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
