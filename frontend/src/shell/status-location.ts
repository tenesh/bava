/**
 * Where the open page is, for the status bar: the Space's name and the page's
 * path inside it, as two items. A file outside any Space shows its full path.
 */
export type LocationInput = {
  spaceRoot: string | null;
  spaceName: string;
  /** The open page's path relative to the Space, if one is open. */
  pagePath: string | null;
  /** The open file's absolute path, if one is open. */
  filePath: string | null;
};

export function statusLocation({ spaceRoot, spaceName, pagePath, filePath }: LocationInput): { space?: string; path?: string } {
  if (spaceRoot) return { space: spaceName, path: pagePath ?? undefined };
  return { space: undefined, path: filePath ?? undefined };
}
