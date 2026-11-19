<script lang="ts">
  import { app, getSong, saveSong, deleteSong, songName } from './store.svelte';
  import { parseLyrics, formatLyrics } from '../shared/slides';
  import type { Song } from '../shared/types';
  import StImport from './StImport.svelte';

  let langs = $derived(app.state!.languages);
  let q = $state('');
  let filtered = $derived(app.songs.filter((s) => !q || s.search.includes(q.toLowerCase())));

  interface Draft {
    id?: string;
    number: string;
    collection: string;
    collectionKey: string;
    author: string;
    year: string;
    composer: string;
    copyright: string;
    key: string;
    title: Record<string, string>;
    text: Record<string, string>;
  }
  let draft = $state<Draft | null>(null);
  let msg = $state('');

  async function edit(id: string) {
    const s = await getSong(id);
    draft = {
      id: s.id,
      number: s.number?.toString() ?? '',
      collection: s.collection ?? '',
      collectionKey: s.collectionKey ?? '',
      author: s.author ?? '',
      year: s.year?.toString() ?? '',
      composer: s.composer ?? '',
      copyright: s.copyright ?? '',
      key: s.key ?? '',
      title: { ...s.title },
      text: Object.fromEntries(langs.map((l) => [l.code, formatLyrics(s, l.code)])),
    };
    msg = '';
  }

  function newSong() {
    draft = { number: '', collection: '', collectionKey: '', author: '', year: '', composer: '', copyright: '', key: '', title: {}, text: {} };
    msg = '';
  }

  async function save() {
    if (!draft) return;
    const lyrics: Song['lyrics'] = {};
    let order: string[] = [];
    for (const l of langs) {
      const parsed = parseLyrics(draft.text[l.code] ?? '');
      if (!parsed.order.length) continue;
      lyrics[l.code] = parsed.verses;
      if (parsed.order.length > order.length) order = parsed.order;
    }
    const song: Song = {
      id: draft.id ?? '',
      number: draft.number ? Number(draft.number) : null,
      collection: draft.collection,
      collectionKey: draft.collectionKey || draft.collection,
      author: draft.author,
      year: draft.year ? Number(draft.year) : null,
      composer: draft.composer,
      copyright: draft.copyright,
      key: draft.key,
      title: Object.fromEntries(Object.entries(draft.title).filter(([, v]) => v)),
      order,
      lyrics,
    };
    const saved = await saveSong(song);
    draft.id = saved.id;
    msg = 'Saved.';
  }

  async function remove() {
    if (!draft?.id || !confirm('Delete this song?')) return;
    await deleteSong(draft.id);
    draft = null;
  }
</script>

<div class="songs">
  <section class="col">
    <div class="row">
      <input class="grow" placeholder="Filter…" bind:value={q} />
      <button class="primary" onclick={newSong}>New</button>
    </div>
    <div class="list">
      {#each filtered as s (s.id)}
        <button class="name" class:sel={draft?.id === s.id} onclick={() => edit(s.id)}>
          <span class="muted">{s.collection}</span> {songName(s)}
        </button>
      {/each}
    </div>
    <StImport />
  </section>

  <section class="col editor">
    {#if draft}
      <div class="meta">
        <label>Number <input bind:value={draft.number} /></label>
        <label>Collection <input bind:value={draft.collection} /></label>
        <label>Code <input bind:value={draft.collectionKey} placeholder="DP" /></label>
        <label>Key <input bind:value={draft.key} /></label>
        <label>Author <input bind:value={draft.author} /></label>
        <label>Year <input bind:value={draft.year} /></label>
        <label>Composer <input bind:value={draft.composer} /></label>
        <label>Text © <input bind:value={draft.copyright} /></label>
      </div>
      <p class="muted small">
        Start each part with <code>[1]</code>, <code>[2]</code>, <code>[c]</code> (chorus), <code>[b]</code> (bridge).
        Repeat <code>[c]</code> on its own line to repeat the chorus. Matching keys line up across languages.
      </p>
      <div class="langs" style:grid-template-columns="repeat({langs.length}, 1fr)">
        {#each langs as l (l.code)}
          <div class="lang">
            <label>Title ({l.name}) <input bind:value={draft.title[l.code]} /></label>
            <textarea rows="22" bind:value={draft.text[l.code]} placeholder="[1]&#10;First line&#10;Second line"></textarea>
          </div>
        {/each}
      </div>
      <div class="row">
        <button class="primary" onclick={save}>Save</button>
        {#if draft.id}<button class="danger" onclick={remove}>Delete</button>{/if}
        <span class="muted">{msg}</span>
      </div>
    {:else}
      <p class="muted">Select a song or create a new one.</p>
    {/if}
  </section>
</div>

<style>
  .songs { height: 100%; display: grid; grid-template-columns: 300px 1fr; background: var(--panel); }
  .col { padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 10px; border-right: 1px solid var(--line); }
  .list { display: flex; flex-direction: column; gap: 2px; }
  .name { text-align: left; background: transparent; border-color: transparent; padding: 4px 8px; }
  .name.sel { background: var(--panel-2); }
  .meta { display: grid; grid-template-columns: 100px 1fr 90px 80px; gap: 8px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  .langs { display: grid; gap: 12px; }
  .lang { display: flex; flex-direction: column; gap: 8px; }
  .small { font-size: 12px; margin: 0; }
  code { color: var(--accent); }
</style>
