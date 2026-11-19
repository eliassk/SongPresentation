<script lang="ts">
  import { app } from './store.svelte';

  interface Col { id: string; key: string; name: string; languages: string[] }

  let available = $state(false);
  let collections = $state<Col[]>([]);
  let picked = $state<Record<string, boolean>>({});
  let langs = $state<Record<string, boolean>>({ pl: true, no: true });
  let busy = $state(false);
  let checking = $state(false);
  let error = $state('');
  let status = $derived(app.state!.importStatus);

  fetch('/api/st/status')
    .then((r) => r.json())
    .then((s) => {
      available = s.available;
      if (s.available) checkSignedIn();
    });

  async function api(path: string, body?: unknown) {
    const res = await fetch('/api/st/' + path, body !== undefined ? { method: 'POST', body: JSON.stringify(body) } : undefined);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Request failed');
    return json;
  }

  async function loadCollections(showErrors = true) {
    error = '';
    try {
      collections = await api('collections');
    } catch (e) {
      if (showErrors) error = (e as Error).message;
    }
  }

  async function checkSignedIn() {
    checking = true;
    await loadCollections(false);
    checking = false;
  }

  async function signIn() {
    busy = true;
    error = '';
    try {
      await api('login', {});
      await loadCollections();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function resync() {
    error = '';
    try {
      await api('resync', {});
    } catch (e) {
      error = (e as Error).message;
    }
  }
  let cfg = $derived(app.state!.stImport);

  async function startImport() {
    error = '';
    try {
      await api('import', {
        collections: collections.filter((c) => picked[c.id]),
        // Primary first: it sets titles and collection codes.
        languages: offered.filter((l) => langs[l]).sort((a, b) => rank(a) - rank(b)),
        languageNames: Object.fromEntries(offered.map((l) => [l, langName(l)])),
      });
    } catch (e) {
      error = (e as Error).message;
    }
  }

  let anyPicked = $derived(collections.some((c) => picked[c.id]));

  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  const langName = (code: string) => {
    try {
      return names.of(code.replace('_', '-')) ?? code;
    } catch {
      return code;
    }
  };
  let offered = $derived(
    [...new Set(collections.filter((c) => picked[c.id]).flatMap((c) => c.languages))].sort((a, b) =>
      langName(a).localeCompare(langName(b)),
    ),
  );
  const rank = (l: string) => {
    const i = app.state!.languages.findIndex((x) => x.code === l);
    return i === -1 ? 99 : i;
  };
  function selectAll(on: boolean) {
    for (const l of offered) langs[l] = on;
  }
</script>

<div class="st">
  <h2 class="nomargin">SongTreasures</h2>
  {#if available && (cfg?.collections.length || app.songs.some((x) => x.id.startsWith('st:')))}
    <div class="sync">
      <button class="primary" disabled={status.running} onclick={resync}>{status.running ? 'Working…' : 'Check for updates'}</button>
      <p class="muted small">
        {#if cfg}{cfg.collections.map((c) => c.name).join(', ')} · {cfg.languages.join(', ').toUpperCase()}{:else}Imported collections{/if}
        {#if cfg?.lastSync}<br />Last checked {new Date(cfg.lastSync).toLocaleString()}{/if}
      </p>
    </div>
  {/if}
  {#if !available}
    <p class="muted small">Available in the desktop app.</p>
  {:else if !collections.length}
    {#if checking && !busy}<p class="muted small">Checking for an existing SongTreasures session…</p>{/if}
    <button class="primary" disabled={busy} onclick={signIn}>{busy ? 'Waiting for sign-in…' : 'Sign in to SongTreasures'}</button>
    {#if busy}<button onclick={() => fetch('/api/st/cancel', { method: 'POST' })}>Cancel</button>{/if}
    <p class="muted small">A SongTreasures window opens on top. Sign in there; it closes by itself.</p>
  {:else}
    <div class="cols">
      {#each collections as c (c.id)}
        <label><input type="checkbox" bind:checked={picked[c.id]} /> {c.name} {#if c.key}<span class="muted">({c.key})</span>{/if}</label>
      {/each}
    </div>
    {#if offered.length}
      <div class="row">
        <strong class="small grow">Languages</strong>
        <button class="link" onclick={() => selectAll(true)}>Select all</button>
        <button class="link" onclick={() => selectAll(false)}>None</button>
      </div>
      <div class="langs">
        {#each offered as l (l)}
          <label><input type="checkbox" bind:checked={langs[l]} /> {langName(l)} <span class="muted">{l}</span></label>
        {/each}
      </div>
      <p class="muted small">The first ticked language in your display profile sets titles and collection codes. Importing all languages takes longer.</p>
    {/if}
    <button class="primary" disabled={!anyPicked || status.running} onclick={startImport}>
      {status.running ? 'Importing…' : 'Import selected'}
    </button>
  {/if}

  {#if status.running || status.message}
    <progress max={status.total || 1} value={status.done}></progress>
    <p class="small">{status.message}</p>
  {/if}
  {#if error || status.error}<p class="small err">{error || status.error}</p>{/if}
</div>

<style>
  .nomargin { margin: 0; }
  .sync { display: flex; flex-direction: column; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  .st { display: flex; flex-direction: column; gap: 8px; }
  .cols { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow: auto; }
  label { display: flex; gap: 6px; align-items: center; font-size: 13px; }
  .small { font-size: 12px; margin: 0; }
  .err { color: var(--live); }
  progress { width: 100%; }
  .langs { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }
  .link { background: none; border: none; color: var(--accent); padding: 0 4px; font-size: 12px; }
</style>
