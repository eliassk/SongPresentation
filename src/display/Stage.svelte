<script lang="ts">
  import Display from './Display.svelte';
  import type { Profile, Song } from '../shared/types';

  let { profile, song, slideIndex = 0, blank = false, checker = false }: {
    profile: Profile;
    song: Song | null;
    slideIndex?: number;
    blank?: boolean;
    /** Show a checkerboard behind transparent backgrounds (preview only). */
    checker?: boolean;
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
    <Display {profile} {song} {slideIndex} {blank} />
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
