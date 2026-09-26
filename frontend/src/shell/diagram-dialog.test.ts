import { describe, expect, it, vi } from 'vitest';
import { createDiagramDialog } from './diagram-dialog.svelte';

// The Diagram from Code dialog's layout state (plan 06.11): what the preview is
// rendered with is what Insert uses, and the engine used becomes the default.
function setup(defaultEngine: 'tala' | 'dagre' | 'elk' = 'tala') {
  const request = vi.fn();
  const saveDefault = vi.fn().mockResolvedValue(undefined);
  const dialog = createDiagramDialog({ request, defaultEngine: () => defaultEngine, saveDefault });
  return { dialog, request, saveDefault };
}

describe('the Diagram from Code dialog', () => {
  it('opens at the default engine, facing down, and renders the starter', () => {
    const { dialog, request } = setup('elk');
    dialog.open('a -> b');
    expect(dialog.engine).toBe('elk');
    expect(dialog.direction).toBe('down');
    expect(request).toHaveBeenLastCalledWith('a -> b', { engine: 'elk', direction: 'down' });
  });

  it('re-renders with a new engine', () => {
    const { dialog, request } = setup();
    dialog.open('a -> b');
    dialog.setEngine('dagre');
    expect(request).toHaveBeenLastCalledWith('a -> b', { engine: 'dagre', direction: 'down' });
  });

  it('sends no direction for TALA, which ignores it', () => {
    const { dialog, request } = setup();
    dialog.open('a -> b');
    dialog.setDirection('right');
    expect(request).toHaveBeenLastCalledWith('a -> b', { engine: 'tala', direction: '' });
  });

  it('re-renders what was typed with the chosen layout', () => {
    const { dialog, request } = setup('dagre');
    dialog.open('a -> b');
    dialog.setDirection('right');
    dialog.setSource('x -> y');
    expect(request).toHaveBeenLastCalledWith('x -> y', { engine: 'dagre', direction: 'right' });
  });

  it('saves the engine used as the default on insert, and says so', async () => {
    const { dialog, saveDefault } = setup();
    dialog.open('a -> b');
    dialog.setEngine('dagre');
    expect(await dialog.inserted()).toBe(true);
    expect(saveDefault).toHaveBeenCalledWith('dagre');
  });

  it('saves nothing when the default was used', async () => {
    const { dialog, saveDefault } = setup('elk');
    dialog.open('a -> b');
    expect(await dialog.inserted()).toBe(false);
    expect(saveDefault).not.toHaveBeenCalled();
  });
});
