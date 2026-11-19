<script lang="ts">
  import { app, loadSongs } from './store.svelte';
  import Live from './Live.svelte';
  import Songs from './Songs.svelte';
  import Displays from './Displays.svelte';

  let tab = $state<'live' | 'songs' | 'displays'>('live');
  loadSongs();
</script>

<div class="shell">
  <header>
    <strong>SongPresentation</strong>
    <nav>
      <button class:sel={tab === 'live'} onclick={() => (tab = 'live')}>Live</button>
      <button class:sel={tab === 'songs'} onclick={() => (tab = 'songs')}>Songs</button>
      <button class:sel={tab === 'displays'} onclick={() => (tab = 'displays')}>Displays</button>
    </nav>
    <span class="status" class:online={app.online}>{app.online ? 'Server online' : 'Reconnecting…'}</span>
  </header>

  <main>
    {#if !app.state}
      <p class="muted pad">Connecting to the local server…</p>
    {:else if tab === 'live'}
      <Live />
    {:else if tab === 'songs'}
      <Songs />
    {:else}
      <Displays />
    {/if}
  </main>
</div>

<style>
  .shell { height: 100%; display: flex; flex-direction: column; }
  header {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--line);
    background: var(--panel);
  }
  nav { display: flex; gap: 4px; }
  nav button { background: transparent; border-color: transparent; }
  nav button.sel { background: var(--panel-2); border-color: var(--line); }
  .status { margin-left: auto; font-size: 12px; color: var(--live); }
  .status.online { color: var(--ok); }
  main { flex: 1; min-height: 0; }
  .pad { padding: 16px; }
</style>
