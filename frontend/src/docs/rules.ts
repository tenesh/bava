/**
 * The typing shortcuts: `#` to `######`, `-` or `*`, `1.`,
 * `a.`, `i.`, `[]`, `>` and a space, and `---`, each at the start of a line.
 */
import { InputRule, inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import { schema } from './schema';
import { calloutRule } from './callout';
import { inlineMathRule } from './math';

const { nodes } = schema;

function todoRule(): InputRule {
  return new InputRule(/^\[\s?\]\s$/, (state, _match, start, end) => {
    const $start = state.doc.resolve(start);
    if ($start.parent.type !== nodes.paragraph || $start.depth > 1) return null;
    const tr = state.tr.delete(start, end);
    const range = tr.selection.$from.blockRange();
    if (!range) return null;
    tr.wrap(range, [{ type: nodes.bullet_list }, { type: nodes.list_item, attrs: { checked: false } }]);
    return tr;
  });
}

function dividerRule(): InputRule {
  return new InputRule(/^---$/, (state, _match, start, end) => {
    const $start = state.doc.resolve(start);
    if ($start.parent.type !== nodes.paragraph) return null;
    const para = $start.before();
    return state.tr
      .delete(start, end)
      .replaceWith(para, para + 2, [nodes.horizontal_rule.create(), nodes.paragraph.create()])
      .scrollIntoView();
  });
}

export function shortcuts() {
  return inputRules({
    rules: [
      textblockTypeInputRule(/^(#{1,6})\s$/, nodes.heading, (m) => ({ level: m[1].length })),
      wrappingInputRule(/^\s*([-*])\s$/, nodes.bullet_list),
      wrappingInputRule(
        /^(\d+)\.\s$/,
        nodes.ordered_list,
        (m) => ({ order: Number(m[1]) }),
        (m, node) => node.childCount + node.attrs.order === Number(m[1]),
      ),
      wrappingInputRule(/^a\.\s$/, nodes.ordered_list, { style: 'a' }),
      wrappingInputRule(/^i\.\s$/, nodes.ordered_list, { style: 'i' }),
      todoRule(),
      wrappingInputRule(/^\s*>\s$/, nodes.blockquote),
      dividerRule(),
      textblockTypeInputRule(/^```([\w+#.-]*)\s$/, nodes.code_block, (m) => ({ language: m[1] })),
      calloutRule(),
      inlineMathRule(),
    ],
  });
}
