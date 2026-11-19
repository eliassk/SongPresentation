import { mount } from 'svelte';
import '@fontsource-variable/inter';
import Remote from './Remote.svelte';

mount(Remote, { target: document.getElementById('app')! });
