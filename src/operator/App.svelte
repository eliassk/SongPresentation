<script lang="ts">
  import { app, loadSongs } from './store.svelte';
  import Live from './Live.svelte';
  import Songs from './Songs.svelte';
  import Displays from './Displays.svelte';

  let tab = $state<'live' | 'songs' | 'displays'>('live');
  loadSongs();

  const tabs = [
    { id: 'live', label: 'Live' },
    { id: 'songs', label: 'Songs' },
    { id: 'displays', label: 'Displays' },
  ] as const;

  let onAir = $derived(!!app.state?.liveSong && !app.state.live.blank);
</script>

<div class="shell">
  <header>
    <div class="brand">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="2" y="5" width="9" height="14" rx="2" fill="var(--accent)" />
        <rect x="13" y="5" width="9" height="14" rx="2" fill="var(--text)" />
      </svg>
      <span>SongPresentation</span>
    </div>

    <nav aria-label="Sections">
      {#each tabs as t (t.id)}
        <button class:sel={tab === t.id} aria-current={tab === t.id ? 'page' : undefined} onclick={() => (tab = t.id)}>
          {t.label}
        </button>
      {/each}
    </nav>

    <div class="status">
      <span class="pill" class:onair={onAir}>
        <span class="dot"></span>{onAir ? 'On air' : app.state?.live.blank ? 'Blanked' : 'Standby'}
      </span>
      <span class="pill" class:offline={!app.online}>
        <span class="dot"></span>{app.online ? 'Server online' : 'Reconnecting…'}
      </span>
    </div>
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
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 24px;
    padding: 10px 20px;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 650; font-size: 15px; letter-spacing: -0.01em; }
  nav {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--panel-3);
    border-radius: 9px;
  }
  nav button {
    background: transparent;
    border-color: transparent;
    padding: 6px 18px;
    color: var(--text-2);
    border-radius: 7px;
  }
  nav button:hover { background: transparent; color: var(--text); }
  nav button.sel { background: var(--panel); color: var(--text); box-shadow: var(--shadow); border-color: transparent; }
  .status { justify-self: end; display: flex; gap: 8px; }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-2);
    background: var(--panel-2);
    border-radius: 999px;
    padding: 4px 11px;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
  .pill.offline .dot { background: var(--live); }
  .pill:not(.onair):first-child .dot { background: var(--line-strong); }
  .pill.onair { background: var(--live-soft); color: var(--live); font-weight: 600; }
  .pill.onair .dot { background: var(--live); box-shadow: 0 0 0 0 rgba(214, 52, 60, 0.5); animation: pulse 1.8s var(--ease) infinite; }
  @keyframes pulse {
    to { box-shadow: 0 0 0 6px rgba(214, 52, 60, 0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pill.onair .dot { animation: none; }
  }
  main { flex: 1; min-height: 0; }
  .pad { padding: 16px; }
</style>
