export type LangCode = string;

export interface Song {
  id: string;
  number?: number | null;
  collection?: string;
  /** Short code shown on screen, e.g. "DP". */
  collectionKey?: string;
  title: Record<LangCode, string>;
  author?: string;
  year?: number | null;
  composer?: string;
  copyright?: string;
  key?: string;
  /** Verse keys in play order. "c" is the chorus and MAY repeat. */
  order: string[];
  lyrics: Record<LangCode, Record<string, string[]>>;
}

export interface SongSummary {
  id: string;
  number: number | null;
  collection: string;
  collectionKey: string;
  title: Record<LangCode, string>;
  search: string;
}

export interface Language {
  code: LangCode;
  name: string;
}

export interface LangStyle {
  color: string;
  italic: boolean;
  scale: number;
  weight: number;
}

export interface Profile {
  id: string;
  name: string;
  width: number;
  height: number;
  languages: LangCode[];
  layout: {
    mode: 'columns' | 'stacked';
    ratio: number;
    gap: number;
    padding: number;
    divider: boolean;
    dividerColor: string;
    align: 'top' | 'center' | 'bottom';
    textAlign: 'left' | 'center';
  };
  text: {
    font: string;
    autoFit: boolean;
    size: number;
    maxSize: number;
    minSize: number;
    lineHeight: number;
    shadow: boolean;
    perLanguage: Record<LangCode, LangStyle>;
  };
  header: {
    show: boolean;
    showCollection: boolean;
    showNumber: boolean;
    showTitle: boolean;
    showCredits: boolean;
    numberSize: number;
    creditsSize: number;
    color: string;
    rule: boolean;
    ruleColor: string;
  };
  /** Region used for header + lyrics, in % of the canvas. The background still fills the canvas. */
  area: { x: number; y: number; w: number; h: number };
  background: { type: 'color' | 'transparent'; color: string };
  transitionMs: number;
  showVerseLabel: boolean;
  missingLanguage: 'fallbackSingle' | 'empty';
}

export interface AppState {
  live: { songId: string | null; slideIndex: number; blank: boolean };
  liveSong: Song | null;
  setlist: string[];
  /** Disabled slide indexes per song id. */
  disabled: Record<string, number[]>;
  profiles: Profile[];
  languages: Language[];
  server: { port: number; ips: string[]; hostname: string };
  songsVersion: number;
  stImport: { collections: { id: string; name: string }[]; languages: string[]; lastSync: string | null } | null;
  importStatus: { running: boolean; done: number; total: number; message: string; error: string };
}
