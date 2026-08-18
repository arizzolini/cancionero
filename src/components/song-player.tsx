"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSingingFollow } from "@/hooks/use-singing-follow";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { getSong, saveSong } from "@/lib/song-library";
import type { VoiceCommand } from "@/lib/lyric-matcher";
import type { Song, SongLine } from "@/types/song";

const TEMPO_MS = [8000, 6500, 5200, 4200, 3400, 2700, 2200, 1800, 1500, 1200];

function firstSearchableIndex(lines: SongLine[]): number {
  return lines.findIndex((line) => line.searchable);
}

function nextSearchableIndex(lines: SongLine[], current: number, direction: 1 | -1): number {
  let index = current + direction;
  while (index >= 0 && index < lines.length) {
    if (lines[index].searchable) return index;
    index += direction;
  }
  return current;
}

function statusLabel(
  listening: boolean,
  followStatus: string,
  tempoEnabled: boolean,
  lastMatchAt: number,
): string {
  if (!listening && !tempoEnabled) return "Pausado";
  if (followStatus === "unsupported") return "Sin micrófono: auto-scroll";
  if (followStatus === "error") return "Micrófono no disponible";
  if (listening && Date.now() - lastMatchAt < 5000 && followStatus === "matching") {
    return "Siguiendo tu canto";
  }
  if (listening) return "Escuchando";
  if (tempoEnabled) return "Auto-scroll";
  return "Listo";
}

