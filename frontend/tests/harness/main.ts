/**
 * The app as the browser tests see it: the real interface, the Go side faked,
 * the platform fixed to macOS so shortcut labels read the same every run.
 */
import '../../src/styles/index.scss';
import { mount } from 'svelte';
import App from '../../src/App.svelte';
import { markPlatform } from '../../src/shell/platform';
import { fakes } from './bindings-app';

markPlatform(document, 'darwin');

type WailsEvents = { dispatchWailsEvent(event: { name: string; data: unknown }): void };

// What the walks drive: a native menu command, as Go would deliver it.
Object.assign(window, {
  __bava: {
    fakes,
    menu(id: string) {
      (window as unknown as { _wails: WailsEvents })._wails.dispatchWailsEvent({ name: 'menu:command', data: { id } });
    },
  },
});

mount(App, { target: document.getElementById('app')! });
