/**
 * Whether a page shows something kept on disk beside it: a picture, a video,
 * an embed's picture or a file card at a relative address. A page opened on
 * its own inside a store's sandbox reaches its folder only once the user
 * allows it, so the app offers to when this is true.
 */
import { parseBody } from './markdown';

/** An address on disk relative to the page: no scheme, no leading slash. */
const relative = (address: string) => address !== '' && !/^[a-z][a-z0-9+.-]*:/i.test(address) && !address.startsWith('/');

export function usesItsFolder(markdown: string): boolean {
  let found = false;
  parseBody(markdown).descendants((node) => {
    if (found) return false;
    const name = node.type.name;
    if ((name === 'image' || name === 'video' || name === 'embed') && relative(String(node.attrs.src ?? ''))) found = true;
    if (name === 'card' && relative(String(node.attrs.href ?? ''))) found = true;
    return !found;
  });
  return found;
}
