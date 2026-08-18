import { describe, expect, it } from "vitest";
import type { SongLine } from "@/types/song";
import {
  detectVoiceCommand,
  findBestLyricMatch,
  normalizeText,
} from "@/lib/lyric-matcher";

function lyric(id: string, text: string): SongLine {
  return {
    id,
    kind: "lyric",
    raw: text,
    lyrics: text,
    searchable: true,
  };
}

const lines: SongLine[] = [
  lyric("0", "Vuelve a despertar la lluvia en mi"),
  lyric("1", "Derramanado toda su raiz"),
  lyric("2", "Sobre el papel"),
  lyric("3", "Y me siento solo con mi voz"),
  lyric("4", "No descubro como sucedio"),
  lyric("5", "Perder tu amor"),
  lyric("6", "Y me siento solo con mi voz"),
];

describe("normalizeText", () => {
  it("quita acentos y puntuación", () => {
    expect(normalizeText("Estás aquí!")).toBe("estas aqui");
  });
});

describe("detectVoiceCommand", () => {
  it("reconoce órdenes deliberadas", () => {
    expect(detectVoiceCommand("asistente siguiente por favor")).toBe("next");
    expect(detectVoiceCommand("Asistente atrás")).toBe("back");
    expect(detectVoiceCommand("asistente pausa")).toBe("pause");
    expect(detectVoiceCommand("asistente seguir")).toBe("resume");
  });

  it("no toma la letra de la canción como orden", () => {
    expect(detectVoiceCommand("vuelve a despertar la lluvia")).toBeNull();
  });
});

describe("findBestLyricMatch", () => {
  it("empareja un fragmento correcto", () => {
    const match = findBestLyricMatch(
      "Vuelve a despertar la lluvia en mi",
      lines,
      0,
    );
    expect(match?.lineIndex).toBe(0);
    expect(match?.score).toBeGreaterThan(0.7);
  });

  it("acepta un fragmento incompleto del verso actual", () => {
    const match = findBestLyricMatch("despierta la lluvia", lines, 0);
    expect(match?.lineIndex).toBe(0);
  });

  it("avanza a un verso cercano cuando el actual ya no coincide", () => {
    const match = findBestLyricMatch("sobre el papel", lines, 0);
    expect(match?.lineIndex).toBe(2);
  });

  it("se queda en el estribillo actual y no salta al repetido", () => {
    const match = findBestLyricMatch(
      "Y me siento solo con mi voz",
      lines,
      3,
    );
    expect(match?.lineIndex).toBe(3);
  });

  it("usa la repetición siguiente cuando ya se pasó el primer estribillo", () => {
    const match = findBestLyricMatch(
      "Y me siento solo con mi voz",
      lines,
      5,
    );
    expect(match?.lineIndex).toBe(6);
  });

  it("no salta con palabras erróneas", () => {
    const match = findBestLyricMatch("banana manzana perro casa", lines, 0);
    expect(match).toBeNull();
  });
});
