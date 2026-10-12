import { describe, expect, it, vi } from 'vitest';
import { createPictureLoader, pictureAddress } from './pictures';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('loading pictures for the canvas', () => {
  it("asks for an attachment where the page's pictures load from", () => {
    expect(pictureAddress('/Users/ana/Yum cha', 'har gow.png')).toBe(
      '/bava-file/?root=%2FUsers%2Fana%2FYum+cha&path=.bava%2Fattachments%2Fhar+gow.png',
    );
  });

  it('hands each picture over once loaded, and loads each file once', async () => {
    const picture = {} as HTMLImageElement;
    const load = vi.fn(async () => picture);
    const arrived = vi.fn();
    const loader = createPictureLoader({ load, arrived });
    loader.want('/space', ['a.png', 'a.png']);
    loader.want('/space', ['a.png']);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(pictureAddress('/space', 'a.png'));
    expect(arrived).toHaveBeenCalledWith('a.png', picture);
    expect(loader.get('/space', 'a.png')).toBe(picture);
  });

  it('reports a file that cannot be loaded as missing', async () => {
    const arrived = vi.fn();
    const loader = createPictureLoader({ load: async () => Promise.reject(new Error('404')), arrived });
    loader.want('/space', ['gone.png']);
    await settle();
    expect(arrived).toHaveBeenCalledWith('gone.png', null);
    expect(loader.get('/space', 'gone.png')).toBeNull();
  });

  it("drops a picture that arrives after the Space changed", async () => {
    let finish: (picture: HTMLImageElement) => void = () => {};
    const arrived = vi.fn();
    const loader = createPictureLoader({ load: () => new Promise((resolve) => (finish = resolve)), arrived });
    loader.want('/one', ['a.png']);
    loader.want('/two', []);
    finish({} as HTMLImageElement);
    await settle();
    expect(arrived).not.toHaveBeenCalled();
  });

  it('loads a file again when asked to forget it, as after it was replaced', async () => {
    const load = vi.fn(async () => ({}) as HTMLImageElement);
    const loader = createPictureLoader({ load, arrived: () => {} });
    loader.want('/space', ['a.png']);
    await settle();
    loader.forget('a.png');
    loader.want('/space', ['a.png']);
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('says how many are loading, so a caller can tell when they have settled', async () => {
    const counts: number[] = [];
    const loader = createPictureLoader({ load: async () => ({}) as HTMLImageElement, arrived: () => {}, loading: (n) => counts.push(n) });
    loader.want('/space', ['a.png', 'b.png']);
    await settle();
    expect(counts[0]).toBe(2);
    expect(counts[counts.length - 1]).toBe(0);
  });

  it('drops everything on a reset: a load under way, and what is known', async () => {
    let finish: (picture: HTMLImageElement) => void = () => {};
    const load = vi.fn(() => new Promise<HTMLImageElement>((resolve) => (finish = resolve)));
    const arrived = vi.fn();
    const loader = createPictureLoader({ load, arrived });
    loader.want('/one', ['a.png']);
    loader.reset();
    finish({} as HTMLImageElement);
    await settle();
    expect(arrived).not.toHaveBeenCalled();
    // The same Space again loads afresh.
    loader.want('/one', ['a.png']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('looks again for the files found missing, as after files were attached', async () => {
    let there = false;
    const load = vi.fn(async () => (there ? ({} as HTMLImageElement) : Promise.reject(new Error('404'))));
    const arrived = vi.fn();
    const loader = createPictureLoader({ load, arrived });
    loader.want('/space', ['a.png']);
    await settle();
    there = true;
    loader.retryMissing();
    loader.want('/space', ['a.png']);
    await settle();
    expect(arrived).toHaveBeenLastCalledWith('a.png', {});
  });
});

