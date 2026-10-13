/**
 * Reading the custom icon library for the canvas: the icons handed to the
 * sets, and each SVG made into a picture once, outside the stage, as
 * pictures are loaded. The library is a folder anyone can drop files into,
 * so it is read again whenever it may have changed.
 */
import { customSvgs, iconPictureAddress, loadedSet, setCustomIcons, type CustomIcon, type IconEntry } from './sets';

type Options = {
  /** The library as Go lists it. */
  list: () => Promise<{ icons: CustomIcon[] | null }>;
  /** Makes a picture from an address (`pictures.ts`, `loadPicture`). */
  load: (address: string) => Promise<CanvasImageSource>;
  /** A picture made from an SVG, or null when it cannot be drawn. */
  pictured: (svg: string, picture: CanvasImageSource | null) => void;
  /** The library has been read: the canvas draws its icons again. */
  arrived: () => void;
};

export function createIconLibrary({ list, load, pictured, arrived }: Options) {
  const wanted = new Set<string>();
  /** Each read is numbered; one that answers after a newer one has started is dropped. */
  let latest = 0;

  return {
    /**
     * Read the library, and make the pictures of icons new to it; unreadable,
     * it counts as empty, so its icons show as missing.
     */
    async read(): Promise<IconEntry[]> {
      const mine = (latest += 1);
      let icons: CustomIcon[] = [];
      try {
        icons = (await list()).icons ?? [];
      } catch {
        // Unreadable: empty.
      }
      if (mine !== latest) return loadedSet('custom') ?? [];
      setCustomIcons(icons);
      const entries = loadedSet('custom') ?? [];
      const fresh = entries.flatMap(customSvgs).filter((svg) => !wanted.has(svg));
      for (const svg of fresh) wanted.add(svg);
      await Promise.all(
        fresh.map((svg) =>
          load(iconPictureAddress(svg)).then(
            (picture) => pictured(svg, picture),
            () => pictured(svg, null),
          ),
        ),
      );
      arrived();
      return entries;
    },
  };
}
