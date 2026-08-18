"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  detectVoiceCommand,
  findBestLyricMatch,
  type VoiceCommand,
} from "@/lib/lyric-matcher";
import type { SongLine } from "@/types/song";

type FollowStatus = "idle" | "listening" | "matching" | "unsupported" | "error";

type UseSingingFollowOptions = {
  lines: SongLine[];
  currentIndex: number;
  enabled: boolean;
  onMatch: (lineIndex: number, score: number) => void;
  onCommand: (command: VoiceCommand) => void;
};

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function subscribeSpeechSupport() {
  return () => {};
}

export function useSingingFollow({
  lines,
  currentIndex,
  enabled,
  onMatch,
  onCommand,
}: UseSingingFollowOptions) {
  const [liveStatus, setLiveStatus] = useState<Exclude<FollowStatus, "idle" | "unsupported">>("listening");
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState(0);

  const supported = useSyncExternalStore(
    subscribeSpeechSupport,
    () => Boolean(getSpeechRecognition()),
    () => false,
  );

  const currentIndexRef = useRef(currentIndex);
  const linesRef = useRef(lines);
  const onMatchRef = useRef(onMatch);
  const onCommandRef = useRef(onCommand);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRunRef = useRef(false);
  const lastCommandAtRef = useRef(0);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    linesRef.current = lines;
    onMatchRef.current = onMatch;
    onCommandRef.current = onCommand;
  }, [currentIndex, lines, onMatch, onCommand]);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!enabled || !Recognition) {
      shouldRunRef.current = false;
      recognitionRef.current?.stop();
      return;
    }

    shouldRunRef.current = true;
    const recognition = new Recognition();
    recognition.lang = "es-AR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setLiveStatus("listening");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let heard = "";
      let bestConfidence = 0;
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        heard += ` ${result[0].transcript}`;
        bestConfidence = Math.max(bestConfidence, result[0].confidence || 0);
        if (result.isFinal) isFinal = true;
      }

      heard = heard.trim();
      if (!heard) return;

      setTranscript(heard);
      setConfidence(bestConfidence);

      const command = detectVoiceCommand(heard);
      if (command) {
        const now = Date.now();
        if (now - lastCommandAtRef.current > 1200) {
          lastCommandAtRef.current = now;
          onCommandRef.current(command);
        }
        return;
      }

      const match = findBestLyricMatch(
        heard,
        linesRef.current,
        currentIndexRef.current,
      );

      if (match && (isFinal || match.score >= 0.6)) {
        setLiveStatus("matching");
        onMatchRef.current(match.lineIndex, match.score);
      } else {
        setLiveStatus("listening");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldRunRef.current = false;
        setLiveStatus("error");
        return;
      }
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      setLiveStatus("listening");
    };

    recognition.onend = () => {
      if (shouldRunRef.current) {
        try {
          recognition.start();
        } catch {
          window.setTimeout(() => {
            if (shouldRunRef.current) {
              try {
                recognition.start();
              } catch {
                setLiveStatus("error");
              }
            }
          }, 250);
        }
      }
    };

    try {
      recognition.start();
    } catch {
      window.setTimeout(() => setLiveStatus("error"), 0);
    }

    return () => {
      shouldRunRef.current = false;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onstart = null;
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [enabled]);

  const status: FollowStatus = !enabled
    ? "idle"
    : !supported
      ? "unsupported"
      : liveStatus;

  return { status, transcript, confidence, supported };
}
