<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { Profile, Song } from '../shared/types';
  import { slideKeys, verseLabel } from '../shared/slides';

  let { profile, song, slideIndex = 0, blank = false, disabled = [] }: {
    profile: Profile;
    song: Song | null;
    slideIndex?: number;
    blank?: boolean;
    disabled?: number[];
  } = $props();

  let lang = $derived(profile.languages[0] ?? 'pl');
  let keys = $derived(slideKeys(song));
  let key = $derived(keys[slideIndex] ?? null);
  let nextIndex = $derived(keys.findIndex((_, i) => i > slideIndex && !disabled.includes(i)));
  let nextKey = $derived(nextIndex === -1 ? null : keys[nextIndex]);
  let enabledCount = $derived(keys.filter((_, i) => !disabled.includes(i)).length);
  let position = $derived(keys.filter((_, i) => i <= slideIndex && !disabled.includes(i)).length);

  // Falls back to any language that has the verse, so singers never see an empty screen.
  const lines = (k: string | null) => {
    if (!song || !k) return [];
    return song.lyrics[lang]?.[k] ?? Object.values(song.lyrics).find((l) => l[k]?.length)?.[k] ?? [];
  };

  // Long verses shrink to fit; singers MUST see the whole verse.
  const MAX = 64;
  const MIN = 28;
  let current = $state<HTMLElement>();
  let size = $state(MAX);

  async function fit() {
    await tick();
    const el = current;
    if (!el) return;
    const fits = (s: number) => {
      el.style.fontSize = s + 'px';
      return el.scrollHeight <= el.clientHeight + 1;
    };
    let lo = MIN;
    let hi = MAX;
    if (fits(hi)) lo = hi;
    else
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
    el.style.fontSize = lo + 'px';
    size = lo;
  }

  $effect(() => {
    void key;
    void song;
    void nextKey;
    fit();
    document.fonts?.ready.then(fit);
  });

  $effect(() => {
    const el = current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  });

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));
  let clock = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
</script>

<div class="conf" style:font-family={profile.text.font}>
  <header>
    {#if song}
      <span class="num">{song.collectionKey} {song.number ?? ''}</span>
      <span class="title">{song.title[lang] ?? Object.values(song.title)[0] ?? ''}</span>
      {#if key}<span class="pos">{verseLabel(key)} · {position}/{enabledCount}</span>{/if}
    {:else}
      <span class="title idle">Waiting for the next song</span>
    {/if}
    <span class="clock">{clock}</span>
  </header>

  {#if blank}
    <div class="blanked">Screens are blanked</div>
  {/if}

  <section class="current" class:dim={blank} bind:this={current} style:font-size="{size}px">
    {#if key}
      <div class="label">{verseLabel(key)}</div>
      {#each lines(key) as line}<div class="line">{line}</div>{/each}
    {/if}
  </section>

  <section class="next">
    {#if nextKey}
      <div class="nlabel">Next · {verseLabel(nextKey)}</div>
      {#each lines(nextKey) as line}<div class="line">{line}</div>{/each}
    {:else if song}
      <div class="nlabel">End of song</div>
    {/if}
  </section>
</div>

<style>
  .conf {
    position: absolute;
    inset: 0;
    background: #000;
    color: #fff;
    display: grid;
    grid-template-rows: auto 1fr auto;
    padding: 36px 56px 40px;
    gap: 24px;
  }
  header {
    display: flex;
    align-items: baseline;
    gap: 24px;
    font-size: 34px;
    color: #9a968e;
    border-bottom: 2px solid #2a2a2a;
    padding-bottom: 18px;
  }
  .num { color: #e9c46a; font-weight: 700; font-variant-numeric: tabular-nums; }
  .title { flex: 1; color: #d8d4cc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title.idle { color: #6f6a61; }
  .pos, .clock { font-variant-numeric: tabular-nums; }
  .clock { color: #fff; font-weight: 600; }
  .current { line-height: 1.32; font-weight: 600; overflow: hidden; min-height: 0; }
  .current.dim { opacity: 0.35; }
  .label { font-size: 0.5em; color: #e9c46a; font-weight: 700; margin-bottom: 6px; }
  .next {
    font-size: 38px;
    line-height: 1.3;
    color: #8b877f;
    border-top: 2px solid #2a2a2a;
    padding-top: 18px;
    max-height: 34vh;
    overflow: hidden;
  }
  .nlabel { font-size: 0.7em; color: #6f6a61; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.02em; }
  .blanked {
    position: absolute;
    top: 120px;
    right: 56px;
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    background: #d6343c;
    border-radius: 8px;
    padding: 6px 16px;
  }
</style>
