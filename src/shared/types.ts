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
  /** Header style on audience displays. "full" (default) follows the display profile. */
  header?: SongHeader;
  /** Verse keys in play order. "c" is the chorus and MAY repeat. */
  order: string[];
  lyrics: Record<LangCode, Record<string, string[]>>;
  /** Set on a medley: the parts in play order. Empty keys means the whole song. */
  medley?: MedleyPart[];
  /** Resolved by the server for a medley. Index matches the "<part>:" prefix of each slide key. */
  parts?: (SongMeta | undefined)[];
  /** Sung language per verse key. "*" applies to the whole song. Set on the live song only. */
  sung?: Record<string, LangCode>;
}

export type SongHeader = 'full' | 'title' | 'none';

export interface MedleyPart {
  songId: string;
  keys: string[];
}

export type SongMeta = Pick<Song, 'title' | 'number' | 'collection' | 'collectionKey' | 'author' | 'year' | 'composer' | 'copyright' | 'key' | 'header'> & { songId: string };

export interface SongSummary {
  id: string;
  number: number | null;
  collection: string;
  collectionKey: string;
  title: Record<LangCode, string>;
  medley: boolean;
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
  /** "confidence" is the singers' view: current + next verse. */
  mode?: 'audience' | 'confidence';
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
    /** Each lyric line stays on one line. Fit shrinks the text to the widest line. */
    noWrap: boolean;
    size: number;
    maxSize: number;
    minSize: number;
    lineHeight: number;
    shadow: boolean;
    /** Colour for every column after the first. Empty uses the language's own colour. */
    secondaryColor: string;
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
  /** Show operator notes and line marks. Off by default. */
  showNotes: boolean;
  /** Singers' view goes black with Blank. Otherwise it dims and shows a badge. */
  blankWithScreens: boolean;
  missingLanguage: 'fallbackSingle' | 'empty';
}

export interface AppState {
  live: { songId: string | null; slideIndex: number; blank: boolean };
  liveSong: Song | null;
  setlist: string[];
  setlistName: string;
  savedSetlists: { id: string; name: string; ids: string[] }[];
  /** Disabled slide indexes per song id. */
  disabled: Record<string, number[]>;
  /** Operator annotations per song id, then verse key. Kept off the song so re-imports keep them. */
  notes: Record<string, Record<string, VerseNote>>;
  /** Sung-language overrides per song id, then verse key or "*". */
  sung: Record<string, Record<string, LangCode>>;
  /** Text size each display fitted to, in px. */
  fitted?: Record<string, number>;
  /** Marks a line click cycles through. */
  markPresets: string[];
  profiles: Profile[];
  languages: Language[];
  server: { port: number; ips: string[]; hostname: string };
  songsVersion: number;
  stImport: { collections: { id: string; name: string }[]; languages: string[]; lastSync: string | null } | null;
  importStatus: { running: boolean; done: number; total: number; message: string; error: string };
  /** SongTreasures band session being followed. `available` needs a sign-in and imported songs. */
  stSession?: {
    available: boolean;
    code: string;
    error: string;
    suggestion: { songId: string | null; number: number; collection: string; title: string; updatedAt: string | null } | null;
  };
}

export interface VerseNote {
  text: string;
  /** Mark per line index, e.g. "Solo". */
  marks: Record<number, string>;
  /** Free-text comment per line index. Shown beside the line, after its mark. */
  comments?: Record<number, string>;
}
