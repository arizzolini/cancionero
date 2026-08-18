"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { searchSongs } from "@/lib/song-library";
import type { Song } from "@/types/song";

type SongLibraryProps = {
  songs: Song[];
  loading: boolean;
  onDelete: (song: Song) => void;
};

export function SongLibrary({ songs, loading, onDelete }: SongLibraryProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => searchSongs(songs, query), [songs, query]);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Tu biblioteca</h2>
          <p className="text-sm text-zinc-400">
            Buscá entre las canciones guardadas en este dispositivo.
          </p>
        </div>
        <span className="rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-300">
          {filtered.length}
        </span>
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="¿Qué quieres tocar?"
        className="min-h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-orange-400"
      />

      {loading ? (
        <p className="text-sm text-zinc-400">Cargando canciones…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-700 px-4 py-10 text-center text-zinc-400">
          {songs.length === 0
            ? "Todavía no hay canciones. Importá una URL para empezar."
            : "No hay coincidencias en tu biblioteca."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {filtered.map((song) => (
            <li key={song.id}>
              <article className="flex items-stretch gap-2 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-2">
                <Link
                  href={`/song/${encodeURIComponent(song.id)}`}
                  className="flex min-h-16 flex-1 flex-col justify-center rounded-2xl px-3 py-2"
                >
                  <h3 className="text-lg font-semibold leading-6 text-zinc-50">
                    {song.title}
                  </h3>
                  <p className="text-sm text-orange-300">{song.artist}</p>
                  {song.key ? (
                    <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                      Tono {song.key}
                    </p>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(song)}
                  className="min-w-16 rounded-2xl px-3 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-300"
                >
                  Borrar
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