export function SongPlayer({ songId }: { songId: string }) {
  const router = useRouter();
  const [song, setSong] = useState<Song | null>(null);
  const [missing, setMissing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [tempoEnabled, setTempoEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(110);
  const [tempoSpeed, setTempoSpeed] = useState(5);
  const [lastMatchAt, setLastMatchAt] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [reimporting, setReimporting] = useState(false);
  const [reimportError, setReimportError] = useState<string | null>(null);
  const lineRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    void getSong(songId).then((stored) => {
      if (cancelled) return;
      if (!stored) {
        setMissing(true);
        return;
      }
      setSong(stored);
      const first = firstSearchableIndex(stored.lines);
      setActiveIndex(first === -1 ? 0 : first);
    });
    return () => {
      cancelled = true;
    };
  }, [songId]);

  const onMatch = useCallback((lineIndex: number, score: number) => {
    setActiveIndex(lineIndex);
    setLastMatchAt(Date.now());
    setLastScore(score);
  }, []);

  const onCommand = useCallback((command: VoiceCommand) => {
    if (!song) return;
    if (command === "next") {
      setActiveIndex((current) => nextSearchableIndex(song.lines, current, 1));
      setLastMatchAt(Date.now());
    }
    if (command === "back") {
      setActiveIndex((current) => nextSearchableIndex(song.lines, current, -1));
      setLastMatchAt(Date.now());
    }
    if (command === "pause") {
      setListening(false);
      setTempoEnabled(false);
    }
    if (command === "resume") {
      setListening(true);
      setTempoEnabled(true);
      setLastMatchAt(Date.now());
    }
  }, [song]);

  const follow = useSingingFollow({
    lines: song?.lines ?? [],
    currentIndex: activeIndex,
    enabled: listening,
    onMatch,
    onCommand,
  });

  useWakeLock(listening || tempoEnabled);

  useEffect(() => {
    if (!song || (!listening && !tempoEnabled)) return;
    const intervalMs = TEMPO_MS[tempoSpeed - 1] ?? 2700;
    const timer = window.setInterval(() => {
      const voiceIsLeading = listening && Date.now() - lastMatchAt < 8000;
      if (voiceIsLeading) return;
      setActiveIndex((current) => nextSearchableIndex(song.lines, current, 1));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [song, listening, tempoEnabled, tempoSpeed, lastMatchAt]);

  useEffect(() => {
    const node = lineRefs.current[activeIndex];
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  const modeLabel = useMemo(
    () => statusLabel(listening, follow.status, tempoEnabled, lastMatchAt),
    [listening, follow.status, tempoEnabled, lastMatchAt],
  );

  async function handleReimport() {
    if (!song) return;
    setReimportError(null);
    setReimporting(true);
    try {
      const response = await fetch("/api/import-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: song.sourceUrl }),
      });
      const data = (await response.json()) as { song?: Song; error?: string };
      if (!response.ok || !data.song) {
        throw new Error(data.error || "No se pudo volver a importar.");
      }
      await saveSong(data.song);
      setSong(data.song);
    } catch (error) {
      setReimportError(
        error instanceof Error ? error.message : "No se pudo volver a importar.",
      );
    } finally {
      setReimporting(false);
    }
  }

  if (missing) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">Canción no encontrada</h1>
        <p className="text-zinc-400">
          Esta cifra no está en la biblioteca de este dispositivo.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-zinc-950"
        >
          Volver a la biblioteca
        </button>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-400">
        Cargando canción…
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="text-sm text-orange-300 hover:text-orange-200">
              Biblioteca
            </Link>
            <h1 className="truncate text-xl font-semibold text-zinc-50">{song.title}</h1>
            <p className="truncate text-sm text-orange-300">{song.artist}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {song.key ? `Tono ${song.key} · ` : ""}
              Fuente:{" "}
              <a
                href={song.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-zinc-600 underline-offset-2"
              >
                Cifra Club
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleReimport()}
            disabled={reimporting}
            className="rounded-2xl border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
          >
            {reimporting ? "Actualizando…" : "Reimportar"}
          </button>
        </div>
        {reimportError ? (
          <p className="mx-auto mt-2 max-w-3xl text-sm text-red-300">{reimportError}</p>
        ) : null}
      </header>

      <div
        className="mx-auto w-full max-w-3xl flex-1 px-4 pb-48 pt-6"
        style={{ fontSize: `${fontSize}%` }}
      >
        {song.lines.map((line, index) => {
          const active = index === activeIndex && line.searchable;
          return (
            <div
              key={line.id}
              ref={(node) => {
                lineRefs.current[index] = node;
              }}
              role={line.searchable ? "button" : undefined}
              tabIndex={line.searchable ? 0 : undefined}
              onKeyDown={(event) => {
                if (!line.searchable) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveIndex(index);
                  setLastMatchAt(Date.now());
                }
              }}
              onClick={() => {
                if (line.searchable) {
                  setActiveIndex(index);
                  setLastMatchAt(Date.now());
                }
              }}
              className={`rounded-2xl px-2 py-1 font-mono whitespace-pre-wrap leading-7 ${
                active
                  ? "bg-orange-500/15 ring-1 ring-orange-400/70"
                  : line.searchable
                    ? "cursor-pointer hover:bg-zinc-900"
                    : "text-zinc-500"
              }`}
            >
              {line.kind === "section" ? (
                <div className="text-sm font-sans font-semibold uppercase tracking-wide text-zinc-400">
                  {line.raw.trim()}
                </div>
              ) : null}
              {line.chords ? (
                <div className="text-orange-400">{line.chords}</div>
              ) : null}
              {line.lyrics ? (
                <div className={active ? "text-zinc-50" : "text-zinc-200"}>{line.lyrics}</div>
              ) : null}
              {line.kind === "tab" ? (
                <div className="overflow-x-auto text-xs text-zinc-500">{line.raw}</div>
              ) : null}
              {line.kind === "blank" ? <div className="h-3" /> : null}
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium text-zinc-200">{modeLabel}</p>
            <p className="truncate text-zinc-500">
              {follow.supported
                ? follow.transcript
                  ? `Te oí: ${follow.transcript}`
                  : "Di “asistente siguiente” o “asistente pausa”"
                : "Usá Chrome o Edge para el micrófono"}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setActiveIndex((current) => nextSearchableIndex(song.lines, current, -1))}
              className="min-h-12 rounded-2xl bg-zinc-800 text-base font-semibold"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={() => {
                const next = !listening;
                setListening(next);
                if (next) {
                  setTempoEnabled(true);
                  setLastMatchAt(Date.now());
                }
              }}
              className={`min-h-12 rounded-2xl text-base font-semibold ${
                listening ? "bg-emerald-500 text-zinc-950" : "bg-orange-500 text-zinc-950"
              }`}
            >
              {listening ? "Mic. on" : "Mic. off"}
            </button>
            <button
              type="button"
              onClick={() => setTempoEnabled((value) => !value)}
              className={`min-h-12 rounded-2xl text-base font-semibold ${
                tempoEnabled ? "bg-zinc-100 text-zinc-950" : "bg-zinc-800"
              }`}
            >
              Scroll
            </button>
            <button
              type="button"
              onClick={() => setActiveIndex((current) => nextSearchableIndex(song.lines, current, 1))}
              className="min-h-12 rounded-2xl bg-zinc-800 text-base font-semibold"
            >
              Sig.
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-zinc-400">
              Texto {fontSize}%
              <input
                type="range"
                min={90}
                max={180}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                className="mt-1 w-full accent-orange-400"
              />
            </label>
            <label className="text-sm text-zinc-400">
              Velocidad {tempoSpeed}
              <input
                type="range"
                min={1}
                max={10}
                value={tempoSpeed}
                onChange={(event) => setTempoSpeed(Number(event.target.value))}
                className="mt-1 w-full accent-orange-400"
              />
            </label>
          </div>
          {lastScore > 0 ? (
            <p className="text-xs text-zinc-500">
              Confianza de coincidencia: {Math.round(lastScore * 100)}%
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
