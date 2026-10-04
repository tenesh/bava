/**
 * The component gallery: each component in `src/components/` on its own, in
 * the states it can show, with the app's tokens, styles and fonts. `?c=` names
 * the component, `&v=` one of its set-ups, `&theme=` light or dark. Props are
 * plain data: nothing here reaches the Go side.
 */
import '../../src/styles/index.scss';
import { mount } from 'svelte';
import Gallery from './gallery/Gallery.svelte';
import { markPlatform } from '../../src/shell/platform';

// Every component's styles, as the app's one stylesheet holds them: some
// components style parts that others render (the menus share theirs).
import.meta.glob('../../src/components/*.svelte', { eager: true });

markPlatform(document, 'darwin');

const params = new URLSearchParams(location.search);
// As the app's theme does: the token layer keys off this attribute.
document.documentElement.setAttribute('data-theme', params.get('theme') === 'dark' ? 'dark' : 'light');

mount(Gallery, {
  target: document.getElementById('app')!,
  props: { name: params.get('c') ?? '', variant: params.get('v') ?? '' },
});
