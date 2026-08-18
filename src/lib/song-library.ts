import type { Song } from "@/types/song";

const DB_NAME = "cancionero";
const STORE_NAME = "songs";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listSongs(): Promise<Song[]> {
  const db = await openDatabase();
  const songs = await requestToPromise(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
  );
  db.close();
  return songs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await openDatabase();
  const song = await requestToPromise(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id),
  );
  db.close();
  return song as Song | undefined;
}

export async function saveSong(song: Song): Promise<void> {
  const db = await openDatabase();
  const existing = (await requestToPromise(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(song.id),
  )) as Song | undefined;

  const toSave: Song = existing
    ? { ...song, importedAt: existing.importedAt, updatedAt: Date.now() }
    : song;

  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(toSave),
  );
  db.close();
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDatabase();
  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id),
  );
  db.close();
}

export function searchSongs(songs: Song[], query: string): Song[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return songs;
  return songs.filter((song) => {
    const haystack = `${song.title} ${song.artist} ${song.key ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
}
