<script lang="ts">
  import { untrack } from 'svelte';
  import { app, link, getSong, songName, displayUrls } from './store.svelte';
  import Stage from '../display/Stage.svelte';
  import { slideKeys, verseLabel, verseCount } from '../shared/slides';
  import type { Song } from '../shared/types';

  let st = $derived(app.state!);
  let preview = $derived(st.profiles[0]);
  let langs = $derived(preview?.languages ?? []);
  let primary = $derived(langs[0] ?? 'pl');

  // Library
  let collections = $derived.by(() => {
    const m = new Map<string, string>();
    for (const s of app.songs) if (!m.has(s.collectionKey)) m.set(s.collectionKey, s.collection || s.collectionKey);
    return [...m].map(([key, name]) => ({ key, name }));
  });
  let collection = $state('');
  $effect(() => {
    if (!collection && collections.length) collection = collections[0].key;
  });
  let q = $state('');
  let numberBox = $state('');

  let filtered = $derived.by(() => {
    const s = q.trim().toLowerCase();
    const base = s ? app.songs : app.songs.filter((x) => x.collectionKey === collection);
    if (!s) return base;
    return base.filter((x) => x.search.includes(s));
  });

  // Selected song follows the live song whenever the live song changes.
  let selected = $state<Song | null>(null);
  let lastLiveId: string | null = null;
  $effect(() => {
    const live = st.liveSong;
    untrack(() => {
      if (live && (live.id !== lastLiveId || selected?.id === live.id)) {
        selected = live;
        if (live.collectionKey) collection = live.collectionKey;
      }
      lastLiveId = live?.id ?? null;
    });
  });

  // Per-operator preference, so it lives in localStorage.
  const readFollow = () => {
    try {
      return localStorage.getItem('followSelection') === '1';
    } catch {
      return false;
    }
  };
  let follow = $state(readFollow());
  $effect(() => {
    try {
      localStorage.setItem('followSelection', follow ? '1' : '0');
    } catch {}
  });

  async function select(id: string) {
    if (follow && id !== st.live.songId) link.send('setLive', { songId: id });
    selected = await getSong(id);
  }

  let selKeys = $derived(slideKeys(selected));
  let disabled = $derived(new Set(selected ? (st.disabled[selected.id] ?? []) : []));
  let selectedIsLive = $derived(!!selected && selected.id === st.live.songId);
  let liveKeys = $derived(slideKeys(st.liveSong));
  let liveDisabled = $derived(new Set(st.liveSong ? (st.disabled[st.liveSong.id] ?? []) : []));
  let nextIndex = $derived(liveKeys.findIndex((_, i) => i > st.live.slideIndex && !liveDisabled.has(i)));

  function goLive(index = 0) {
    if (selected) link.send('setLive', { songId: selected.id, slideIndex: index });
  }
  function toggle(i: number) {
    if (selected) link.send('toggleVerse', { songId: selected.id, index: i });
  }
  function toggleAll() {
    if (selected) link.send('setAllVerses', { songId: selected.id, enabled: disabled.size > 0 });
  }
  function jumpNumber(e: Event) {
    e.preventDefault();
    if (numberBox.trim()) link.send('goNumber', { collectionKey: collection, number: numberBox.trim() });
    numberBox = '';
  }

  function addToSetlist(id: string) {
    if (!st.setlist.includes(id)) link.send('setlist', { ids: [...st.setlist, id] });
  }
  function moveInSetlist(i: number, d: number) {
    const ids = [...st.setlist];
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    link.send('setlist', { ids });
  }
  const summary = (id: string) => app.songs.find((s) => s.id === id);

  // Single-language displays switch language. Multi-language displays toggle one in or out.
  function pickLanguage(p: { id: string; languages: string[] }, code: string) {
    let next: string[];
    if (p.languages.length <= 1) next = [code];
    else if (p.languages.includes(code)) next = p.languages.filter((l) => l !== code);
    else next = [...p.languages, code];
    if (next.length) link.send('profileLanguages', { id: p.id, languages: next });
  }

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select')) {
      if (e.key === 'Enter' && t.id === 'search' && filtered[0]) select(filtered[0].id);
      if (e.key === 'Escape') t.blur();
      return;
    }
    if (/^\d$/.test(e.key)) {
      document.getElementById('number')?.focus();
      return; // the digit lands in the number box
    }
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) link.send('step', { delta: 1 });
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) link.send('step', { delta: -1 });
    else if (e.key === 'b' || e.key === '.') link.send('blank', {});
    else if (e.key === 'Enter') goLive(0);
    else if (e.key === ']') link.send('songStep', { delta: 1 });
    else if (e.key === '[') link.send('songStep', { delta: -1 });
    else if (e.key === 'n') link.send('setlistStep', { delta: 1 });
    else if (e.key === 'p') link.send('setlistStep', { delta: -1 });
    else if (e.key === '/') document.getElementById('search')?.focus();
    else return;
    e.preventDefault();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="live">
  <!-- Library -->
  <section class="col left">
    <div class="card pad stack">
      <select bind:value={collection}>
        {#each collections as c (c.key)}<option value={c.key}>{c.name} ({c.key})</option>{/each}
      </select>
      <form class="row" onsubmit={jumpNumber}>
        <input id="number" class="grow" inputmode="numeric" placeholder="Song number → Enter" bind:value={numberBox} />
        <button type="submit">Go</button>
      </form>
      <input id="search" placeholder="Search all collections… ( / )" bind:value={q} />
      <label class="follow" title="Clicking a song puts it on the screens immediately">
        <input type="checkbox" bind:checked={follow} /> Screens follow selection
      </label>
    </div>

    <div class="card list">
      {#each filtered as s (s.id)}
        <div class="item" class:sel={selected?.id === s.id} class:islive={st.live.songId === s.id}>
          <button class="name" onclick={() => select(s.id)} ondblclick={() => link.send('setLive', { songId: s.id })}>
            <span class="n">{s.number ?? ''}</span>
            <span class="t">{s.title[primary] ?? Object.values(s.title)[0]}</span>
            {#if q}<span class="k">{s.collectionKey}</span>{/if}
          </button>
          <button class="add" title="Add to setlist" onclick={() => addToSetlist(s.id)}>+</button>
        </div>
      {:else}
        <p class="muted pad">No songs.</p>
      {/each}
    </div>

    <div class="card pad">
      <h2>Setlist <span class="muted">(n / p)</span></h2>
      {#each st.setlist as id, i (id)}
        {@const s = summary(id)}
        <div class="item" class:sel={selected?.id === id} class:islive={st.live.songId === id}>
          <button class="name" onclick={() => select(id)}>
            <span class="k">{s?.collectionKey}</span><span class="n">{s?.number ?? ''}</span>
            <span class="t">{s ? (s.title[primary] ?? Object.values(s.title)[0]) : id}</span>
          </button>
          <button class="add" onclick={() => moveInSetlist(i, -1)}>↑</button>
          <button class="add" onclick={() => moveInSetlist(i, 1)}>↓</button>
          <button class="add" onclick={() => link.send('setlist', { ids: st.setlist.filter((x) => x !== id) })}>×</button>
        </div>
      {:else}
        <p class="muted small">Use + to build the service.</p>
      {/each}
    </div>
  </section>

  <!-- Song page -->
  <section class="col mid">
    {#if selected}
      <div class="songnav">
        <button onclick={() => link.send('songStep', { delta: -1 })} title="Previous song in collection ( [ )">← Prev song</button>
        <span class="grow"></span>
        <button onclick={() => link.send('songStep', { delta: 1 })} title="Next song in collection ( ] )">Next song →</button>
      </div>

      <div class="card">
        <div class="cardhead collection">{selected.collection}</div>
        <div class="info">
          <div class="bignum">{selected.number ?? ''}</div>
          <div class="meta">
            <div class="title">{selected.title[primary] ?? Object.values(selected.title)[0]}</div>
            {#each langs.slice(1) as l}
              {#if selected.title[l]}<div class="subtitle">{selected.title[l]}</div>{/if}
            {/each}
            {#if selected.author}
              <div class="m">Written{selected.year ? ` in ${selected.year}` : ''} by <span class="chip">{selected.author}</span></div>
            {/if}
            <div class="m">{selected.composer || 'Unknown composer'}</div>
            {#if selected.copyright}<div class="m">Text ©: {selected.copyright}</div>{/if}
            <div class="m">{[selected.key, verseCount(selected)].filter(Boolean).join(' · ')}</div>
          </div>
          <div class="golive">
            <button class="primary" onclick={() => goLive(0)}>{selectedIsLive ? 'Restart' : 'Show'} (Enter)</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="cardhead row">
          <strong class="choose">Choose verses</strong>
          <button class="toggleall" onclick={toggleAll}>
            <span class="check" class:off={disabled.size > 0}>✓</span> Toggle all verses
          </button>
          <span class="grow"></span>
          <span class="muted small">Click a verse to skip it · ▶ to show it</span>
        </div>
        <div class="verses">
          {#each selKeys as k, i}
            {@const off = disabled.has(i)}
            {@const isLive = selectedIsLive && st.live.slideIndex === i}
            <div class="verse" class:off class:islive={isLive}>
              <button class="vbody" onclick={() => toggle(i)} title={off ? 'Enable verse' : 'Skip verse'}>
                <div class="vhead"><span class="check" class:off>✓</span> <strong>{verseLabel(k)}</strong></div>
                <div class="vcols" style:grid-template-columns="repeat({langs.length}, 1fr)">
                  {#each langs as l, li}
                    <div class:second={li > 0}>
                      {#each selected.lyrics[l]?.[k] ?? [] as line}<div>{line}</div>{:else}<div class="muted">—</div>{/each}
                    </div>
                  {/each}
                </div>
              </button>
              <button class="show" title="Show this verse" onclick={() => goLive(i)}>▶</button>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="card pad muted">Pick a song, or type its number and press Enter.</div>
    {/if}
  </section>

  <!-- Live output -->
  <section class="col right">
    <div class="card pad stack">
      <div class="row">
        <h2 class="grow nomargin">Live · {preview?.name}</h2>
        <button class:on={st.live.blank} onclick={() => link.send('blank', {})}>Blank (B)</button>
        <button onclick={() => link.send('clear')}>Clear</button>
      </div>
      <div class="preview" style:aspect-ratio="{preview.width} / {preview.height}">
        <Stage profile={preview} song={st.liveSong} slideIndex={st.live.slideIndex} blank={st.live.blank} checker />
      </div>
      <div class="row">
        <button onclick={() => link.send('step', { delta: -1 })}>← Prev</button>
        <span class="grow center muted">
          {st.liveSong ? `${songName(st.liveSong, primary)} · ${verseLabel(liveKeys[st.live.slideIndex] ?? '')}` : 'Nothing live'}
        </span>
        <button onclick={() => link.send('step', { delta: 1 })}>Next →</button>
      </div>
    </div>

    <div class="card pad">
      <h2>Next</h2>
      {#if nextIndex !== -1 && st.liveSong}
        <strong class="small">{verseLabel(liveKeys[nextIndex])}</strong>
        {#each st.liveSong.lyrics[primary]?.[liveKeys[nextIndex]] ?? [] as line}<div>{line}</div>{/each}
      {:else}
        <span class="muted">End of song</span>
      {/if}
    </div>

    <div class="card pad stack">
      <h2 class="nomargin">Displays</h2>
      {#each st.profiles as p (p.id)}
        <div class="display">
          <div class="row">
            <strong class="grow">{p.name}</strong>
            <span class="muted small">{p.width}×{p.height}</span>
            <button title="Smaller text" onclick={() => link.send('fontStep', { id: p.id, delta: -4 })}>A−</button>
            <button title="Larger text" onclick={() => link.send('fontStep', { id: p.id, delta: 4 })}>A+</button>
          </div>
          <div class="langpills">
            {#each st.languages as l (l.code)}
              {@const on = p.languages.includes(l.code)}
              <button class:on title={l.name} onclick={() => pickLanguage(p, l.code)}>
                {l.code.toUpperCase()}{#if on && p.languages.length > 1}<sup>{p.languages.indexOf(l.code) + 1}</sup>{/if}
              </button>
            {/each}
          </div>
          <a class="url" href={displayUrls(p.id)[0]} target="_blank">{displayUrls(p.id)[0]}</a>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .live {
    height: 100%;
    display: grid;
    grid-template-columns: 290px minmax(0, 1fr) 420px;
    gap: 16px;
    padding: 16px;
  }
  .col { overflow: auto; display: flex; flex-direction: column; gap: 12px; min-height: 0; }
  .pad { padding: 14px 16px; }
  .stack { display: flex; flex-direction: column; gap: 8px; }
  .small { font-size: 12px; }
  .nomargin { margin: 0; }
  .center { text-align: center; }

  .follow { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--muted); }
  .list { flex: 1; min-height: 180px; overflow: auto; padding: 6px; }
  .item { display: flex; gap: 2px; border-radius: 6px; }
  .item button { background: transparent; border-color: transparent; padding: 5px 8px; }
  .item .name { flex: 1; display: flex; gap: 8px; text-align: left; min-width: 0; }
  .item .n { color: var(--muted); min-width: 2.2em; text-align: right; font-variant-numeric: tabular-nums; }
  .item .k { color: var(--accent); font-size: 11px; font-weight: 600; }
  .item .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item.sel { background: var(--panel-2); }
  .item.islive .t { color: var(--live); font-weight: 600; }
  .item .add { color: var(--muted); }

  .songnav { display: flex; gap: 8px; }
  .songnav button { background: var(--panel); }
  .cardhead { padding: 14px 24px; border-bottom: 1px solid var(--line); }
  .collection { color: var(--accent); font-size: 17px; }
  .info { display: flex; gap: 20px; padding: 18px 24px 22px; }
  .bignum { font-size: 34px; font-weight: 700; color: #9aa0a8; line-height: 1.1; min-width: 1.5em; }
  .meta { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .title { font-size: 24px; font-weight: 700; line-height: 1.2; }
  .subtitle { font-size: 16px; color: var(--accent); }
  .m { color: var(--muted); font-size: 15px; }
  .chip { background: var(--panel-2); border-radius: 6px; padding: 3px 9px; }
  .golive { align-self: flex-start; }

  .choose { font-size: 17px; }
  .toggleall { display: flex; gap: 8px; align-items: center; border: none; }
  .check {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #46b85a;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    flex: none;
  }
  .check.off { background: #c9ccd1; }

  .verses { padding: 14px 16px 18px; display: flex; flex-direction: column; gap: 8px; }
  .verse { display: flex; border: 1px solid transparent; border-radius: 10px; }
  .verse.islive { border-color: var(--accent); background: var(--accent-soft); }
  .verse.off { opacity: 0.45; }
  .verse.off .vcols { text-decoration: line-through; text-decoration-color: #0004; }
  .vbody { flex: 1; text-align: left; background: transparent; border: none; padding: 12px 16px; font-size: 16px; line-height: 1.75; }
  .vhead { display: flex; gap: 10px; align-items: center; margin-bottom: 2px; }
  .vcols { display: grid; gap: 24px; }
  .second { color: var(--accent); }
  .show { background: transparent; border: none; color: var(--muted); font-size: 18px; padding: 0 16px; }
  .show:hover { color: var(--accent); }

  .preview { width: 100%; border-radius: 8px; overflow: hidden; background: #000; }
  .display { border-top: 1px solid var(--line); padding-top: 8px; }
  .display button { padding: 2px 8px; }
  .langpills { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 4px; }
  .langpills button { padding: 2px 10px; font-size: 12px; font-weight: 600; border-radius: 999px; }
  .langpills button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
  .url { font-size: 12px; color: var(--accent); word-break: break-all; }
</style>
