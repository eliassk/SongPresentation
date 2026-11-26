<script lang="ts">
  import { t } from '../shared/i18n.svelte';
  import { app, getSong, saveSong, deleteSong, songName } from './store.svelte';
  import { parseLyrics, formatLyrics } from '../shared/slides';
  import type { Song, SongHeader } from '../shared/types';
  import StImport from './StImport.svelte';

  let langs = $derived(app.state!.languages);
  let q = $state('');
  let collections = $derived.by(() => {
    const m = new Map<string, string>();
    for (const s of app.songs) if (!m.has(s.collectionKey)) m.set(s.collectionKey, s.collection || s.collectionKey);
    return [...m].map(([key, name]) => ({ key, name }));
  });
  let collection = $state('');
  let filtered = $derived(
    app.songs.filter((s) => !s.medley && (!collection || s.collectionKey === collection) && (!q || s.search.includes(q.toLowerCase()))),
  );
  let primary = $derived(app.state!.profiles[0]?.languages[0] ?? 'pl');

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
    header: SongHeader;
    title: Record<string, string>;
    text: Record<string, string>;
  }
  let draft = $state<Draft | null>(null);
  // Fields the editor does not show (source, remoteUpdatedAt) MUST survive a save.
  let original: Song | null = null;
  let msg = $state('');

  async function edit(id: string) {
    const s = await getSong(id);
    original = s;
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
      header: s.header ?? 'full',
      title: { ...s.title },
      text: Object.fromEntries(langs.map((l) => [l.code, formatLyrics(s, l.code)])),
    };
    msg = '';
  }

  function newSong() {
    original = null;
    draft = { number: '', collection: '', collectionKey: '', author: '', year: '', composer: '', copyright: '', key: '', header: 'full', title: {}, text: {} };
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
      ...(original ?? {}),
      id: draft.id ?? '',
      number: draft.number ? Number(draft.number) : null,
      collection: draft.collection,
      collectionKey: draft.collectionKey || draft.collection,
      author: draft.author,
      year: draft.year ? Number(draft.year) : null,
      composer: draft.composer,
      copyright: draft.copyright,
      key: draft.key,
      header: draft.header,
      title: Object.fromEntries(Object.entries(draft.title).filter(([, v]) => v)),
      order,
      lyrics,
    };
    const saved = await saveSong(song);
    original = saved;
    draft.id = saved.id;
    msg = t('Saved.');
  }

  async function remove() {
    if (!draft?.id || !confirm(t('Delete this song?'))) return;
    await deleteSong(draft.id);
    draft = null;
  }
</script>

