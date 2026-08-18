import { describe, expect, it } from "vitest";
import { parseCifraClubSong, parseCifraLines } from "@/lib/cifra-club-parser";
import { parseCifraClubUrl, songIdFromUrl } from "@/lib/cifra-club-url";

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="es-ES">
<head>
  <title>La Noche Sin Ti - Los Huayra - Cifra Club</title>
  <meta property="og:title" content="La Noche Sin Ti - Los Huayra - Cifra Club" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":["MusicRecording","Article"],"name":"Los Huayra - La Noche Sin Ti","url":"https://www.cifraclub.com/los-huayra/la-noche-sin-ti/","byArtist":{"@type":"MusicGroup","name":"Los Huayra"}}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicComposition","name":"La Noche Sin Ti"}</script>
</head>
<body>
  <span>Tono<!-- -->: </span> <button type="button" data-anchor="--chord-tone">E</button>
  <article data-chord-container="true">
    <pre class="_crVx" data-chord-content="true">
<div class="kvMV">[Intro] <b data-chord-name="E">E</b>  <b data-chord-name="E/B">E/B</b>  <b data-chord-name="E">E</b>  <b data-chord-name="E/B">E/B</b>
</div><div class="kvMV"><b data-chord-name="E">E</b>                                  <b data-chord-name="C#m">C#m</b>
  Vuelve a despertar la lluvia en mi
</div><div class="kvMV">                      <b data-chord-name="G#m">G#m</b>
Derramanado toda su raiz
</div><div class="kvMV">            <b data-chord-name="A">A</b>
Sobre el papel
</div><div class="kvMV">[Estribillo]
</div><div class="kvMV"><b data-chord-name="E">E</b>
  Y me siento solo con mi voz
</div><div class="kvMV"><b data-chord-name="C#m">C#m</b>                        <b data-chord-name="G#m">G#m</b>
    No descubro como sucedio
</div>
    </pre>
  </article>
</body>
</html>`;

describe("parseCifraClubUrl", () => {
  it("acepta una URL HTTPS de Cifra Club y genera un id estable", () => {
    const url = parseCifraClubUrl(
      "https://www.cifraclub.com/los-huayra/la-noche-sin-ti/?utm=1#verso",
    );
    expect(url.hostname).toBe("www.cifraclub.com");
    expect(url.search).toBe("");
    expect(songIdFromUrl(url)).toBe("los-huayra--la-noche-sin-ti");
  });

  it("rechaza hosts que no son Cifra Club", () => {
    expect(() => parseCifraClubUrl("https://example.com/los-huayra/la-noche-sin-ti/")).toThrow(
      /cifraclub/i,
    );
  });
});

describe("parseCifraClubSong", () => {
  it("extrae título, artista, tono y versos desde el HTML actual de Cifra Club", () => {
    const song = parseCifraClubSong(
      FIXTURE_HTML,
      "https://www.cifraclub.com/los-huayra/la-noche-sin-ti/",
    );

    expect(song.title).toBe("La Noche Sin Ti");
    expect(song.artist).toBe("Los Huayra");
    expect(song.key).toBe("E");
    expect(song.sourceName).toBe("Cifra Club");

    const lyrics = song.lines
      .filter((line) => line.searchable)
      .map((line) => line.lyrics?.trim());

    expect(lyrics).toContain("Vuelve a despertar la lluvia en mi");
    expect(lyrics).toContain("Y me siento solo con mi voz");

    const intro = song.lines.find((line) => line.chords?.includes("E/B"));
    expect(intro?.searchable).toBe(false);

    const firstLyric = song.lines.find((line) =>
      line.lyrics?.includes("Vuelve a despertar"),
    );
    expect(firstLyric?.chords).toMatch(/E/);
    expect(firstLyric?.chords).toMatch(/C#m/);
  });

  it("falla con un HTML que no tiene cifra", () => {
    const html = `<html><head><title>Tema - Artista - Cifra Club</title>
      <script type="application/ld+json">{"@type":"MusicComposition","name":"Tema"}</script>
      <script type="application/ld+json">{"@type":"MusicRecording","name":"Artista - Tema","byArtist":{"name":"Artista"}}</script>
      </head><body><h1>Tema</h1></body></html>`;
    expect(() =>
      parseCifraClubSong(html, "https://www.cifraclub.com/a/b/"),
    ).toThrow(/cifra/i);
  });
});

describe("parseCifraLines", () => {
  it("mantiene tabs fuera del seguimiento", () => {
    const lines = parseCifraLines(`[Solo]
E|---12------12------|
  Esta linea si se canta
B|------12------12---|`);

    expect(lines.some((line) => line.kind === "tab")).toBe(true);
    expect(lines.filter((line) => line.searchable).map((line) => line.lyrics?.trim())).toEqual([
      "Esta linea si se canta",
    ]);
  });
});
