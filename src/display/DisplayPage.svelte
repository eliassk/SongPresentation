<script lang="ts">
  import Stage from './Stage.svelte';
  import { connect } from '../shared/ws';
  import type { AppState } from '../shared/types';

  // URL: /display/<profileId>
  const profileId = decodeURIComponent(location.pathname.split('/')[2] ?? '');

  let st = $state<AppState | null>(null);
  let online = $state(false);
  connect(
    (s) => (st = s),
    (ok) => (online = ok),
  );

  let profile = $derived(st?.profiles.find((p) => p.id === profileId) ?? st?.profiles[0] ?? null);
</script>

{#if profile && st}
  <Stage {profile} song={st.liveSong} slideIndex={st.live.slideIndex} blank={st.live.blank} />
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
