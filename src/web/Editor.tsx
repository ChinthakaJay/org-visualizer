import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Problem } from '../core';

export interface EditorHandle {
  getText(): string;
  /** Replace the whole document. The cursor stays on the same line and column where possible. */
  replaceText(text: string): void;
  /** Put the cursor at the start of a 1-based line, scroll it into view and focus the editor. */
  goToLine(line: number): void;
}

interface EditorProps {
  initialText: string;
  onChange?(text: string): void;
  /** Shown as lint markers on their lines. */
  problems?: Problem[];
}

/** The Org file editor (CodeMirror 6). It owns its document; the parent listens and pushes replacements. */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialText, onChange, problems = [] }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange });
  handlers.current = { onChange };
  /** Set while we replace the text ourselves, so it isn't reported as a user edit. */
  const replacing = useRef(false);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          lineNumbers(),
          lintGutter(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !replacing.current) handlers.current.onChange?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // The editor owns its document after creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current!;
    const { doc } = v.state;
    const diagnostics: Diagnostic[] = problems
      .filter((p) => p.line <= doc.lines)
      .map((p) => {
        const line = doc.line(p.line);
        return { from: line.from, to: line.to, severity: p.severity, message: p.message };
      });
    v.dispatch(setDiagnostics(v.state, diagnostics));
  }, [problems]);

  useImperativeHandle(ref, () => ({
    getText: () => view.current!.state.doc.toString(),
    replaceText(text) {
      const v = view.current!;
      const { doc, selection } = v.state;
      const head = doc.lineAt(selection.main.head);
      const column = selection.main.head - head.from;
      replacing.current = true;
      v.dispatch({ changes: { from: 0, to: doc.length, insert: text } });
      replacing.current = false;
      const next = v.state.doc;
      const line = next.line(Math.min(head.number, next.lines));
      v.dispatch({ selection: { anchor: line.from + Math.min(column, line.length) } });
    },
    goToLine(n) {
      const v = view.current!;
      const line = v.state.doc.line(Math.max(1, Math.min(n, v.state.doc.lines)));
      v.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      v.focus();
    },
  }), []);

  return <div className="editor" ref={host} />;
});
