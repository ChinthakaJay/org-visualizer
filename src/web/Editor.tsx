import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { useEffect, useRef } from 'react';

interface EditorProps {
  text: string;
}

/** The Org file editor (CodeMirror 6). */
export function Editor({ text }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: text,
        extensions: [lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), EditorState.readOnly.of(true)],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // The editor owns its document after creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="editor" ref={host} />;
}
