const langStyle = (color, italic = false, scale = 1) => ({ color, italic, scale, weight: 600 });

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
      gap: 64,
      padding: 72,
      divider: true,
      dividerColor: '#ffffff33',
      align: 'top',
      textAlign: 'left',
    },
    text: {
      font: "'Inter Variable', 'Segoe UI', Arial, sans-serif",
      autoFit: true,
      size: 56,
      maxSize: 84,
      minSize: 18,
      lineHeight: 1.3,
      shadow: true,
      perLanguage: {
        pl: langStyle('#ffffff'),
        no: langStyle('#f2cf6b'),
      },
    },
    header: {
      show: true,
      showCollection: true,
      showNumber: true,
      showTitle: false,
      showCredits: true,
      numberSize: 150,
      creditsSize: 38,
      color: '#ffffff',
      rule: true,
      ruleColor: '#ffffff66',
    },
    background: { type: 'color', color: '#111111' },
    transitionMs: 250,
    showVerseLabel: true,
    missingLanguage: 'fallbackSingle',
    ...overrides,
  };
}

const profiles = () => [
  baseProfile({ id: 'led-wall', name: 'LED wall (PL | NO)', width: 2048, height: 1024, languages: ['pl', 'no'] }),
  baseProfile({
    id: 'stage',
    name: 'Stage projector',
    languages: ['pl'],
    background: { type: 'color', color: '#000000' },
    text: { ...baseProfile({}).text, maxSize: 110 },
    header: { ...baseProfile({}).header, numberSize: 120, creditsSize: 32 },
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