<div class="songs">
  <section class="col side">
    <div class="card pad"><StImport /></div>

    <div class="card libcard">
      <div class="filters">
        <select bind:value={collection} aria-label={t("Collection")}>
          <option value="">{t("All collections (")}{app.songs.length})</option>
          {#each collections as c (c.key)}<option value={c.key}>{c.name} · {c.key}</option>{/each}
        </select>
        <div class="row">
          <input class="grow" placeholder={t("Filter by number, title or line")} bind:value={q} aria-label={t("Filter songs")} />
          <button class="primary" onclick={newSong}>{t("New song")}</button>
        </div>
      </div>
      <div class="list">
        {#each filtered as s (s.id)}
          <button class="item" class:sel={draft?.id === s.id} onclick={() => edit(s.id)}>
            <span class="k">{s.collectionKey}</span>
            <span class="n num">{s.number ?? ''}</span>
            <span class="t">{s.title[primary] ?? Object.values(s.title)[0] ?? '(untitled)'}</span>
          </button>
        {:else}
          <p class="empty">{t("No songs match.")}</p>
        {/each}
      </div>
    </div>
  </section>

  <section class="col">
    {#if draft}
      <div class="card editor">
        <div class="meta">
          <label>{t("Number")} <input class="num" bind:value={draft.number} /></label>
          <label>{t("Collection")} <input bind:value={draft.collection} /></label>
          <label>{t("Code")} <input bind:value={draft.collectionKey} placeholder=DP /></label>
          <label>{t("Key")} <input bind:value={draft.key} /></label>
          <label>{t("Author")} <input bind:value={draft.author} /></label>
          <label>{t("Year")} <input class="num" bind:value={draft.year} /></label>
          <label>{t("Composer")} <input bind:value={draft.composer} /></label>
          <label>Text © <input bind:value={draft.copyright} /></label>
          <label>{t("Header on screen")}
            <select bind:value={draft.header}>
              <option value="full">{t("Full (number, title, credits)")}</option>
              <option value="title">{t("Title only")}</option>
              <option value="none">{t("None, lyrics only")}</option>
            </select>
          </label>
        </div>
        <p class="muted small">
          {t("Start each part with")} <code>[1]</code>, <code>[2]</code>, <code>[c]</code> {t("(chorus),")} <code>[b]</code> {t("(bridge).")}
          {t("Repeat")} <code>[c]</code> {t("on its own line to repeat the chorus. Matching keys line up across languages.")}
        </p>
        <div class="langs" style:grid-template-columns="repeat({Math.min(langs.length, 3)}, 1fr)">
          {#each langs as l (l.code)}
            <div class="lang">
              <label>{t("Title ·")} {l.name} <input bind:value={draft.title[l.code]} /></label>
              <textarea rows="20" bind:value={draft.text[l.code]} placeholder="[1]&#10;First line&#10;Second line"></textarea>
            </div>
          {/each}
        </div>
        <div class="row actions">
          <button class="primary" onclick={save}>{t("Save song")}</button>
          {#if draft.id}<button class="danger" onclick={remove}>{t("Delete")}</button>{/if}
          <span class="muted">{msg}</span>
        </div>
      </div>
    {:else}
      <div class="card welcome">
        <h1>{t("Song library")}</h1>
        <p class="muted">{t("Pick a song on the left to edit its text, or create a new one. Songs from SongTreasures update with Check for updates.")}</p>
      </div>
    {/if}
  </section>
</div>

<style>
  .songs { height: 100%; display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px; padding: 16px; }
  .col { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding: 2px; }
  .side { overflow: hidden; }
  .side > .card { flex-shrink: 0; }
  .pad { padding: 14px 16px; }
  .libcard { flex: 1 1 0 !important; flex-shrink: 1 !important; min-height: 220px; display: flex; flex-direction: column; overflow: hidden; }
  .filters { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-bottom: 1px solid var(--line); }
  .list { flex: 1; overflow: auto; padding: 6px; display: flex; flex-direction: column; }
  .item { justify-content: flex-start; gap: 10px; background: transparent; border-color: transparent; padding: 6px 8px; font-weight: 400; text-align: left; border-radius: 8px; flex-shrink: 0; }
  .item:hover { background: var(--panel-2); border-color: transparent; }
  .item.sel { background: var(--accent-soft); }
  .item .k { color: var(--accent-ink); font-size: 11px; font-weight: 600; min-width: 3em; }
  .item .n { color: var(--muted); min-width: 2.4em; text-align: right; font-size: 13px; }
  .item .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .empty { color: var(--muted); padding: 12px; margin: 0; }
  .editor { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
  .meta { display: grid; grid-template-columns: 90px 1fr 90px 80px; gap: 10px; }
  label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 500; color: var(--text-2); }
  .langs { display: grid; gap: 14px; }
  .lang { display: flex; flex-direction: column; gap: 8px; }
  .small { font-size: 12px; margin: 0; line-height: 1.6; }
  code { color: var(--accent-ink); font-weight: 600; }
  .actions { padding-top: 4px; }
  .welcome { padding: 40px 36px; }
  .welcome h1 { margin: 0 0 8px; font-size: 24px; letter-spacing: -0.015em; }
  .welcome p { margin: 0; max-width: 52ch; line-height: 1.6; }
</style>
