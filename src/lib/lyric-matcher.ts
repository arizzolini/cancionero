import type { SongLine } from "@/types/song";

export type VoiceCommand = "next" | "back" | "pause" | "resume";

export type MatchResult = {
  lineIndex: number;
  score: number;
};

const COMMANDS: Array<{ phrase: string; command: VoiceCommand }> = [
  { phrase: "asistente siguiente", command: "next" },
  { phrase: "asistente adelante", command: "next" },
  { phrase: "asistente atras", command: "back" },
  { phrase: "asistente detras", command: "back" },
  { phrase: "asistente anterior", command: "back" },
  { phrase: "asistente pausa", command: "pause" },
  { phrase: "asistente pausar", command: "pause" },
  { phrase: "asistente parar", command: "pause" },
  { phrase: "asistente seguir", command: "resume" },
  { phrase: "asistente continua", command: "resume" },
  { phrase: "asistente continuar", command: "resume" },
];

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter((word) => word.length > 1);
}

export function detectVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = normalizeText(transcript);
  for (const item of COMMANDS) {
    if (normalized.includes(item.phrase)) {
      return item.command;
    }
  }
  return null;
}

function longestCommonSubsequence(a: string[], b: string[]): number {
  const rows = a.length;
  const cols = b.length;
  if (rows === 0 || cols === 0) return 0;

  const previous = new Array<number>(cols + 1).fill(0);
  const current = new Array<number>(cols + 1).fill(0);

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    for (let j = 0; j <= cols; j += 1) {
      previous[j] = current[j];
      current[j] = 0;
    }
  }

  return previous[cols];
}

function tokensRelated(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) {
    return true;
  }
  return false;
}

function countHits(heard: string[], lineTokens: string[]): number {
  return lineTokens.filter((token) =>
    heard.some((word) => tokensRelated(word, token)),
  ).length;
}

export function scoreLine(heard: string[], lineTokens: string[]): number {
  if (heard.length === 0 || lineTokens.length === 0) return 0;

  const hits = countHits(heard, lineTokens);
  const coverage = hits / lineTokens.length;
  const sequence =
    longestCommonSubsequence(heard, lineTokens) / lineTokens.length;
  const heardCoverage =
    heard.filter((word) => lineTokens.some((token) => tokensRelated(word, token)))
      .length / heard.length;

  return coverage * 0.35 + sequence * 0.35 + heardCoverage * 0.3;
}

function minRequiredHits(lineTokens: string[], heard: string[]): number {
  const n = Math.min(lineTokens.length, Math.max(heard.length, 1));
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  return 3;
}

export function findBestLyricMatch(
  transcript: string,
  lines: SongLine[],
  currentIndex: number,
  options?: { windowAhead?: number; minScore?: number },
): MatchResult | null {
  const windowAhead = options?.windowAhead ?? 8;
  const minScore = options?.minScore ?? 0.45;
  const heard = tokenize(transcript).slice(-10);

  if (heard.length === 0) return null;

  const searchable = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.searchable && tokenize(line.lyrics ?? "").length > 0);

  if (searchable.length === 0) return null;

  const currentSearchPos = searchable.findIndex(({ index }) => index >= currentIndex);
  const startPos = Math.max(0, (currentSearchPos === -1 ? 0 : currentSearchPos) - 1);
  const endPos = Math.min(
    searchable.length - 1,
    (currentSearchPos === -1 ? 0 : currentSearchPos) + windowAhead,
  );

  const candidates = searchable.slice(startPos, endPos + 1).map(({ line, index }) => {
    const tokens = tokenize(line.lyrics ?? "");
    const hits = countHits(heard, tokens);
    return {
      index,
      tokens,
      hits,
      score: scoreLine(heard, tokens),
    };
  });

  const currentCandidate = candidates.find((item) => item.index === currentIndex);
  if (
    currentCandidate &&
    currentCandidate.score >= minScore &&
    currentCandidate.hits >= minRequiredHits(currentCandidate.tokens, heard)
  ) {
    const betterAhead = candidates.find(
      (item) =>
        item.index > currentIndex &&
        item.score >= currentCandidate.score + 0.25 &&
        item.hits >= minRequiredHits(item.tokens, heard),
    );
    if (!betterAhead) {
      return { lineIndex: currentIndex, score: currentCandidate.score };
    }
  }

  const forward = candidates
    .filter(
      (item) =>
        item.index >= currentIndex &&
        item.score >= minScore &&
        item.hits >= minRequiredHits(item.tokens, heard),
    )
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (forward[0]) {
    return { lineIndex: forward[0].index, score: forward[0].score };
  }

  const previous = candidates.find((item) => item.index === currentIndex - 1);
  if (
    previous &&
    previous.score >= Math.max(minScore, 0.7) &&
    previous.hits >= minRequiredHits(previous.tokens, heard)
  ) {
    return { lineIndex: previous.index, score: previous.score };
  }

  return null;
}
