import type { Song, SongLine } from "@/types/song";
import { songIdFromUrl } from "@/lib/cifra-club-url";

const CHORD_TOKEN =
  /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?(?:[0-9]+)?(?:sus[24])?(?:\([0-9]+\))?(?:\/[A-G](?:#|b)?)?$/;

const TAB_LINE = /(?:^\s*[EADGBEeadgbe]\|)|(?:\|[-xX0-9hHpPbBrRsS/~]+)/;
const SECTION_LINE = /^\[[^\]]+\]/;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, ""));
}

function matchAttribute(html: string, regex: RegExp): string | null {
  const match = html.match(regex);
  return match?.[1]?.trim() || null;
}

function extractJsonLd(html: string): Array<Record<string, unknown>> {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  const parsed: Array<Record<string, unknown>> = [];

  for (const block of blocks) {
    try {
      const value = JSON.parse(block[1]) as unknown;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object") {
            parsed.push(item as Record<string, unknown>);
          }
        }
      } else if (value && typeof value === "object") {
        parsed.push(value as Record<string, unknown>);
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return parsed;
}

function typeIncludes(value: unknown, typeName: string): boolean {
  if (typeof value === "string") return value === typeName;
  if (Array.isArray(value)) return value.includes(typeName);
  return false;
}

function extractTitleAndArtist(html: string): { title: string; artist: string } {
  const jsonLd = extractJsonLd(html);
  const composition = jsonLd.find((item) => typeIncludes(item["@type"], "MusicComposition"));
  const recording = jsonLd.find((item) => typeIncludes(item["@type"], "MusicRecording"));

  const compositionTitle =
    typeof composition?.name === "string" ? composition.name.trim() : null;
  const recordingName =
    typeof recording?.name === "string" ? recording.name.trim() : null;
  const byArtist = recording?.byArtist;
  const artistFromLd =
    byArtist &&
    typeof byArtist === "object" &&
    typeof (byArtist as { name?: unknown }).name === "string"
      ? ((byArtist as { name: string }).name.trim())
      : null;

  const ogTitle = matchAttribute(
    html,
    /property="og:title"[^>]*content="([^"]+)"/i,
  ) || matchAttribute(html, /content="([^"]+)"[^>]*property="og:title"/i);

  const pageTitle = matchAttribute(html, /<title>([^<]+)<\/title>/i);
  const heading = matchAttribute(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);

  let title =
    compositionTitle ||
    stripTags(heading || "") ||
    (ogTitle ? ogTitle.split(" - ")[0] : "") ||
    (pageTitle ? pageTitle.split(" - ")[0] : "");

  let artist =
    artistFromLd ||
    "";

  if (!artist && recordingName?.includes(" - ")) {
    artist = recordingName.split(" - ")[0].trim();
  }
  if (!artist && ogTitle) {
    const parts = ogTitle.replace(/\s+-\s+Cifra Club$/i, "").split(" - ");
    if (parts.length >= 2) artist = parts[1].trim();
  }
  if (!artist && pageTitle) {
    const parts = pageTitle.replace(/\s+-\s+Cifra Club$/i, "").split(" - ");
    if (parts.length >= 2) artist = parts[1].trim();
  }

  title = title.trim();
  artist = artist.trim();

  if (!title || !artist) {
    throw new Error(
      "No se pudo leer el título o el artista. Cifra Club puede haber cambiado su página.",
    );
  }

  return { title, artist };
}

