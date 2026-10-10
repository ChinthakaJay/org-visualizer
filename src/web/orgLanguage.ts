import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StringStream } from '@codemirror/language';
import { tags } from '@lezer/highlight';

interface State {
  /** Where on the line we are: the head (`[team] <id> : <Name>`) or the key=value fields after it. */
  part: 'start' | 'id' | 'name' | 'key' | 'value';
}

/**
 * Syntax highlighting for the Org file: comments, the `team` keyword, ids, names, `|` separators,
 * keys and values. Mirrors what Parse reads; mistakes are left to the lint markers.
 */
const orgFile = StreamLanguage.define<State>({
  name: 'org-file',
  startState: () => ({ part: 'start' }),
  token(stream: StringStream, state: State) {
    if (stream.sol()) state.part = 'start';
    // `#` starts a comment at the start of a line or after whitespace.
    if (stream.peek() === '#' && (stream.sol() || /\s/.test(stream.string.charAt(stream.pos - 1)))) {
      stream.skipToEnd();
      return 'comment';
    }
    if (stream.eatSpace()) return null;

    if (stream.eat('|')) {
      state.part = 'key';
      return 'separator';
    }
    switch (state.part) {
      case 'start':
        state.part = 'id';
        if (stream.match(/^team(?=\s)/)) return 'keyword';
        if (!stream.match(/^[^\s:|#]+/)) stream.next();
        return 'definition';
      case 'id':
        if (stream.eat(':')) {
          state.part = 'name';
          return 'punctuation';
        }
        if (!stream.match(/^[^\s:|#]+/)) stream.next();
        return 'definition';
      case 'name':
        stream.match(/^[^|#]*?(?=\s#|\||$)/) || stream.next();
        return 'string';
      case 'key':
        if (stream.match(/^[\w-]+(?=\s*=)/)) return 'propertyName';
        if (stream.eat('=')) {
          state.part = 'value';
          return 'operator';
        }
        stream.match(/^[^|#]*?(?=\s#|\||$)/) || stream.next();
        return 'invalid';
      case 'value':
        stream.match(/^[^|#]*?(?=\s#|\||$)/) || stream.next();
        return 'atom';
    }
  },
  tokenTable: {
    definition: tags.definition(tags.variableName),
    separator: tags.separator,
  },
});

const orgFileStyle = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: tags.definition(tags.variableName), color: 'var(--syntax-id)', fontWeight: '600' },
  { tag: tags.string, color: 'var(--ink)' },
  { tag: [tags.separator, tags.punctuation, tags.operator], color: 'var(--muted)' },
  { tag: tags.propertyName, color: 'var(--syntax-key)' },
  { tag: tags.atom, color: 'var(--syntax-value)' },
]);

/** The Org file language plus its highlight colours, as one editor extension. */
export const orgFileSyntax = [orgFile, syntaxHighlighting(orgFileStyle)];
