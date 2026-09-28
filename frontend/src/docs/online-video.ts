/**
 * Videos on YouTube, Vimeo and Loom, by the address of their page: which
 * site, which video, and the address of the site's player, loaded only when
 * play is pressed. YouTube's player is its no-cookie one.
 */

export type OnlineVideo = { provider: 'YouTube' | 'Vimeo' | 'Loom'; id: string; player: string };

/** An id is letters, digits, `-` and `_`: nothing that could reach past it in the player's address. */
const ID = /^[A-Za-z0-9_-]+$/;

/** The online video an address is the page of; null for any other address. */
export function onlineVideo(address: string): OnlineVideo | null {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  let found: Pick<OnlineVideo, 'provider' | 'id'> | null = null;
  if (host === 'youtube.com' && parts[0] === 'watch') found = { provider: 'YouTube', id: url.searchParams.get('v') ?? '' };
  else if (host === 'youtube.com' && parts[0] === 'shorts' && parts.length === 2) found = { provider: 'YouTube', id: parts[1] };
  else if (host === 'youtu.be' && parts.length === 1) found = { provider: 'YouTube', id: parts[0] };
  else if (host === 'vimeo.com' && parts.length === 1 && /^\d+$/.test(parts[0])) found = { provider: 'Vimeo', id: parts[0] };
  else if (host === 'loom.com' && parts[0] === 'share' && parts.length === 2) found = { provider: 'Loom', id: parts[1] };
  if (!found || !ID.test(found.id)) return null;
  const player = {
    YouTube: `https://www.youtube-nocookie.com/embed/${found.id}?autoplay=1`,
    // Vimeo's player keeps no record of the viewer with `dnt=1`.
    Vimeo: `https://player.vimeo.com/video/${found.id}?autoplay=1&dnt=1`,
    Loom: `https://www.loom.com/embed/${found.id}?autoplay=1`,
  }[found.provider];
  return { ...found, player };
}
