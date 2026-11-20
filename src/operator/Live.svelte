<script lang="ts">
  import { untrack } from 'svelte';
  import { app, link, getSong, songName, displayUrls } from './store.svelte';
  import Stage from '../display/Stage.svelte';
  import { slideKeys, verseLabel, verseCount } from '../shared/slides';
  import type { Song } from '../shared/types';
  import Check from '@lucide/svelte/icons/check';
  import Play from '@lucide/svelte/icons/play';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import SkipBack from '@lucide/svelte/icons/skip-back';
  import SkipForward from '@lucide/svelte/icons/skip-forward';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Search from '@lucide/svelte/icons/search';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Minus from '@lucide/svelte/icons/minus';
  import Trash from '@lucide/svelte/icons/trash-2';
  import ListPlus from '@lucide/svelte/icons/list-plus';
  import PenLine from '@lucide/svelte/icons/pen-line';

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
    // "dp112", "dp 112" or "DP 11" search one collection by number prefix.
    const m = s.match(/^([a-zæøåąćęłńóśźż]+)\s*(\d+)$/i);
    if (m) {
      const hits = app.songs.filter(
        (x) => x.collectionKey?.toLowerCase() === m[1] && x.number != null && String(x.number).startsWith(m[2]),
      );
      if (hits.length) return hits.sort((a, b) => (a.number === Number(m[2]) ? -1 : b.number === Number(m[2]) ? 1 : 0));
    }
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
  let savedCurrent = $derived(st.savedSetlists.find((x) => x.name === st.setlistName) ?? null);
  function deleteSetlist() {
    if (savedCurrent && confirm(`Delete saved setlist “${savedCurrent.name}”?`)) link.send('setlistDelete', { id: savedCurrent.id });
  }

  // Annotations
  let MARKS = $derived(st.markPresets ?? []);
  let annotate = $state(false);
  let notes = $derived(selected ? (st.notes?.[selected.id] ?? {}) : {});
  function cycleMark(key: string, line: number) {
    if (!selected) return;
    const cur = notes[key]?.marks?.[line] ?? '';
    // A custom mark that is not a preset goes back to none.
    const i = MARKS.indexOf(cur);
    const next = cur && i === -1 ? '' : (MARKS[i + 1] ?? '');
    link.send('lineMark', { songId: selected.id, key, line, mark: next });
  }
  // window.prompt does not work in Electron, so custom marks are typed inline.
  let editing = $state<{ key: string; line: number } | null>(null);
  function customMark(key: string, line: number, e: MouseEvent) {
    e.preventDefault();
    editing = { key, line };
  }
  function saveCustom(e: Event) {
    const ed = editing;
    if (!ed || !selected) return;
    editing = null;
    link.send('lineMark', { songId: selected.id, key: ed.key, line: ed.line, mark: (e.currentTarget as HTMLInputElement).value.trim() });
  }
  function setPresets(e: Event) {
    link.send('markPresetsSet', { marks: (e.currentTarget as HTMLInputElement).value.split(',') });
  }
  function setNote(key: string, e: Event) {
    const text = (e.currentTarget as HTMLInputElement).value;
    if (selected && text !== (notes[key]?.text ?? '')) link.send('noteSet', { songId: selected.id, key, text });
  }
  const summary = (id: string) => app.songs.find((s) => s.id === id);

  // Typing MUST NOT be overwritten by unrelated state broadcasts.
  let setlistName = $state(untrack(() => app.state!.setlistName));
  let lastServerName = untrack(() => app.state!.setlistName);
  $effect(() => {
    const n = st.setlistName;
    if (n !== lastServerName) {
      lastServerName = n;
      setlistName = n;
    }
  });
  function loadSetlist(e: Event) {
    const id = (e.currentTarget as HTMLSelectElement).value;
    if (id) link.send('setlistLoad', { id });
    (e.currentTarget as HTMLSelectElement).value = '';
  }

  // Click shows only that language. Shift/Cmd/Ctrl-click adds or removes it (multi-column).
  function pickLanguage(p: { id: string; languages: string[] }, code: string, e: MouseEvent) {
    let next: string[];
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      next = p.languages.includes(code) ? p.languages.filter((l) => l !== code) : [...p.languages, code];
    } else next = [code];
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
  <section class="col">
    <div class="card pad stack">
      <select bind:value={collection} aria-label="Collection">
        {#each collections as c (c.key)}<option value={c.key}>{c.name} · {c.key}</option>{/each}
      </select>
      <form class="numrow" onsubmit={jumpNumber}>
        <input id="number" class="grow num" inputmode="numeric" placeholder="Song number" bind:value={numberBox} aria-label="Song number" />
        <button type="submit" class="primary">Go live</button>
      </form>
      <div class="search">
        <Search size={15} />
        <input id="search" placeholder="Search all collections" bind:value={q} aria-label="Search songs" />
        <kbd>/</kbd>
      </div>
      <label class="follow" title="Clicking a song puts it on the screens immediately">
        <input type="checkbox" bind:checked={follow} /> Screens follow selection
      </label>
    </div>

    <div class="card list" role="list">
      {#each filtered as s (s.id)}
        <div class="item" role="listitem" class:sel={selected?.id === s.id} class:islive={st.live.songId === s.id}>
          <button class="name" onclick={() => select(s.id)} ondblclick={() => link.send('setLive', { songId: s.id })}>
            <span class="n num">{s.number ?? ''}</span>
            <span class="t">{s.title[primary] ?? Object.values(s.title)[0]}</span>
            {#if q}<span class="k">{s.collectionKey}</span>{/if}
          </button>
          <button class="icon ghost" title="Add to setlist" aria-label="Add to setlist" onclick={() => addToSetlist(s.id)}><Plus size={15} /></button>
        </div>
      {:else}
        <p class="empty">No songs match “{q}”.</p>
      {/each}
    </div>

    <div class="card pad">
      <div class="row head"><h2 class="grow">Setlist</h2><span class="hint">N / P</span></div>
      <div class="setbar">
        <input class="grow" placeholder="Service name, e.g. Sunday 22.11" bind:value={setlistName} aria-label="Setlist name" />
        <button title="Save setlist" onclick={() => link.send('setlistSave', { name: setlistName })}>Save</button>
      </div>
      <div class="setbar">
        <select class="grow" onchange={loadSetlist} aria-label="Load saved setlist">
          <option value="">Load saved… ({st.savedSetlists.length})</option>
          {#each st.savedSetlists as x (x.id)}<option value={x.id}>{x.name} · {x.ids.length} items</option>{/each}
        </select>
        <button title="Start an empty setlist" onclick={() => link.send('setlistNew')}>New</button>
        {#if savedCurrent}<button class="icon" title="Delete saved setlist" aria-label="Delete saved setlist" onclick={deleteSetlist}><Trash size={14} /></button>{/if}
        <a class="printlink" href="/print/setlist" target="_blank" title="Print for musicians">Print</a>
      </div>
      {#each st.setlist as id, i (id)}
        {@const s = summary(id)}
        <div class="item" class:sel={selected?.id === id} class:islive={st.live.songId === id}>
          <button class="name" onclick={() => select(id)}>
            <span class="k">{s?.collectionKey}</span><span class="n num">{s?.number ?? ''}</span>
            <span class="t">{s ? (s.title[primary] ?? Object.values(s.title)[0]) : id}</span>
          </button>
          <button class="icon ghost" aria-label="Move up" onclick={() => moveInSetlist(i, -1)}><ArrowUp size={14} /></button>
          <button class="icon ghost" aria-label="Move down" onclick={() => moveInSetlist(i, 1)}><ArrowDown size={14} /></button>
          <button class="icon ghost" aria-label="Remove" onclick={() => link.send('setlist', { ids: st.setlist.filter((x) => x !== id) })}><X size={14} /></button>
        </div>
      {:else}
        <p class="empty small">Add songs with <Plus size={12} /> to plan the service.</p>
      {/each}
    </div>
  </section>

  <!-- Song page -->
  <section class="col mid">
    {#if selected}
      <div class="card songcard">
        <div class="cardhead">
          <button class="icon ghost" title="Previous song in collection ( [ )" aria-label="Previous song" onclick={() => link.send('songStep', { delta: -1 })}><ChevronLeft size={18} /></button>
          <span class="collection grow">{selected.collection}</span>
          <button class="icon ghost" title="Next song in collection ( ] )" aria-label="Next song" onclick={() => link.send('songStep', { delta: 1 })}><ChevronRight size={18} /></button>
        </div>
        <div class="info">
          <div class="bignum num">{selected.number ?? ''}</div>
          <div class="meta">
            <h1 class="title">{selected.title[primary] ?? Object.values(selected.title)[0]}</h1>
            {#each langs.slice(1) as l}
              {#if selected.title[l]}<div class="subtitle">{selected.title[l]}</div>{/if}
            {/each}
            <div class="facts">
              {#if selected.author}<span>Written{selected.year ? ` in ${selected.year}` : ''} by <span class="chip">{selected.author}</span></span>{/if}
              <span>{selected.composer || 'Unknown composer'}</span>
              {#if selected.copyright}<span>Text © {selected.copyright}</span>{/if}
              <span class="num">{[selected.key, verseCount(selected) ? `${verseCount(selected)} verses` : ''].filter(Boolean).join(' · ')}</span>
            </div>
          </div>
          <button class="golive" disabled={st.setlist.includes(selected.id)} title="Add to setlist" onclick={() => addToSetlist(selected!.id)}>
            <ListPlus size={16} /> {st.setlist.includes(selected.id) ? 'In setlist' : 'Setlist'}
          </button>
          <button class="primary golive" onclick={() => goLive(0)}>
            {#if selectedIsLive}<RotateCcw size={16} /> Restart{:else}<Play size={16} /> Show{/if}
            <kbd class="onaccent">↵</kbd>
          </button>
        </div>
      </div>

      <div class="card">
        <div class="cardhead">
          <h2 class="nomargin">Verses</h2>
          <button class="toggleall ghost" onclick={toggleAll}>
            <span class="check" class:off={disabled.size > 0}><Check size={12} strokeWidth={3} /></span>
            {disabled.size > 0 ? 'Enable all' : 'All enabled'}
          </button>
          <span class="grow"></span>
          <span class="hint">{annotate ? 'Click a line to mark it · notes are saved per song' : 'Click to skip a verse'}</span>
          <button class="toggleall" class:on={annotate} aria-pressed={annotate} onclick={() => (annotate = !annotate)}><PenLine size={14} /> Annotate</button>
        </div>
        {#if annotate}
          <label class="presets">
            <span>Marks</span>
            <input class="grow" value={MARKS.join(', ')} onchange={setPresets} placeholder="Solo, All, Men, Women" aria-label="Marks a click cycles through, comma separated" />
            <span class="hint">click a line to cycle · click its tag to type any text</span>
          </label>
        {/if}
        <datalist id="mark-presets">{#each MARKS as m}<option value={m}></option>{/each}</datalist>
        <div class="verses">
          {#each selKeys as k, i}
            {@const off = disabled.has(i)}
            {@const isLive = selectedIsLive && st.live.slideIndex === i}
            {@const note = notes[k]}
            <div class="verse" class:off class:islive={isLive}>
              {#if annotate}
                <div class="vbody">
                  <div class="vhead">
                    <strong class="num">{verseLabel(k)}</strong>
                    <input class="noteinput grow" placeholder="Note, e.g. key change, slower…" value={note?.text ?? ''} onchange={(e) => setNote(k, e)} aria-label="Note for {verseLabel(k)}" />
                  </div>
                  <div class="vcols" style:grid-template-columns="repeat({langs.length}, 1fr)">
                    {#each langs as l, li}
                      <div class:second={li > 0}>
                        {#each selected.lyrics[l]?.[k] ?? [] as line, n}
                          {#if li === 0 && editing?.key === k && editing.line === n}
                            <div class="markline">
                              <!-- svelte-ignore a11y_autofocus -->
                              <input class="markinput" list="mark-presets" autofocus placeholder="Type any text" value={note?.marks?.[n] ?? ''} aria-label="Mark for this line" onfocus={(e) => e.currentTarget.select()}
                                onkeydown={(e) => { if (e.key === 'Enter') saveCustom(e); if (e.key === 'Escape') editing = null; }}
                                onblur={saveCustom} />{line}
                            </div>
                          {:else if li === 0}
                            <div class="markline">
                              <button class="mark" class:empty={!note?.marks?.[n]} title="Click to type your own text" aria-label="Edit mark" onclick={(e) => customMark(k, n, e)}>{note?.marks?.[n] ?? '+'}</button><button class="linetext" onclick={() => cycleMark(k, n)} oncontextmenu={(e) => customMark(k, n, e)} title="Click to cycle: {MARKS.join(', ')}, none">{line}</button>
                            </div>
                          {:else}<div>{line}</div>{/if}
                        {/each}
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
              <button class="vbody" onclick={() => toggle(i)} aria-pressed={!off} title={off ? 'Enable verse' : 'Skip verse'}>
                <div class="vhead">
                  <span class="check" class:off><Check size={12} strokeWidth={3} /></span>
                  <strong class="num">{verseLabel(k)}</strong>
                  {#if isLive}<span class="livetag">On screen</span>{/if}
                  {#if note?.text}<span class="notetag">{note.text}</span>{/if}
                </div>
                <div class="vcols" style:grid-template-columns="repeat({langs.length}, 1fr)">
                  {#each langs as l, li}
                    <div class:second={li > 0}>
                      {#each selected.lyrics[l]?.[k] ?? [] as line, n}<div>{#if li === 0 && note?.marks?.[n]}<span class="mark">{note.marks[n]}</span>{/if}{line}</div>{:else}<div class="muted">No {l.toUpperCase()} text</div>{/each}
                    </div>
                  {/each}
                </div>
              </button>
              {/if}
              <button class="show" title="Show this verse" aria-label="Show this verse" onclick={() => goLive(i)}><Play size={18} /></button>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="card welcome">
        <h1>Ready for the service</h1>
        <p class="muted">Type a song number and press Enter, or pick one from the list. Arrow keys move between verses, B blanks the screens.</p>
      </div>
    {/if}
  </section>

  <!-- Live output -->
  <section class="col">
    <div class="card onair" class:active={!!st.liveSong && !st.live.blank}>
      <div class="cardhead">
        <span class="badge" class:active={!!st.liveSong && !st.live.blank}><span class="dot"></span>{st.live.blank ? 'Blanked' : st.liveSong ? 'Live' : 'Standby'}</span>
        <span class="grow small muted">{preview?.name}</span>
        <button class="ghost small" onclick={() => link.send('clear')}>Clear</button>
      </div>
      <div class="previewwrap">
        <div class="preview" style:aspect-ratio="{preview.width} / {preview.height}">
          <Stage profile={preview} song={st.liveSong} slideIndex={st.live.slideIndex} blank={st.live.blank} disabled={[...liveDisabled]} notes={st.liveSong ? st.notes?.[st.liveSong.id] : undefined} checker />
        </div>
      </div>
      <div class="nowline">
        {#if st.liveSong}
          <strong class="num">{st.liveSong.collectionKey} {st.liveSong.number ?? ''}</strong>
          <span class="grow ellipsis">{st.liveSong.title[primary] ?? Object.values(st.liveSong.title)[0]}</span>
          <span class="vpos num">{verseLabel(liveKeys[st.live.slideIndex] ?? '')}</span>
        {:else}
          <span class="muted">Nothing on screen</span>
        {/if}
      </div>
      <div class="transport">
        <button class="big" aria-label="Previous verse" onclick={() => link.send('step', { delta: -1 })}><SkipBack size={18} /> Prev</button>
        <button class="big blank" class:on={st.live.blank} onclick={() => link.send('blank', {})}><EyeOff size={18} /> Blank <kbd>B</kbd></button>
        <button class="big next" aria-label="Next verse" onclick={() => link.send('step', { delta: 1 })}>Next <SkipForward size={18} /></button>
      </div>
    </div>

    <div class="card pad">
      <h2>Up next</h2>
      {#if nextIndex !== -1 && st.liveSong}
        <div class="next">
          <span class="vtag num">{verseLabel(liveKeys[nextIndex])}</span>
          <div>{#each st.liveSong.lyrics[primary]?.[liveKeys[nextIndex]] ?? [] as line}<div>{line}</div>{/each}</div>
        </div>
      {:else}
        <p class="muted small nomargin">{st.liveSong ? 'Last verse of this song.' : 'Nothing queued.'}</p>
      {/if}
    </div>

    <div class="card pad stack">
      <h2 class="nomargin">Displays</h2>
      {#each st.profiles as p (p.id)}
        <div class="display">
          <div class="row">
            <strong class="grow">{p.name}</strong>
            <span class="muted small num">{p.width}×{p.height}</span>
            <div class="seg">
              <button class="icon" title="Smaller text" aria-label="Smaller text" onclick={() => link.send('fontStep', { id: p.id, delta: -4 })}><Minus size={14} /></button>
              <span class="seglabel num" title="Text size on this display">{st.fitted?.[p.id] ?? (p.text.autoFit ? p.text.maxSize : p.text.size)}</span>
              <button class="icon" title="Larger text" aria-label="Larger text" onclick={() => link.send('fontStep', { id: p.id, delta: 4 })}><Plus size={14} /></button>
            </div>
          </div>
          <div class="langpills" role="group" aria-label="Languages on {p.name}">
            {#each st.languages as l (l.code)}
              {@const on = p.languages.includes(l.code)}
              <button class:sel={on} aria-pressed={on} title="{l.name}: click to show only this · Shift-click to add or remove" onclick={(e) => pickLanguage(p, l.code, e)}>
                {l.code.toUpperCase()}{#if on && p.languages.length > 1}<sup>{p.languages.indexOf(l.code) + 1}</sup>{/if}
              </button>
            {/each}
          </div>
          <a class="url" href={displayUrls(p.id)[0]} target="_blank">{displayUrls(p.id)[0]}</a>
        </div>
      {/each}
      <p class="hint nomargin">Click a language to show only it. Shift-click to add a second column.</p>
      <div class="display">
        <div class="row"><strong class="grow">Phone remote</strong></div>
        <a class="url" href={displayUrls('').map((u) => u.replace('/display/', '/remote'))[0]} target="_blank">{displayUrls('').map((u) => u.replace('/display/', '/remote'))[0]}</a>
      </div>
    </div>
  </section>
</div>

<style>
  .live {
    height: 100%;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr) 440px;
    gap: 16px;
    padding: 16px;
  }
  @media (max-width: 1440px) {
    .live { grid-template-columns: 250px minmax(0, 1fr) 360px; gap: 12px; padding: 12px; }
    .info { gap: 14px; padding: 12px 16px; }
    .bignum { font-size: 28px; }
    .title { font-size: 18px; }
  }
  .col { overflow: auto; display: flex; flex-direction: column; gap: 12px; min-height: 0; padding: 2px; }
  /* Cards MUST keep their height; the column scrolls instead. Only the song list flexes. */
  .col > .card { flex-shrink: 0; }
  .pad { padding: 14px 16px; }
  .stack { display: flex; flex-direction: column; gap: 10px; }
  .small { font-size: 12px; }
  .nomargin { margin: 0; }
  .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint { font-size: 12px; color: var(--muted); display: inline-flex; align-items: center; gap: 4px; }
  .head { margin-bottom: 4px; }
  .head h2 { margin: 0; }
  kbd {
    font: 600 11px/1 'Inter Variable', sans-serif;
    color: var(--muted);
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-bottom-width: 2px;
    border-radius: 5px;
    padding: 3px 6px;
  }
  kbd.onaccent { background: rgba(255, 255, 255, 0.18); border-color: rgba(255, 255, 255, 0.3); color: #fff; }
  .ghost { background: transparent; border-color: transparent; }
  .ghost:hover { background: var(--panel-2); border-color: transparent; }
  .icon { padding: 5px; color: var(--muted); }
  .icon:hover { color: var(--text); }

  .numrow { display: flex; gap: 8px; }
  .numrow input { font-size: 16px; font-weight: 600; letter-spacing: 0.02em; }
  .search { position: relative; display: flex; align-items: center; color: var(--muted); }
  .search :global(svg) { position: absolute; left: 10px; pointer-events: none; }
  .search input { width: 100%; padding-left: 32px; padding-right: 34px; }
  .search kbd { position: absolute; right: 8px; }
  .setbar { display: flex; gap: 6px; margin-bottom: 6px; }
  .setbar button, .setbar select, .setbar input { font-size: 13px; padding: 5px 8px; }
  .printlink { font-size: 13px; color: var(--accent-ink); align-self: center; padding: 0 4px; text-underline-offset: 3px; }
  .follow { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--text-2); cursor: pointer; }

  .col > .list { flex: 1 1 0; flex-shrink: 1; min-height: 200px; overflow: auto; padding: 6px; }
  .item { display: flex; gap: 2px; border-radius: 8px; transition: background 120ms var(--ease); }
  .item:hover { background: var(--panel-2); }
  .item button { background: transparent; border-color: transparent; }
  .item .name { flex: 1; justify-content: flex-start; gap: 10px; text-align: left; min-width: 0; padding: 6px 8px; font-weight: 400; }
  .item .n { color: var(--muted); min-width: 2.4em; text-align: right; font-size: 13px; }
  .item .k { color: var(--accent-ink); font-size: 11px; font-weight: 600; }
  .item .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item.sel { background: var(--accent-soft); }
  .item.sel .t { font-weight: 500; }
  .item.islive .t { color: var(--live); font-weight: 600; }
  .item.islive .n { color: var(--live); }
  .item .icon { opacity: 0; }
  .item:hover .icon, .item .icon:focus-visible { opacity: 1; }
  .empty { color: var(--muted); padding: 12px; margin: 0; display: flex; align-items: center; gap: 4px; }

  .cardhead { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid var(--line); }
  .collection { color: var(--accent-ink); font-size: 15px; font-weight: 500; text-align: center; }
  .info { display: flex; gap: 16px; padding: 14px 20px; align-items: flex-start; }
  .bignum { font-size: 32px; font-weight: 700; color: #a8a196; line-height: 1; letter-spacing: -0.03em; min-width: 1.4em; }
  .meta { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .title { font-size: 20px; font-weight: 700; line-height: 1.2; margin: 0; letter-spacing: -0.015em; text-wrap: balance; }
  .subtitle { font-size: 14px; color: var(--accent-ink); }
  .facts { display: flex; flex-wrap: wrap; column-gap: 14px; row-gap: 2px; margin-top: 6px; color: var(--muted); font-size: 13px; }
  .chip { background: var(--panel-2); border-radius: 6px; padding: 1px 6px; color: var(--text-2); }
  .golive { padding: 8px 14px; font-size: 14px; border-radius: var(--radius); }

  .toggleall { color: var(--text-2); font-size: 13px; }
  .toggleall.on { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent-ink); }
  .mark { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; color: #fff; background: var(--accent); border-radius: 4px; padding: 0 5px; margin-right: 8px; line-height: 1.6; vertical-align: 2px; }
  .mark.empty { background: transparent; color: var(--muted); border: 1px dashed var(--line-strong); }
  .markline { display: flex; align-items: baseline; line-height: 1.7; border-radius: 4px; }
  .markline:hover { background: var(--accent-soft); }
  button.mark { border: none; cursor: text; flex: none; }
  button.mark:hover { outline: 2px solid var(--accent-line); }
  .linetext { flex: 1; text-align: left; background: transparent; border: none; padding: 0; font: inherit; font-weight: 400; line-height: 1.7; }
  .linetext:hover { background: transparent; }
  .noteinput { font-size: 13px; padding: 4px 8px; }
  .markinput { font-size: 12px; padding: 1px 6px; width: 9em; margin-right: 8px; }
  .presets { display: flex; align-items: center; gap: 10px; padding: 10px 20px; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--text-2); }
  .presets input { font-size: 13px; padding: 4px 8px; }
  .notetag { font-size: 12px; color: var(--accent-ink); font-style: italic; }
  .check {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--ok);
    color: #fff;
    flex: none;
    transition: background 150ms var(--ease);
  }
  .check.off { background: var(--line-strong); }

  .verses { padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 6px; }
  .verse { display: flex; border: 1px solid transparent; border-radius: var(--radius); transition: background 150ms var(--ease), border-color 150ms var(--ease), opacity 150ms var(--ease); }
  .verse:hover { background: var(--panel-2); }
  .verse.islive { border-color: var(--accent); background: var(--accent-soft); }
  .verse.off { opacity: 0.42; }
  .verse.off .vcols { text-decoration: line-through; text-decoration-color: rgba(0, 0, 0, 0.25); }
  .vbody { flex: 1; display: block; text-align: left; background: transparent; border: none; padding: 12px 16px; font-size: 16px; font-weight: 400; line-height: 1.7; }
  .vbody:hover { background: transparent; }
  .vhead { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
  .livetag { font-size: 11px; font-weight: 600; color: var(--accent-ink); background: #fff; border: 1px solid var(--accent-line); border-radius: 999px; padding: 1px 8px; }
  .vcols { display: grid; gap: 28px; }
  .second { color: var(--accent-ink); }
  .show { background: transparent; border: none; color: var(--muted); padding: 0 18px; border-radius: 0 var(--radius) var(--radius) 0; }
  .show:hover { color: var(--accent-ink); background: var(--accent-soft); }

  .welcome { padding: 40px 36px; }
  .welcome h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -0.015em; }
  .welcome p { margin: 0; max-width: 52ch; line-height: 1.6; }

  .onair { overflow: hidden; transition: box-shadow 200ms var(--ease); }
  .onair.active { box-shadow: 0 0 0 2px var(--live), var(--shadow-lift); }
  .onair .cardhead { padding: 10px 14px; }
  .badge { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
  .badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line-strong); }
  .badge.active { color: var(--live); }
  .badge.active .dot { background: var(--live); }
  .previewwrap { padding: 12px 14px 0; }
  .preview { width: 100%; border-radius: 8px; overflow: hidden; background: #000; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1); }
  .nowline { display: flex; gap: 10px; align-items: baseline; padding: 10px 16px 0; min-height: 30px; }
  .vpos { color: var(--accent-ink); font-weight: 600; }
  .transport { display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px; padding: 12px 14px 14px; }
  .big { padding: 12px 14px; font-size: 15px; font-weight: 600; border-radius: var(--radius); }
  .big.next { background: var(--text); color: #fff; border-color: var(--text); }
  .big.next:hover { background: #000; }
  .blank kbd { margin-left: 2px; }
  .blank.on kbd { background: rgba(255, 255, 255, 0.2); color: #fff; border-color: transparent; }

  .next { display: flex; gap: 12px; line-height: 1.6; }
  .vtag { font-weight: 600; color: var(--muted); min-width: 2em; }

  .display { border-top: 1px solid var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .display:first-of-type { border-top: none; padding-top: 0; }
  .seg { display: inline-flex; align-items: center; border: 1px solid var(--line); border-radius: var(--radius-s); }
  .seg button { border: none; border-radius: var(--radius-s); background: transparent; }
  .seglabel { font-size: 12px; font-weight: 700; color: var(--text-2); padding: 0 2px; }
  .langpills { display: flex; flex-wrap: wrap; gap: 4px; }
  .langpills button { padding: 3px 11px; font-size: 12px; font-weight: 600; border-radius: 999px; color: var(--text-2); }
  .langpills button.sel { background: var(--accent); border-color: var(--accent); color: #fff; }
  .langpills sup { font-size: 9px; margin-left: 1px; opacity: 0.85; }
  .url { font-size: 12px; color: var(--accent-ink); word-break: break-all; text-underline-offset: 3px; }
</style>
