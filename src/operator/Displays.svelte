<script lang="ts">
  import { untrack } from 'svelte';
  import { app, link, displayUrls } from './store.svelte';
  import Stage from '../display/Stage.svelte';
  import { defaultLangStyle } from '../shared/slides';
  import type { Profile, Song } from '../shared/types';

  let st = $derived(app.state!);
  let selectedId = $state(untrack(() => app.state!.profiles[0].id));
  let draft = $state<Profile | null>(null);

  // Load a fresh copy when the selection changes. Server echoes MUST NOT overwrite the draft mid-edit.
  $effect(() => {
    const id = selectedId;
    const p = untrack(() => st.profiles.find((x) => x.id === id) ?? st.profiles[0]);
    draft = structuredClone($state.snapshot(p));
    if (p.id !== id) selectedId = p.id;
  });

  // Push every edit live to all displays.
  $effect(() => {
    if (!draft) return;
    const snap = $state.snapshot(draft);
    for (const l of snap.languages) snap.text.perLanguage[l] ??= defaultLangStyle();
    link.send('profileUpdate', { profile: snap });
  });

  const sample: Song = {
    id: 'sample',
    number: 123,
    title: { pl: 'Przykładowa pieśń', no: 'Eksempelsang' },
    order: ['1'],
    lyrics: {
      pl: { 1: ['To jest przykładowa zwrotka,', 'aby sprawdzić wygląd ekranu,', 'rozmiar tekstu i kolory.'] },
      no: { 1: ['Dette er et eksempelvers', 'for å sjekke skjermens utseende,', 'tekststørrelse og farger.'] },
    },
  };
  let previewSong = $derived(st.liveSong ?? sample);

  function toggleLang(code: string) {
    if (!draft) return;
    draft.languages = draft.languages.includes(code)
      ? draft.languages.filter((l) => l !== code)
      : [...draft.languages, code];
    draft.text.perLanguage[code] ??= defaultLangStyle();
  }
  function moveLang(i: number, d: number) {
    if (!draft) return;
    const a = [...draft.languages];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    draft.languages = a;
  }

  let newCode = $state('');
  let newName = $state('');
  function addLanguage() {
    const code = newCode.trim().toLowerCase();
    if (!code || st.languages.some((l) => l.code === code)) return;
    link.send('languagesSet', { languages: [...st.languages, { code, name: newName.trim() || code }] });
    newCode = newName = '';
  }

  const langName = (c: string) => st.languages.find((l) => l.code === c)?.name ?? c;
  const fonts = [
    "'Inter Variable', 'Segoe UI', Arial, sans-serif",
    'Segoe UI, Arial, sans-serif',
    'Arial, sans-serif',
    'Verdana, sans-serif',
    'Tahoma, sans-serif',
    'Georgia, serif',
    'Times New Roman, serif',
    'Calibri, Arial, sans-serif',
  ];

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }
</script>

