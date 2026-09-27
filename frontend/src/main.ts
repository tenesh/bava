import './styles/index.scss'
import { mount } from 'svelte'
import App from './App.svelte'
import { markPlatform } from './shell/platform'
import { currentPlatform } from './shell/shortcuts'

markPlatform(document, currentPlatform())

mount(App, { target: document.getElementById('app')! })

// The smoke test driver, in a -tags e2e build only: the flag is set when that
// build's frontend is made, so a normal build leaves the driver out entirely.
if (import.meta.env.VITE_BAVA_E2E === '1') void import('./e2e/driver').then((driver) => driver.start());
