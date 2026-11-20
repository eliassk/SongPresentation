<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import type { Profile, Song, VerseNote } from '../shared/types';
  import { slideKeys, verseLabel } from '../shared/slides';

  let { profile, song, slideIndex = 0, blank = false, disabled = [], notes }: {
    profile: Profile;
    song: Song | null;
    slideIndex?: number;
    blank?: boolean;
    disabled?: number[];
    notes?: Record<string, VerseNote>;
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

  // Follows the profile's text settings. With auto-fit, singers MUST see the whole verse.
  let current = $state<HTMLElement>();
  let size = $state(64);

  async function fit() {
    await tick();
    const el = current;
    const t = profile.text;
    if (!el) return;
    if (!t.autoFit) {
      el.style.fontSize = t.size + 'px';
      size = t.size;
      return;
    }
    const fits = (s: number) => {
      el.style.fontSize = s + 'px';
      if (el.scrollHeight > el.clientHeight + 1) return false;
      // With noWrap every line MUST fit its own width.
      return !t.noWrap || [...el.querySelectorAll<HTMLElement>('.text')].every((x) => x.scrollWidth <= x.clientWidth + 1);
    };
    let lo = Math.min(t.minSize, t.maxSize);
    let hi = t.maxSize;
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
    JSON.stringify(profile.text);
    void profile.showVerseLabel;
    void key;
    void song;
    void nextKey;
    JSON.stringify(notes);
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

  <section
    class="current"
    class:nowrap={profile.text.noWrap}
    class:dim={blank}
    class:shadow={profile.text.shadow}
    bind:this={current}
    style:font-size="{size}px"
    style:line-height={profile.text.lineHeight}
  >
    {#if key}
      {#if profile.showVerseLabel}<div class="label">{verseLabel(key)}</div>{/if}
      {#if notes?.[key]?.text}<div class="note">{notes[key].text}</div>{/if}
      {#each lines(key) as line, n}<div class="line marked"><span class="text">{line}</span>{#if notes?.[key]?.marks?.[n]}<span class="mark">{notes[key].marks[n]}</span>{/if}</div>{/each}
    {/if}
  </section>

  <section class="next" style:line-height={profile.text.lineHeight}>
    {#if nextKey}
      <div class="nlabel">Next · {verseLabel(nextKey)}{#if notes?.[nextKey]?.text} · <span class="nnote">{notes[nextKey].text}</span>{/if}</div>
      {#each lines(nextKey) as line, n}<div class="line marked"><span class="text">{line}</span>{#if notes?.[nextKey]?.marks?.[n]}<span class="mark">{notes[nextKey].marks[n]}</span>{/if}</div>{/each}
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
  .current { font-weight: 600; overflow: hidden; min-height: 0; }
  .current.dim { opacity: 0.35; }
  .shadow { text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.9); }
  .label { font-size: 0.5em; color: #e9c46a; font-weight: 700; margin-bottom: 6px; }
  .next {
    font-size: 38px;
    color: #8b877f;
    border-top: 2px solid #2a2a2a;
    padding-top: 18px;
    max-height: 34vh;
    overflow: hidden;
  }
  /* Marks sit in a right-hand gutter so the lyrics keep their left edge. */
  .marked { display: flex; align-items: center; gap: 0.6em; }
  .marked .text { flex: 1; min-width: 0; }
  .nowrap .text { white-space: nowrap; overflow: hidden; }
  .note { text-align: right; font-size: 0.45em; font-style: italic; color: #e9c46a; font-weight: 600; margin-bottom: 6px; }
  .nnote { font-style: italic; color: #b89a52; }
  .mark { display: inline-block; font-size: 0.42em; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; background: #e9c46a; color: #000; border-radius: 0.25em; padding: 0.1em 0.4em; flex: none; text-shadow: none; }
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
