import { describe, expect, it } from 'vitest';
import { createTools, TOOLS, toolForKey } from './tools.svelte';

describe('tools', () => {
  // A duplicate shortcut is silent and maddening: one tool simply never
  // activates and nothing reports why.
  it('gives every tool a unique shortcut', () => {
    const keys = TOOLS.map((tool) => tool.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every tool a message key rather than a literal label', () => {
    for (const tool of TOOLS) {
      expect(tool.labelKey.startsWith('tool.'), `${tool.id} has no message key`).toBe(true);
    }
  });

  it('starts on select', () => {
    expect(createTools().active).toBe('select');
  });

  it('activates a tool by its shortcut', () => {
    const tools = createTools();
    tools.activate(toolForKey('r')!);
    expect(tools.active).toBe('rect');
  });

  it('matches shortcuts case-insensitively', () => {
    expect(toolForKey('R')).toBe('rect');
    expect(toolForKey('r')).toBe('rect');
  });

  it('ignores a key that is not a shortcut', () => {
    expect(toolForKey('9')).toBeUndefined();
  });

  // Escape is the universal way out of a tool; without it a user who picks the
  // pen by accident has no obvious escape.
  it('returns to select on escape', () => {
    const tools = createTools();
    tools.activate('pen');
    tools.escape();
    expect(tools.active).toBe('select');
  });

  it('covers the tools the design shows', () => {
    expect(TOOLS.map((t) => t.id).sort()).toEqual(
      ['arrow', 'ellipse', 'frame', 'line', 'pen', 'rect', 'select', 'text'].sort(),
    );
  });
});
