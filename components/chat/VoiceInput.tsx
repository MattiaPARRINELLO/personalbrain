"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";

interface VoiceInputProps {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function VoiceInput({ onResult, onInterim, onListeningChange, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // onResult/onInterim sont souvent des closures inline qui changent à chaque
  // render : on les garde dans des refs pour ne recréer le SpeechRecognition
  // qu'une seule fois.
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onListeningChangeRef = useRef(onListeningChange);
  useEffect(() => {
    onResultRef.current = onResult;
    onInterimRef.current = onInterim;
    onListeningChangeRef.current = onListeningChange;
  }, [onResult, onInterim, onListeningChange]);

  const setListeningState = (v: boolean) => {
    setListening(v);
    onListeningChangeRef.current?.(v);
  };

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "fr-FR";
    // Dictée continue : plusieurs phrases à la suite, avec texte intermédiaire
    // affiché en direct pendant que l'utilisateur parle.
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0]?.transcript ?? "";
        if (res.isFinal) final += transcript + " ";
        else interim = transcript;
      }
      if (interim) onInterimRef.current?.(interim.trim());
      const finalTrimmed = final.trim();
      if (finalTrimmed) onResultRef.current(finalTrimmed);
    };

    recognition.onerror = () => {
      setListeningState(false);
    };

    recognition.onend = () => {
      setListeningState(false);
      onInterimRef.current?.("");
    };

    recognitionRef.current = recognition;
    return () => {
      // Arrêter proprement la reconnaissance au démontage (sinon le micro
      // reste actif et l'instance fuit).
      try {
        recognition.abort();
      } catch {
        // Pas en cours d'écoute.
      }
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListeningState(false);
    } else {
      try {
        recognitionRef.current.start();
        setListeningState(true);
      } catch {
        setListeningState(false);
      }
    }
  }, [listening]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={disabled}
      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${
        listening
          ? "bg-[var(--danger)]/20 text-[var(--danger)] animate-pulse"
          : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-3)]"
      }`}
      title={listening ? "Arrêter l'écoute" : "Commande vocale"}
    >
      {listening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
