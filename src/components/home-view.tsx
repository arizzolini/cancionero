"use client";

import { useCallback, useEffect, useState } from "react";
import { ImportSongForm } from "@/components/import-song-form";
import { SongLibrary } from "@/components/song-library";
import { deleteSong, listSongs } from "@/lib/song-library";
import type { Song } from "@/types/song";

export function HomeView() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const stored = await listSongs();
    setSongs(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listSongs().then((stored) => {
      if (cancelled) return;
      setSongs(stored);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(song: Song) {
    const confirmed = window.confirm(`¿Borrar "${song.title}" de este dispositivo?`);
    if (!confirmed) return;
    await deleteSong(song.id);
    await refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 pb-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-orange-400">
          Cancionero
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Tocá y cantá sin soltar la guitarra
        </h1>
        <p className="max-w-2xl text-base leading-7 text-zinc-400">
          Importá una canción de Cifra Club, guardala en este dispositivo y dejá
          que el micrófono aproxime en qué verso vas. Si el canto no se entiende,
          el auto-scroll y los controles siguen disponibles.
        </p>
      </header>

      <ImportSongForm onImported={() => void refresh()} />
      <SongLibrary songs={songs} loading={loading} onDelete={handleDelete} />

      <aside className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm leading-6 text-zinc-400">
        <p>
          El reconocimiento de voz no guarda audio en la app. En Chrome o Edge el
          navegador puede enviarlo a su propio servicio de transcripción. Las
          canciones quedan solo en este dispositivo.
        </p>
      </aside>
    </div>
  );
}