<div class="displays">
  <section class="col side">
    <h2>Display profiles</h2>
    {#each st.profiles as p (p.id)}
      <button class="name" class:sel={p.id === selectedId} onclick={() => (selectedId = p.id)}>
        {p.name} <span class="muted">{p.width}×{p.height}</span>
      </button>
    {/each}
    <div class="row">
      <button onclick={() => link.send('profileAdd', { fromId: selectedId })}>Duplicate</button>
      <button
        class="danger"
        disabled={st.profiles.length < 2}
        onclick={() => confirm('Delete this display profile?') && link.send('profileDelete', { id: selectedId })}
      >Delete</button>
    </div>

    <h2>Languages</h2>
    {#each st.languages as l (l.code)}
      <div class="muted">{l.code} · {l.name}</div>
    {/each}
    <div class="row">
      <input style="width:60px" placeholder="en" bind:value={newCode} />
      <input class="grow" placeholder="English" bind:value={newName} />
      <button onclick={addLanguage}>Add</button>
    </div>
  </section>

  {#if draft}
    <section class="col form">
      <fieldset>
        <legend>General</legend>
        <label>Name <input bind:value={draft.name} /></label>
        <div class="row">
          <label>Width <input type="number" bind:value={draft.width} /></label>
          <label>Height <input type="number" bind:value={draft.height} /></label>
        </div>
        <div class="urls">
          {#each displayUrls(draft.id) as u}
            <div class="row"><code class="grow">{u}</code><button onclick={() => copy(u)}>Copy</button></div>
          {/each}
          <p class="muted small">Add as an OBS Browser Source at {draft.width}×{draft.height}. Turn off "Shutdown source when not visible".</p>
        </div>
      </fieldset>

      <fieldset>
        <legend>Languages (order = columns)</legend>
        {#each draft.languages as code, i (code)}
          {@const s = draft.text.perLanguage[code] ?? defaultLangStyle()}
          <div class="langrow">
            <strong>{langName(code)}</strong>
            <button onclick={() => moveLang(i, -1)}>↑</button>
            <button onclick={() => moveLang(i, 1)}>↓</button>
            <button onclick={() => toggleLang(code)}>Remove</button>
          </div>
          {#if draft.text.perLanguage[code]}
            <div class="row indent">
              <input type="color" bind:value={draft.text.perLanguage[code].color} />
              <label class="inline"><input type="checkbox" bind:checked={draft.text.perLanguage[code].italic} /> Italic</label>
              <label class="inline">Scale <input type="range" min="0.5" max="1.5" step="0.05" bind:value={draft.text.perLanguage[code].scale} /> {s.scale}</label>
              <label class="inline">Weight
                <select bind:value={draft.text.perLanguage[code].weight}>
                  {#each [300, 400, 500, 600, 700, 800] as w}<option value={w}>{w}</option>{/each}
                </select>
              </label>
            </div>
          {/if}
        {/each}
        <div class="row">
          {#each st.languages.filter((l) => !draft!.languages.includes(l.code)) as l}
            <button onclick={() => toggleLang(l.code)}>+ {l.name}</button>
          {/each}
        </div>
        <label class="inline">
          Missing translation
          <select bind:value={draft.missingLanguage}>
            <option value="fallbackSingle">Show available language only</option>
            <option value="empty">Keep empty column</option>
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Layout</legend>
        <div class="row">
          <label>Mode
            <select bind:value={draft.layout.mode}>
              <option value="columns">Side by side</option>
              <option value="stacked">Stacked</option>
            </select>
          </label>
          <label>Vertical
            <select bind:value={draft.layout.align}>
              <option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option>
            </select>
          </label>
          <label>Text align
            <select bind:value={draft.layout.textAlign}>
              <option value="left">Left</option><option value="center">Center</option>
            </select>
          </label>
        </div>
        <label>Split (first column) {Math.round(draft.layout.ratio * 100)}%
          <input type="range" min="0.25" max="0.75" step="0.01" bind:value={draft.layout.ratio} /></label>
        <label>Padding {draft.layout.padding}px <input type="range" min="0" max="300" bind:value={draft.layout.padding} /></label>
        <label>Gap {draft.layout.gap}px <input type="range" min="0" max="300" bind:value={draft.layout.gap} /></label>
        <div class="row">
          <label class="inline"><input type="checkbox" bind:checked={draft.layout.divider} /> Divider</label>
          <input type="color" value={draft.layout.dividerColor.slice(0, 7)} oninput={(e) => (draft!.layout.dividerColor = e.currentTarget.value + '55')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Text</legend>
        <label>Font
          <select bind:value={draft.text.font}>
            {#each fonts as f}<option value={f}>{f.split(',')[0]}</option>{/each}
          </select>
        </label>
        <label class="inline"><input type="checkbox" bind:checked={draft.text.autoFit} /> Auto-fit text to screen</label>
        {#if draft.text.autoFit}
          <label>Max size {draft.text.maxSize}px <input type="range" min="20" max="240" bind:value={draft.text.maxSize} /></label>
          <label>Min size {draft.text.minSize}px <input type="range" min="8" max="80" bind:value={draft.text.minSize} /></label>
        {:else}
          <label>Size {draft.text.size}px <input type="range" min="12" max="240" bind:value={draft.text.size} /></label>
        {/if}
        <label>Line height {draft.text.lineHeight} <input type="range" min="0.9" max="2" step="0.05" bind:value={draft.text.lineHeight} /></label>
        <div class="row">
          <label class="inline"><input type="checkbox" bind:checked={draft.text.shadow} /> Shadow</label>
          <label class="inline"><input type="checkbox" bind:checked={draft.showVerseLabel} /> Verse label</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Header</legend>
        <div class="row wrap">
          <label class="inline"><input type="checkbox" bind:checked={draft.header.show} /> Show</label>
          <label class="inline"><input type="checkbox" bind:checked={draft.header.showCollection} /> Collection code</label>
          <label class="inline"><input type="checkbox" bind:checked={draft.header.showNumber} /> Number</label>
          <label class="inline"><input type="checkbox" bind:checked={draft.header.showTitle} /> Title</label>
          <label class="inline"><input type="checkbox" bind:checked={draft.header.showCredits} /> Credits</label>
          <label class="inline"><input type="checkbox" bind:checked={draft.header.rule} /> Line</label>
        </div>
        <div class="row">
          <label class="inline">Text <input type="color" bind:value={draft.header.color} /></label>
          <label class="inline">Line <input type="color" value={draft.header.ruleColor.slice(0, 7)} oninput={(e) => (draft!.header.ruleColor = e.currentTarget.value + '66')} /></label>
        </div>
        <label>Number size {draft.header.numberSize}px <input type="range" min="40" max="300" bind:value={draft.header.numberSize} /></label>
        <label>Credits size {draft.header.creditsSize}px <input type="range" min="14" max="80" bind:value={draft.header.creditsSize} /></label>
      </fieldset>

      <fieldset>
        <legend>Background &amp; transition</legend>
        <div class="row">
          <select bind:value={draft.background.type}>
            <option value="transparent">Transparent (OBS overlay)</option>
            <option value="color">Solid colour</option>
          </select>
          {#if draft.background.type === 'color'}<input type="color" bind:value={draft.background.color} />{/if}
        </div>
        <label>Fade {draft.transitionMs}ms <input type="range" min="0" max="1500" step="50" bind:value={draft.transitionMs} /></label>
      </fieldset>
    </section>

    <section class="col previewcol">
      <h2>Preview · {draft.width}×{draft.height} {st.liveSong ? '(live song)' : '(sample)'}</h2>
      <div class="preview" style:aspect-ratio="{draft.width} / {draft.height}">
        <Stage profile={draft} song={previewSong} slideIndex={st.liveSong ? st.live.slideIndex : 0} checker />
      </div>
      <p class="muted small">Changes go live to every screen showing this profile.</p>
    </section>
  {/if}
</div>

<style>
  .displays { height: 100%; display: grid; grid-template-columns: 260px 400px 1fr; background: var(--panel); }
  .col { padding: 12px; overflow: auto; display: flex; flex-direction: column; gap: 10px; border-right: 1px solid var(--line); }
  .name { text-align: left; background: transparent; border-color: transparent; padding: 6px 8px; }
  .name.sel { background: var(--panel-2); border-color: var(--line); }
  fieldset { border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; margin: 0; }
  legend { color: var(--accent); font-size: 12px; padding: 0 4px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
  label.inline { flex-direction: row; align-items: center; gap: 6px; }
  .row label { flex: 1; }
  .row label.inline { flex: none; }
  .langrow { display: flex; gap: 6px; align-items: center; }
  .langrow strong { flex: 1; }
  .langrow button { padding: 2px 8px; }
  .indent { padding-left: 8px; flex-wrap: wrap; }
  .wrap { flex-wrap: wrap; }
  .urls code { font-size: 12px; color: var(--accent); word-break: break-all; }
  .urls button { padding: 2px 8px; }
  .preview { width: 100%; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; background: #000; }
  .small { font-size: 12px; margin: 0; }
</style>
