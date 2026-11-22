<script lang="ts">
  import { t } from '../shared/i18n.svelte';
  import { untrack } from 'svelte';
  import { app, link, getSong, saveSong, songName, displayUrls } from './store.svelte';
  import Stage from '../display/Stage.svelte';
  import { slideKeys, verseLabel, verseCount, sungLanguages } from '../shared/slides';
  import type { Song, MedleyPart } from '../shared/types';
  import Check from '@lucide/svelte/icons/check';
  import Radio from '@lucide/svelte/icons/radio';
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
  import Layers from '@lucide/svelte/icons/layers';
  import Printer from '@lucide/svelte/icons/printer';
  import FilePlus from '@lucide/svelte/icons/file-plus';
  import Languages from '@lucide/svelte/icons/languages';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import MessageSquareText from '@lucide/svelte/icons/message-square-text';

  let st = $derived(app.state!);
  // Which display the on-air card previews. Per operator, so it lives in localStorage.
  let previewId = $state((() => {
    try {
      return localStorage.getItem('previewProfile') ?? '';
    } catch {
      return '';
    }
  })());
  $effect(() => {
    try {
      localStorage.setItem('previewProfile', previewId);
    } catch {}
  });
  let preview = $derived(st.profiles.find((p) => p.id === previewId) ?? st.profiles[0]);
  // The song page follows the first display, not the preview choice.
  let langs = $derived(st.profiles[0]?.languages ?? []);
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

  // SongTreasures band session. The leader's song is offered with one click, never opened by itself.
  let stCode = $state('');
  let stS = $derived(st.stSession);
  let stSuggest = $derived(stS?.suggestion?.songId && stS.suggestion.songId !== selected?.id ? stS.suggestion : null);

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

  // Keeps the live verse and the one after it visible while stepping through the song.
  let versesEl = $state<HTMLDivElement>();
  $effect(() => {
    const idx = st.live.slideIndex;
    const nxt = nextIndex;
    if (!selectedIsLive || !versesEl) return;
    const items = versesEl.children;
    const target = (items[nxt] ?? items[idx]) as HTMLElement | undefined;
    target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

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
    if (savedCurrent && confirm(t('Delete saved setlist “{name}”?', { name: savedCurrent.name }))) link.send('setlistDelete', { id: savedCurrent.id });
  }

  let dirty = $derived(!!st.setlist.length && (!savedCurrent || savedCurrent.ids.join() !== st.setlist.join()));

  // Medley builder. Each part keeps all slide keys of its song and which of them play.
  type BuildPart = { songId: string; all: string[]; on: boolean[] };
  let medley = $state<{ id?: string; name: string; parts: BuildPart[] } | null>(null);
  let mq = $state('');
  let medleyHits = $derived.by(() => {
    const t = mq.trim().toLowerCase();
    if (!t) return [];
    const m = t.match(/^([a-zæøåąćęłńóśźż]*)\s*(\d+)$/i);
    const pool = app.songs.filter((x) => !x.medley);
    const hits = m
      ? pool.filter((x) => String(x.number) === m[2] && (!m[1] || x.collectionKey.toLowerCase() === m[1]))
      : pool.filter((x) => x.search.includes(t));
    return hits.slice(0, 6);
  });
  function startMedley() {
    medley = { name: '', parts: [] };
    mq = '';
  }
  async function toPart(id: string, keys: string[] = []): Promise<BuildPart> {
    const all = slideKeys(await getSong(id));
    // Stored keys are a subsequence of the slide keys. Empty means every verse.
    let j = 0;
    const on = all.map((k) => (keys.length ? (keys[j] === k ? (j++, true) : false) : true));
    return { songId: id, all, on };
  }
  async function editMedley(song: Song) {
    const parts = await Promise.all((song.medley ?? []).map((p) => toPart(p.songId, p.keys)));
    medley = { id: song.id, name: song.title[primary] ?? Object.values(song.title)[0] ?? '', parts };
    mq = '';
  }
  async function addSongToMedley(id: string, on?: boolean[]) {
    if (!medley) return;
    const part = await toPart(id);
    if (on) part.on = on;
    medley.parts.push(part);
    mq = '';
    if (!medley.name) {
      const sm = summary(id);
      medley.name = 'Medley: ' + (sm ? (sm.title[primary] ?? Object.values(sm.title)[0]) : '');
    }
  }
  function addPart() {
    if (selected && !selected.medley) addSongToMedley(selected.id, selKeys.map((_, i) => !disabled.has(i)));
  }
  function movePart(i: number, d: number) {
    if (!medley) return;
    const j = i + d;
    if (j < 0 || j >= medley.parts.length) return;
    [medley.parts[i], medley.parts[j]] = [medley.parts[j], medley.parts[i]];
  }
  async function saveMedley() {
    if (!medley?.parts.length) return;
    const name = medley.name.trim() || 'Medley';
    const parts = medley.parts.map((p) => ({ songId: p.songId, keys: p.on.every(Boolean) ? [] : p.all.filter((_, i) => p.on[i]) }));
    const saved = await saveSong({ id: medley.id ?? '', title: { [primary]: name }, collection: 'Medley', collectionKey: 'MED', number: null, medley: parts } as Song);
    if (!st.setlist.includes(saved.id)) link.send('setlist', { ids: [...st.setlist, saved.id] });
    medley = null;
    selected = await getSong(saved.id);
  }
  const songLabel = (id: string) => {
    const x = summary(id);
    return x ? `${x.collectionKey} ${x.number ?? ''} · ${x.title[primary] ?? Object.values(x.title)[0]}` : id;
  };

  // Sung language. "*" is the whole song; a verse key overrides it.
  let sung = $derived(selected ? (st.sung?.[selected.id] ?? {}) : {});
  let langOptions = $derived.by(() => {
    const codes = new Set([...st.languages.map((l) => l.code), ...Object.keys(selected?.lyrics ?? {})]);
    return [...codes].filter((c) => !selected || selected.lyrics[c]).map((c) => ({ code: c, name: st.languages.find((l) => l.code === c)?.name ?? c }));
  });
  function setSung(key: string, lang: string) {
    if (selected) link.send('sungSet', { songId: selected.id, key, lang });
  }
  const verseLangs = (k: string) => (selected ? sungLanguages({ ...selected, sung }, k, langs) : langs);

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
  // Line comments show as an icon. Hover shows the text, click opens a popup to edit it.
  let commenting = $state<{ key: string; line: number } | null>(null);
  function saveComment(key: string, line: number, e: Event) {
    const text = (e.currentTarget as HTMLTextAreaElement).value.trim();
    commenting = null;
    if (selected && text !== (notes[key]?.comments?.[line] ?? '')) link.send('lineComment', { songId: selected.id, key, line, text });
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
    if (id && (!dirty || confirm(t('The current setlist has unsaved changes. Open another one anyway?')))) link.send('setlistLoad', { id });
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

{#snippet commentIcon(k: string, n: number, text: string | undefined)}
  <span class="cmtwrap">
    <button class="cmtbtn" class:set={!!text} title={text || t('Comment…')} aria-label={t('Comment for this line')} onclick={() => (commenting = commenting?.key === k && commenting.line === n ? null : { key: k, line: n })}>
      {#if text}<MessageSquareText size={14} />{:else}<MessageSquare size={14} />{/if}
    </button>
    {#if commenting?.key === k && commenting.line === n}
      <div class="cmtpop">
        <!-- svelte-ignore a11y_autofocus -->
        <textarea autofocus rows="3" placeholder={t('Comment…')} aria-label={t('Comment for this line')}
          onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); } if (e.key === 'Escape') commenting = null; }}
          onblur={(e) => saveComment(k, n, e)}>{text ?? ''}</textarea>
        <span class="hint">Enter ↵</span>
      </div>
    {/if}
  </span>
{/snippet}

<div class="live">
  <!-- Library -->
  <section class="col">
    <div class="card pad stack">
      <select bind:value={collection} aria-label={t("Collection")}>
        {#each collections as c (c.key)}<option value={c.key}>{c.name} · {c.key}</option>{/each}
      </select>
      <form class="numrow" onsubmit={jumpNumber}>
        <input id="number" class="grow num" inputmode="numeric" placeholder={t("Song number")} bind:value={numberBox} aria-label={t("Song number")} />
        <button type="submit" class="primary">{t("Go live")}</button>
      </form>
      <div class="search">
        <Search size={15} />
        <input id="search" placeholder={t("Search all collections")} bind:value={q} aria-label={t("Search songs")} />
        <kbd>/</kbd>
      </div>
      <label class="follow" title={t("Clicking a song puts it on the screens immediately")}>
        <input type="checkbox" bind:checked={follow} /> {t("Screens follow selection")}
      </label>
      {#if stS?.available}
        {#if stS.code}
          <div class="stbox">
            <div class="sthead">
              <span class="stdot" class:err={!!stS.error}></span>
              <span class="stlbl">{t("Session")}</span>
              <b class="num stcode">{stS.code}</b>
              <button class="stx" onclick={() => link.send('stFollow', { code: '' })} title={t("Stop following")} aria-label={t("Stop following")}><X size={14} /></button>
            </div>
            {#if stS.error}<p class="stmsg">{t(stS.error)}</p>
            {:else if stSuggest}
              <button class="stsuggest" onclick={() => select(stSuggest!.songId!)} title={t("Open the song the leader chose")}>
                <span class="stsong">
                  <span class="lbl">{t("Leader chose")}</span>
                  <span class="sttitle"><b class="num">{stSuggest.collection} {stSuggest.number}</b> {stSuggest.title}</span>
                </span>
                <ChevronRight size={18} />
              </button>
            {:else if stS.suggestion && !stS.suggestion.songId}
              <p class="stmsg">{t("Leader chose")} <b class="num">{stS.suggestion.collection} {stS.suggestion.number}</b>. {t("This song is not in your library.")}</p>
            {/if}
          </div>
        {:else}
          <form class="stform" onsubmit={(e) => { e.preventDefault(); if (stCode.trim()) link.send('stFollow', { code: stCode }); }}>
            <Radio size={15} />
            <input class="grow num" placeholder={t("Session code")} bind:value={stCode} aria-label={t("SongTreasures session code")} title={t("SongTreasures session code")} />
            <button class="small" type="submit" disabled={!stCode.trim()}>{t("Follow")}</button>
          </form>
        {/if}
      {/if}
    </div>

    <div class="card list" role="list">
      {#each filtered as s (s.id)}
        <div class="item" role="listitem" class:sel={selected?.id === s.id} class:islive={st.live.songId === s.id}>
          <button class="name" onclick={() => select(s.id)} ondblclick={() => link.send('setLive', { songId: s.id })}>
            <span class="n num">{s.number ?? ''}</span>
            <span class="t">{s.title[primary] ?? Object.values(s.title)[0]}</span>
            {#if q}<span class="k">{s.collectionKey}</span>{/if}
          </button>
          <button class="icon ghost" title={medley ? t('Add to medley') : t('Add to setlist')} aria-label={medley ? t('Add to medley') : t('Add to setlist')} onclick={() => (medley ? addSongToMedley(s.id) : addToSetlist(s.id))}>{#if medley}<Layers size={15} />{:else}<Plus size={15} />{/if}</button>
        </div>
      {:else}
        <p class="empty">{t("No songs match “")}{q}”.</p>
      {/each}
    </div>

    <div class="card pad">
      <div class="row head">
        <h2 class="grow">{t("Setlist")}{#if dirty} <span class="unsaved" title={t("Not saved")}>●</span>{/if}</h2>
        <span class="hint">N / P · {st.setlist.length} {t("items")}</span>
      </div>
      <form class="setbar" onsubmit={(e) => { e.preventDefault(); link.send('setlistSave', { name: setlistName }); }}>
        <input class="grow" placeholder={t("Service name, e.g. Sunday 22.11")} bind:value={setlistName} aria-label={t("Setlist name")} />
        <button type="submit" class:primary={dirty} title={t("Save setlist")}>{t("Save")}</button>
      </form>
      <select class="openpick" onchange={loadSetlist} aria-label={t("Open saved setlist")}>
        <option value="">{t("Open saved setlist… (")}{st.savedSetlists.length})</option>
        {#each st.savedSetlists as x (x.id)}<option value={x.id}>{x.name} · {x.ids.length} {t("items")}</option>{/each}
      </select>
      <div class="tools">
        <button title={t("Start an empty setlist")} onclick={() => (!dirty || confirm(t('Discard unsaved changes?'))) && link.send('setlistNew')}><FilePlus size={14} /> {t("New")}</button>
        <button class:on={!!medley} title={t("Build a medley from several songs")} onclick={() => (medley ? (medley = null) : startMedley())}><Layers size={14} /> {t("Medley")}</button>
        <span class="grow"></span>
        <a class="icon toollink" href="/print/setlist" target="_blank" title={t("Print for musicians")} aria-label={t("Print setlist")}><Printer size={14} /></a>
        {#if savedCurrent}<button class="icon ghost" title={t("Delete saved setlist")} aria-label={t("Delete saved setlist")} onclick={deleteSetlist}><Trash size={14} /></button>{/if}
      </div>

      {#if medley}
        <div class="medley">
          <input placeholder={t("Medley name")} bind:value={medley.name} aria-label={t("Medley name")} />
          {#each medley.parts as p, i}
            <div class="part">
              <div class="row">
                <span class="pi num">{i + 1}</span>
                <span class="grow ellipsis">{songLabel(p.songId)}</span>
                <button class="icon ghost" aria-label={t("Move up")} onclick={() => movePart(i, -1)}><ArrowUp size={13} /></button>
                <button class="icon ghost" aria-label={t("Move down")} onclick={() => movePart(i, 1)}><ArrowDown size={13} /></button>
                <button class="icon ghost" aria-label={t("Remove song")} onclick={() => medley!.parts.splice(i, 1)}><X size={13} /></button>
              </div>
              <div class="chips">
                {#each p.all as k, vi}
                  <button class="chip" class:off={!p.on[vi]} aria-pressed={p.on[vi]} title={p.on[vi] ? t('Click to skip') : t('Click to include')} onclick={() => (p.on[vi] = !p.on[vi])}>{verseLabel(k)}</button>
                {/each}
              </div>
            </div>
          {/each}
          <div class="msearch">
            <Search size={14} />
            <input placeholder={medley.parts.length ? t('Add next song: number or title') : t('Add first song: number or title')} bind:value={mq} aria-label={t("Find a song to add")}
              onkeydown={(e) => { if (e.key === 'Enter' && medleyHits[0]) { e.preventDefault(); addSongToMedley(medleyHits[0].id); } }} />
          </div>
          {#each medleyHits as h (h.id)}
            <button class="hit" onclick={() => addSongToMedley(h.id)}><Plus size={13} /> {songLabel(h.id)}</button>
          {/each}
          <p class="pv">{medley.parts.length ? t('Click a verse to skip it. ') : ''}{t("You can also use")} <Layers size={11} /> {t("in the song list.")}</p>
          <div class="row">
            <button class="ghost" onclick={() => (medley = null)}>{t("Cancel")}</button>
            <span class="grow"></span>
            <button class="primary" disabled={!medley.parts.length} onclick={saveMedley}>{medley.id ? t('Save medley') : t('Save and add')}</button>
          </div>
        </div>
      {/if}

      <div class="setitems">
      {#each st.setlist as id, i (id)}
        {@const s = summary(id)}
        <div class="item" class:sel={selected?.id === id} class:islive={st.live.songId === id}>
          <button class="name" onclick={() => select(id)} ondblclick={() => link.send('setLive', { songId: id })} title={t("Click to open, double-click to show")}>
            <span class="pos num">{i + 1}</span>
            {#if s?.medley}<span class="k"><Layers size={11} /></span>{:else}<span class="k">{s?.collectionKey}</span><span class="n num">{s?.number ?? ''}</span>{/if}
            <span class="t">{s ? (s.title[primary] ?? Object.values(s.title)[0]) : id}</span>
          </button>
          <button class="icon ghost" aria-label={t("Move up")} onclick={() => moveInSetlist(i, -1)}><ArrowUp size={14} /></button>
          <button class="icon ghost" aria-label={t("Move down")} onclick={() => moveInSetlist(i, 1)}><ArrowDown size={14} /></button>
          <button class="icon ghost" aria-label={t("Remove")} onclick={() => link.send('setlist', { ids: st.setlist.filter((x) => x !== id) })}><X size={14} /></button>
        </div>
      {:else}
        <p class="empty small">{t("Add songs with")} <Plus size={12} /> {t("to plan the service.")}</p>
      {/each}
      </div>
    </div>
  </section>

  <!-- Song page -->
  <section class="col mid">
    {#if selected}
      <div class="card songcard">
        <div class="cardhead">
          <button class="icon ghost" title={t("Previous song in collection ( [ )")} aria-label={t("Previous song")} onclick={() => link.send('songStep', { delta: -1 })}><ChevronLeft size={18} /></button>
          <span class="collection grow">{selected.collection}</span>
          <button class="icon ghost" title={t("Next song in collection ( ] )")} aria-label={t("Next song")} onclick={() => link.send('songStep', { delta: 1 })}><ChevronRight size={18} /></button>
        </div>
        <div class="info">
          <div class="bignum num">{selected.number ?? ''}</div>
          <div class="meta">
            <h1 class="title">{selected.title[primary] ?? Object.values(selected.title)[0]}</h1>
            {#each langs.slice(1) as l}
              {#if selected.title[l]}<div class="subtitle">{selected.title[l]}</div>{/if}
            {/each}
            {#if selected.parts}
              <div class="facts">{#each selected.parts as p, i}{#if p}<span class="chip">{i + 1}. {p.collectionKey} {p.number ?? ''} {p.title[primary] ?? Object.values(p.title)[0]}</span>{/if}{/each}</div>
            {:else}
            <div class="facts">
              {#if selected.author}<span>{selected.year ? t('Written in {year} by', { year: selected.year }) : t('Written by')} <span class="chip">{selected.author}</span></span>{/if}
              <span>{selected.composer || t('Unknown composer')}</span>
              {#if selected.copyright}<span>Text © {selected.copyright}</span>{/if}
              <span class="num">{[selected.key, verseCount(selected) ? `${verseCount(selected)} verses` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            {/if}
          </div>
          {#if medley && !selected.medley}
            <button class="golive accentbtn" onclick={addPart}><Layers size={16} /> {t("Add to medley")}</button>
          {:else if selected.medley}
            <button class="golive" onclick={() => editMedley(selected!)}><Layers size={16} /> {t("Edit medley")}</button>
          {/if}
          <button class="golive" disabled={st.setlist.includes(selected.id)} title={t("Add to setlist")} onclick={() => addToSetlist(selected!.id)}>
            <ListPlus size={16} /> {st.setlist.includes(selected.id) ? t('In setlist') : t('Setlist')}
          </button>
          <button class="primary golive" onclick={() => goLive(0)}>
            {#if selectedIsLive}<RotateCcw size={16} /> {t("Restart")}{:else}<Play size={16} /> {t("Show")}{/if}
            <kbd class="onaccent">↵</kbd>
          </button>
        </div>
      </div>

      <div class="card">
        <div class="cardhead">
          <h2 class="nomargin">{t("Verses")}</h2>
          <button class="toggleall ghost" onclick={toggleAll}>
            <span class="check" class:off={disabled.size > 0}><Check size={12} strokeWidth={3} /></span>
            {disabled.size > 0 ? t('Enable all') : t('All enabled')}
          </button>
          <label class="sungpick" title={t("Language the singers sing. Stage and singers' screens follow it. Each verse can override it.")}>
            <Languages size={14} />
            <select value={sung['*'] ?? ''} onchange={(e) => setSung('*', e.currentTarget.value)} aria-label={t("Sung language for the whole song")}>
              <option value="">{t("Display languages")}</option>
              {#each langOptions as o (o.code)}<option value={o.code}>{t("Sung in")} {o.name}</option>{/each}
            </select>
          </label>
          <span class="grow"></span>
          <span class="hint">{annotate ? t('Click a line to mark it · notes are saved per song') : t('Click to skip a verse')}</span>
          <button class="toggleall" class:on={annotate} aria-pressed={annotate} onclick={() => (annotate = !annotate)}><PenLine size={14} /> {t("Annotate")}</button>
        </div>
        {#if annotate}
          <label class="presets">
            <span>{t("Marks")}</span>
            <input class="grow" value={MARKS.join(', ')} onchange={setPresets} placeholder={t("Solo, All, Men, Women")} aria-label={t("Marks a click cycles through, comma separated")} />
            <span class="hint">{t("click a line to cycle · click its tag to type any text")}</span>
          </label>
        {/if}
        <datalist id="mark-presets">{#each MARKS as m}<option value={m}></option>{/each}</datalist>
        <div class="verses" bind:this={versesEl}>
          {#each selKeys as k, i}
            {@const off = disabled.has(i)}
            {@const isLive = selectedIsLive && st.live.slideIndex === i}
            {@const note = notes[k]}
            <div class="verse" class:off class:islive={isLive}>
              {#if annotate}
                <div class="vbody">
                  <div class="vhead">
                    <strong class="num">{verseLabel(k)}</strong>
                    <input class="noteinput grow" placeholder={t("Note, e.g. key change, slower…")} value={note?.text ?? ''} onchange={(e) => setNote(k, e)} aria-label="Note for {verseLabel(k)}" />
                  </div>
                  <div class="vcols" style:grid-template-columns="repeat({langs.length}, 1fr)">
                    {#each langs as l, li}
                      <div class:second={li > 0}>
                        {#each selected.lyrics[l]?.[k] ?? [] as line, n}
                          {#if li === 0 && editing?.key === k && editing.line === n}
                            <div class="markline">
                              <!-- svelte-ignore a11y_autofocus -->
                              <input class="markinput" list="mark-presets" autofocus placeholder={t("Type any text")} value={note?.marks?.[n] ?? ''} aria-label={t("Mark for this line")} onfocus={(e) => e.currentTarget.select()}
                                onkeydown={(e) => { if (e.key === 'Enter') saveCustom(e); if (e.key === 'Escape') editing = null; }}
                                onblur={saveCustom} />{line}
                            </div>
                          {:else if li === 0}
                            <div class="markline">
                              <button class="mark" class:empty={!note?.marks?.[n]} title={t("Click to type your own text")} aria-label={t("Edit mark")} onclick={(e) => customMark(k, n, e)}>{note?.marks?.[n] ?? '+'}</button><button class="linetext" onclick={() => cycleMark(k, n)} oncontextmenu={(e) => customMark(k, n, e)} title="Click to cycle: {MARKS.join(', ')}, none">{line}</button>
                              {@render commentIcon(k, n, note?.comments?.[n])}
                            </div>
                          {:else}<div>{line}</div>{/if}
                        {/each}
                      </div>
                    {/each}
                  </div>
                </div>
              {:else}
              <button class="vbody" onclick={() => toggle(i)} aria-pressed={!off} title={off ? t('Enable verse') : t('Skip verse')}>
                <div class="vhead">
                  <span class="check" class:off><Check size={12} strokeWidth={3} /></span>
                  <strong class="num">{verseLabel(k)}</strong>
                  {#if isLive}<span class="livetag">{t("On screen")}</span>{/if}
                  {#if note?.text}<span class="notetag">{note.text}</span>{/if}
                  {#if selected.parts && selected.parts[Number(k.split(':')[0])]}{@const p = selected.parts[Number(k.split(':')[0])]!}<span class="parttag">{p.collectionKey} {p.number ?? ''}</span>{/if}
                </div>
                <div class="vcols" style:grid-template-columns="repeat({verseLangs(k).length}, 1fr)">
                  {#each verseLangs(k) as l, li}
                    <div class:second={li > 0}>
                      {#each selected.lyrics[l]?.[k] ?? [] as line, n}<div>{#if li === 0 && note?.marks?.[n]}<span class="mark">{note.marks[n]}</span>{/if}{line}{#if li === 0 && note?.comments?.[n]}<span class="cmttag" title={note.comments[n]}><MessageSquareText size={13} /></span>{/if}</div>{:else}<div class="muted">{t("No")} {l.toUpperCase()} {t("text")}</div>{/each}
                    </div>
                  {/each}
                </div>
              </button>
              {/if}
              {#if !annotate}
                <select class="vlang" class:set={!!sung[k]} value={sung[k] ?? ''} onchange={(e) => setSung(k, e.currentTarget.value)} title={t("Sung language for this verse")} aria-label="Sung language for {verseLabel(k)}">
                  <option value="">{sung['*'] ? sung['*'].toUpperCase() : t('Lang')}</option>
                  {#each langOptions as o (o.code)}<option value={o.code}>{o.code.toUpperCase()} · {o.name}</option>{/each}
                </select>
              {/if}
              <button class="show" title={t("Show this verse")} aria-label={t("Show this verse")} onclick={() => goLive(i)}><Play size={18} /></button>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <div class="card welcome">
        <h1>{t("Ready for the service")}</h1>
        <p class="muted">{t("Type a song number and press Enter, or pick one from the list. Arrow keys move between verses, B blanks the screens.")}</p>
      </div>
    {/if}
  </section>

  <!-- Live output -->
  <section class="col">
    <div class="card onair" class:active={!!st.liveSong && !st.live.blank}>
      <div class="cardhead">
        <span class="badge" class:active={!!st.liveSong && !st.live.blank}><span class="dot"></span>{st.live.blank ? t('Blanked') : st.liveSong ? t('Live') : t('Standby')}</span>
        <select class="grow previewpick" bind:value={previewId} aria-label={t("Display to preview")}>
          {#each st.profiles as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
        </select>
        <button class="ghost small" onclick={() => link.send('clear')}>{t("Clear")}</button>
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
          <span class="muted">{t("Nothing on screen")}</span>
        {/if}
      </div>
      <div class="transport">
        <button class="big" aria-label={t("Previous verse")} onclick={() => link.send('step', { delta: -1 })}><SkipBack size={18} /> {t("Prev")}</button>
        <button class="big blank" class:on={st.live.blank} onclick={() => link.send('blank', {})}><EyeOff size={18} /> {t("Blank")} <kbd>B</kbd></button>
        <button class="big next" aria-label={t("Next verse")} onclick={() => link.send('step', { delta: 1 })}>{t("Next")} <SkipForward size={18} /></button>
      </div>
    </div>

    <div class="card pad">
      <h2>{t("Up next")}</h2>
      {#if nextIndex !== -1 && st.liveSong}
        <div class="next">
          <span class="vtag num">{verseLabel(liveKeys[nextIndex])}</span>
          <div>{#each st.liveSong.lyrics[primary]?.[liveKeys[nextIndex]] ?? [] as line}<div>{line}</div>{/each}</div>
        </div>
      {:else}
        <p class="muted small nomargin">{st.liveSong ? t('Last verse of this song.') : t('Nothing queued.')}</p>
      {/if}
    </div>

    <div class="card pad stack">
      <h2 class="nomargin">{t("Displays")}</h2>
      {#each st.profiles as p (p.id)}
        <div class="display">
          <div class="row">
            <strong class="grow">{p.name}</strong>
            <span class="muted small num">{p.width}×{p.height}</span>
            <div class="seg">
              <button class="icon" title={t("Smaller text")} aria-label={t("Smaller text")} onclick={() => link.send('fontStep', { id: p.id, delta: -4 })}><Minus size={14} /></button>
              <span class="seglabel num" title={t("Text size on this display")}>{st.fitted?.[p.id] ?? (p.text.autoFit ? p.text.maxSize : p.text.size)}</span>
              <button class="icon" title={t("Larger text")} aria-label={t("Larger text")} onclick={() => link.send('fontStep', { id: p.id, delta: 4 })}><Plus size={14} /></button>
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
      <p class="hint nomargin">{t("Click a language to show only it. Shift-click to add a second column.")}</p>
      <div class="display">
        <div class="row"><strong class="grow">{t("Phone remote")}</strong></div>
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
  .openpick { width: 100%; font-size: 13px; padding: 5px 8px; margin-bottom: 6px; }
  .tools { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
  .tools button { font-size: 13px; padding: 5px 8px; gap: 5px; }
  .tools button.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent-ink); }
  .toollink { color: var(--text-2); display: inline-flex; padding: 6px; border-radius: 8px; }
  .toollink:hover { background: var(--panel-2); }
  .unsaved { color: var(--accent-ink); font-size: 10px; vertical-align: middle; }
  .setitems { border-top: 1px solid var(--line); padding-top: 6px; }
  .item .pos { color: var(--muted); font-size: 11px; min-width: 1.2em; }
  .medley { display: flex; flex-direction: column; gap: 6px; background: var(--panel-2); border-radius: var(--radius); padding: 10px; margin-bottom: 8px; }
  .medley input { font-size: 13px; padding: 5px 8px; }
  .part { display: flex; flex-direction: column; gap: 4px; font-size: 13px; background: var(--panel); border-radius: 8px; padding: 6px 8px; }
  .part .row { gap: 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; padding-left: 1.6em; }
  .chips .chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); border: 1px solid var(--accent); color: var(--accent-ink); font-weight: 600; }
  .chips .chip.off { background: transparent; border-style: dashed; border-color: var(--line-strong); color: var(--muted); text-decoration: line-through; font-weight: 400; }
  .msearch { display: flex; align-items: center; gap: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 0 8px; color: var(--muted); }
  .msearch input { border: none; background: transparent; flex: 1; padding: 6px 0; outline: none; }
  .hit { justify-content: flex-start; font-size: 13px; padding: 5px 8px; font-weight: 400; background: var(--panel); text-align: left; }
  .part .pi { color: var(--accent-ink); font-weight: 600; min-width: 1.2em; }
  .pv { color: var(--muted); font-size: 12px; margin: 0; }
  .accentbtn { border-color: var(--accent); background: var(--accent-soft); }
  .sungpick { display: inline-flex; align-items: center; gap: 4px; color: var(--muted); }
  .sungpick select { font-size: 12px; padding: 3px 6px; }
  .verse { position: relative; }
  .vlang { position: absolute; top: 6px; right: 58px; font-size: 11px; padding: 2px 4px; opacity: 0; transition: opacity 120ms var(--ease); }
  .verse:hover .vlang, .vlang:focus, .vlang.set { opacity: 1; }
  .vlang.set { border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
  .parttag { font-size: 11px; color: var(--accent-ink); font-weight: 600; }
  .setbar button, .setbar select, .setbar input { font-size: 13px; padding: 5px 8px; }
  .printlink { font-size: 13px; color: var(--accent-ink); align-self: center; padding: 0 4px; text-underline-offset: 3px; }
  .stform { display: flex; gap: 8px; align-items: center; color: var(--text-2); }
  .stform input { text-transform: uppercase; min-width: 0; }
  .stbox { display: flex; flex-direction: column; gap: 8px; }
  .sthead { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); white-space: nowrap; }
  .stdot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex: none; animation: stpulse 2s ease-in-out infinite; }
  .stdot.err { background: var(--text-3, #999); animation: none; }
  @keyframes stpulse { 50% { opacity: 0.35; } }
  .stcode { color: var(--text); letter-spacing: 0.04em; }
  .stx { margin-left: auto; padding: 4px; border: none; background: none; color: var(--text-2); display: inline-flex; }
  .stx:hover { color: var(--text); background: var(--panel-2); }
  .stsuggest { display: flex; gap: 8px; align-items: center; width: 100%; text-align: left; padding: 8px 10px; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--panel)); }
  .stsong { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .stsuggest .lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); }
  .sttitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stmsg { margin: 0; font-size: 12px; color: var(--text-2); }
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
  .linetext { flex: 1; justify-content: flex-start; text-align: left; background: transparent; border: none; padding: 0; font: inherit; font-weight: 400; line-height: 1.7; }
  .linetext:hover { background: transparent; }
  .noteinput { font-size: 13px; padding: 4px 8px; }
  .cmtwrap { position: relative; flex: none; margin-left: 8px; align-self: center; }
  .cmtbtn { padding: 2px 4px; border: none; background: transparent; color: var(--muted); opacity: 0; line-height: 0; }
  .markline:hover .cmtbtn, .cmtbtn:focus-visible { opacity: 1; }
  .cmtbtn.set { opacity: 1; color: var(--accent-ink); }
  .cmtpop { position: absolute; z-index: 20; top: calc(100% + 4px); right: 0; width: 260px; background: var(--panel); border: 1px solid var(--line-strong); border-radius: 10px; box-shadow: var(--shadow); padding: 8px; display: flex; flex-direction: column; gap: 4px; }
  .cmtpop textarea { width: 100%; font: inherit; font-size: 13px; resize: vertical; box-sizing: border-box; }
  .cmtpop .hint { align-self: flex-end; font-size: 11px; }
  .cmttag { color: var(--accent-ink); margin-left: 8px; display: inline-flex; vertical-align: -2px; cursor: help; }
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
  .previewpick { font-size: 12px; color: var(--muted); background: transparent; border-color: transparent; padding: 3px 6px; min-width: 0; }
  .previewpick:hover { border-color: var(--line); color: var(--text); }
  .preview { width: 100%; border-radius: 8px; overflow: hidden; background: #000; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1); }
  .nowline { display: flex; gap: 10px; align-items: baseline; padding: 10px 16px 0; min-height: 30px; }
  .vpos { color: var(--accent-ink); font-weight: 600; }
  /* Columns MUST shrink: translated labels are longer than the English ones. */
  .transport { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px 14px 14px; container-type: inline-size; }
  .big { padding: 12px 8px; font-size: 15px; font-weight: 600; border-radius: var(--radius); min-width: 0; white-space: nowrap; overflow: hidden; gap: 6px; }
  @container (max-width: 380px) { .big kbd { display: none; } }
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
