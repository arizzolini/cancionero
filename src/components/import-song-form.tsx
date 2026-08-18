"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSong } from "@/lib/song-library";
import type { ImportSongResponse } from "@/types/song";

type ImportSongFormProps = {
  onImported?: () => void;
};

export function ImportSongForm({ onImported }: ImportSongFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/import-song", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await response.json()) as ImportSongResponse & { error?: string };
      if (!response.ok || !data.song) {
        throw new Error(data.error || "No se pudo importar la canción.");
      }

      await saveSong(data.song);
      setUrl("");
      onImported?.();
      router.push(`/song/${encodeURIComponent(data.song.id)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo importar la canción.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-xl shadow-black/20"
    >
      <label htmlFor="song-url" className="mb-2 block text-sm font-medium text-zinc-300">
        Pegá la URL de Cifra Club
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="song-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.cifraclub.com/artista/cancion/"
          className="min-h-12 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-orange-400"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-12 rounded-2xl bg-orange-500 px-5 text-base font-semibold text-zinc-950 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Importando…" : "Importar"}
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          No buscamos en Cifra Club. Solo importamos la canción cuya URL pegues,
          con atribución al original.
        </p>
      )}
    </form>
  );
}
