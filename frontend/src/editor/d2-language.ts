/**
 * D2 as an editor reads it: a stream tokeniser for its colours, and the
 * editing help D2 is typed with (indent, closing, the comment toggle,
 * bracket matching). Used by the D2 diagram dialog and by code blocks set
 * to D2, on the canvas and in a page.
 *
 * A tokeniser, not a grammar: colour and keys need to know what each piece
 * of a line is, never the shape of the whole diagram.
 */
import { StreamLanguage, StringStream, bracketMatching, indentOnInput, LanguageSupport, type StreamParser } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import keywords from '../../../testdata/d2/keywords.json';

/** D2's reserved words, as the pinned D2 lists them (`testdata/d2/keywords.json`). */
export const D2_KEYWORDS: ReadonlySet<string> = new Set(keywords);

/** What a piece of D2 is, for its colour. */
export type D2Kind = 'comment' | 'keyword' | 'name' | 'string' | 'number' | 'operator' | 'type' | 'punctuation';

type State = {
  /** How many braces are open, for indentation. */
  depth: number;
  /** Inside square brackets: a list of values. */
  square: number;
  /** After a colon on this line: what follows is a value. */
  value: boolean;
  /** Inside a block string: what closes it. */
  block: string | null;
};

const WORD = /^[\p{L}\p{N}_](?:[\p{L}\p{N}_]|-(?![->-]))*/u;
const CONNECTION = /^(?:<-+>|<-+|-+>|--+)/;
const NUMBER = /^-?\d+(?:\.\d+)?(?=\s*(?:$|[;{}\]#,]))/;
const ATOM = /^(?:true|false|null)(?=\s*(?:$|[;{}\]#,]))/i;
const BLOCK_OPEN = /^(\|+)(`*)([\w-]*)/;
const VARIABLE = /^\$\{[^}\n]*\}?/;

/** A quoted string, escapes and all, to its closing quote or the line's end. */
function quoted(stream: StringStream, quote: string): void {
  let escaped = false;
  while (!stream.eol()) {
    const char = stream.next();
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === quote) return;
  }
}

/**
 * An unquoted value: to a `;`, a brace or bracket, a ` #` comment, a `${`
 * variable, or the line's end, its trailing blanks left out.
 */
function unquoted(stream: StringStream): void {
  const rest = stream.string.slice(stream.pos);
  let end = 0;
  while (end < rest.length) {
    const char = rest[end];
    if (char === ';' || char === '{' || char === '}' || char === '[' || char === ']') break;
    if (char === '#' && (end === 0 || /\s/.test(rest[end - 1]))) break;
    if (char === '$' && rest[end + 1] === '{') break;
    end += 1;
  }
  const text = rest.slice(0, end).replace(/\s+$/, '');
  stream.pos += Math.max(1, text.length);
}

const parser: StreamParser<State> = {
  name: 'd2',
  startState: () => ({ depth: 0, square: 0, value: false, block: null }),
  copyState: (state) => ({ ...state }),

  token(stream, state): D2Kind | null {
    if (stream.sol()) state.value = state.square > 0;
    if (state.block !== null) {
      // A block string runs whole lines until its delimiter closes it.
      const close = state.block;
      const at = stream.string.indexOf(close, stream.pos);
      if (at === stream.pos) {
        stream.pos += close.length;
        state.block = null;
        state.value = false;
        return 'string';
      }
      if (at < 0) stream.skipToEnd();
      else stream.pos = at;
      return 'string';
    }
    if (stream.eatSpace()) return null;
    const char = stream.peek()!;

    if (char === '#') {
      stream.skipToEnd();
      return 'comment';
    }
    if (char === '"' || char === "'") {
      // A quote inside a name (Bob's) is part of the name; one that opens it, or a value, is a string.
      const before = stream.pos > 0 ? stream.string[stream.pos - 1] : '';
      if (!state.value && /[\p{L}\p{N}_]/u.test(before)) {
        stream.match(/^['"][\p{L}\p{N}_-]*/u);
        return 'name';
      }
      stream.next();
      quoted(stream, char);
      return 'string';
    }
    if (char === '|' && state.value) {
      const open = stream.match(BLOCK_OPEN) as RegExpMatchArray;
      state.block = open[2] + open[1];
      return 'string';
    }
    if (stream.match(VARIABLE)) return 'type';
    if (stream.match(CONNECTION)) {
      state.value = false;
      return 'operator';
    }
    if (stream.match('!&') || stream.match('&') || stream.match('**') || stream.match('*')) return 'operator';
    if ('{}[]();.:,'.includes(char)) {
      stream.next();
      if (char === '{') {
        state.depth += 1;
        state.value = false;
      } else if (char === '}') {
        state.depth = Math.max(0, state.depth - 1);
        state.value = state.square > 0;
      } else if (char === '[') {
        state.square += 1;
        state.value = true;
      } else if (char === ']') {
        state.square = Math.max(0, state.square - 1);
        state.value = state.square > 0;
      } else if (char === ';') {
        state.value = state.square > 0;
      } else if (char === ':') {
        state.value = true;
      }
      return 'punctuation';
    }
    if (state.value) {
      if (stream.match(NUMBER) || stream.match(ATOM)) return 'number';
      unquoted(stream);
      return 'string';
    }
    const word = stream.match(WORD) as RegExpMatchArray | null;
    if (word) return D2_KEYWORDS.has(word[0].toLowerCase()) ? 'keyword' : 'name';
    stream.next();
    return null;
  },

  indent(state, textAfter, context) {
    // Inside a block string the code is someone else's: its indent is left alone.
    if (state.block !== null) return null;
    const closing = /^\s*[}\]]/.test(textAfter) ? 1 : 0;
    return Math.max(0, state.depth + state.square - closing) * context.unit;
  },

  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    indentOnInput: /^\s*[}\]]$/,
  },

  tokenTable: {
    comment: tags.comment,
    keyword: tags.keyword,
    name: tags.variableName,
    string: tags.string,
    number: tags.number,
    operator: tags.operator,
    type: tags.typeName,
    punctuation: tags.punctuation,
  },
};

/** D2, as CodeMirror reads it. */
export const d2Language = StreamLanguage.define(parser);

/**
 * D2 with its editing help: indentation by brace, closing brackets and
 * quotes, a typed `}` lined up, the matching bracket marked, and `#` as its
 * comment, which the default keymap's ⌘/ toggles.
 */
export function d2Support(): LanguageSupport {
  return new LanguageSupport(d2Language, [
    closeBrackets(),
    bracketMatching(),
    indentOnInput(),
    // Its own keys are only these; Mod-/ is the editor's default keymap's, as for any language with comments.
    keymap.of(closeBracketsKeymap),
  ]);
}

/** A source's tokens, line by line, as [text, kind]; for tests and anything that reads D2 without an editor. */
export function tokenise(source: string): [string, D2Kind | 'plain'][] {
  const state = parser.startState!(2);
  const out: [string, D2Kind | 'plain'][] = [];
  for (const line of source.split('\n')) {
    const stream = new StringStream(line, 4, 2);
    if (line === '' && state.block === null) state.value = state.square > 0;
    while (!stream.eol()) {
      const start = stream.pos;
      const kind = parser.token(stream, state) as D2Kind | null;
      out.push([line.slice(start, stream.pos), kind ?? 'plain']);
    }
  }
  return out;
}
