import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
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

export interface EditorHandle {
  getText(): string;
  /** Replace the whole document. The cursor stays on the same line and column where possible. */
  replaceText(text: string): void;
}

interface EditorProps {
  initialText: string;
  onChange?(text: string): void;
}

/** The Org file editor (CodeMirror 6). It owns its document; the parent listens and pushes replacements. */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialText, onChange }, ref) {
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
  }), []);

  return <div className="editor" ref={host} />;
});
