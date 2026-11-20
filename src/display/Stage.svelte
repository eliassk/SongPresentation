<script lang="ts">
  import Display from './Display.svelte';
  import Confidence from './Confidence.svelte';
  import type { Profile, Song, VerseNote } from '../shared/types';

  let { profile, song, slideIndex = 0, blank = false, checker = false, disabled = [], notes, onfit }: {
    profile: Profile;
    song: Song | null;
    slideIndex?: number;
    blank?: boolean;
    /** Show a checkerboard behind transparent backgrounds (preview only). */
    checker?: boolean;
    disabled?: number[];
    notes?: Record<string, VerseNote>;
    /** Displays report their fitted text size so the operator's A−/A+ step from it. */
    onfit?: (size: number) => void;
  } = $props();

  let w = $state(0);
  let h = $state(0);
  let scale = $derived(w && h ? Math.min(w / profile.width, h / profile.height) : 0);
</script>

<div class="stage" bind:clientWidth={w} bind:clientHeight={h}>
  <div
    class="canvas"
    class:checker={checker && profile.background.type === 'transparent'}
    style:width="{profile.width}px"
    style:height="{profile.height}px"
    style:transform="translate(-50%, -50%) scale({scale})"
  >
    {#if profile.mode === 'confidence'}
      <Confidence {profile} {song} {slideIndex} {blank} {disabled} notes={profile.showNotes ? notes : undefined} {onfit} />
    {:else}
      <Display {profile} {song} {slideIndex} {blank} notes={profile.showNotes ? notes : undefined} {onfit} />
    {/if}
  </div>
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .canvas {
    position: absolute;
    left: 50%;
    top: 50%;
    transform-origin: center;
  }
  .checker {
    background: repeating-conic-gradient(#2a2d33 0 25%, #1d1f24 0 50%) 0 0 / 40px 40px;
  }
</style>
