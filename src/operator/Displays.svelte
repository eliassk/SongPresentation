<script lang="ts">
  import { t } from '../shared/i18n.svelte';
  import { untrack } from 'svelte';
  import { app, link, displayUrls } from './store.svelte';
  import Stage from '../display/Stage.svelte';
  import { defaultLangStyle } from '../shared/slides';
  import type { Profile, Song } from '../shared/types';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import Trash from '@lucide/svelte/icons/trash-2';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

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

  // A reset happens on the server. The draft MUST reload from it, or the old draft is pushed back.
  let pendingReset: string | null = null;
  function resetLayout() {
    if (!draft || !confirm(t('Reset this display to its default layout? Name is kept.'))) return;
    pendingReset = draft.id;
    link.send('profileReset', { id: draft.id });
  }
  $effect(() => {
    const profiles = st.profiles;
    untrack(() => {
      if (!pendingReset) return;
      const p = profiles.find((x) => x.id === pendingReset);
      if (p) draft = structuredClone($state.snapshot(p));
      pendingReset = null;
    });
  });

  // Direct manipulation in the preview. Drag distances are converted to canvas pixels.
  let previewEl = $state<HTMLDivElement>();
  type DragKind = 'numberSize' | 'creditsSize' | 'text' | 'move' | 'nw' | 'se';
  let drag: { kind: DragKind; x0: number; y0: number; start: number; area: Profile['area'] } | null = null;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  function beginDrag(kind: DragKind, e: PointerEvent) {
    if (!draft) return;
    e.preventDefault();
    e.stopPropagation();
    const textKey = draft.text.autoFit ? 'maxSize' : 'size';
    const start = kind === 'numberSize' ? draft.header.numberSize : kind === 'creditsSize' ? draft.header.creditsSize : draft.text[textKey];
    drag = { kind, x0: e.clientX, y0: e.clientY, start, area: { ...draft.area } };
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', endDrag, { once: true });
  }

  function onDrag(e: PointerEvent) {
    if (!drag || !draft || !previewEl) return;
    const scale = previewEl.getBoundingClientRect().width / draft.width;
    const dx = (e.clientX - drag.x0) / scale;
    const dy = (e.clientY - drag.y0) / scale;
    const px = (dx / draft.width) * 100;
    const py = (dy / draft.height) * 100;
    const grow = (dx - dy) * 0.25; // up or right grows
    const a = drag.area;
    switch (drag.kind) {
      case 'numberSize':
        draft.header.numberSize = Math.round(clamp(drag.start + grow, 30, 300));
        break;
      case 'creditsSize':
        draft.header.creditsSize = Math.round(clamp(drag.start + grow * 0.5, 12, 80));
        break;
      case 'text':
        draft.text[draft.text.autoFit ? 'maxSize' : 'size'] = Math.round(clamp(drag.start + grow * 0.5, 12, 240));
        break;
      case 'move':
        draft.area = { ...a, x: Math.round(clamp(a.x + px, 0, 100 - a.w)), y: Math.round(clamp(a.y + py, 0, 100 - a.h)) };
        break;
      case 'se':
        draft.area = { ...a, w: Math.round(clamp(a.w + px, 10, 100 - a.x)), h: Math.round(clamp(a.h + py, 10, 100 - a.y)) };
        break;
      case 'nw': {
        const x = Math.round(clamp(a.x + px, 0, a.x + a.w - 10));
        const y = Math.round(clamp(a.y + py, 0, a.y + a.h - 10));
        draft.area = { x, y, w: a.w + a.x - x, h: a.h + a.y - y };
        break;
      }
    }
  }

  function endDrag() {
    drag = null;
    window.removeEventListener('pointermove', onDrag);
  }

  // Elements inside the rendered display that can be dragged to resize.
  function onPreviewDown(e: PointerEvent) {
    if (draft?.mode === 'confidence') return;
    const t = e.target as HTMLElement;
    if (t.closest('.num, .ckey')) beginDrag('numberSize', e);
    else if (t.closest('.credits')) beginDrag('creditsSize', e);
    else if (t.closest('.body')) beginDrag('text', e);
  }

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

  let copied = $state('');
  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    copied = text;
    setTimeout(() => copied === text && (copied = ''), 1500);
  }

  // The singers' view ignores layout, header, area and background, so those tabs are hidden for it.
  let isConf = $derived(draft?.mode === 'confidence');
  let tabs = $derived(
    isConf
      ? (['Text', 'Screen'] as const)
      : (['Text', 'Languages', 'Layout', 'Header', 'Screen'] as const),
  );
  let tab = $state<string>('Text');
  $effect(() => {
    if (!(tabs as readonly string[]).includes(tab)) tab = 'Text';
  });
  const modeLabel = (p: Profile) => t(p.mode === 'confidence' ? 'Singers' : p.background.type === 'transparent' ? 'Overlay' : 'Audience');
