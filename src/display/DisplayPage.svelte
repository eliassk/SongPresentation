<script lang="ts">
  import Stage from './Stage.svelte';
  import { connect } from '../shared/ws';
  import type { AppState } from '../shared/types';

  // URL: /display/<profileId>
  const profileId = decodeURIComponent(location.pathname.split('/')[2] ?? '');

  let st = $state<AppState | null>(null);
  let online = $state(false);
  const link = connect(
    (s) => (st = s),
    (ok) => (online = ok),
  );

  let lastFit = 0;
  function onfit(size: number) {
    if (!profile || size === lastFit) return;
    lastFit = size;
    link.send('fitted', { id: profile.id, size });
  }

  // "?bg=transparent" drops the background for this URL only, e.g. as an OBS overlay.
  const transparent = new URLSearchParams(location.search).get('bg') === 'transparent';
  let found = $derived(st?.profiles.find((p) => p.id === profileId) ?? st?.profiles[0] ?? null);
  let profile = $derived(found && transparent ? { ...found, background: { ...found.background, type: 'transparent' as const } } : found);
</script>

{#if profile && st}
  <Stage
    {profile}
    song={st.liveSong}
    slideIndex={st.live.slideIndex}
    blank={st.live.blank}
    disabled={st.liveSong ? (st.disabled[st.liveSong.id] ?? []) : []}
    notes={st.liveSong ? st.notes?.[st.liveSong.id] : undefined}
    {onfit}
    {transparent}
  />
{:else if !online}
  <div class="wait">SongPresentation: connecting…</div>
{/if}

<style>
  .wait {
    font: 14px system-ui, sans-serif;
    color: #888;
    padding: 12px;
  }
</style>
