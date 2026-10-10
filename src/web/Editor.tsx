import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search';
import { EditorState, type ChangeSpec } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { format, type Problem } from '../core';
import { orgFileSyntax } from './orgLanguage';

export interface EditorHandle {
  getText(): string;
  /** Replace the whole document (reported through onChange). The cursor stays on the same line and column where possible. */
  replaceText(text: string): void;
  /** Put the cursor at the start of a 1-based line, scroll it into view and focus the editor. */
  goToLine(line: number): void;
  /**
   * Change the text as if the user typed it (so it autosaves and can be undone), then put the
   * cursor at the end of a 1-based line and select it if asked.
   */
  applyEdit(text: string, line: number | null, options?: { select?: boolean }): void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const FIND_KEYS = isMac ? '⌘F' : 'Ctrl+F';
const FORMAT_KEYS = isMac ? '⇧⌥F' : 'Shift+Alt+F';

/** The smallest change that turns old into text: the differing middle, after any shared start and end. */
function minimalChange(old: string, text: string, offset = 0): ChangeSpec {
  let start = 0;
  while (start < old.length && start < text.length && old[start] === text[start]) start++;
  let end = 0;
  while (end < old.length - start && end < text.length - start && old[old.length - 1 - end] === text[text.length - 1 - end]) end++;
  return { from: offset + start, to: offset + old.length - end, insert: text.slice(start, text.length - end) };
}

/**
 * Format the whole Org file as one undoable edit. Format never adds or removes lines, so each
 * changed line gets its own small change and the cursor stays where it was in its line.
 */
function formatDocument(view: EditorView): boolean {
  const { doc } = view.state;
  const next = format(doc.toString()).split('\n');
  const changes: ChangeSpec[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (line.text !== next[i - 1]) changes.push(minimalChange(line.text, next[i - 1], line.from));
  }
  if (changes.length) view.dispatch({ changes, userEvent: 'format' });
  return true;
}

interface EditorProps {
  initialText: string;
  onChange?(text: string): void;
  /** Shown as lint markers on their lines. */
  problems?: Problem[];
  /** Called with the cursor's 1-based line whenever it moves to a different line. */
  onCursorLine?(line: number): void;
}

/** The Org file editor (CodeMirror 6). It owns its document; the parent listens and pushes replacements. */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialText, onChange, problems = [], onCursorLine }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onCursorLine });
  handlers.current = { onChange, onCursorLine };
  const cursorLine = useRef(0);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          lineNumbers(),
          lintGutter(),
          orgFileSyntax,
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          highlightSelectionMatches(),
          search({ top: true }),
          history(),
          keymap.of([{ key: 'Shift-Alt-f', run: formatDocument, preventDefault: true }, ...searchKeymap, ...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString());
            if (u.docChanged || u.selectionSet) {
              const line = u.state.doc.lineAt(u.state.selection.main.head).number;
              if (line !== cursorLine.current) {
                cursorLine.current = line;
                handlers.current.onCursorLine?.(line);
              }
            }
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
      v.dispatch({ changes: { from: 0, to: doc.length, insert: text } });
      const next = v.state.doc;
      const line = next.line(Math.min(head.number, next.lines));
      v.dispatch({ selection: { anchor: line.from + Math.min(column, line.length) } });
    },
    applyEdit(text, n, { select = false } = {}) {
      const v = view.current!;
      // Replace only the part that differs, so undo and the cursor behave naturally.
      v.dispatch({ changes: minimalChange(v.state.doc.toString(), text) });
      if (n !== null) {
        const line = v.state.doc.line(Math.max(1, Math.min(n, v.state.doc.lines)));
        // A selected line is selected backwards, so a long line scrolls to its start, not its end.
        v.dispatch({ selection: select ? { anchor: line.to, head: line.from } : { anchor: line.to }, scrollIntoView: true });
      }
      v.focus();
    },
    goToLine(n) {
      const v = view.current!;
      const line = v.state.doc.line(Math.max(1, Math.min(n, v.state.doc.lines)));
      v.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      v.focus();
    },
  }), []);

  return (
    <>
      <div className="toolbar editor-toolbar" role="toolbar" aria-label="Editor">
        <button title={`Find and replace (${FIND_KEYS})`} onClick={() => openSearchPanel(view.current!)}>Find</button>
        <button
          title={`Tidy the spacing of every line (${FORMAT_KEYS})`}
          onClick={() => {
            formatDocument(view.current!);
            view.current!.focus();
          }}
        >
          Format
        </button>
      </div>
      <div className="editor" ref={host} />
    </>
  );
});