</script>

<div class="displays">
  <!-- Profiles -->
  <aside class="side">
    <div class="sidehead">
      <h2>{t("Displays")}</h2>
      <button class="small" title={t("Duplicate the selected display")} onclick={() => link.send('profileAdd', { fromId: selectedId })}><Plus size={14} /> {t("New")}</button>
    </div>
    <div class="plist">
      {#each st.profiles as p (p.id)}
        <button class="pcard" class:sel={p.id === selectedId} onclick={() => (selectedId = p.id)}>
          <span class="pname">{p.name}</span>
          <span class="pmeta">
            <span class="badge" class:conf={p.mode === 'confidence'}>{modeLabel(p)}</span>
            <span class="num">{p.width}×{p.height}</span>
            <span>{p.languages.map((l) => l.toUpperCase()).join(' · ')}</span>
          </span>
        </button>
      {/each}
    </div>

    <details class="langs">
      <summary>{t("Languages")} <span class="muted">({st.languages.length})</span></summary>
      <div class="langlist">
        {#each st.languages as l (l.code)}<span class="pill"><b>{l.code.toUpperCase()}</b> {l.name}</span>{/each}
      </div>
      <div class="addlang">
        <input style="width:56px" placeholder=en bind:value={newCode} aria-label={t("Language code")} />
        <input class="grow" placeholder={t("English")} bind:value={newName} aria-label={t("Language name")} />
        <button onclick={addLanguage}>{t("Add")}</button>
      </div>
    </details>
  </aside>

  {#if draft}
    <section class="main">
      <!-- Identity -->
      <header class="bar">
        <input class="title" bind:value={draft.name} aria-label={t("Display name")} />
        <span class="badge" class:conf={isConf}>{modeLabel(draft)}</span>
        <span class="grow"></span>
        <button class="ghost" onclick={resetLayout}><RotateCcw size={14} /> {t("Reset")}</button>
        <button
          class="ghost danger"
          disabled={st.profiles.length < 2}
          onclick={() => confirm(t('Delete “{name}”?', { name: draft!.name })) && link.send('profileDelete', { id: selectedId })}
        ><Trash size={14} /> {t("Delete")}</button>
      </header>

      <div class="work">
        <!-- Preview -->
        <div class="previewcol">
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="preview editable" class:noarea={isConf} bind:this={previewEl} onpointerdown={onPreviewDown} style:aspect-ratio="{draft.width} / {draft.height}">
            <Stage
              profile={draft}
              song={previewSong}
              slideIndex={st.liveSong ? st.live.slideIndex : 0}
              disabled={st.liveSong ? (st.disabled[st.liveSong.id] ?? []) : []}
              notes={previewSong ? st.notes?.[previewSong.id] : undefined}
              checker
            />
            {#if !isConf}
              <div class="areaframe" style:left="{draft.area.x}%" style:top="{draft.area.y}%" style:width="{draft.area.w}%" style:height="{draft.area.h}%">
                <div class="grip" title={t("Drag to move the text area")} onpointerdown={(e) => beginDrag('move', e)}>{t("Text area")}</div>
                <div class="corner nw" title={t("Drag to resize")} onpointerdown={(e) => beginDrag('nw', e)}></div>
                <div class="corner se" title={t("Drag to resize")} onpointerdown={(e) => beginDrag('se', e)}></div>
              </div>
            {/if}
          </div>
          <p class="hint">
            {st.liveSong ? t('Showing the live song.') : t('Showing a sample song.')}
            {#if !isConf}{t("Drag the number, credits or lyrics to resize them. Drag the frame to move the text area.")}{/if}
            {t("Changes go live immediately.")}
          </p>

          <div class="links">
            <div class="linkshead">{t("Open on a screen or add to OBS as a Browser Source at")} {draft.width}×{draft.height}</div>
            {#each displayUrls(draft.id) as u}
              <div class="link">
                <code>{u}</code>
                <button class="icon" title={t("Copy")} aria-label="Copy {u}" onclick={() => copy(u)}>{#if copied === u}<Check size={14} />{:else}<Copy size={14} />{/if}</button>
              </div>
            {/each}
          </div>
        </div>

        <!-- Settings -->
        <div class="settings">
          <div class="tabs" role="tablist">
            {#each tabs as tb}
              <button role="tab" aria-selected={tab === tb} class:sel={tab === tb} onclick={() => (tab = tb)}>{t(tb)}</button>
            {/each}
          </div>

          <div class="panel">
            {#if tab === 'Text'}
              {#if isConf}
                <div class="group">
                  <h3>{t("Language")}</h3>
                  <div class="seg wide">
                    {#each st.languages as l (l.code)}
                      <button class:sel={draft.languages[0] === l.code} onclick={() => (draft!.languages = [l.code])}>{l.name}</button>
                    {/each}
                  </div>
                </div>
              {/if}
              <div class="group">
                <h3>{t("Font")}</h3>
                <div class="field"><span>{t("Typeface")}</span>
                  <select bind:value={draft.text.font}>{#each fonts as f}<option value={f}>{f.split(',')[0].replace(/'/g, '')}</option>{/each}</select>
                </div>
                <label class="check"><input type="checkbox" bind:checked={draft.text.autoFit} /> {t("Fit text to the screen")}</label>
                {#if draft.text.autoFit}
                  <label class="check"><input type="checkbox" bind:checked={draft.text.noWrap} /> {t("Keep each line on one line")} <small>{t("shrinks instead of wrapping")}</small></label>
                  <div class="field"><span>{t("Largest")}</span><input type="range" min="20" max="240" bind:value={draft.text.maxSize} /><output>{draft.text.maxSize}px</output></div>
                  <div class="field"><span>{t("Smallest")}</span><input type="range" min="8" max="80" bind:value={draft.text.minSize} /><output>{draft.text.minSize}px</output></div>
                {:else}
                  <div class="field"><span>{t("Size")}</span><input type="range" min="12" max="240" bind:value={draft.text.size} /><output>{draft.text.size}px</output></div>
                {/if}
                <div class="field"><span>{t("Line height")}</span><input type="range" min="0.9" max="2" step="0.05" bind:value={draft.text.lineHeight} /><output>{draft.text.lineHeight}</output></div>
              </div>
              <div class="group">
                <h3>{t("Show")}</h3>
                <label class="check"><input type="checkbox" bind:checked={draft.showVerseLabel} /> {t("Verse label")} <small>{t("1., Ref., Bridge")}</small></label>
                <label class="check"><input type="checkbox" bind:checked={draft.text.shadow} /> {t("Text shadow")}</label>
                <label class="check"><input type="checkbox" bind:checked={draft.showNotes} /> {t("Notes &amp; marks")} <small>{t("from Annotate: Solo, All…")}</small></label>
                {#if isConf}<label class="check"><input type="checkbox" bind:checked={draft.blankWithScreens} /> {t("Go black with Blank")} <small>{t("off: dims and shows a badge")}</small></label>{/if}
              </div>
            {:else if tab === 'Languages'}
              <div class="group">
                <h3>{t("Columns")} <small>{t("in order, left to right")}</small></h3>
                {#each draft.languages as code, i (code)}
                  {@const s = draft.text.perLanguage[code] ?? defaultLangStyle()}
                  <div class="lang">
                    <div class="langtop">
                      <span class="colnum">{i + 1}</span>
                      <strong class="grow">{langName(code)}</strong>
                      <button class="icon" aria-label={t("Move left")} disabled={i === 0} onclick={() => moveLang(i, -1)}><ArrowUp size={14} /></button>
                      <button class="icon" aria-label={t("Move right")} disabled={i === draft.languages.length - 1} onclick={() => moveLang(i, 1)}><ArrowDown size={14} /></button>
                      <button class="icon" aria-label="Remove {langName(code)}" disabled={draft.languages.length < 2} onclick={() => toggleLang(code)}><X size={14} /></button>
                    </div>
                    {#if draft.text.perLanguage[code]}
                      <div class="langstyle">
                        <input type="color" bind:value={draft.text.perLanguage[code].color} aria-label={t("Colour")} />
                        <select bind:value={draft.text.perLanguage[code].weight} aria-label={t("Weight")}>
                          {#each [300, 400, 500, 600, 700, 800] as w}<option value={w}>{t(({ 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Heavy' } as Record<number, string>)[w])}</option>{/each}
                        </select>
                        <label class="check"><input type="checkbox" bind:checked={draft.text.perLanguage[code].italic} /> {t("Italic")}</label>
                        <input class="grow" type="range" min="0.5" max="1.5" step="0.05" bind:value={draft.text.perLanguage[code].scale} aria-label={t("Scale")} />
                        <output>{Math.round(s.scale * 100)}%</output>
                      </div>
                    {/if}
                  </div>
                {/each}
                {#if st.languages.some((l) => !draft!.languages.includes(l.code))}
                  <div class="addrow">
                    {#each st.languages.filter((l) => !draft!.languages.includes(l.code)) as l}
                      <button class="small" onclick={() => toggleLang(l.code)}><Plus size={13} /> {l.name}</button>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="group">
                <h3>{t("Second column")}</h3>
                <label class="check">
                  <input type="checkbox" checked={!!draft.text.secondaryColor} onchange={(e) => (draft!.text.secondaryColor = e.currentTarget.checked ? '#cfcfcf' : '')} />
                  {t("Same colour for every column after the first")}
                  {#if draft.text.secondaryColor}<input type="color" bind:value={draft.text.secondaryColor} aria-label={t("Secondary colour")} />{/if}
                </label>
                <div class="field"><span>{t("No translation")}</span>
                  <select bind:value={draft.missingLanguage}>
                    <option value="fallbackSingle">{t("Show only the available language")}</option>
                    <option value="empty">{t("Keep an empty column")}</option>
                  </select>
                </div>
              </div>
            {:else if tab === 'Layout'}
              <div class="group">
                <h3>{t("Arrangement")}</h3>
                <div class="field"><span>{t("Languages")}</span>
                  <div class="seg">
                    <button class:sel={draft.layout.mode === 'columns'} onclick={() => (draft!.layout.mode = 'columns')}>{t("Side by side")}</button>
                    <button class:sel={draft.layout.mode === 'stacked'} onclick={() => (draft!.layout.mode = 'stacked')}>{t("Stacked")}</button>
                  </div>
                </div>
                <div class="field"><span>{t("Vertical")}</span>
                  <div class="seg">
                    {#each ['top', 'center', 'bottom'] as const as a}<button class:sel={draft.layout.align === a} onclick={() => (draft!.layout.align = a)}>{t(a[0].toUpperCase() + a.slice(1))}</button>{/each}
                  </div>
                </div>
                <div class="field"><span>{t("Text align")}</span>
                  <div class="seg">
                    <button class:sel={draft.layout.textAlign === 'left'} onclick={() => (draft!.layout.textAlign = 'left')}>{t("Left")}</button>
                    <button class:sel={draft.layout.textAlign === 'center'} onclick={() => (draft!.layout.textAlign = 'center')}>{t("Center")}</button>
                  </div>
                </div>
                {#if draft.layout.mode === 'columns'}
                  <div class="field"><span>{t("First column")}</span><input type="range" min="0.25" max="0.75" step="0.01" bind:value={draft.layout.ratio} /><output>{Math.round(draft.layout.ratio * 100)}%</output></div>
                {/if}
              </div>
              <div class="group">
                <h3>{t("Spacing")}</h3>
                <div class="field"><span>{t("Padding")}</span><input type="range" min="0" max="300" bind:value={draft.layout.padding} /><output>{draft.layout.padding}px</output></div>
                <div class="field"><span>{t("Gap")}</span><input type="range" min="0" max="300" bind:value={draft.layout.gap} /><output>{draft.layout.gap}px</output></div>
                <label class="check">
                  <input type="checkbox" bind:checked={draft.layout.divider} /> {t("Divider between languages")}
                  {#if draft.layout.divider}<input type="color" value={draft.layout.dividerColor.slice(0, 7)} oninput={(e) => (draft!.layout.dividerColor = e.currentTarget.value + '55')} aria-label={t("Divider colour")} />{/if}
                </label>
              </div>
              <div class="group">
                <h3>{t("Text area")} <small>{t("part of the screen used for text")}</small></h3>
                <div class="field"><span>{t("Top")}</span><input type="range" min="0" max="90" bind:value={draft.area.y} /><output>{draft.area.y}%</output></div>
                <div class="field"><span>{t("Height")}</span><input type="range" min="10" max={100 - draft.area.y} bind:value={draft.area.h} /><output>{draft.area.h}%</output></div>
                <div class="field"><span>{t("Left")}</span><input type="range" min="0" max="90" bind:value={draft.area.x} /><output>{draft.area.x}%</output></div>
                <div class="field"><span>{t("Width")}</span><input type="range" min="10" max={100 - draft.area.x} bind:value={draft.area.w} /><output>{draft.area.w}%</output></div>
                <div class="addrow">
                  <button class="small" onclick={() => (draft!.area = { x: 0, y: 0, w: 100, h: 100 })}>{t("Full screen")}</button>
                  <button class="small" onclick={() => (draft!.area = { x: 5, y: 4, w: 90, h: 60 })}>{t("Upper 60%")}</button>
                </div>
              </div>
            {:else if tab === 'Header'}
              <div class="group">
                <label class="check strong"><input type="checkbox" bind:checked={draft.header.show} /> {t("Show header")}</label>
              </div>
              {#if draft.header.show}
                <div class="group">
                  <h3>{t("Contents")}</h3>
                  <div class="chips">
                    <label class="check"><input type="checkbox" bind:checked={draft.header.showCollection} /> {t("Collection")}</label>
                    <label class="check"><input type="checkbox" bind:checked={draft.header.showNumber} /> {t("Number")}</label>
                    <label class="check"><input type="checkbox" bind:checked={draft.header.showTitle} /> {t("Title")}</label>
                    <label class="check"><input type="checkbox" bind:checked={draft.header.showCredits} /> {t("Credits")}</label>
                  </div>
                </div>
                <div class="group">
                  <h3>{t("Style")}</h3>
                  <div class="field"><span>{t("Number")}</span><input type="range" min="40" max="300" bind:value={draft.header.numberSize} /><output>{draft.header.numberSize}px</output></div>
                  <div class="field"><span>{t("Credits")}</span><input type="range" min="14" max="80" bind:value={draft.header.creditsSize} /><output>{draft.header.creditsSize}px</output></div>
                  <div class="field"><span>{t("Colour")}</span><input type="color" bind:value={draft.header.color} aria-label={t("Header colour")} /></div>
                  <label class="check">
                    <input type="checkbox" bind:checked={draft.header.rule} /> {t("Line under header")}
                    {#if draft.header.rule}<input type="color" value={draft.header.ruleColor.slice(0, 7)} oninput={(e) => (draft!.header.ruleColor = e.currentTarget.value + '66')} aria-label={t("Line colour")} />{/if}
                  </label>
                </div>
              {/if}
            {:else if tab === 'Screen'}
              <div class="group">
                <h3>{t("Resolution")}</h3>
                <div class="res">
                  <input type="number" bind:value={draft.width} aria-label={t("Width")} /><span>×</span><input type="number" bind:value={draft.height} aria-label={t("Height")} />
                </div>
                <div class="addrow">
                  {#each [[1920, 1080], [1280, 720], [3840, 2160], [1024, 768]] as [w, h]}
                    <button class="small" class:sel={draft.width === w && draft.height === h} onclick={() => { draft!.width = w; draft!.height = h; }}>{w}×{h}</button>
                  {/each}
                </div>
              </div>
              {#if !isConf}
                <div class="group">
                  <h3>{t("Background")}</h3>
                  <div class="seg wide">
                    <button class:sel={draft.background.type === 'transparent'} onclick={() => (draft!.background.type = 'transparent')}>{t("Transparent")} <small>{t("OBS overlay")}</small></button>
                    <button class:sel={draft.background.type === 'color'} onclick={() => (draft!.background.type = 'color')}>{t("Solid colour")}</button>
                  </div>
                  {#if draft.background.type === 'color'}<div class="field"><span>{t("Colour")}</span><input type="color" bind:value={draft.background.color} aria-label={t("Background colour")} /></div>{/if}
                </div>
                <div class="group">
                  <h3>{t("Transition")}</h3>
                  <div class="field"><span>{t("Fade")}</span><input type="range" min="0" max="1500" step="50" bind:value={draft.transitionMs} /><output>{draft.transitionMs}ms</output></div>
                </div>
              {/if}
              <p class="hint">{t("In OBS, turn off “Shutdown source when not visible” so the display stays connected.")}</p>
            {/if}
          </div>
        </div>
      </div>
    </section>
  {/if}
</div>

<style>
  .displays { height: 100%; display: grid; grid-template-columns: 260px minmax(0, 1fr); background: var(--bg); }

  /* Sidebar */
  .side { background: var(--panel); border-right: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
  .sidehead { display: flex; align-items: center; justify-content: space-between; padding: 14px 14px 8px; }
  .sidehead h2 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text-2); letter-spacing: 0.02em; }
  .plist { flex: 1; overflow: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 2px; }
  .pcard { display: flex; flex-direction: column; align-items: stretch; gap: 4px; text-align: left; background: transparent; border: 1px solid transparent; padding: 9px 10px; border-radius: var(--radius); }
  .pcard:hover { background: var(--panel-2); }
  .pcard.sel { background: var(--accent-soft); border-color: var(--accent-line); }
  .pname { font-weight: 600; font-size: 14px; color: var(--text); }
  .pmeta { display: flex; gap: 8px; align-items: center; font-size: 11.5px; color: var(--muted); }
  .num { font-variant-numeric: tabular-nums; }
  .badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent-ink); background: var(--accent-soft); border: 1px solid var(--accent-line); border-radius: 999px; padding: 1px 7px; }
  .badge.conf { color: #2d5f8a; background: #eaf2fa; border-color: #c7dbee; }

  .langs { border-top: 1px solid var(--line); padding: 10px 14px 14px; font-size: 13px; }
  .langs summary { cursor: pointer; font-weight: 600; color: var(--text-2); }
  .langlist { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0; }
  .pill { background: var(--panel-2); border-radius: 999px; padding: 2px 9px; font-size: 12px; color: var(--text-2); }
  .addlang { display: flex; gap: 6px; }
  .addlang input, .addlang button { font-size: 13px; padding: 4px 8px; }

  /* Main */
  .main { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
  .bar { display: flex; align-items: center; gap: 10px; padding: 12px 20px; background: var(--panel); border-bottom: 1px solid var(--line); }
  .bar .title { font-size: 18px; font-weight: 700; border-color: transparent; background: transparent; padding: 4px 8px; margin-left: -8px; min-width: 0; width: 22ch; }
  .bar .title:hover, .bar .title:focus { border-color: var(--line); background: var(--panel); }
  .grow { flex: 1; min-width: 0; }
  .ghost { background: transparent; border-color: transparent; color: var(--text-2); display: inline-flex; align-items: center; gap: 6px; }
  .ghost:hover:not(:disabled) { background: var(--panel-2); }
  .danger:hover:not(:disabled) { color: var(--live); }

  .work { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 380px; }
  .previewcol { overflow: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
  .preview { position: relative; width: 100%; border-radius: 8px; overflow: hidden; background: #000; box-shadow: var(--shadow-lift); }
  .editable { user-select: none; touch-action: none; overflow: visible !important; margin-top: 22px; }
  .editable.noarea { margin-top: 0; overflow: hidden !important; }
  .hint { font-size: 12px; color: var(--muted); margin: 0; line-height: 1.5; }

  .links { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
  .linkshead { font-size: 12px; color: var(--muted); margin-bottom: 2px; }
  .link { display: flex; align-items: center; gap: 8px; }
  .link code { flex: 1; min-width: 0; font-size: 12px; color: var(--accent-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* Settings */
  .settings { background: var(--panel); border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
  .tabs { display: flex; gap: 2px; padding: 8px 10px 0; border-bottom: 1px solid var(--line); }
  .tabs button { background: transparent; border: none; border-bottom: 2px solid transparent; border-radius: 0; padding: 8px 10px; font-size: 13px; color: var(--muted); }
  .tabs button:hover { color: var(--text); }
  .tabs button.sel { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }
  .panel { flex: 1; overflow: auto; padding: 4px 18px 20px; }
  .group { padding: 14px 0; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
  .group:last-child { border-bottom: none; }
  h3 { margin: 0; font-size: 12px; font-weight: 600; color: var(--text-2); letter-spacing: 0.02em; }
  small { font-weight: 400; color: var(--muted); font-size: 11.5px; }

  .field { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; align-items: center; gap: 10px; font-size: 13px; }
  .field > span { color: var(--text-2); }
  .field > select, .field > .seg { grid-column: 2 / 4; }
  .field > input[type='color'] { justify-self: start; }
  output { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 3.4em; text-align: right; }
  input[type='range'] { width: 100%; accent-color: var(--accent); }
  input[type='color'] { width: 32px; height: 24px; padding: 0 2px; border: 1px solid var(--line); border-radius: 5px; background: var(--panel); cursor: pointer; }
  .check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text); cursor: pointer; }
  .check input[type='checkbox'] { accent-color: var(--accent); margin: 0; }
  .check.strong { font-weight: 600; }
  .chips { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .seg { display: flex; background: var(--panel-2); border-radius: var(--radius-s); padding: 2px; gap: 2px; }
  .seg button { flex: 1; border: none; background: transparent; padding: 5px 8px; font-size: 12.5px; color: var(--text-2); border-radius: 5px; }
  .seg button.sel { background: var(--panel); color: var(--text); font-weight: 600; box-shadow: var(--shadow); }
  .seg.wide button { padding: 7px 8px; }

  .lang { border: 1px solid var(--line); border-radius: var(--radius); padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
  .langtop { display: flex; align-items: center; gap: 4px; }
  .colnum { width: 20px; height: 20px; border-radius: 50%; background: var(--accent-soft); color: var(--accent-ink); font-size: 11px; font-weight: 700; display: grid; place-items: center; margin-right: 6px; }
  .langstyle { display: flex; align-items: center; gap: 8px; }
  .langstyle select { font-size: 12px; padding: 3px 6px; }
  .icon { background: transparent; border-color: transparent; padding: 4px; color: var(--muted); display: inline-grid; place-items: center; }
  .icon:hover:not(:disabled) { color: var(--text); background: var(--panel-2); }
  .icon:disabled { opacity: 0.3; }
  .addrow { display: flex; flex-wrap: wrap; gap: 6px; }
  .small { font-size: 12px; padding: 4px 9px; display: inline-flex; align-items: center; gap: 4px; }
  .small.sel { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent-ink); }
  .res { display: flex; align-items: center; gap: 8px; }
  .res input { width: 90px; }
  .res span { color: var(--muted); }

  /* Direct manipulation in the preview */
  .areaframe { position: absolute; border: 1px dashed rgba(233, 196, 106, 0.85); pointer-events: none; border-radius: 2px; }
  .grip { position: absolute; left: -1px; top: -22px; pointer-events: auto; cursor: move; font-size: 11px; font-weight: 600; color: #1d1c1a; background: #e9c46a; border-radius: 4px 4px 0 0; padding: 3px 8px; user-select: none; }
  .corner { position: absolute; width: 12px; height: 12px; background: #e9c46a; border: 2px solid #1d1c1a; border-radius: 3px; pointer-events: auto; }
  .corner.nw { left: -7px; top: -7px; cursor: nwse-resize; }
  .corner.se { right: -7px; bottom: -7px; cursor: nwse-resize; }
  .editable:not(.noarea) :global(.num), .editable:not(.noarea) :global(.ckey), .editable:not(.noarea) :global(.credits), .editable:not(.noarea) :global(.body) {
    cursor: ns-resize;
    border-radius: 4px;
    transition: outline-color 120ms;
    outline: 2px solid transparent;
    outline-offset: 4px;
  }
  .editable:not(.noarea) :global(.num:hover), .editable:not(.noarea) :global(.credits:hover), .editable:not(.noarea) :global(.body:hover) { outline-color: rgba(233, 196, 106, 0.6); }

  @media (max-width: 1280px) {
    .work { grid-template-columns: minmax(0, 1fr) 340px; }
    .displays { grid-template-columns: 220px minmax(0, 1fr); }
  }
</style>
