/**
 * Pictures for the canvas's picture elements, loaded outside the stage and
 * handed to it (`CanvasStage.setPicture`), as highlighted code is: loading is
 * asynchronous and the stage draws synchronously.
 *
 * A picture is an attachment of the open Space, loaded through the route the
 * page's pictures use, once per file.
 */
const ATTACHMENTS = '.bava/attachments/';

/** Where the app serves an attachment of the Space at `root`. */
export function pictureAddress(root: string, file: string): string {
  return `/bava-file/?${new URLSearchParams({ root, path: ATTACHMENTS + file })}`;
}

/** Load a picture from an address: resolves once it can be drawn. */
export function loadPicture(address: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`cannot load ${address}`));
    image.src = address;
  });
}

const asPng = new WeakMap<HTMLImageElement, string | null>();

/**
 * A loaded picture as a PNG data address, for showing inside an SVG on
 * screen (an export's preview) without fetching anything; null when it
 * cannot be drawn out.
 */
export function pngData(picture: HTMLImageElement): string | null {
  if (asPng.has(picture)) return asPng.get(picture)!;
  let data: string | null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = picture.naturalWidth;
    canvas.height = picture.naturalHeight;
    canvas.getContext('2d')?.drawImage(picture, 0, 0);
    data = canvas.width > 0 && canvas.height > 0 ? canvas.toDataURL('image/png') : null;
  } catch {
    data = null;
  }
  asPng.set(picture, data);
  return data;
}

export function createPictureLoader(options: {
  load?: (address: string) => Promise<HTMLImageElement>;
  /** A file's picture, or null when it cannot be loaded. */
  arrived: (file: string, picture: HTMLImageElement | null) => void;
  /** Told whenever loads start or settle, with how many are under way. */
  loading?: (count: number) => void;
}) {
  const load = options.load ?? loadPicture;
  let root = '';
  /** By file, for `root`: the picture, null when missing, or the load under way. */
  const known = new Map<string, HTMLImageElement | null | Promise<void>>();
  const report = () => options.loading?.([...known.values()].filter((v) => v instanceof Promise).length);

  return {
    /** Load the files not yet loaded or loading, in the Space at `at`. */
    want(at: string, files: string[]): void {
      if (at !== root) {
        root = at;
        known.clear();
      }
      for (const file of new Set(files)) {
        if (known.has(file)) continue;
        const asked = root;
        const loading = load(pictureAddress(asked, file)).then(
          (picture) => settle(asked, file, picture),
          () => settle(asked, file, null),
        );
        known.set(file, loading);
      }
      report();
    },

    /** A file's picture: null when it cannot be loaded, undefined while unknown. */
    get(at: string, file: string): HTMLImageElement | null | undefined {
      if (at !== root) return undefined;
      const value = known.get(file);
      return value instanceof Promise ? undefined : value;
    },

    /** Load a file again next time it is wanted: it was replaced, or arrived. */
    forget(file: string): void {
      known.delete(file);
    },

    /** Look again for every file found missing, next time it is wanted: files were attached. */
    retryMissing(): void {
      for (const [file, value] of known) if (value === null) known.delete(file);
    },

    /** Forget everything, loads under way too: the Space changed, or there is none. */
    reset(): void {
      root = '';
      known.clear();
      report();
    },
  };

  function settle(asked: string, file: string, picture: HTMLImageElement | null): void {
    // The Space changed while it loaded: it is not this Space's picture.
    if (asked !== root) return;
    known.set(file, picture);
    options.arrived(file, picture);
    report();
  }
}

export type PictureLoader = ReturnType<typeof createPictureLoader>;
