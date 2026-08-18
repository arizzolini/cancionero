export type SongLineKind = "section" | "lyric" | "chords" | "tab" | "blank";

export type SongLine = {
  id: string;
  kind: SongLineKind;
  raw: string;
  chords?: string;
  lyrics?: string;
  sectionLabel?: string;
  searchable: boolean;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  key: string | null;
  sourceUrl: string;
  sourceName: "Cifra Club";
  lines: SongLine[];
  importedAt: number;
  updatedAt: number;
};

export type ImportSongResponse = {
  song: Song;
};

export type ImportSongError = {
  error: string;
};
