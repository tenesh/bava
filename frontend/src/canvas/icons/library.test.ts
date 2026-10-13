import { describe, expect, it, vi } from 'vitest';
import { createIconLibrary } from './library';
import { iconEntry, iconPictureAddress } from './sets';

const acme = { name: 'acme', svg: '<svg viewBox="0 0 1 1"/>', darkSvg: '<svg viewBox="0 0 1 1"><g/></svg>' };

function library(list: () => Promise<{ icons: (typeof acme)[] | null }>, load = vi.fn(async (address: string) => ({ address }) as unknown as CanvasImageSource)) {
  const pictured = vi.fn();
  const arrived = vi.fn();
  return { reader: createIconLibrary({ list, load, pictured, arrived }), load, pictured, arrived };
}

describe('reading the custom icon library', () => {
  it('hands the icons to the canvas, and makes each copy a picture once, before it answers', async () => {
    const { reader, load, pictured, arrived } = library(async () => ({ icons: [acme] }));
    const entries = await reader.read();
    expect(entries.map((entry) => entry.name)).toEqual(['acme']);
    expect(iconEntry('custom/acme')).toMatchObject({ svg: acme.svg, darkSvg: acme.darkSvg });
    expect(arrived).toHaveBeenCalled();
    expect(pictured).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith(iconPictureAddress(acme.svg));
    await reader.read();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('draws a copy that cannot be made into a picture as nothing', async () => {
    const { reader, pictured } = library(async () => ({ icons: [{ ...acme, darkSvg: '' }] }), vi.fn(async () => Promise.reject(new Error('bad'))));
    await reader.read();
    await vi.waitFor(() => expect(pictured).toHaveBeenCalledWith(acme.svg, null));
  });

  it('counts a library it cannot read as empty, so its icons show as missing', async () => {
    const { reader } = library(async () => Promise.reject(new Error('unreadable')));
    expect(await reader.read()).toEqual([]);
    expect(iconEntry('custom/acme')).toBeNull();
  });

  // A read that answers late is not the library as it is now.
  it('keeps the newest read when an older one answers after it', async () => {
    let answerFirst: (value: { icons: (typeof acme)[] }) => void = () => {};
    const answers = [
      new Promise<{ icons: (typeof acme)[] }>((resolve) => (answerFirst = resolve)),
      Promise.resolve({ icons: [{ ...acme, name: 'newer' }] }),
    ];
    const { reader } = library(() => answers.shift()!);
    const first = reader.read();
    await reader.read();
    answerFirst({ icons: [{ ...acme, name: 'older' }] });
    expect((await first).map((entry) => entry.name)).toEqual(['newer']);
    expect(iconEntry('custom/newer')).not.toBeNull();
    expect(iconEntry('custom/older')).toBeNull();
  });
});

