import { NextResponse } from "next/server";
import { parseCifraClubSong } from "@/lib/cifra-club-parser";
import { isAllowedCifraClubUrl, parseCifraClubUrl } from "@/lib/cifra-club-url";

export const runtime = "nodejs";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new Error("La página es demasiado grande para importarla.");
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("La página es demasiado grande para importarla.");
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(buffer);
}

async function fetchCifraPage(startUrl: URL): Promise<string> {
  let current = startUrl.toString();

  for (let i = 0; i < MAX_REDIRECTS; i += 1) {
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
        "User-Agent": USER_AGENT,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Cifra Club devolvió una redirección inválida.");
      }
      const nextUrl = new URL(location, current);
      if (!isAllowedCifraClubUrl(nextUrl.toString())) {
        throw new Error("Se bloqueó una redirección fuera de Cifra Club.");
      }
      current = parseCifraClubUrl(nextUrl.toString()).toString();
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Cifra Club respondió ${response.status}. Probá de nuevo en unos minutos.`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error("La respuesta no es una página HTML de Cifra Club.");
    }

    return readLimited(response, MAX_BYTES);
  }

  throw new Error("Demasiadas redirecciones al importar la canción.");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string") {
      return NextResponse.json(
        { error: "Pegá la URL de una canción de Cifra Club." },
        { status: 400 },
      );
    }

    const url = parseCifraClubUrl(body.url);
    const html = await fetchCifraPage(url);
    const song = parseCifraClubSong(html, url.toString());

    return NextResponse.json({ song });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo importar la canción.";

    const status =
      message.includes("Solo se") ||
      message.includes("URL") ||
      message.includes("Pegá")
        ? 400
        : 422;

    return NextResponse.json({ error: message }, { status });
  }
}
