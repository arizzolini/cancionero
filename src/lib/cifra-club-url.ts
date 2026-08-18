const ALLOWED_HOSTS = new Set([
  "www.cifraclub.com",
  "cifraclub.com",
  "m.cifraclub.com",
  "www.cifraclub.com.br",
  "cifraclub.com.br",
  "m.cifraclub.com.br",
]);

export function parseCifraClubUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Pegá la URL de una canción de Cifra Club.");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("La URL no es válida.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Solo se permiten URLs HTTPS de Cifra Club.");
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      "Solo se pueden importar canciones desde cifraclub.com o cifraclub.com.br.",
    );
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(
      "La URL debe ser de una canción, por ejemplo https://www.cifraclub.com/artista/cancion/",
    );
  }

  if (parts.some((part) => part === ".." || part.includes("\\"))) {
    throw new Error("La URL de la canción no es válida.");
  }

  url.search = "";
  url.hash = "";
  url.pathname = `/${parts.join("/")}/`;
  return url;
}

export function isAllowedCifraClubUrl(raw: string): boolean {
  try {
    parseCifraClubUrl(raw);
    return true;
  } catch {
    return false;
  }
}

export function songIdFromUrl(url: URL): string {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .join("--")
    .toLowerCase();
}