function extractKey(html: string): string | null {
  const fromButton = html.match(
    /Tono(?:<!-- -->)?:\s*<\/span>\s*<button[^>]*>([^<]+)<\/button>/i,
  );
  if (fromButton?.[1]) return fromButton[1].trim();

  const plain = stripTags(html.replace(/<!--[\s\S]*?-->/g, ""));
  const fromText = plain.match(/Tono:\s*([A-G](?:#|b)?m?)/i);
  return fromText?.[1] ?? null;
}

function extractPreInnerHtml(html: string): string {
  const withFlag = html.match(
    /<pre[^>]*data-chord-content[^>]*>([\s\S]*?)<\/pre>/i,
  );
  if (withFlag?.[1]) return withFlag[1];

  const anyPre = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)]
    .map((match) => match[1])
    .sort((a, b) => b.length - a.length)[0];

  if (!anyPre || anyPre.replace(/<[^>]+>/g, "").trim().length < 20) {
    throw new Error(
      "No se encontró la cifra de la canción. Cifra Club puede haber cambiado su página.",
    );
  }

  return anyPre;
}

function htmlToPlainCifra(innerHtml: string): string {
  return decodeEntities(
    innerHtml
      .replace(/<\/div>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n");
}

function isChordToken(token: string): boolean {
  return CHORD_TOKEN.test(token);
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const withoutSection = tokens.map((token) => token.replace(SECTION_LINE, "")).filter(Boolean);
  if (withoutSection.length === 0) return SECTION_LINE.test(line.trim());
  const chordCount = withoutSection.filter(isChordToken).length;
  return chordCount > 0 && chordCount / withoutSection.length >= 0.7;
}

function isTabLine(line: string): boolean {
  return TAB_LINE.test(line) || /^\s*Parte \d+/i.test(line);
}

function isLyricLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isTabLine(trimmed) || isChordLine(trimmed)) return false;
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(trimmed);
}

function sectionLabelFrom(line: string): string | undefined {
  const match = line.match(SECTION_LINE);
  return match?.[0];
}

export function parseCifraLines(plain: string): SongLine[] {
  const rawLines = plain.split("\n");
  const lines: SongLine[] = [];
  let pendingChords: string | null = null;
  let pendingSection: string | undefined;
  let index = 0;

  const push = (line: Omit<SongLine, "id">) => {
    lines.push({ ...line, id: `line-${index}` });
    index += 1;
  };

  const flushChords = () => {
    if (pendingChords === null) return;
    const label = sectionLabelFrom(pendingChords) ?? pendingSection;
    push({
      kind: "chords",
      raw: pendingChords,
      chords: pendingChords.trim() ? pendingChords : undefined,
      sectionLabel: label,
      searchable: false,
    });
    pendingChords = null;
    pendingSection = undefined;
  };

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\u00a0/g, " ");
    const trimmed = line.trim();

    if (!trimmed) {
      flushChords();
      if (lines.length === 0 || lines[lines.length - 1].kind !== "blank") {
        push({ kind: "blank", raw: "", searchable: false });
      }
      continue;
    }

    if (isTabLine(line)) {
      flushChords();
      push({ kind: "tab", raw: line, searchable: false });
      continue;
    }

    if (SECTION_LINE.test(trimmed) && !isLyricLine(trimmed.replace(SECTION_LINE, ""))) {
      flushChords();
      if (isChordLine(trimmed)) {
        pendingChords = line;
        pendingSection = sectionLabelFrom(trimmed);
      } else {
        push({
          kind: "section",
          raw: line,
          sectionLabel: sectionLabelFrom(trimmed),
          searchable: false,
        });
      }
      continue;
    }

    if (isChordLine(line)) {
      flushChords();
      pendingChords = line;
      pendingSection = sectionLabelFrom(line);
      continue;
    }

    if (isLyricLine(line)) {
      push({
        kind: "lyric",
        raw: line,
        chords: pendingChords?.trim() ? pendingChords : undefined,
        lyrics: line,
        sectionLabel: pendingSection ?? sectionLabelFrom(pendingChords ?? ""),
        searchable: true,
      });
      pendingChords = null;
      pendingSection = undefined;
      continue;
    }

    flushChords();
    push({
      kind: "chords",
      raw: line,
      chords: line,
      searchable: false,
    });
  }

  flushChords();
  return lines.filter((line, i, all) => {
    if (line.kind !== "blank") return true;
    return i !== 0 && i !== all.length - 1;
  });
}

export function parseCifraClubSong(html: string, sourceUrl: string): Song {
  if (!html.includes("<") || html.length < 200) {
    throw new Error("La respuesta de Cifra Club no parece una página de canción.");
  }

  const { title, artist } = extractTitleAndArtist(html);
  const key = extractKey(html);
  const plain = htmlToPlainCifra(extractPreInnerHtml(html));
  const lines = parseCifraLines(plain);
  const searchableCount = lines.filter((line) => line.searchable).length;

  if (searchableCount < 2) {
    throw new Error(
      "La canción se importó, pero no se encontraron suficientes versos para seguir la letra.",
    );
  }

  const url = new URL(sourceUrl);
  const now = Date.now();

  return {
    id: songIdFromUrl(url),
    title,
    artist,
    key,
    sourceUrl: url.toString(),
    sourceName: "Cifra Club",
    lines,
    importedAt: now,
    updatedAt: now,
  };
}
