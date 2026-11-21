<script lang="ts">
  import { t } from '../shared/i18n.svelte';
  import { connect } from '../shared/ws';
  import { slideKeys, verseLabel } from '../shared/slides';
  import type { AppState, SongSummary } from '../shared/types';

  let st = $state<AppState | null>(null);
  let online = $state(false);
  let songs = $state<SongSummary[]>([]);
  const link = connect(
    (s) => (st = s),
    (ok) => (online = ok),
  );
  fetch('/api/songs')
    .then((r) => r.json())
    .then((x) => (songs = x));

  let lang = $derived(st?.profiles[0]?.languages[0] ?? 'pl');
  let song = $derived(st?.liveSong ?? null);
  let keys = $derived(slideKeys(song));
  let off = $derived(new Set(song ? (st?.disabled[song.id] ?? []) : []));
  let idx = $derived(st?.live.slideIndex ?? 0);
  let nextIdx = $derived(keys.findIndex((_, i) => i > idx && !off.has(i)));
  const lines = (k: string | undefined) => (song && k ? (song.lyrics[lang]?.[k] ?? Object.values(song.lyrics).find((l) => l[k])?.[k] ?? []) : []);
  const title = (id: string) => {
    const s = songs.find((x) => x.id === id);
    return s ? `${s.collectionKey} ${s.number ?? ''} · ${s.title[lang] ?? Object.values(s.title)[0] ?? ''}` : id;
  };

  let notes = $derived(song ? (st?.notes?.[song.id] ?? {}) : {});
  let numberBox = $state('');
  function go(e: Event) {
    e.preventDefault();
    // "DP112", "dp 112" or "km53" pick the collection. A bare number stays in the live song's collection.
    const m = numberBox.trim().match(/^([^\d\s]*)\s*(\d+)$/);
    const key = m?.[1] || song?.collectionKey || songs[0]?.collectionKey;
    if (m && key) link.send('goNumber', { collectionKey: key, number: m[2] });
    numberBox = '';
  }
</script>

<main>
  <header>
    <span class="dot" class:ok={online}></span>
    <strong class="grow">{song ? `${song.collectionKey} ${song.number ?? ''}` : t('Nothing live')}</strong>
    {#if song && keys[idx]}<span class="pos">{verseLabel(keys[idx])}</span>{/if}
  </header>

  <section class="now" class:blank={st?.live.blank}>
    {#if st?.live.blank}<div class="tag">{t("Blanked")}</div>{/if}
    {#if notes[keys[idx]]?.text}<div class="note">{notes[keys[idx]].text}</div>{/if}
    {#each lines(keys[idx]) as l, n}<div>{#if notes[keys[idx]]?.marks?.[n]}<span class="mark">{notes[keys[idx]].marks[n]}</span>{/if}{l}</div>{:else}<div class="muted">{t("Pick a song below.")}</div>{/each}
  </section>

  {#if nextIdx !== -1}
    <section class="next">
      <div class="tag muted">{t("Next ·")} {verseLabel(keys[nextIdx])}</div>
      <div class="clip">{lines(keys[nextIdx])[0] ?? ''}…</div>
    </section>
  {/if}

  <div class="transport">
    <button aria-label={t("Previous verse")} onclick={() => link.send('step', { delta: -1 })}>{t("‹ Prev")}</button>
    <button class="next-btn" aria-label={t("Next verse")} onclick={() => link.send('step', { delta: 1 })}>{t("Next ›")}</button>
  </div>
  <div class="row">
    <button class="blank-btn" class:on={st?.live.blank} onclick={() => link.send('blank', {})}>{st?.live.blank ? t('Show') : t('Blank')}</button>
    <form onsubmit={go} class="row grow">
      <input autocapitalize="characters" autocomplete="off" placeholder={t("DP112 or 112")} bind:value={numberBox} aria-label={t("Song number")} />
      <button type="submit">{t("Go")}</button>
    </form>
  </div>

  {#if st?.setlist.length}
    <h2>{st.setlistName || t('Setlist')}</h2>
    <ul>
      {#each st.setlist as id (id)}
        <li>
          <button class:live={st.live.songId === id} onclick={() => link.send('setLive', { songId: id })}>{title(id)}</button>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  :global(html, body) {
    margin: 0;
    background: #1f1e1b;
    color: #f2efe8;
    font: 16px/1.45 'Inter Variable', system-ui, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }
  main {
    max-width: 520px;
    margin: 0 auto;
    padding: max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  header { display: flex; align-items: center; gap: 10px; font-size: 18px; }
  .grow { flex: 1; min-width: 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #d6343c; }
  .dot.ok { background: #3fb950; }
  .pos { color: #cfcfcf; font-weight: 700; }
  .now { background: #2a2824; border-radius: 14px; padding: 16px; font-size: 19px; min-height: 120px; }
  .now.blank { opacity: 0.5; }
  .next { background: #2a2824; border-radius: 14px; padding: 12px 16px; color: #a9a397; }
  .clip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #cfcfcf; margin-bottom: 4px; }
  .muted { color: #8f897f; }
  .note { font-size: 14px; font-style: italic; color: #cfcfcf; margin-bottom: 6px; }
  .mark { font-size: 11px; font-weight: 700; text-transform: uppercase; background: #cfcfcf; color: #1f1e1b; border-radius: 4px; padding: 1px 5px; margin-right: 8px; vertical-align: 2px; }
  .transport { display: grid; grid-template-columns: 1fr 1.6fr; gap: 10px; }
  button {
    font: inherit;
    font-weight: 600;
    color: #f2efe8;
    background: #34312c;
    border: none;
    border-radius: 14px;
    padding: 16px;
    touch-action: manipulation;
  }
  button:active { transform: scale(0.98); }
  .transport button { font-size: 22px; padding: 28px 16px; }
  .next-btn { background: #cfcfcf; color: #1f1e1b; }
  .blank-btn.on { background: #d6343c; color: #fff; }
  .row { display: flex; gap: 10px; }
  input { font: inherit; font-size: 18px; width: 100%; min-width: 0; background: #2a2824; color: #f2efe8; border: 1px solid #45413a; border-radius: 14px; padding: 12px 14px; }
  h2 { font-size: 14px; color: #a9a397; margin: 8px 0 0; }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  li button { width: 100%; text-align: left; font-weight: 500; padding: 14px 16px; }
  li button.live { background: #4a2a2b; color: #ffb3b6; }
</style>
