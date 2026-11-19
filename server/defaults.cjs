const langStyle = (color, italic = false, scale = 1) => ({ color, italic, scale, weight: 500 });

function baseProfile(overrides) {
  return {
    id: 'display',
    name: 'Display',
    width: 1920,
    height: 1080,
    languages: ['pl'],
    layout: {
      mode: 'columns',
      ratio: 0.5,
      gap: 96,
      padding: 48,
      divider: true,
      dividerColor: '#ffffff26',
      align: 'top',
      textAlign: 'left',
    },
    text: {
      font: "'Inter Variable', 'Segoe UI', Arial, sans-serif",
      autoFit: true,
      size: 56,
      maxSize: 96,
      minSize: 16,
      lineHeight: 1.45,
      shadow: true,
      secondaryColor: '#cfcfcf',
      perLanguage: {
        pl: langStyle('#ffffff'),
        no: langStyle('#e9c46a'),
      },
    },
    header: {
      show: true,
      showCollection: true,
      showNumber: true,
      showTitle: false,
      showCredits: true,
      numberSize: 64,
      creditsSize: 20,
      color: '#ffffff',
      rule: true,
      ruleColor: '#ffffff40',
    },
    area: { x: 0, y: 0, w: 100, h: 100 },
    background: { type: 'color', color: '#111111' },
    transitionMs: 0,
    showVerseLabel: true,
    missingLanguage: 'fallbackSingle',
    ...overrides,
  };
}

const profiles = () => [
  // The LED wall reaches the floor. Text stays in the upper part, readable above the stage.
  baseProfile({
    id: 'led-wall',
    name: 'LED wall (PL | NO)',
    width: 2048,
    height: 1024,
    languages: ['pl', 'no'],
    area: { x: 5, y: 4, w: 90, h: 60 },
  }),
  baseProfile({
    id: 'stage',
    name: 'Stage projector',
    languages: ['pl'],
    background: { type: 'color', color: '#000000' },
    layout: { ...baseProfile({}).layout, padding: 80 },
    text: { ...baseProfile({}).text, maxSize: 120 },
    header: { ...baseProfile({}).header, numberSize: 110, creditsSize: 28 },
  }),
];

const languages = () => [
  { code: 'pl', name: 'Polski' },
  { code: 'no', name: 'Norsk' },
];

const state = () => ({
  live: { songId: null, slideIndex: 0, blank: false },
  setlist: [],
  disabled: {},
  profiles: profiles(),
  languages: languages(),
});

// Demo songs. Texts are original placeholders, not taken from any hymnbook.
function demo(collection, collectionKey, number, titlePl, titleNo, verses) {
  const order = verses.map((_, i) => String(i + 1));
  const pick = (k) => Object.fromEntries(verses.map((v, i) => [String(i + 1), v[k]]).filter(([, v]) => v));
  return {
    id: `demo-${collectionKey}-${number}`,
    collection,
    collectionKey,
    number,
    title: { pl: titlePl, no: titleNo },
    author: 'Demo Author',
    year: 2026,
    composer: 'Demo melody',
    copyright: 'Demo',
    key: 'G',
    order,
    lyrics: { pl: pick('pl'), no: pick('no') },
  };
}

const songs = () => [
  demo('Demo Pieśni', 'DM', 1, 'Poranna pieśń', 'Morgensang', [
    { pl: ['Budzi się dzień, wschodzi nowe światło,', 'serce me śpiewa na nowo dziś.', 'Chwała Ci, Panie, za każdy dzień.'],
      no: ['Dagen står opp, et nytt lys bryter frem,', 'mitt hjerte synger på ny i dag.', 'Ære til deg, Herre, for hver dag.'] },
    { pl: ['Prowadź mnie drogą, którą Ty znasz,', 'niech Twoja łaska otacza mnie.'],
      no: ['Led meg på veien som du kjenner,', 'la din nåde omslutte meg.'] },
    { pl: ['A gdy wieczór przyjdzie znów,', 'w Tobie spokój znajdę swój.'],
      no: ['Og når kvelden kommer igjen,', 'finner jeg min fred i deg.'] },
  ]),
  demo('Demo Pieśni', 'DM', 2, 'Wieczorna modlitwa', 'Kveldsbønn', [
    { pl: ['Gdy zapada zmrok,', 'spokój daj mi swój.'], no: ['Når det blir kveld,', 'gi meg din fred.'] },
    { pl: ['Czuwaj nad mym snem,', 'bądź mi tarczą, Panie.'], no: ['Våk over min søvn,', 'vær mitt skjold, Herre.'] },
    { pl: ['A gdy wstanie świt,', 'niech Cię wielbię znów.'] },
  ]),
  demo('Demo Dodatek', 'DD', 1, 'Pieśń drogi', 'Veiens sang', [
    { pl: ['Idę naprzód krok za krokiem,', 'Ty prowadzisz mnie.'], no: ['Jeg går fremover steg for steg,', 'du leder meg.'] },
    { pl: ['Nie boję się, bo jesteś ze mną,', 'w każdy nowy dzień.'], no: ['Jeg frykter ikke, for du er med meg,', 'hver eneste dag.'] },
  ]),
];

module.exports = { baseProfile, state, songs };
