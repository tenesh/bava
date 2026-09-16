import './styles/index.scss'
import { mount } from 'svelte'
import App from './App.svelte'
import { markPlatform } from './shell/platform'
import { currentPlatform } from './shell/shortcuts'

markPlatform(document, currentPlatform())

mount(App, { target: document.getElementById('app')! })
