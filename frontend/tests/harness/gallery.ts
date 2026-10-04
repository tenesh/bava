/**
 * The component gallery: the components in `src/components/`, in the states
 * they can show, with the app's tokens, styles and fonts. `?sheet=` names a
 * family's sheet (`gallery/sheets.ts`); or `?c=` names one component and `&v=`
 * one of its set-ups. `&theme=` is light or dark. Props are plain data:
 * nothing here reaches the Go side.
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
  props: { name: params.get('c') ?? '', variant: params.get('v') ?? '', sheet: params.get('sheet') ?? '' },
});
