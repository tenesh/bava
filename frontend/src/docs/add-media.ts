/**
 * Adding files to a page, however they come: pasted, dropped or picked. Each
 * is copied into the Space's attachments, then all go into the page together
 * (an image or a video shown, any other file as a card). A page opened on its
 * own first offers to open its folder as a Space; declined, nothing is added.
 */

/** A file on disk, or bytes with no name (a pasted image, in base64). */
export type MediaFile = { path: string } | { data: string };

export type AddMediaDeps = {
  /** Whether the open page is in a Space. */
  inSpace: () => boolean;
  /** Asks to open the page's folder as a Space, and opens it when accepted. */
  offerSpace: () => Promise<boolean>;
  /** Copies one file into the attachments: the name it was saved under, or why not. */
  attach: (file: MediaFile) => Promise<{ name: string } | { error: string }>;
  /** Puts the attachments into the page, in order, as one edit. */
  insert: (names: string[]) => void;
  notify: (message: string) => void;
};

/** Adds `files` to the page. */
export async function addMedia(files: MediaFile[], deps: AddMediaDeps): Promise<void> {
  if (files.length === 0) return;
  if (!deps.inSpace() && !(await deps.offerSpace())) return;
  const names: string[] = [];
  for (const file of files) {
    const result = await deps.attach(file);
    if ('error' in result) deps.notify(result.error);
    else names.push(result.name);
  }
  if (names.length > 0) deps.insert(names);
}
