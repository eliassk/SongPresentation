import { mount } from 'svelte';
import '@fontsource-variable/inter';
import DisplayPage from './DisplayPage.svelte';

mount(DisplayPage, { target: document.getElementById('app')! });
