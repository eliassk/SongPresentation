<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { tIn } from '../shared/i18n.svelte';
  import type { Profile, Song, VerseNote } from '../shared/types';
  import { slideKeys, verseLabel, metaFor, sungLanguages } from '../shared/slides';

  let { profile, song, slideIndex = 0, blank = false, disabled = [], notes, onfit, transparent = false }: {
    profile: Profile;
    song: Song | null;
    slideIndex?: number;
    blank?: boolean;
    disabled?: number[];
    notes?: Record<string, VerseNote>;
    onfit?: (size: number) => void;
    transparent?: boolean;
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
    const l = sungLanguages(song, k, [lang])[0];
    return song.lyrics[l]?.[k] ?? Object.values(song.lyrics).find((l) => l[k]?.length)?.[k] ?? [];
  };

  // Only the start of the next verse: the current verse keeps the space and its size.
  const NEXT_LINES = 2;
  let meta = $derived(song ? metaFor(song, key) : null);
  let nextMeta = $derived(song && nextKey ? metaFor(song, nextKey) : null);

  // Follows the profile's text settings. With auto-fit, singers MUST see the whole verse.
  let current = $state<HTMLElement>();
  let size = $state(64);

  // Measures with transitions off, then eases from the shown size to the fitted one.
  // Only settings changes animate; verse changes MUST switch size at once.
  async function fit(animate = false) {
    await tick();
    const el = current;
    const t = profile.text;
    if (!el) return;
    const shown = size;
    el.style.transition = 'none';
    let target = t.size;
    if (t.autoFit) {
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
      target = lo;
    }
    el.style.fontSize = (animate ? shown : target) + 'px';
    void el.offsetHeight;
    el.style.transition = '';
    el.style.fontSize = target + 'px';
    size = target;
  }

  let lastSettings = '';
  $effect(() => {
    const settings = JSON.stringify(profile.text) + profile.showVerseLabel;
    void key;
    void song;
    void nextKey;
    JSON.stringify(notes);
    const animate = !!lastSettings && settings !== lastSettings;
    lastSettings = settings;
    fit(animate);
    // A refit right away would cut the easing short, so wait only for fonts still loading.
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => fit());
  });

  $effect(() => {
    const el = current;
    if (!el) return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => onfit?.(size));

  let now = $state(new Date());
  const timer = setInterval(() => (now = new Date()), 1000);
  onDestroy(() => clearInterval(timer));
  let clock = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
</script>

{#if blank && profile.blankWithScreens}
  <div class="conf black" style:background={transparent ? 'transparent' : null}></div>
{:else}
{#snippet markedLine(line: string, mark: string | undefined, comment: string | undefined)}
  <!-- The dotted leader ties the right-aligned comment and mark to their line. -->
  <div class="line marked"><span class="text" class:has={!!(mark || comment)}>{line}</span>{#if mark || comment}<span class="leader"></span>{#if comment}<span class="cmt">{comment}</span>{/if}{#if mark}<span class="mark">{mark}</span>{/if}{/if}</div>
{/snippet}

<div class="conf" style:font-family={profile.text.font} style:background={transparent ? 'transparent' : null}>
  <header>
    {#if song && meta}
      <span class="num">{meta.collectionKey ?? ''} {meta.number ?? ''}</span>
      <span class="title">{meta.title?.[lang] ?? Object.values(meta.title ?? {})[0] ?? ''}</span>
      {#if song.parts}<span class="medley">{song.title[lang] ?? Object.values(song.title)[0]}</span>{/if}
      {#if key}<span class="pos">{verseLabel(key)} · {position}/{enabledCount}</span>{/if}
    {:else}
      <span class="title idle">{tIn(lang, 'Waiting for the next song')}</span>
    {/if}
    <span class="clock">{clock}</span>
  </header>

  {#if blank}
    <div class="blanked">{tIn(lang, 'Screens are blanked')}</div>
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
      {#each lines(key) as line, n}{@render markedLine(line, notes?.[key]?.marks?.[n], notes?.[key]?.comments?.[n])}{/each}
    {/if}
  </section>

  <section class="next" style:line-height={profile.text.lineHeight}>
    {#if nextKey}
      <div class="nlabel">{tIn(lang, 'Next')} · {#if nextMeta && nextMeta !== meta}<span class="nsong">{nextMeta.collectionKey ?? ''} {nextMeta.number ?? ''} {nextMeta.title?.[lang] ?? Object.values(nextMeta.title ?? {})[0] ?? ''}</span> · {/if}{verseLabel(nextKey)}{#if notes?.[nextKey]?.text} · <span class="nnote">{notes[nextKey].text}</span>{/if}</div>
      {#each lines(nextKey).slice(0, NEXT_LINES) as line, n}{@render markedLine(n === NEXT_LINES - 1 && lines(nextKey).length > NEXT_LINES ? line + ' …' : line, notes?.[nextKey]?.marks?.[n], notes?.[nextKey]?.comments?.[n])}{/each}
    {:else if song}
      <div class="nlabel">{tIn(lang, 'End of song')}</div>
    {/if}
  </section>
</div>
{/if}

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
  .num { color: #cfcfcf; font-weight: 700; font-variant-numeric: tabular-nums; }
  .title { flex: 1; color: #d8d4cc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .title.idle { color: #6f6a61; }
  .pos, .clock { font-variant-numeric: tabular-nums; }
  .clock { color: #fff; font-weight: 600; }
  .current { font-weight: 600; overflow: hidden; min-height: 0; transition: font-size 450ms ease, opacity 450ms ease; }
  .current.dim { opacity: 0.35; }
  .shadow { text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.9); }
  .label { font-size: 0.5em; color: #cfcfcf; font-weight: 700; margin-bottom: 6px; }
  /* Bold and bright, but well below the current verse so it keeps most of the space. */
  .next {
    font-size: 44px;
    font-weight: 600;
    color: #d2cec6;
    border-top: 2px solid #2a2a2a;
    padding-top: 18px;
    max-height: 34vh;
    overflow: hidden;
  }
  /* Marks sit in a right-hand gutter so the lyrics keep their left edge. */
  .marked { display: flex; align-items: center; gap: 0.6em; }
  .marked .text { flex: 1; min-width: 0; }
  .marked .text.has { flex: 0 1 auto; }
  .cmt { flex: none; max-width: 40%; font-size: 0.45em; font-style: italic; font-weight: 600; color: #cfcfcf; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .leader { flex: 1; min-width: 1em; align-self: center; border-bottom: 0.07em dotted #6a6a6a; margin-top: 0.15em; }
  .nowrap .text { white-space: nowrap; overflow: hidden; }
  .note { text-align: right; font-size: 0.45em; font-style: italic; color: #cfcfcf; font-weight: 600; margin-bottom: 6px; }
  .nnote { font-style: italic; color: #9a9a9a; }
  .mark { display: inline-block; font-size: 0.5em; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; background: #cfcfcf; color: #000; border-radius: 0.25em; padding: 0.1em 0.4em; flex: none; text-shadow: none; }
  .medley { flex: none; max-width: 30%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.7em; color: #8b877f; border: 1px solid #3a3a3a; border-radius: 999px; padding: 2px 12px; }
  .nsong { color: #cfcfcf; }
  .nlabel { font-size: 0.7em; color: #a39e94; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.02em; }
  .black { background: #000; }
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
