<script lang="ts">
  import { tick } from 'svelte';
  import type { Profile, Song } from '../shared/types';
  import { slideKeys, verseLabel, defaultLangStyle, credits } from '../shared/slides';

  let { profile, song, slideIndex = 0, blank = false }: {
    profile: Profile;
    song: Song | null;
    slideIndex?: number;
    blank?: boolean;
  } = $props();

  let keys = $derived(slideKeys(song));
  let key = $derived(keys.length ? keys[Math.min(slideIndex, keys.length - 1)] : null);

  let langs = $derived.by(() => {
    if (!song || !key) return [];
    if (profile.missingLanguage === 'empty') return profile.languages;
    return profile.languages.filter((l) => song.lyrics[l]?.[key!]?.length);
  });

  let gridTemplate = $derived.by(() => {
    const n = Math.max(langs.length, 1);
    const tracks = n === 2 ? `${profile.layout.ratio}fr ${1 - profile.layout.ratio}fr` : `repeat(${n}, 1fr)`;
    return profile.layout.mode === 'columns'
      ? `grid-template-columns:${tracks};grid-template-rows:1fr`
      : `grid-template-rows:${tracks};grid-template-columns:1fr`;
  });

  let title = $derived(
    song ? [...new Set(profile.languages.map((l) => song.title?.[l]).filter(Boolean))].join('  ·  ') : '',
  );
  let creditLines = $derived(song ? credits(song, profile.languages[0] ?? 'en') : ['', '']);

  let body = $state<HTMLDivElement>();
  let fontSize = $state(48);

  async function fit() {
    await tick();
    const t = profile.text;
    if (!t.autoFit || !body) {
      fontSize = t.size;
      return;
    }
    const cols = [...body.querySelectorAll<HTMLElement>('.inner')];
    const fits = (s: number) => {
      body!.style.setProperty('--fs', s + 'px');
      return cols.every((c) => {
        const box = c.parentElement!;
        return c.scrollHeight <= box.clientHeight + 1 && c.scrollWidth <= box.clientWidth + 1;
      });
    };
    let lo = t.minSize;
    let hi = t.maxSize;
    if (fits(hi)) lo = hi;
    else
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
    body.style.setProperty('--fs', lo + 'px');
    fontSize = lo;
  }

  $effect(() => {
    // Re-fit on any change of profile, slide or text.
    JSON.stringify(profile);
    void key;
    void langs;
    void song;
    fit();
    document.fonts?.ready.then(fit);
  });

  const style = (l: string) => profile.text.perLanguage[l] ?? defaultLangStyle();
  const h = $derived(profile.header);
</script>

<div
  class="root"
  style:background={profile.background.type === 'color' ? profile.background.color : 'transparent'}
  style:font-family={profile.text.font}
>
  {#if !blank && song && key}
    <div
      class="slide"
      class:shadow={profile.text.shadow}
      style:left="{profile.area?.x ?? 0}%"
      style:top="{profile.area?.y ?? 0}%"
      style:width="{profile.area?.w ?? 100}%"
      style:height="{profile.area?.h ?? 100}%"
    >
      {#if h.show}
        <header
          style:color={h.color}
          style:padding="{profile.layout.padding * 0.45}px {profile.layout.padding * 0.7}px {profile.layout.padding * 0.3}px"
          style:border-bottom={h.rule ? `2px solid ${h.ruleColor}` : 'none'}
        >
          <div class="id">
            {#if h.showCollection && song.collectionKey}
              <span class="ckey" style:font-size="{h.numberSize * 0.2}px">{song.collectionKey}</span>
            {/if}
            {#if h.showNumber && song.number != null}
              <span class="num" style:font-size="{h.numberSize}px">{song.number}</span>
            {/if}
            {#if h.showTitle}
              <span class="title" style:font-size="{h.creditsSize * 1.3}px">{title}</span>
            {/if}
          </div>
          {#if h.showCredits}
            <div class="credits" style:font-size="{h.creditsSize}px">
              {#if creditLines[0]}<div>{creditLines[0]}</div>{/if}
              {#if creditLines[1]}<div>{creditLines[1]}</div>{/if}
            </div>
          {/if}
        </header>
      {/if}

      {#key `${song.id}:${slideIndex}`}
        <div
          class="body"
          bind:this={body}
          style="{gridTemplate};gap:{profile.layout.gap}px;padding:{profile.layout.padding}px;--fs:{fontSize}px;animation-duration:{profile.transitionMs}ms"
        >
          {#each langs as l, i (l)}
            {@const s = style(l)}
            <div
              class="col"
              class:divided={profile.layout.divider && i > 0}
              class:stacked={profile.layout.mode === 'stacked'}
              style:--divider={profile.layout.dividerColor}
              style:--half-gap="{profile.layout.gap / 2}px"
              style:justify-content={profile.layout.align === 'top' ? 'flex-start' : profile.layout.align === 'bottom' ? 'flex-end' : 'center'}
            >
              <div
                class="inner"
                class:labelled={profile.showVerseLabel}
                style:text-align={profile.layout.textAlign}
                style:color={i > 0 && profile.text.secondaryColor ? profile.text.secondaryColor : s.color}
                style:font-style={s.italic ? 'italic' : 'normal'}
                style:font-weight={s.weight}
                style:font-size="calc(var(--fs) * {s.scale})"
                style:line-height={profile.text.lineHeight}
              >
                {#if profile.showVerseLabel}<div class="label">{verseLabel(key)}</div>{/if}
                <div class="lines">
                  {#each song.lyrics[l]?.[key] ?? [] as line}
                    <div class="line">{line}</div>
                  {/each}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/key}
    </div>
  {/if}
</div>

<style>
  .root {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .slide {
    position: absolute;
    display: flex;
    flex-direction: column;
  }
  .shadow {
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 2px rgba(0, 0, 0, 0.9);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1em;
    flex: none;
  }
  .id {
    display: flex;
    align-items: baseline;
    gap: 0.25em;
    min-width: 0;
  }
  .ckey {
    font-weight: 500;
    opacity: 0.7;
    letter-spacing: 0.04em;
    margin-right: 0.6em;
  }
  .num {
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .title {
    margin-left: 0.6em;
    font-weight: 600;
  }
  .credits {
    text-align: right;
    line-height: 1.35;
    font-weight: 400;
    opacity: 0.78;
    letter-spacing: 0.01em;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    animation-name: fadein;
    animation-timing-function: ease-out;
  }
  @keyframes fadein {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .col {
    position: relative;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .col.divided::before {
    content: '';
    position: absolute;
    left: calc(-1 * var(--half-gap));
    top: 2%;
    bottom: 2%;
    border-left: 2px solid var(--divider);
  }
  .col.divided.stacked::before {
    left: 0;
    right: 0;
    top: calc(-1 * var(--half-gap));
    bottom: auto;
    border-left: none;
    border-top: 2px solid var(--divider);
  }
  .inner {
    overflow-wrap: break-word;
  }
  .inner.labelled {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 0.7em;
  }
  .label {
    min-width: 1.6em;
    opacity: 0.55;
    font-variant-numeric: tabular-nums;
  }
</style>
